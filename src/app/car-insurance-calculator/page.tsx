import type { Metadata } from "next";
import CarCalc from "@/components/calculators/CarCalc";
import NoticeBox from "@/components/NoticeBox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/car-insurance-calculator`;

export const metadata: Metadata = {
  title: "자동차보험 견적 비교 계산기 — 받은 견적 비교",
  description:
    "여러 보험사에서 받은 연간 자동차보험 견적을 입력하면 최저·최고·차액과 연간 차액을 12개월로 나눈 월 환산 차액을 비교합니다. 보험료를 추정하지 않고, 입력한 견적만 비교합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "자동차보험 견적 비교 계산기",
    description: "받은 자동차보험 견적들의 최저·최고·차액을 비교하세요.",
    url: URL,
  },
};

export default function CarPage() {
  const faqs = [
    {
      q: "이 계산기는 예상 보험료를 알려주나요?",
      a: "아니요. 이 계산기는 보험료를 추정하지 않습니다. 이용자가 여러 보험사에서 직접 받은 견적 금액을 입력하면, 그 견적들의 최저·최고·차액만 비교해 보여줍니다.",
    },
    {
      q: "어느 보험사가 가장 좋은지 알려주나요?",
      a: "이 계산기는 어느 보험사가 더 좋은지 판단하거나 추천하지 않습니다. 최저 견적 표시는 단순 사실 안내이며, 실제로는 보장 범위·특약·자기부담금 등 조건이 서로 같은지도 함께 확인해야 정확한 비교가 됩니다.",
    },
    {
      q: "견적은 어디서 받나요?",
      a: "각 보험사 공식 홈페이지, 다이렉트 채널, 설계사, 또는 보험다모아 같은 공식 비교 채널에서 같은 조건으로 견적을 받은 뒤, 그 금액을 이 계산기에 입력해 비교하시면 됩니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          자동차보험 견적 비교 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          여러 보험사에서 받은 연간 자동차보험 견적을 나란히 비교합니다. 연간 견적 금액을 입력하면
          최저·최고 견적과 차액, 연간 차액을 12개월로 나눈 월 환산 차액을 계산합니다. 보험료를 추정하지
          않고, 입력한 견적만 비교하는 도구입니다.
        </p>
      </header>

      <CarCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          정확한 비교를 위해서는 각 견적의 보장 범위(대인·대물 한도), 자기부담금, 특약 구성이 같은 조건인지
          확인하세요. 조건이 다르면 단순 금액 비교만으로는 유불리를 판단하기 어렵습니다.
        </NoticeBox>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <RelatedCalculators currentHref="/car-insurance-calculator" />
    </article>
  );
}
