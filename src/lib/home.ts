import { CALCULATORS } from "./site";

type CalculatorHref = (typeof CALCULATORS)[number]["href"];
type HomeGroup = {
  id: string; label: string; question: string; description: string;
  start: { href: string; label: string }; hub: string; guide: string;
  calculators: readonly CalculatorHref[];
};

// 홈 분류만 관리하며, 이름·설명은 기존 계산기 레지스트리를 정본으로 사용한다.
export const HOME_GROUPS = [
  { id: "silson", label: "실손 병원비", question: "병원비 중 내 부담은 얼마일까요?", description: "진료비의 급여·비급여 내역과 내 실손 세대를 확인하고, 본인부담금과 보험 적용 금액을 계산합니다.", start: { href: "#silson", label: "내 실손 세대 선택" }, hub: "/silson-guide", guide: "health-insurance-claim", calculators: ["/2nd-3rd-generation-health-insurance-calculator", "/health-insurance-calculator", "/5th-generation-health-insurance-calculator"] },
  { id: "cancellation", label: "해지·유지 비교", question: "이 보험, 계속 유지해야 할까요?", description: "지금 돌려받을 금액과 남은 보험료를 나란히 확인합니다. 금액 비교와 보장에 대한 판단은 구분하세요.", start: { href: "/surrender-value-calculator", label: "해지환급금부터 확인" }, hub: "/insurance-cancellation", guide: "surrender-value", calculators: ["/surrender-value-calculator", "/future-premium-calculator", "/cancel-vs-keep-calculator"] },
  { id: "protection", label: "가족 보장 점검", question: "가족에게 필요한 보장은 얼마일까요?", description: "가족의 생활비와 부채, 준비된 자금을 정리해 필요한 보장과 현재 보장의 차이를 확인합니다.", start: { href: "/family-living-calculator", label: "유족 생활비부터 계산" }, hub: "/protection-planning", guide: "before-buying-checklist", calculators: ["/family-living-calculator", "/death-coverage-calculator", "/coverage-gap-calculator"] },
  { id: "budget", label: "보험료·견적 점검", question: "보험료 부담과 견적을 비교하고 싶어요.", description: "월 보험료가 소득에서 차지하는 비중을 확인하거나, 같은 보장 조건의 자동차보험 견적을 비교하세요.", start: { href: "/insurance-premium-calculator", label: "보험료 비중 계산" }, hub: "/car-insurance-calculator", guide: "", calculators: ["/insurance-premium-calculator", "/car-insurance-calculator"] },
] as const satisfies readonly HomeGroup[];

export const REVIEW_STEPS = [
  { title: "지금 돌려받을 금액", description: "보험사에서 확인한 해지환급금과 지금까지 낸 보험료로 차이를 확인합니다.", href: "/surrender-value-calculator", action: "해지환급금 계산" },
  { title: "앞으로 더 낼 금액", description: "월 보험료와 남은 납입기간으로 향후 납입 부담을 확인합니다. 갱신 시 보험료는 달라질 수 있습니다.", href: "/future-premium-calculator", action: "남은 보험료 계산" },
  { title: "해지와 유지 나란히", description: "환급금과 남은 보험료를 같은 화면에서 비교합니다. 보장 내용은 보험증권에서 따로 점검하세요.", href: "/cancel-vs-keep-calculator", action: "해지·유지 비교" },
] as const;

export const PROTECTION_STEPS = [
  { title: "가족에게 필요한 생활비", description: "월 생활비와 필요한 기간을 정해 유족 생활비를 계산합니다.", href: "/family-living-calculator", action: "유족 생활비 계산" },
  { title: "준비할 사망보장 금액", description: "생활비와 부채, 준비된 자금을 바탕으로 필요한 사망보장을 가늠합니다.", href: "/death-coverage-calculator", action: "사망보장 계산" },
  { title: "현재 보장과의 차이", description: "필요한 보장과 이미 가입한 보장을 비교합니다. 차이가 곧 추가 가입 권유는 아닙니다.", href: "/coverage-gap-calculator", action: "보장 공백 확인" },
] as const;
