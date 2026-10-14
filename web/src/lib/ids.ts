/** Make a human-readable, url-safe slug id from a name. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Gameday id = "<seasonId>-<date>" e.g. "2026-2027-2026-11-14". */
export function gamedayId(seasonId: string, date: string): string {
  return `${seasonId}-${date}`;
}
