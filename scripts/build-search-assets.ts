import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { allPersonMeta, allSearchNames, getSummaries, listSources, linkStatus } from "@civic/db";

async function main() {
  const root = resolve(process.cwd());
  const db = new DatabaseSync(resolve(root, "data/civic.db"), { readOnly: true });
  db.exec("PRAGMA query_only = ON");

  try {
    const names = allSearchNames(db).map(({ personId, nameNorm }) => ({ personId, nameNorm }));
    const metadata = allPersonMeta(db);
    const summaries = getSummaries(db, metadata.map(({ id }) => id));
    const summariesById = Object.fromEntries(summaries.map((person) => [person.id, person]));
    const people = Object.fromEntries(metadata.flatMap((meta) => {
      const person = summariesById[meta.id];
      return person ? [[meta.id, { meta, person }]] : [];
    }));
    const places = db.prepare(`SELECT id,type,name,label,name_norm,state,approximate
      FROM place ORDER BY id`).all() as Array<{id:string;type:string;name:string;label:string;name_norm:string;state:string;approximate:number}>;
    const namesByLetter = new Map<string, typeof names>();
    const peopleByLetter = new Map<string, Record<string, (typeof people)[string]>>();
    const placesByLetter = new Map<string, typeof places>();
    const personNamesById = new Map<string, Set<string>>();
    for (const name of names) {
      const letters = new Set(name.nameNorm.split(" ").map((word) => word[0]).filter(Boolean));
      for (const letter of letters) {
        const bucket = namesByLetter.get(letter) ?? [];
        bucket.push(name);
        namesByLetter.set(letter, bucket);
        const ids = personNamesById.get(name.personId) ?? new Set<string>();
        ids.add(letter);
        personNamesById.set(name.personId, ids);
      }
    }
    for (const [id, letters] of personNamesById) {
      for (const letter of letters) {
        const bucket = peopleByLetter.get(letter) ?? {};
        bucket[id] = people[id];
        peopleByLetter.set(letter, bucket);
      }
    }
    for (const place of places) {
      const letters = new Set(place.name_norm.split(" ").map((word) => word[0]).filter(Boolean));
      for (const letter of letters) {
        const bucket = placesByLetter.get(letter) ?? [];
        bucket.push(place);
        placesByLetter.set(letter, bucket);
      }
    }

    const outputDirectory = resolve(root, "apps/api/static");
    await mkdir(outputDirectory, { recursive: true });
    const oldFiles = await readdir(outputDirectory);
    await Promise.all(oldFiles
      .filter((file) => file === "search-index.json" || file === "people-search.json" || file === "place-search.json" ||
        /^people-search-[a-z0-9]\.json$/.test(file) || /^place-search-[a-z0-9]\.json$/.test(file) || file === "office-search.json")
      .map((file) => unlink(resolve(outputDirectory, file))));
    const writes: Promise<void>[] = [];
    for (const letter of "abcdefghijklmnopqrstuvwxyz0123456789") {
      writes.push(writeFile(resolve(outputDirectory, `people-search-${letter}.json`), JSON.stringify({
        names: namesByLetter.get(letter) ?? [],
        people: peopleByLetter.get(letter) ?? {},
      })));
      writes.push(writeFile(resolve(outputDirectory, `place-search-${letter}.json`), JSON.stringify({
        places: placesByLetter.get(letter) ?? [],
      })));
    }
    const officePeople = Object.fromEntries(metadata.flatMap((meta) =>
      meta.candidate && people[meta.id] ? [[meta.id, people[meta.id]]] : []));
    writes.push(writeFile(resolve(outputDirectory, "office-search.json"), JSON.stringify({ people: officePeople })));
    const sources = listSources(db).map((source) => ({
      ...source,
      link: linkStatus(db, source.url),
    }));
    writes.push(writeFile(resolve(outputDirectory, "sources.json"), JSON.stringify({ items: sources })));
    await Promise.all(writes);
    const assetCount = writes.length;
    console.log(`Built ${assetCount} search assets from ${names.length} names, ${metadata.length} people, ${places.length} places`);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error("Could not build search snapshot", error);
  process.exitCode = 1;
});
