export const SITE = {
  name: "보험계산기",
  url: "https://xn--989a00a773aktdxo7a.kr",
  description:
    "실손보험, 보험료, 자동차보험을 무료로 계산해보세요. 2026년 기준 참고용 보험 계산기 전문 사이트입니다.",
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
    title: "보험료 계산기",
    short: "보험료",
    description: "나이·성별·보장금액 기준 예상 보험료 범위를 확인합니다.",
    href: "/insurance-premium-calculator",
    icon: "💰",
  },
  {
    title: "자동차보험 계산기",
    short: "자동차보험",
    description: "운전 경력과 사고 이력을 반영해 예상 자동차보험료를 산출합니다.",
    href: "/car-insurance-calculator",
    icon: "🚗",
  },
] as const;
