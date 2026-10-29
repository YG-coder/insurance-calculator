/**
 * 사람이 검토한 마지막 내용 수정일. 빌드일·규정 대조일을 대신 넣지 않는다.
 * watch는 수정일 재검토 대상이며, 변경의 의미를 자동 판정하지 않는다.
 * 가이드는 기존 Guide.updated가 정본이다.
 */
export type ContentDate = {
  updated: string;
  watch: readonly string[];
  ignore?: readonly { sha: string; reason: string }[];
};

const SHARE_IMAGE_ONLY = {
  sha: "0d7047891b1bcdc21d95cc5efaf2f32ac8da15f2",
  reason: "공유 이미지 누락 보완. 해당 허브의 설명·단계·FAQ는 변경하지 않았다.",
};
const SOCIAL_URL_ONLY = {
  sha: "b8678d28cfdbd6679394c599e20a59397fe903e8",
  reason: "페이지별 공유 주소 명시. 정책 본문은 변경하지 않았다.",
};
const DISPLAY_ORIGIN_ONLY = {
  sha: "eefe5457d84cc5d656bf9a70236c60347fa5d46c",
  reason: "주소 정본과 표시 분리. 소개 본문의 운영 목적·계산 방식은 변경하지 않았다.",
};

const calculatorWatch = [
  "src/lib/insurance/common/**",
  "src/components/AmountInput.tsx",
  "src/components/RawAmountInput.tsx",
  "src/components/ResultCard.tsx",
  "src/components/calculators/choiceGroup.ts",
  "src/components/calculators/focusAfterUpdate.ts",
  "src/lib/calculator-content.ts",
  "src/components/CalculatorDetails.tsx",
] as const;

function calculator(path: string, component: string, engine: string): ContentDate {
  return {
    // 2026-10-29: 계산 기준·출처 또는 입력값 계산 범위와 문맥 링크를 추가했다.
    updated: "2026-10-29",
    watch: ["src/app" + path + "/page.tsx", component, engine, ...calculatorWatch],
  };
}

function silson(path: string, components: readonly string[]): ContentDate {
  return {
    updated: "2026-10-29",
    watch: [
      "src/app" + path + "/page.tsx",
      ...components,
      "src/components/calculators/PolicyGenerationGuide.tsx",
      // 세대별 상수·출처가 공유 파일에 있다. 다른 세대만의 변경은 사유를 기록해 예외 처리한다.
      "src/lib/insurance/engine/**",
      "src/lib/regulatory-basis.ts",
      "src/lib/regulatory-hold-copy.ts",
      "src/components/RegulatoryBasis.tsx",
      ...calculatorWatch,
    ],
  };
}

export const CONTENT_DATES: Record<string, ContentDate> = {
  "/": {
    updated: "2026-10-29",
    watch: ["src/app/page.tsx"],
  },
  "/about": {
    updated: "2026-10-02",
    watch: ["src/app/about/page.tsx"],
    ignore: [SOCIAL_URL_ONLY, DISPLAY_ORIGIN_ONLY],
  },
  "/privacy": {
    updated: "2026-10-02",
    watch: ["src/app/privacy/page.tsx"],
    ignore: [SOCIAL_URL_ONLY],
  },
  "/terms": {
    updated: "2026-04-28",
    watch: ["src/app/terms/page.tsx"],
    ignore: [SOCIAL_URL_ONLY],
  },
  "/disclaimer": {
    updated: "2026-10-29",
    watch: ["src/app/disclaimer/page.tsx"],
  },
  "/guide": {
    updated: "2026-10-29",
    watch: ["src/app/guide/page.tsx"],
  },
  ...Object.fromEntries(["insurance-cancellation", "protection-planning", "silson-guide"].map((slug) => [
    "/" + slug,
    {
      // 9/29: 구조화 데이터를 수집 가능한 서버 HTML로 출력한 변경.
      updated: "2026-09-29",
      watch: ["src/app/" + slug + "/page.tsx"],
      ignore: [SHARE_IMAGE_ONLY],
    },
  ])),
  "/health-insurance-calculator": silson("/health-insurance-calculator", [
    "src/components/calculators/HealthCalc.tsx",
    "src/components/calculators/HealthCalcMulti2021.tsx",
  ]),
  "/2nd-3rd-generation-health-insurance-calculator": silson("/2nd-3rd-generation-health-insurance-calculator", [
    "src/components/calculators/HealthCalcStandardized.tsx",
  ]),
  "/5th-generation-health-insurance-calculator": silson("/5th-generation-health-insurance-calculator", [
    "src/components/calculators/HealthCalc5th.tsx",
    "src/components/calculators/HealthCalcMulti2026.tsx",
  ]),
  "/surrender-value-calculator": calculator("/surrender-value-calculator",
    "src/components/calculators/HealthSurrenderCalc.tsx", "src/lib/insurance/decision/surrenderValue.ts"),
  "/future-premium-calculator": calculator("/future-premium-calculator",
    "src/components/calculators/FuturePremiumCalc.tsx", "src/lib/insurance/decision/futurePremium.ts"),
  "/cancel-vs-keep-calculator": calculator("/cancel-vs-keep-calculator",
    "src/components/calculators/CancelVsKeepCalc.tsx", "src/lib/insurance/decision/cancelVsKeep.ts"),
  "/coverage-gap-calculator": calculator("/coverage-gap-calculator",
    "src/components/calculators/CoverageGapCalc.tsx", "src/lib/insurance/decision/coverageGap.ts"),
  "/death-coverage-calculator": calculator("/death-coverage-calculator",
    "src/components/calculators/DeathCoverageCalc.tsx", "src/lib/insurance/decision/deathCoverage.ts"),
  "/family-living-calculator": calculator("/family-living-calculator",
    "src/components/calculators/FamilyLivingCalc.tsx", "src/lib/insurance/decision/familyLiving.ts"),
  "/insurance-premium-calculator": calculator("/insurance-premium-calculator",
    "src/components/calculators/PremiumCalc.tsx", "src/lib/insurance/decision/premiumRatio.ts"),
  "/car-insurance-calculator": calculator("/car-insurance-calculator",
    "src/components/calculators/CarCalc.tsx", "src/lib/insurance/decision/carQuoteCompare.ts"),
};

export function contentUpdated(path: string): string {
  const entry = CONTENT_DATES[path];
  if (!entry) throw new Error("내용 수정일이 등록되지 않은 경로: " + path);
  return entry.updated;
}
