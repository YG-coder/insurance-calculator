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
      a: "보험료는 위험률(연령·성별·흡연·건강상태), 보장금액, 보장기간, 사업비, 예정이율 등을 종합해 산정합니다. 같은 사람이라도 보험사에 따라 보험료가 10~30%까지 차이날 수 있습니다.",
    },
    {
      q: "흡연 여부가 보험료에 얼마나 영향을 주나요?",
      a: "일반적으로 흡연자는 비흡연자에 비해 종신·정기보험 기준 보험료가 20~40% 더 높습니다. 금연 후 일정 기간(보통 1~2년)이 지나면 비흡연자 요율을 적용받을 수 있습니다.",
    },
    {
      q: "젊을 때 가입하는 게 정말 유리한가요?",
      a: "네, 보험료는 가입 시점의 나이에 따라 결정되며 갱신·비갱신형 모두 일찍 가입할수록 유리합니다. 다만 너무 큰 보장금액으로 가입하면 보험료 부담이 길어지므로 적정 수준이 중요합니다.",
    },
    {
      q: "갱신형과 비갱신형 중 어떤 게 좋나요?",
      a: "갱신형은 초기 보험료가 저렴하지만 시간이 지나며 인상되고, 비갱신형은 초기 보험료가 높지만 만기까지 동일합니다. 보장 기간과 본인의 현금흐름을 고려해 선택해야 합니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2026년 기준
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">보험료 계산기</h1>
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
          우리가 매달 납부하는 보험료는 단순한 ‘이용료’가 아니라{" "}
          <strong>위험보험료 + 저축보험료 + 사업비(부가보험료)</strong>로 구성된 복합적인 금액
          입니다. 위험 보험료는 사망·질병·사고 등 보장에 직접 사용되는 부분이고, 저축보험료는
          만기환급금이나 해지환급금에 적립되는 금액이며, 사업비는 보험사 운영·모집비 등에 쓰입니다.
        </p>
        <p>
          따라서 같은 보장이라도 사업비 비중이 높은 상품과 낮은 상품 사이에는 보험료 차이가 크게
          발생합니다. 일반적으로 다이렉트(온라인) 채널 상품은 대면 상품보다 사업비가 낮아 보험료가
          10~20% 저렴한 경향이 있습니다.
        </p>

        <h2>보험료 산정의 핵심 변수</h2>
        <ul>
          <li>
            <strong>연령:</strong> 보험료 산정의 가장 큰 변수. 30대 vs 50대 보험료가 2~3배 차이.
          </li>
          <li>
            <strong>성별:</strong> 사망률·질병률 통계에 따라 동일 연령에서도 보험료가 다름.
          </li>
          <li>
            <strong>흡연 여부:</strong> 흡연자 보험료는 보통 20~40% 높음.
          </li>
          <li>
            <strong>건강 상태:</strong> 고혈압·당뇨 등 기왕증은 부담보·할증 사유.
          </li>
          <li>
            <strong>직업:</strong> 위험 직군은 사고 위험률에 따라 가입 제한·할증.
          </li>
          <li>
            <strong>보장금액·보장기간:</strong> 클수록·길수록 보험료가 비례 증가.
          </li>
        </ul>

        <h2>실제 예시: 35세 남성 종신보험 1억</h2>
        <p>
          35세 비흡연 남성이 사망보장 <strong>1억 원</strong> 종신보험에 가입하는 경우, 보험사·
          상품에 따라 다르지만 일반적으로 월 15만 원~25만 원 수준의 보험료가 산정됩니다. 같은
          조건의 흡연자라면 약 20만 원~33만 원으로 30% 이상 오를 수 있습니다.
        </p>
        <p>
          또한 같은 사람이 보장금액을 5억으로 늘리면 보험료는 단순 5배가 아니라 위험률·사업비
          구조로 인해 4.5~4.8배 수준으로 적용되는 경우가 많습니다. 이런 비선형적 변동 때문에
          정확한 보험료 비교에는 보험사별 견적이 필수적입니다.
        </p>

        <h2>자주 하는 실수</h2>
        <ul>
          <li>
            <strong>‘저렴한 보험료’만 보고 가입:</strong> 보장 범위·면책기간을 확인하지 않으면 정작
            필요한 시점에 보장받지 못할 수 있습니다.
          </li>
          <li>
            <strong>과도한 특약 가입:</strong> 특약 10~20개를 모두 붙이면 보험료가 본 계약의 두
            배가 되는 경우도 흔합니다.
          </li>
          <li>
            <strong>건강 정보 부정확하게 고지:</strong> 고지의무 위반 시 보험금 지급이 거절될 수
            있습니다.
          </li>
          <li>
            <strong>중복 가입:</strong> 실손보험·일부 정액보험은 중복 가입해도 보장이 늘지
            않습니다.
          </li>
          <li>
            <strong>해지환급금 비교 안 함:</strong> 같은 보험료라도 해지 시 환급률이 크게 다를 수
            있습니다.
          </li>
        </ul>

        <h2>보험료 절약 팁</h2>
        <p>
          첫째, <strong>다이렉트 채널</strong>을 적극 활용하세요. 같은 회사의 같은 보장이라도 다이
          렉트 상품은 사업비가 낮아 보험료가 저렴합니다. 둘째, 본인에게 정말 필요한 보장만 골라
          가입하세요. 특히 정기보험과 종신보험을 적절히 조합하면 보험료를 크게 줄일 수 있습니다.
        </p>
        <p>
          셋째, <strong>금연 후 1~2년이 지났다면</strong> 비흡연자 요율로 재산정 신청을 하거나 새로
          가입하는 것이 유리합니다. 마지막으로 보험료가 부담스럽다면 ‘감액 완납’이나 ‘납입
          일시중지(중지보험금)’ 제도를 활용해 해지보다는 유지 쪽으로 검토하는 것이 장기적으로
          이익인 경우가 많습니다.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <div className="mt-10">
        <NoticeBox variant="info">
          본 페이지는 일반적인 정보 제공을 위한 콘텐츠로, 특정 보험 상품의 가입을 권유하거나
          재무적 자문을 제공하지 않습니다. 가입 전 반드시 약관과 공시실 자료를 확인하시기 바랍니다.
        </NoticeBox>
      </div>
    </article>
  );
}
