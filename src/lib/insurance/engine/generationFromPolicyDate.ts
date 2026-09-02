// 최초 계약일 → 실손 세대 구분.
//
// 이 경계일은 "어느 계산기를 안내할지" 판단하는 가입시기 구분값이며 계산 상수가 아니다.
//   - PRE_STANDARD: 실손 표준약관 제정 이전(흔히 1세대). 상품마다 보장이 달라
//     인용 가능한 표준약관 근거가 없으므로 계산 경로를 제공하지 않는다.
//   - 2009: 표준화 실손(2세대)  / 2017: 착한실손(3세대)
//   - 2021: 4세대              / 2026: 5세대
export type PolicyGeneration = "PRE_STANDARD" | "2009" | "2017" | "2021" | "2026" | "INVALID";

export function generationFromPolicyDate(date: string): PolicyGeneration {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return "INVALID";
  }
  if (date >= "2026-05-06") return "2026";
  if (date >= "2021-07-01") return "2021";
  if (date >= "2017-04-01") return "2017";
  if (date >= "2009-10-01") return "2009";
  return "PRE_STANDARD";
}
