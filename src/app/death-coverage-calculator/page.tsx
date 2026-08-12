import type { Metadata } from "next";
import Link from "next/link";
import DeathCoverageCalc from "@/components/calculators/DeathCoverageCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/death-coverage-calculator`;

export const metadata: Metadata = {
  title: "사망보장 계산기 — 필요한 사망보험금 직접 계산",
  description:
    "월 생활비와 보장 기간, 부채, 기존 사망보험금과 자산을 입력하면 필요한 사망보장금액을 계산합니다. 적정 보험금을 추천하지 않고, 유족 필요자금과 준비된 자금의 차이만 계산합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "사망보장 계산기",
    description: "유족 필요자금과 준비된 자금의 차이로 필요 사망보장금액을 계산하세요.",
    url: URL,
  },
};

export default function DeathCoveragePage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          사망보장 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          유족에게 필요한 자금과 이미 준비된 자금을 입력하면, 추가로 필요한 사망보장금액을 계산합니다.
          적정 보험금이 얼마인지는 추천하지 않습니다. 입력하신 금액의 차이만 계산하는 도구입니다.
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

      <DeathCoverageCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          모든 금액은 사용자가 직접 입력합니다. 이 계산기는 연소득 배수·평균 생활비·물가상승률 같은 추정값을
          넣지 않으며, 미래 소득 전체를 반영하는 방식(생애가치법)도 사용하지 않습니다.
        </NoticeBox>
      </div>

      <div className="mt-3">
        <Link
          href="/coverage-gap-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-brand-200 bg-brand-50 px-5 py-4 font-semibold text-brand-800 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>계산한 필요 사망보장금액을 현재 보장과 비교하기 · 보장 공백 계산기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/death-coverage-calculator" />
    </article>
  );
}
