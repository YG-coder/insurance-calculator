import type { Metadata } from "next";
import Link from "next/link";
import CoverageGapCalc from "@/components/calculators/CoverageGapCalc";
import NoticeBox from "@/components/NoticeBox";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/coverage-gap-calculator`;

export const metadata: Metadata = {
  title: "보장 공백 계산기 — 필요 보장금액과 현재 보장의 차이",
  description:
    "필요 보장금액과 현재 보장금액을 입력하면 부족하거나 초과하는 금액을 계산합니다. 적정 보장금액을 추천하지 않고, 두 금액의 차이만 계산합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "보장 공백 계산기",
    description: "필요 보장금액과 현재 보장의 차이(부족/초과)를 계산하세요.",
    url: URL,
  },
};

export default function CoverageGapPage() {
  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          보장 공백 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          필요한 보장금액과 현재 가입한 보장금액을 입력하면 얼마가 부족한지(또는 초과하는지) 계산합니다.
          적정 보장금액이 얼마인지는 정하지 않습니다. 목표와 현재의 차이만 계산하는 도구입니다.
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

      <CoverageGapCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          필요 보장금액은 사용자가 직접 입력합니다. 이 계산기는 연소득 배수·평균 보장금액 같은 추정값을 넣지
          않으며, 얼마를 가입하라는 추천도 하지 않습니다.
        </NoticeBox>
      </div>

      <div className="mt-3">
        <Link
          href="/death-coverage-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>필요 보장금액을 아직 모른다면? 사망보장 계산기로 먼저 계산하기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <RelatedCalculators currentHref="/coverage-gap-calculator" />
    </article>
  );
}
