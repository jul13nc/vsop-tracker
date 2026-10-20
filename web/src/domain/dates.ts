/** "14 novembre 2026" from an ISO yyyy-mm-dd date (server date, no timezone drift). */
export function formatGamedayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
