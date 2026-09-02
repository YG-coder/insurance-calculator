import type { Metadata } from "next";
import Link from "next/link";
import HealthCalc5th from "@/components/calculators/HealthCalc5th";
import HealthCalcMulti2026 from "@/components/calculators/HealthCalcMulti2026";
import PolicyGenerationGuide from "@/components/calculators/PolicyGenerationGuide";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/5th-generation-health-insurance-calculator`;

export const metadata: Metadata = {
  title: "5세대 실손보험 자기부담금 계산기",
  description:
    "2026년 5월 출시된 5세대 실손보험 표준약관을 기준으로 급여·비급여(중증·비중증) 본인부담금과 보험 적용 금액을 계산하세요.",
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
        <p className="mt-3 text-slate-600 leading-relaxed">
          다만 5세대 비급여는 보장종목이 더 나뉩니다. <b>근골격계 이학요법·체외충격파</b>,
          <b> 비급여 주사료</b>, <b>비급여 MRI</b>는 표준약관상 별도 보장종목이라 일반 상해·질병
          비급여에서 제외되고, <b>상급병실료 차액</b>도 입원 의료비와 산식이 다릅니다. 이 계산기는
          현재 <b>일반 비급여만</b> 계산하며, 네 항목은 치료유형 선택 단계에서 계산을 차단합니다.
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
      <HealthCalcMulti2026 />

      <div className="mt-6">
        <NoticeBox variant="info">
          본 계산기는 금융감독원 보험업감독업무시행세칙 별표15의 5세대 표준약관을 기준으로 합니다.
          단건 계산은 통원 1회당·1일당 가입금액까지 반영하며, 연간 횟수와 연간 보험가입금액은 반영하지
          않습니다. 여러 건 합산 계산에서 연간 보험가입금액과 계약해당일 기준 기존 지급보험금·자기부담금·
          통원 횟수를 입력하면 관련 한도를 함께 반영합니다.
          <br />
          계산 범위는 특별약관1·2의 <b>(1)상해비급여·(2)질병비급여</b>입니다. 중증의 3대비급여
          (근골격계 이학요법·체외충격파, 주사료, MRI)와 비중증의 비급여 자기공명영상진단은 약관이
          위 보장종목에서 명시적으로 제외하며, 공제금액·금액한도·횟수한도가 달라 <b>현재 계산하지
          않습니다</b>. 상급병실료 차액도 입원 보상 대상인 &lsquo;비급여 의료비&rsquo;에서 제외되고 별도
          산식(비급여 병실료의 50%, 1일 평균 10만 원 한도)이 적용되어 계산 대상이 아닙니다.
          해당 청구는 보험사 안내를 확인해 주세요.
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
