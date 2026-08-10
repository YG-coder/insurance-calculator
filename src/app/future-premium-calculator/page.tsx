import type { Metadata } from "next";
import Link from "next/link";
import FuturePremiumCalc from "@/components/calculators/FuturePremiumCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/future-premium-calculator`;

export const metadata: Metadata = {
  title: "앞으로 낼 보험료 계산기 — 유지하면 얼마를 더 낼까",
  description:
    "월 보험료와 남은 납입 기간을 입력하면 앞으로 낼 총 보험료, 완납 시 총 납입액, 앞으로 부담 비중을 계산합니다. 보험을 끝까지 유지할 때의 총비용을 확인하세요.",
  alternates: { canonical: URL },
  openGraph: {
    title: "앞으로 낼 보험료 계산기",
    description: "보험을 끝까지 유지하면 앞으로 얼마를 더 내야 하는지 계산하세요.",
    url: URL,
  },
};

export default function FuturePremiumPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          앞으로 낼 보험료 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          지금 보험을 끝까지 유지하면 앞으로 얼마를 더 내야 하는지 계산합니다. 월 보험료와 남은 납입
          기간을 입력하면 앞으로 낼 총 보험료를, 기납입 기간까지 넣으면 완납 시 총 납입액과 앞으로 부담
          비중을 확인할 수 있습니다.
        </p>
      </header>

      <FuturePremiumCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          이 계산기는 사용자가 입력한 값만으로 계산하며, 보험료 인상률·물가·평균 보험료 같은 추정값을
          넣지 않습니다. 갱신형 보험의 실제 보험료는 조건에 따라 달라질 수 있습니다.
        </NoticeBox>
      </div>

      <div className="mt-3">
        <Link
          href="/surrender-value-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>반대로, 지금 해지하면? 해지환급금 계산기로 손익 확인하기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/future-premium-calculator" />
    </article>
  );
}
