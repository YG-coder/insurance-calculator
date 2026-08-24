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

  // ── 통원 회당 보험금 지급 한도 ──────────────────────────────────────
  //   값     : 200,000원. 급여·비급여 동일. 외래와 처방조제비를 합산한 1회 기준.
  //   성격   : **보험금 지급액의 상한**이지 보상대상 의료비의 상한이 아니다.
  //            자기부담금(정률·최소공제)을 먼저 공제한 뒤 이 한도를 적용한다.
  //   대상   : 통원만. 입원에는 회당 한도가 없다.
  //   적용 세대 : 4세대 (2021.07~)
  //   검증 상태 : CONFIRMED — 급여·비급여 약관 원문 2건 교차 확인 (2026-08-24)
  //   근거 1 (비급여) : KDB생명 「(무)비급여실손의료비특약」 약관, 판매일 2024.01.01
  //                     제5조③ "통원 1회당 20만원 이내에서 회사가 정한 금액"
  //                     제3조(1)① "…에서 〈표1〉의 '항목별 공제금액'을 뺀 금액"
  //     http://www.kdblife.com/nKumhoFiles/data_pdf/arrangement/2024/I20659_20240101_(%EB%AC%B4)%EB%B9%84%EA%B8%89%EC%97%AC%EC%8B%A4%EC%86%90%EC%9D%98%EB%A3%8C%EB%B9%84%ED%8A%B9%EC%95%BD_%EC%95%BD%EA%B4%80_V03.pdf
  //   근거 2 (급여)   : ABL생명 「무배당 급여실손의료비보장보험(갱신형)(계약전환용)」
  //                     약관, 판매일 2022.09.01. 제6조⑤ 통원 1회당 20만원 한도.
  //                     공제금액을 먼저 뺀 뒤 한도를 적용한다.
  //     https://abllife.co.kr/cms/pban/prdtPban/whlPrdt/__icsFiles/afieldfile/2022/09/01/20220901_NP_%EA%B8%89%EC%97%AC%EC%8B%A4%EC%86%90%EC%9D%98%EB%A3%8C%EB%B9%84%EB%B3%B4%EC%9E%A5%EB%B3%B4%ED%97%98%28%EA%B0%B1%EC%8B%A0%ED%98%95%29%28%EA%B3%84%EC%95%BD%EC%A0%84%ED%99%98%EC%9A%A9%29.pdf
  //   재검토 : 표준약관 개정 시
  outpatientPerVisitLimit: 200000,
} as const;

// ── 4세대에서 확인되었으나 이번 엔진이 적용하지 않는 한도 ──────────────
//   1건 계산기의 입력 모델(ClaimInput)로는 표현할 수 없다. 결과에 미적용 사실을 명시한다.
//   검증 상태 : CONFIRMED (위 근거 1·2와 동일 출처)
//
//   ⚠ 적용 범위를 반드시 구분한다. 급여 청구에 적용되지 않는 제한을 급여 결과에
//     안내하면 사용자가 자신에게도 적용되는 것으로 오인한다.
//
//   ⚠ 급여 통원에는 연간 횟수 한도가 없다. 급여 약관의 "90회"는 계약 종료 후 계속 중인
//     통원을 추가 보상하는 특수 규정이며 일반 한도가 아니다. 상수화 금지.
export const GEN2021_NOT_APPLIED = {
  // 급여·비급여, 입원·통원 전부 해당.
  //   (상해/질병) × (급여/비급여) 각 축의 연간 한도이며 축 안에서 입원·통원이 합산 소진된다.
  all: ["연간 보상한도 5,000만원(상해·질병별 보장 안에서 입원·통원 합산)"],

  // 비급여 전용. 약관상 항목별 한도이며 입원·통원을 구분해 규정하지 않는다.
  nonBenefit: ["3대비급여 항목별 한도(도수 350만·주사 250만·MRI 300만)"],

  // 비급여 통원 전용. 약관 문언이 "통원 100회"로 통원을 명시한다.
  nonBenefitOutpatient: ["비급여 통원 연간 100회 한도(계약해당일 기준 1년)"],
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
