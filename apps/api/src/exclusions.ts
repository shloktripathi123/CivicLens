import type { DB } from "@civic/db";
import { hiddenTargets } from "@civic/db";

// FR-025: categories that are never displayed, even when a source supplies them.
export const EXCLUSIONS = [
  { category: "home-address", description: "Home addresses of officials and candidates", reason: "Safety: only official offices and campaign contact details are shown.", keys: ["homeAddress", "residence", "residentialAddress"] },
  { category: "personal-contact", description: "Personal phone numbers and email addresses", reason: "Privacy and safety: only official or campaign contact is shown.", keys: ["personalPhone", "personalEmail", "cellPhone", "homePhone"] },
  { category: "family-and-minors", description: "Information about minors or family members who are not themselves public figures", reason: "Privacy and child safety.", keys: ["childrenNames", "spouse", "familyMembers", "minors", "relatives"] },
  { category: "government-id", description: "Government identification numbers", reason: "Identity theft risk.", keys: ["ssn", "socialSecurityNumber", "driversLicense", "passportNumber", "taxId"] },
  { category: "financial-account", description: "Bank or other financial account details", reason: "Fraud risk. Campaign finance totals from regulators are not affected.", keys: ["bankAccount", "accountNumber", "routingNumber", "creditCard"] },
  { category: "health", description: "Health and medical details", reason: "Privacy.", keys: ["health", "medicalHistory", "diagnosis"] },
  { category: "unsupported-allegation", description: "Criminal allegations that do not come from a court or other legal record", reason: "Defamation risk. Court-record allegations may be shown with case status.", keys: ["allegations", "allegation"] },
] as const;

const KEYS = new Set(EXCLUSIONS.flatMap((e) => e.keys as readonly string[]));
const LEGAL_STATUS = new Set(["charged", "convicted", "dismissed", "acquitted"]);

function isLegalRecord(v: unknown): boolean {
  return !!v && typeof v === "object" && "caseStatus" in v && LEGAL_STATUS.has(String((v as { caseStatus: unknown }).caseStatus)) && "recordUrl" in v;
}

export function excludedKeys(): string[] { return [...KEYS]; }

/** Removes excluded fields and any item hidden pending a report, at any depth. */
export function sanitize<T>(value: T, hidden: Set<string>): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v
        .filter((x) => !(x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" && hidden.has((x as { id: string }).id)))
        .filter((x) => !(x && typeof x === "object" && "allegation" in x && !isLegalRecord(x)))
        .map(walk);
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (KEYS.has(k) && !(Array.isArray(x) && x.every(isLegalRecord) && (k === "allegations" || k === "allegation"))) continue;
        out[k] = walk(x);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

export function hiddenSet(db: DB) { return hiddenTargets(db); }
