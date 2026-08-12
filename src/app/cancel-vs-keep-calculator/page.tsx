import type { Metadata } from "next";
import CancelVsKeepCalc from "@/components/calculators/CancelVsKeepCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/cancel-vs-keep-calculator`;

export const metadata: Metadata = {
  title: "보험 해지 vs 유지 계산기 — 두 금액을 나란히 비교",
  description:
    "지금 해지하면 받는 해지환급금과, 그대로 유지하면 앞으로 낼 보험료를 나란히 보여줍니다. 어느 쪽이 유리한지 판단하지 않고 금전적인 두 금액만 비교합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "보험 해지 vs 유지 계산기",
    description: "해지환급금과 앞으로 낼 보험료를 나란히 비교하세요.",
    url: URL,
  },
};

export default function CancelVsKeepPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          보험 해지 vs 유지 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          지금 해지하면 받는 해지환급금과, 그대로 유지하면 앞으로 낼 보험료를 같은 화면에 나란히 보여줍니다.
          어느 쪽이 유리한지는 판단하지 않습니다. 두 금액을 비교해 스스로 결정하실 수 있도록 돕는 도구입니다.
        </p>
      </header>

      <div className="mb-6">
        <a
          href="/insurance-cancellation"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-5 py-3 text-sm font-semibold text-brand-800 transition hover:border-brand-300"
        >
          <span>← 보험 해지 허브에서 3단계 순서대로 안내받기</span>
          <span aria-hidden>→</span>
        </a>
      </div>

      <CancelVsKeepCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          해지환급금은 해지환급금 계산기에서, 앞으로 낼 보험료는 앞으로 낼 보험료 계산기에서 먼저 계산한 뒤
          그 값을 여기에 입력하면 됩니다. 이 계산기는 금전적인 두 금액만 비교하며, 보장의 가치나 추천은
          제공하지 않습니다.
        </NoticeBox>
      </div>

      <RelatedCalculators currentHref="/cancel-vs-keep-calculator" />
    </article>
  );
}
