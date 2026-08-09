import { Coverage, Tier } from "./types";

// ─────────────────────────────────────────────
// 4세대 (generation 2021) — 현행 배포 로직 재현. 회귀 기준선.
// ─────────────────────────────────────────────
export const GEN2021 = {
  rate: { benefit: 0.2, non_benefit: 0.3 } as Record<Coverage, number>,
  outpatientMinDeductible: {
    benefit: { clinic: 10000, hospital: 20000 } as Record<Tier, number>,
    non_benefit: 30000, // 의료기관 구분 없음
  },
} as const;

// ─────────────────────────────────────────────
// 5세대 (generation 2026) — v0.4 기준.
//   값이 박힌 것 = 금융위 원문 직독 A 확정만.
//   minDeductible: null = #3 REVIEW(미확정) → 코드 금지, 원문 직독 대기.
// ─────────────────────────────────────────────
export const GEN2026 = {
  benefit: {
    inpatientRate: 0.2, // #1 A: 급여 입원 20%
    outpatient: {
      floorRate: 0.2,   // #2 A: 최저 20% (구조: Max(건보율, 20%, 최소공제))
      minDeductible: null as null | Record<Tier, number>, // #3 REVIEW → HOLD
    },
  },
  nonBenefit: {
    critical: {                       // 특약1 (중증) — 전부 A
      inpatientRate: 0.30,            // #4·5
      outpatientRate: 0.30,          // #4·5
      outpatientMinDeductible: 30000, // #4·5 Max(30%, 3만)
      outpatientPerVisitLimit: 200000, // #4·5 통원 회당 20만(보험지급 한도)
      annualLimit: 50000000,          // #4·5 연 5천만(연간 지급 한도)
      annualOwnPayCap: 5000000,       // #6 상급종합·종합 입원 자기부담 상한 500만(연 누적)
    },
    nonCritical: {                    // 특약2 (비중증) — 전부 A
      inpatientRate: 0.50,           // #7·9
      outpatientRate: 0.50,          // #7·9
      outpatientMinDeductible: 50000, // #7·9 Max(50%, 5만)
      inpatientPerVisitLimit: 3000000, // #8 입원 회당 300만(보험지급 한도)
      outpatientPerDayLimit: 200000,   // #8 통원 일당 20만(보험지급 한도)
      annualLimit: 10000000,          // #7·9 연 1천만(연간 지급 한도)
    },
  },
};
