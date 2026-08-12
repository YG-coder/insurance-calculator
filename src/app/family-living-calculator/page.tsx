import type { Metadata } from "next";
import FamilyLivingCalc from "@/components/calculators/FamilyLivingCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/family-living-calculator`;

export const metadata: Metadata = {
  title: "유족 생활비 계산기 — 필요한 생활비 총액 계산",
  description:
    "생애주기별로 월 생활비와 기간을 여러 구간으로 나눠 입력하면 총 유족 생활비를 계산합니다. 평균 생활비나 물가상승률 같은 추정값 없이, 입력한 금액만 합산합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "유족 생활비 계산기",
    description: "생활비 구간을 나눠 입력해 총 유족 생활비를 계산하세요.",
    url: URL,
  },
};

export default function FamilyLivingPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          유족 생활비 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          유족에게 필요한 생활비를 생애주기별로 나눠 계산합니다. 시기마다 생활비가 다르면 구간을 추가해
          각각 입력하세요. 입력한 금액을 합산해 총 유족 생활비만 계산하며, 적정 금액을 정하지 않습니다.
        </p>
      </header>

      <div className="mb-6">
        <a
          href="/protection-planning"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-5 py-3 text-sm font-semibold text-brand-800 transition hover:border-brand-300"
        >
          <span>← 보장 설계 허브에서 3단계 순서대로 안내받기</span>
          <span aria-hidden>→</span>
        </a>
      </div>

      <FamilyLivingCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          모든 금액과 기간은 사용자가 직접 입력합니다. 이 계산기는 평균 생활비·물가상승률·할인율 같은
          추정값을 넣지 않으며, 필요한 보험금이나 적정 생활비를 추천하지 않습니다.
        </NoticeBox>
      </div>

      <RelatedCalculators currentHref="/family-living-calculator" />
    </article>
  );
}
