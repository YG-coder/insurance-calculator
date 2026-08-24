import type { Metadata } from "next";
import Link from "next/link";
import HealthCalc5th from "@/components/calculators/HealthCalc5th";
import PolicyGenerationGuide from "@/components/calculators/PolicyGenerationGuide";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/5th-generation-health-insurance-calculator`;

export const metadata: Metadata = {
  title: "5세대 실손보험 자기부담금 계산기",
  description:
    "2026년 5월 출시된 5세대 실손보험 기준으로 급여·비급여(중증·비중증) 본인부담금과 보험 적용 금액을 계산하세요. 금융위원회 발표 기준을 반영한 참고용 계산기입니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "5세대 실손보험 자기부담금 계산기",
    description: "5세대 실손보험 기준 본인부담금·보험 적용 금액을 계산하세요.",
    url: URL,
  },
};

export default function Health5thPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 5세대 (2026년 기준)
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          5세대 실손보험 자기부담금 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          2026년 5월 출시된 5세대 실손보험은 비급여를 <b>중증</b>과 <b>비중증</b>으로 나누고,
          중증은 보장을 강화(입원 자기부담 상한 도입)하고 비중증은 자기부담률을 높였습니다.
          진료비와 구분을 입력하면 본인부담금과 보험 적용 금액을 계산합니다.
        </p>
      </header>

      <div className="mb-6">
        <a
          href="/silson-guide"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-5 py-3 text-sm font-semibold text-brand-800 transition hover:border-brand-300"
        >
          <span>← 실손보험 허브에서 계산·세대 차이·청구를 한 흐름으로 보기</span>
          <span aria-hidden>→</span>
        </a>
      </div>

      <PolicyGenerationGuide />
      <HealthCalc5th />

      <div className="mt-6">
        <NoticeBox variant="info">
          본 계산기는 금융위원회 발표 기준의 급여 입원·비급여(중증/비중증) 자기부담률, 비급여 회당·일당
          한도, 중증 입원 자기부담 상한(500만 원)을 반영합니다. 연간 누적 한도와 급여 통원 등 일부 기준은
          연간 사용액 입력이 필요해 이번 계산에는 반영하지 않았으며, 공식 원문 확인 후 순차적으로 추가할 예정입니다.
        </NoticeBox>
      </div>

      <div className="mt-6">
        <Link
          href="/health-insurance-calculator"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span aria-hidden>←</span>
          <span>기존 4세대 실손보험 계산기 보기</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/5th-generation-health-insurance-calculator" />
    </article>
  );
}
