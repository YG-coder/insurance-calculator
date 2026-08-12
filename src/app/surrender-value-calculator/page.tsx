import type { Metadata } from "next";
import Link from "next/link";
import HealthSurrenderCalc from "@/components/calculators/HealthSurrenderCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/surrender-value-calculator`;

export const metadata: Metadata = {
  title: "해지환급금 계산기 — 지금 해지하면 얼마 돌려받을까",
  description:
    "월 보험료와 납입 기간, 해지환급금을 입력하면 총 납입액·손해액·환급률·월평균 손실을 계산합니다. 남은 납입 보험료까지 비교해 해지 여부를 판단하세요.",
  alternates: { canonical: URL },
  openGraph: {
    title: "해지환급금 계산기",
    description: "지금 해지하면 얼마를 돌려받고 얼마를 손해 보는지 계산하세요.",
    url: URL,
  },
};

export default function SurrenderValuePage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          해지환급금 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          지금 보험을 해지하면 얼마를 돌려받고 얼마를 손해 보는지 계산합니다. 해지환급금을 알고 있으면
          정확한 손익을, 모르면 직접 입력한 예상값으로 참고 계산을 제공합니다. 남은 납입 보험료까지 입력하면
          &lsquo;지금 해지 vs 계속 유지&rsquo;를 바로 비교할 수 있습니다.
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

      <HealthSurrenderCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          이 계산기는 사용자가 입력한 값만으로 계산하며, 상품별 평균 환급률이나 예정이율 같은 추정값을
          제시하지 않습니다. 정확한 해지환급금은 가입하신 보험의 약관 또는 보험사 앱에서 확인하세요.
        </NoticeBox>
      </div>

      <div className="mt-3">
        <Link
          href="/future-premium-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>반대로, 그대로 유지하면? 앞으로 낼 보험료 계산하기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-3">
        <Link
          href="/cancel-vs-keep-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-brand-200 bg-brand-50 px-5 py-4 font-semibold text-brand-800 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>두 금액을 한 화면에서 보기 · 해지 vs 유지 계산기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/surrender-value-calculator" />
    </article>
  );
}
