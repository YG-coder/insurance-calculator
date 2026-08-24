export type PolicyGeneration = "LEGACY" | "2021" | "2026" | "INVALID";

export function generationFromPolicyDate(date: string): PolicyGeneration {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return "INVALID";
  }
  if (date >= "2026-05-06") return "2026";
  if (date >= "2021-07-01") return "2021";
  return "LEGACY";
}
