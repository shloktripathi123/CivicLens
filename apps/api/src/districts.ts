export interface Districts { upper?: string; lower?: string; congress?: string }

const cache = new Map<string, Districts | null>();

const clean = (s: string | undefined) => s?.trim().replace(/^0+(?=\d)/, "").toLowerCase();

/** Looks up the legislative and congressional districts at a point using the free Census Geocoder. Cached; null on failure. */
export async function districtsAt(lat: number, lon: number): Promise<Districts | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: Districts | null = null;
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const g = ((await res.json()) as { result?: { geographies?: Record<string, Array<{ BASENAME?: string }>> } }).result?.geographies ?? {};
      const pick = (re: RegExp) => clean(Object.entries(g).find(([k]) => re.test(k))?.[1]?.[0]?.BASENAME);
      out = { upper: pick(/Legislative Districts - Upper/), lower: pick(/Legislative Districts - Lower/), congress: pick(/Congressional Districts/) };
    }
  } catch { out = null; }
  if (out) cache.set(key, out);
  return out;
}

interface Official { body: string; district: string | null; level: string }

/** Keeps officials whose district matches the point; statewide offices stay. Falls back to everyone if names don't line up. */
export function narrowOfficials<T extends Official>(list: T[], d: Districts | null | undefined, kind: "state" | "federal"): { items: T[]; narrowed: boolean } {
  if (!d) return { items: list, narrowed: false };
  const want = (o: T): string | undefined => {
    if (kind === "federal") return /House/i.test(o.body) ? d.congress : undefined;
    if (!o.district) return undefined;
    return /Senate/i.test(o.body) ? d.upper : /Legislature|House|Assembly/i.test(o.body) ? d.lower : undefined;
  };
  const items = list.filter((o) => {
    const w = want(o);
    const own = o.district ? clean(o.district) : undefined;
    if (w === undefined) return !(kind === "federal" ? /House/i.test(o.body) : !!o.district && /Senate|Legislature|House|Assembly/i.test(o.body));
    return own === w || (own?.endsWith(" " + w) ?? false);
  });
  const matched = list.some((o) => want(o) !== undefined && items.includes(o));
  return matched ? { items, narrowed: true } : { items: list, narrowed: false };
}
