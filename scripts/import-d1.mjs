import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import readline from "node:readline";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dbPath = resolve(root, "data/civic.db");
const tempDir = await mkdtemp(join(tmpdir(), "civic-lens-d1-"));
const dumpPath = join(tempDir, "civic-lens.sql");

function decodeUnistr(content) {
  const source = content.replace(/''/g, "'");
  let decoded = "";
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "\\" || i + 1 === source.length) {
      decoded += source[i];
      continue;
    }

    const escape = source[++i];
    if (escape === "\\" || escape === "'") {
      decoded += escape;
    } else if (escape === "u" || escape === "U") {
      const length = escape === "u" ? 4 : 8;
      const digits = source.slice(i + 1, i + 1 + length);
      if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits)) {
        throw new Error(`Invalid Unicode escape in unistr(): \\${escape}${digits}`);
      }
      const codePoint = Number.parseInt(digits, 16);
      decoded += escape === "u" ? String.fromCharCode(codePoint) : String.fromCodePoint(codePoint);
      i += length;
    } else {
      decoded += `\\${escape}`;
    }
  }
  return `'${decoded.replace(/'/g, "''")}'`;
}

try {
  const sqlite = spawn("sqlite3", [dbPath, ".dump"], { stdio: ["ignore", "pipe", "inherit"] });
  const sqliteClosed = once(sqlite, "close");
  const lines = readline.createInterface({ input: sqlite.stdout, crlfDelay: Infinity });
  const output = createWriteStream(dumpPath, { encoding: "utf8" });
  for await (const line of lines) {
    if (/^PRAGMA /.test(line) || line === "BEGIN TRANSACTION;" || line === "COMMIT;") continue;
    const compatible = line.replace(/unistr\('((?:[^']|'')*)'\)/g, (_match, content) => decodeUnistr(content));
    if (!output.write(`${compatible}\n`)) await once(output, "drain");
  }
  const sqliteExit = await sqliteClosed;
  output.end();
  await once(output, "close");
  if (sqliteExit[0] !== 0) throw new Error(`sqlite3 dump exited with status ${sqliteExit[0]}`);

  const importResult = spawnSync("npx", [
    "wrangler", "d1", "execute", "civic-lens-db", "--remote",
    `--file=${dumpPath}`, "--config", "apps/api/wrangler.jsonc",
  ], { cwd: root, stdio: "inherit" });
  if (importResult.error) throw importResult.error;
  if (importResult.status !== 0) process.exitCode = importResult.status ?? 1;
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
