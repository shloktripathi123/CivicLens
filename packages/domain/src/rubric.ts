// Civic Lens source credibility rubric. A grade depends only on properties of the source,
// never on what a particular claim says, so it cannot be tilted toward a viewpoint.
export const RUBRIC_VERSION = 1;

export type Score = 0 | 1 | 2;
export type Grade = "A" | "B" | "C" | "D";
export type CriterionKey =
  | "primaryRecord" | "authorship" | "editorial" | "independence" | "verifiability" | "currency";

export const CRITERIA: Array<{ key: CriterionKey; label: string; question: string; scores: [string, string, string] }> = [
  { key: "primaryRecord", label: "Primary record", question: "Is it the official record, or a copy of it?",
    scores: ["Secondhand or unsourced", "Derived from an official record", "The official record itself"] },
  { key: "authorship", label: "Authorship transparency", question: "Does it say who produced the information?",
    scores: ["Anonymous", "Organization named, people not", "Named agency or authors"] },
  { key: "editorial", label: "Editorial process", question: "Is there a published review or corrections process?",
    scores: ["None known", "Informal or community review", "Published review or corrections policy"] },
  { key: "independence", label: "Independence", question: "Is the publisher free of a stake in the subject?",
    scores: ["Self-published by the subject", "Interested party, disclosed", "Independent of the subject"] },
  { key: "verifiability", label: "Verifiability", question: "Can each fact be traced to a specific page or record?",
    scores: ["No link to a record", "General link only", "Exact record link per fact"] },
  { key: "currency", label: "Currency", question: "Is it updated on a known schedule?",
    scores: ["Unknown or stale", "Irregular updates", "Regular, dated updates"] },
];

export type Criteria = Record<CriterionKey, Score>;
export interface Rating { grade: Grade; total: number; max: number; lowerCredibility: boolean; criteria: Criteria }

export function gradeFor(total: number): Grade {
  return total >= 10 ? "A" : total >= 8 ? "B" : total >= 5 ? "C" : "D";
}

export function rate(criteria: Criteria): Rating {
  const total = CRITERIA.reduce((n, c) => n + criteria[c.key], 0);
  const grade = gradeFor(total);
  return { grade, total, max: CRITERIA.length * 2, lowerCredibility: grade === "C" || grade === "D", criteria };
}

export const GRADE_MEANING: Record<Grade, string> = {
  A: "Official or near-official record with strong traceability.",
  B: "Reliable, with one or two limits (for example derived from an official record).",
  C: "Lower credibility: shown because it is the best available, but verify it independently.",
  D: "Low credibility: shown for completeness only; treat as unverified.",
};

export function explain(r: Rating): string {
  return CRITERIA.map((c) => `${c.label}: ${c.scores[r.criteria[c.key]]}`).join("; ");
}
