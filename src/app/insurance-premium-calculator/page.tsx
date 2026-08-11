import type { Metadata } from "next";
import PremiumCalc from "@/components/calculators/PremiumCalc";
import NoticeBox from "@/components/NoticeBox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/insurance-premium-calculator`;

export const metadata: Metadata = {
  title: "보험료 비중 계산기 — 소득 대비 보험료 비율",
  description:
    "월 소득과 월 보험료를 입력하면 소득에서 보험료가 차지하는 비중을 계산합니다. 적정 비중을 제시하지 않고, 입력한 값으로 비율만 계산합니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "보험료 비중 계산기",
    description: "월 소득 대비 보험료 비중을 계산하세요.",
    url: URL,
  },
};

export default function PremiumPage() {
  const faqs = [
    {
      q: "보험료 비중은 어떻게 계산되나요?",
      a: "월 보험료를 월 소득으로 나눈 뒤 100을 곱해 백분율로 계산합니다. 이 계산기는 이용자가 입력한 값만 사용하며, 보험료를 추정하거나 임의의 기준을 넣지 않습니다.",
    },
    {
      q: "적정 보험료 비중은 몇 %인가요?",
      a: "적정 비중은 소득 수준, 가족 구성, 자산, 필요한 보장 등에 따라 사람마다 다릅니다. 이 계산기는 특정 비율을 적정선으로 제시하지 않으며, 계산된 비중이 높은지 낮은지는 본인의 상황에 맞게 판단하시기 바랍니다.",
    },
    {
      q: "월 소득은 세전과 세후 중 무엇을 넣나요?",
      a: "기준은 이용자가 정하시면 됩니다. 세전 소득으로 넣으면 세전 기준 비중이, 세후로 넣으면 세후 기준 비중이 계산됩니다. 다른 시점과 비교할 때는 같은 기준으로 입력하는 것이 좋습니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 계산기
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          보험료 비중 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          매달 내는 보험료가 소득에서 얼마나 차지하는지 계산합니다. 월 소득과 월 보험료를 입력하면
          보험료 비중(%)과 연간 환산 금액을 보여줍니다. 적정 비중을 제시하지 않으며, 비율만 계산하는
          도구입니다.
        </p>
      </header>

      <PremiumCalc />

      <div className="mt-6">
        <NoticeBox variant="info">
          이 계산기는 보험료를 추정하지 않습니다. 이용자가 입력한 월 보험료와 월 소득만으로 비중을
          계산하며, 연령·성별·흡연 여부 같은 요소로 예상 보험료를 산출하지 않습니다.
        </NoticeBox>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <RelatedCalculators currentHref="/insurance-premium-calculator" />
    </article>
  );
}
