import type { Metadata } from "next";
import Link from "next/link";
import HealthCalcStandardized from "@/components/calculators/HealthCalcStandardized";
import PolicyGenerationGuide from "@/components/calculators/PolicyGenerationGuide";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/2nd-3rd-generation-health-insurance-calculator`;

export const metadata: Metadata = {
  title: "2·3세대 실손보험 자기부담금 계산기",
  description:
    "2009년 10월~2021년 6월 가입한 표준화 실손(2세대)·착한실손(3세대)의 본인부담금과 보험 적용 금액을 계산합니다. 금융감독원 보험업감독업무시행세칙 [별표 15] 표준약관 원문을 근거로 합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "2·3세대 실손보험 자기부담금 계산기",
    description: "표준화 실손(2세대)·착한실손(3세대) 기준 본인부담금을 계산하세요.",
    url: URL,
  },
};

export default function Health2nd3rdPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2세대 (2009.10~2017.3) / 3세대 (2017.4~2021.6)
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          2·3세대 실손보험 자기부담금 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          표준화 실손(2세대)과 착한실손(3세대)은 급여·비급여를 <b>합한 금액</b>에 하나의 자기부담률을
          적용합니다. 급여와 비급여로 자기부담률이 갈리는 것은 4세대부터입니다. 가입한 상품이
          <b> 표준형</b>인지 <b>선택형</b>인지에 따라 자기부담률과 통원 공제 방식이 달라집니다.
          병원에 여러 번 다녀왔다면 방문별로 입력해 연간 횟수 한도와 자기부담 상한까지 함께 계산할 수 있습니다.
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
      <HealthCalcStandardized />

      <div className="mt-6">
        <NoticeBox variant="info">
          본 계산기는 금융감독원 <b>보험업감독업무시행세칙 [별표 15] 표준약관</b>의 해당 시기 연혁본
          원문을 근거로 입원 자기부담률(표준형 20% · 선택형 10%), 입원 자기부담 연간 상한 200만 원,
          통원 항목별 공제금액(의원 1만 · 병원 1만 5천 · 상급종합 2만 · 처방조제 8천 원)과 표준형의
          20% 정률 비교를 반영합니다. 여러 건을 한 번에 입력하면 계약해당일 기준 <b>연간 외래 180회 ·
          처방전 180건</b> 한도와 입원 자기부담 연간 상한의 <b>건 사이 누적</b>까지 반영합니다.
          회(건)당 보험가입금액은 계약마다 다른 값이라 입력하신 경우에만 적용합니다. 상급병실료 차액과
          3세대 3대비급여 특약은 계산에 넣지 않고 결과에 미적용 사실을 함께 표시합니다.
        </NoticeBox>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900 mb-4">세대별 차이 한눈에</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left">구분</th>
                <th className="border border-slate-200 px-3 py-2 text-left">2세대 · 3세대</th>
                <th className="border border-slate-200 px-3 py-2 text-left">4세대</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-semibold">자기부담 기준</td>
                <td className="border border-slate-200 px-3 py-2">급여+비급여 합계액에 단일 정률</td>
                <td className="border border-slate-200 px-3 py-2">급여 20% / 비급여 30% 분리</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-semibold">입원</td>
                <td className="border border-slate-200 px-3 py-2">표준형 20% · 선택형 10%, 연간 자기부담 상한 200만 원</td>
                <td className="border border-slate-200 px-3 py-2">상한 없음</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-semibold">통원 공제</td>
                <td className="border border-slate-200 px-3 py-2">
                  표준형: 정액과 20% 중 큰 금액 / 선택형: 정액만
                </td>
                <td className="border border-slate-200 px-3 py-2">정액과 정률 중 큰 금액</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-semibold">3대비급여</td>
                <td className="border border-slate-200 px-3 py-2">
                  2세대는 기본 보장에 포함 / 3세대는 별도 특약으로 분리
                </td>
                <td className="border border-slate-200 px-3 py-2">별도 특약</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/health-insurance-calculator"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span aria-hidden>→</span>
          <span>4세대 실손보험 계산기 보기</span>
        </Link>
        <Link
          href="/5th-generation-health-insurance-calculator"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span aria-hidden>→</span>
          <span>5세대 실손보험 계산기 보기</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/2nd-3rd-generation-health-insurance-calculator" />
    </article>
  );
}
