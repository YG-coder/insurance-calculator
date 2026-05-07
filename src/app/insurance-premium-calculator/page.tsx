import type { Metadata } from "next";
import PremiumCalc from "@/components/calculators/PremiumCalc";
import NoticeBox from "@/components/NoticeBox";
import CTABox from "@/components/CTABox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/insurance-premium-calculator`;

export const metadata: Metadata = {
  title: "보험료 계산기",
  description:
      "나이·성별·흡연 여부·보장금액 기준으로 예상 보험료 범위를 무료로 계산하세요. 2026년 기준 참고용 보험료 계산기입니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "보험료 계산기",
    description: "나이·성별·흡연·보장금액 기준 예상 보험료를 계산하세요.",
    url: URL,
  },
};

export default function PremiumPage() {
  const faqs = [
    {
      q: "보험료는 어떻게 산정되나요?",
      a: "보험료는 위험률, 연령, 성별, 흡연 여부, 건강 상태, 보장금액, 보장기간, 사업비 등을 종합해 산정됩니다. 같은 조건이라도 보험사와 상품에 따라 보험료가 달라질 수 있습니다.",
    },
    {
      q: "흡연 여부가 보험료에 얼마나 영향을 주나요?",
      a: "일반적으로 흡연자는 비흡연자보다 보험료가 높게 산정될 수 있습니다. 금연 후 일정 기간이 지나면 비흡연자 요율 적용 가능 여부를 보험사에 확인해볼 수 있습니다.",
    },
    {
      q: "젊을 때 가입하는 게 유리한가요?",
      a: "대체로 보험료는 가입 시점의 나이와 건강 상태에 영향을 받기 때문에 젊고 건강할 때 가입하는 것이 유리할 수 있습니다. 다만 과도한 보장금액은 장기 부담이 될 수 있습니다.",
    },
    {
      q: "갱신형과 비갱신형 중 어떤 게 좋나요?",
      a: "갱신형은 초기 보험료가 낮은 대신 갱신 시 보험료가 오를 수 있고, 비갱신형은 초기 보험료가 높지만 납입 기간 동안 보험료가 일정한 편입니다. 보장 기간과 현금흐름을 고려해야 합니다.",
    },
  ];

  return (
      <article className="container-base py-10">
        <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2026년 기준
        </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            보험료 계산기
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            나이, 성별, 흡연 여부, 보장금액을 입력하면 일반적인 보험 산출 기준으로 예상 보험료
            범위를 확인할 수 있습니다.
          </p>
        </header>

        <PremiumCalc />

        <div className="mt-6">
          <CTABox />
        </div>

        <div className="mt-6">
          <NoticeBox>
            <strong>본 계산 결과는 참고용이며 실제 보험료와 다를 수 있습니다.</strong> 개별 보험
            상품의 정확한 보험료는 보험사 공식 견적을 통해 확인하시기 바랍니다.
          </NoticeBox>
        </div>

        <RelatedCalculators currentHref="/insurance-premium-calculator" />

        <section className="mt-14 prose-seo">
          <h2>보험료의 구조 이해하기</h2>
          <p>
            우리가 매달 납부하는 보험료는 단순한 이용료가 아니라{" "}
            <strong>위험보험료, 저축보험료, 사업비</strong> 등이 합쳐진 금액입니다. 위험보험료는
            사망·질병·사고 등 보장에 직접 사용되는 부분이고, 저축보험료는 만기환급금이나
            해지환급금에 적립되는 금액이며, 사업비는 보험사 운영과 모집 비용 등에 사용됩니다.
          </p>
          <p>
            따라서 같은 보장이라도 상품 구조와 사업비 수준에 따라 보험료 차이가 발생할 수 있습니다.
            일반적으로 온라인 또는 다이렉트 채널 상품은 대면 상품보다 사업비가 낮아 보험료가 저렴한
            편입니다.
          </p>

          <h2>보험료 산정의 핵심 변수</h2>
          <ul>
            <li>
              <strong>연령:</strong> 나이가 많아질수록 질병·사고 위험률이 높아져 보험료가 오를 수 있습니다.
            </li>
            <li>
              <strong>성별:</strong> 통계상 위험률 차이에 따라 동일 연령에서도 보험료가 달라질 수 있습니다.
            </li>
            <li>
              <strong>흡연 여부:</strong> 흡연자는 비흡연자보다 위험률이 높게 반영될 수 있습니다.
            </li>
            <li>
              <strong>건강 상태:</strong> 고혈압, 당뇨, 과거 병력 등은 가입 제한이나 할증 사유가 될 수 있습니다.
            </li>
            <li>
              <strong>직업:</strong> 사고 위험이 높은 직업군은 보험료가 높거나 가입 조건이 달라질 수 있습니다.
            </li>
            <li>
              <strong>보장금액·보장기간:</strong> 보장금액이 크고 보장기간이 길수록 보험료가 높아집니다.
            </li>
          </ul>

          <h2>실제 예시: 35세 남성, 사망보장 1억 원</h2>
          <p>
            예를 들어 35세 비흡연 남성이 사망보장 <strong>1억 원</strong> 기준의 보험에 가입한다고
            가정하면, 보험사와 상품 구조에 따라 월 보험료가 크게 달라질 수 있습니다. 같은 조건의
            흡연자라면 비흡연자보다 보험료가 더 높게 산정될 수 있습니다.
          </p>
          <p>
            또한 보장금액을 높이면 보험료도 함께 올라갑니다. 다만 보험료는 단순히 보장금액에 정비례하지
            않고, 보험사의 위험률과 사업비 구조에 따라 다르게 산정될 수 있으므로 실제 견적 확인이
            필요합니다.
          </p>

          <h2>자주 하는 실수</h2>
          <ul>
            <li>
              <strong>저렴한 보험료만 보고 가입:</strong> 보장 범위, 면책기간, 감액기간을 함께 확인해야 합니다.
            </li>
            <li>
              <strong>과도한 특약 가입:</strong> 필요 이상의 특약은 장기적으로 보험료 부담을 키울 수 있습니다.
            </li>
            <li>
              <strong>건강 정보 부정확하게 고지:</strong> 고지의무 위반 시 보험금 지급이 거절될 수 있습니다.
            </li>
            <li>
              <strong>중복 가입:</strong> 실손보험 등 일부 상품은 중복 가입해도 보장이 늘지 않을 수 있습니다.
            </li>
            <li>
              <strong>해지환급금만 보고 판단:</strong> 보장 내용과 납입 여력을 함께 고려해야 합니다.
            </li>
          </ul>

          <h2>보험료 절약 팁</h2>
          <p>
            보험료를 줄이려면 먼저 본인에게 필요한 보장과 불필요한 특약을 구분해야 합니다. 같은 보장이라도
            다이렉트 채널, 정기보험, 갱신형·비갱신형 선택에 따라 보험료가 달라질 수 있습니다.
          </p>
          <p>
            또한 금연 후 일정 기간이 지났거나 건강 상태가 개선된 경우에는 보험사에 요율 재심사 가능 여부를
            확인해볼 수 있습니다. 보험료가 부담스럽다고 바로 해지하기보다는 감액, 특약 조정, 납입 방식 변경
            등을 먼저 검토하는 것이 좋습니다.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            자주 묻는 질문
          </h2>
          <FAQ items={faqs} />
        </section>

        <div className="mt-10">
          <NoticeBox variant="info">
            본 페이지는 일반적인 정보 제공을 위한 콘텐츠로, 특정 보험 상품의 가입을 권유하거나
            재무적 자문을 제공하지 않습니다. 가입 전 반드시 약관과 공시실 자료를 확인하시기 바랍니다.
          </NoticeBox>
        </div>

        <div className="mt-12 border-t pt-6">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            다른 계산기도 확인해보세요
          </p>

          <div className="flex flex-wrap gap-3 text-sm">
            <a
                href="/health-insurance-calculator"
                className="text-brand-600 hover:underline"
            >
              실손보험 계산기
            </a>

            <a
                href="/car-insurance-calculator"
                className="text-brand-600 hover:underline"
            >
              자동차보험 계산기
            </a>
          </div>
        </div>
      </article>
  );
}