import { normalizeName } from "./index.ts";

export type PlaceType = "state" | "county" | "city" | "zip";

export interface StateInfo { usps: string; fips: string; name: string }

export const STATES: StateInfo[] = [
  ["AL", "01", "Alabama"], ["AK", "02", "Alaska"], ["AZ", "04", "Arizona"], ["AR", "05", "Arkansas"],
  ["CA", "06", "California"], ["CO", "08", "Colorado"], ["CT", "09", "Connecticut"], ["DE", "10", "Delaware"],
  ["DC", "11", "District of Columbia"], ["FL", "12", "Florida"], ["GA", "13", "Georgia"], ["HI", "15", "Hawaii"],
  ["ID", "16", "Idaho"], ["IL", "17", "Illinois"], ["IN", "18", "Indiana"], ["IA", "19", "Iowa"],
  ["KS", "20", "Kansas"], ["KY", "21", "Kentucky"], ["LA", "22", "Louisiana"], ["ME", "23", "Maine"],
  ["MD", "24", "Maryland"], ["MA", "25", "Massachusetts"], ["MI", "26", "Michigan"], ["MN", "27", "Minnesota"],
  ["MS", "28", "Mississippi"], ["MO", "29", "Missouri"], ["MT", "30", "Montana"], ["NE", "31", "Nebraska"],
  ["NV", "32", "Nevada"], ["NH", "33", "New Hampshire"], ["NJ", "34", "New Jersey"], ["NM", "35", "New Mexico"],
  ["NY", "36", "New York"], ["NC", "37", "North Carolina"], ["ND", "38", "North Dakota"], ["OH", "39", "Ohio"],
  ["OK", "40", "Oklahoma"], ["OR", "41", "Oregon"], ["PA", "42", "Pennsylvania"], ["RI", "44", "Rhode Island"],
  ["SC", "45", "South Carolina"], ["SD", "46", "South Dakota"], ["TN", "47", "Tennessee"], ["TX", "48", "Texas"],
  ["UT", "49", "Utah"], ["VT", "50", "Vermont"], ["VA", "51", "Virginia"], ["WA", "53", "Washington"],
  ["WV", "54", "West Virginia"], ["WI", "55", "Wisconsin"], ["WY", "56", "Wyoming"],
  ["AS", "60", "American Samoa"], ["GU", "66", "Guam"], ["MP", "69", "Northern Mariana Islands"],
  ["PR", "72", "Puerto Rico"], ["VI", "78", "U.S. Virgin Islands"],
].map(([usps, fips, name]) => ({ usps, fips, name }));

const BY_USPS = new Map(STATES.map((s) => [s.usps, s]));
const BY_FIPS = new Map(STATES.map((s) => [s.fips, s]));
const BY_NAME = new Map(STATES.map((s) => [normalizeName(s.name), s]));

export const stateByUsps = (u: string) => BY_USPS.get(u.toUpperCase());
export const stateByFips = (f: string) => BY_FIPS.get(f);
export const stateByName = (n: string) => BY_NAME.get(normalizeName(n));

export const isZip = (s: string) => /^\d{5}$/.test(s.trim());

const ABBREV: Record<string, string> = { st: "saint", ste: "sainte", ft: "fort", mt: "mount", twp: "township" };

/** Normalize a place name: lowercase, no punctuation, "St." -> "saint", "Ft." -> "fort", "Mt." -> "mount". */
export function normalizePlaceName(s: string): string {
  return normalizeName(s).split(" ").map((t) => ABBREV[t] ?? t).join(" ");
}

const SUFFIX_RE = /\s+(city and borough|consolidated government|metropolitan government|unified government|urban county|zona urbana|municipality|comunidad|plantation|township|borough|village|parish|county|town|city|cdp)$/i;
const COUNTY_WORDS = new Set(["county", "parish", "borough"]);

/** Strip the Census legal-status suffix ("Portland city" -> "Portland", "Multnomah County" -> "Multnomah"). */
export function displayName(label: string): string {
  const base = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const stripped = base.replace(SUFFIX_RE, "");
  return stripped || base;
}

export interface PlaceQuery {
  /** Remaining name tokens after removing a trailing state and type words. */
  tokens: string[];
  state?: string;
  type?: PlaceType;
}

/**
 * Split a query like "portland oregon", "St. Louis, MO" or "multnomah county" into name tokens plus
 * optional state and type hints. Hints are only extracted while at least one name token remains.
 */
export function parsePlaceQuery(q: string): PlaceQuery {
  let toks = normalizePlaceName(q).split(" ").filter(Boolean);
  let state: string | undefined;
  let type: PlaceType | undefined;
  if (toks.length > 1) {
    const last = toks[toks.length - 1];
    const two = toks.length > 2 ? toks.slice(-2).join(" ") : "";
    const twoState = two ? stateByName(two) : undefined;
    if (twoState) { state = twoState.usps; toks = toks.slice(0, -2); }
    else {
      const s = BY_NAME.get(last) ?? (last.length === 2 ? BY_USPS.get(last.toUpperCase()) : undefined);
      if (s) { state = s.usps; toks = toks.slice(0, -1); }
    }
  }
  if (toks.length > 1) {
    const last = toks[toks.length - 1];
    if (COUNTY_WORDS.has(last)) { type = "county"; toks = toks.slice(0, -1); }
    else if (last === "city" || last === "town" || last === "village") { type = "city"; toks = toks.slice(0, -1); }
  }
  return { tokens: toks, state, type };
}

export const placeId = (type: PlaceType, key: string) => `${type}:${key}`;

export interface PlaceSummary {
  id: string; type: PlaceType; name: string; label: string; state: string; stateName: string;
  approximate: boolean;
}
