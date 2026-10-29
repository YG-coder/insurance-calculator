import type { Generation } from "./regulatory-basis";

export const SILSON_GENERATIONS: Record<string, readonly Generation[]> = {
  "/2nd-3rd-generation-health-insurance-calculator": ["2009", "2017"],
  "/health-insurance-calculator": ["2021"],
  "/5th-generation-health-insurance-calculator": ["2026"],
};

export const CONTEXT_LINKS: Record<string, readonly { href: string; label: string; context: string }[]> = {
  "/health-insurance-calculator": [{
    href: "/2nd-3rd-generation-health-insurance-calculator",
    label: "2·3세대 실손보험 자기부담금 계산기",
    context: "현재 적용되는 계약이 2·3세대라면 해당 세대의 공제 방식으로 계산하세요.",
  }],
  "/5th-generation-health-insurance-calculator": [{
    href: "/2nd-3rd-generation-health-insurance-calculator",
    label: "2·3세대 실손보험 자기부담금 계산기",
    context: "기존 2·3세대 계약을 유지하고 있다면 현재 계약에 맞는 계산기를 이용하세요.",
  }],
  "/surrender-value-calculator": [{
    href: "/coverage-gap-calculator",
    label: "보장 공백 계산기",
    context: "해지 손익과 별도로, 해지 후 남을 보장금액을 직접 확인해 필요한 보장과 비교해 보세요.",
  }],
  "/cancel-vs-keep-calculator": [{
    href: "/coverage-gap-calculator",
    label: "보장 공백 계산기",
    context: "해지·유지 금액만으로 보장 부족을 판단할 수는 없습니다. 필요한 보장과 남을 보장을 별도로 비교하세요.",
  }],
  "/insurance-premium-calculator": [{
    href: "/coverage-gap-calculator",
    label: "보장 공백 계산기",
    context: "보험료 비중과 보장 부족은 다른 값입니다. 필요한 보장금액과 현재 보장을 함께 확인하세요.",
  }],
};
