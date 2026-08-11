export const SITE = {
  name: "보험계산기",
  url: "https://xn--989a00a773aktdxo7a.kr",
  description:
    "해지환급금·사망보장·보장 공백부터 실손보험 자기부담금까지, 보험 의사결정에 필요한 숫자를 직접 계산하세요. 추정값 없이 입력한 값으로 계산하는 참고용 보험 계산기입니다.",
};

export const CALCULATORS = [
  {
    title: "실손보험 자기부담금 계산기",
    short: "실손보험",
    description: "병원비 중 본인부담금과 보험 적용 금액을 계산합니다.",
    href: "/health-insurance-calculator",
    icon: "🏥",
  },
  {
    title: "5세대 실손보험 자기부담금 계산기",
    short: "5세대 실손",
    description: "2026년 출시 5세대 실손보험 기준 본인부담금과 보험 적용 금액을 계산합니다.",
    href: "/5th-generation-health-insurance-calculator",
    icon: "🆕",
  },
  {
    title: "해지환급금 계산기",
    short: "해지환급금",
    description: "보험을 지금 해지하면 돌려받는 금액과 손실을 계산합니다.",
    href: "/surrender-value-calculator",
    icon: "💸",
  },
  {
    title: "앞으로 낼 보험료 계산기",
    short: "앞으로 낼 보험료",
    description: "보험을 끝까지 유지하면 앞으로 얼마를 더 내야 하는지 계산합니다.",
    href: "/future-premium-calculator",
    icon: "📆",
  },
  {
    title: "보험 해지 vs 유지 계산기",
    short: "해지 vs 유지",
    description: "해지환급금과 앞으로 낼 보험료를 한 화면에서 나란히 비교합니다.",
    href: "/cancel-vs-keep-calculator",
    icon: "⚖️",
  },
  {
    title: "보장 공백 계산기",
    short: "보장 공백",
    description: "필요 보장금액과 현재 보장금액의 차이(부족·초과)를 계산합니다.",
    href: "/coverage-gap-calculator",
    icon: "🛡️",
  },
  {
    title: "사망보장 계산기",
    short: "사망보장",
    description: "유족 필요자금과 준비된 자금의 차이로 필요한 사망보장금액을 계산합니다.",
    href: "/death-coverage-calculator",
    icon: "👪",
  },
  {
    title: "유족 생활비 계산기",
    short: "유족 생활비",
    description: "생애주기별 생활비를 구간으로 나눠 총 유족 생활비를 계산합니다.",
    href: "/family-living-calculator",
    icon: "👨‍👩‍👧",
  },
  {
    title: "보험료 비중 계산기",
    short: "보험료 비중",
    description: "월 소득에서 보험료가 차지하는 비중을 계산합니다.",
    href: "/insurance-premium-calculator",
    icon: "💳",
  },
  {
    title: "자동차보험 견적 비교 계산기",
    short: "자동차 견적 비교",
    description: "여러 보험사에서 받은 자동차보험 견적의 최저·최고·차액을 비교합니다.",
    href: "/car-insurance-calculator",
    icon: "🚗",
  },
] as const;
