import type { Metadata } from "next";
import CarCalc from "@/components/calculators/CarCalc";
import NoticeBox from "@/components/NoticeBox";
import CTABox from "@/components/CTABox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import RelatedGuides from "@/components/RelatedGuides";
import { SITE } from "@/lib/site";

const PAGE_URL = `${SITE.url}/car-insurance-calculator`;

export const metadata: Metadata = {
  title: "자동차보험 계산기",
  description:
    "나이·운전 경력·사고 이력·차량가액 기준으로 예상 자동차보험료를 무료로 계산하세요. 2026년 기준 참고용 자동차보험 계산기입니다.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "자동차보험 계산기",
    description: "운전 경력과 사고 이력을 반영한 예상 자동차보험료를 계산하세요.",
    url: PAGE_URL,
  },
};

export default function CarPage() {
  const faqs = [
    {
      q: "자동차보험료는 어떤 기준으로 산정되나요?",
      a: "기본요율(차종·차량가액)에 운전자 연령, 운전 경력, 사고 이력, 보험가입경력요율 등이 반영되어 산정됩니다. 같은 차량이라도 운전자 조건에 따라 보험료가 두 배 이상 차이 날 수 있습니다.",
    },
    {
      q: "운전 경력은 보험료에 얼마나 영향을 주나요?",
      a: "보험가입경력이 길수록 할인율이 커지며, 일반적으로 3년 이상 무사고 경력이 있을 때 의미 있는 할인이 적용됩니다. 가족 한정 운전자 특약 등을 활용하면 추가 할인이 가능할 수 있습니다.",
    },
    {
      q: "사고가 있으면 얼마나 할증되나요?",
      a: "사고 내용(대인·대물·자손)과 점수에 따라 할증률이 달라지며, 1건만으로도 다음 갱신 시 10~30% 이상 할증될 수 있습니다. 사고건수요율은 최근 3년간의 이력을 주로 반영합니다.",
    },
    {
      q: "다이렉트와 대면 가입 차이는?",
      a: "다이렉트(온라인)는 설계사 수수료가 없어 평균적으로 보험료가 저렴한 편입니다. 다만 사고 처리·상담 편의성에서 차이가 있을 수 있어 본인 우선순위에 맞춰 선택하시기 바랍니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2026년 기준
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          자동차보험 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          나이, 운전 경력, 최근 사고 건수, 차량가액을 입력하면 일반적인 자동차
          보험 산출 기준으로 예상 보험료 범위를 확인할 수 있습니다.
        </p>
      </header>

      <CarCalc />

      <div className="mt-6">
        <CTABox />
      </div>

      <div className="mt-6">
        <NoticeBox>
          <strong>본 계산 결과는 참고용이며 실제 보험료와 다를 수 있습니다.</strong>{" "}
          정확한 보험료는 각 보험사 다이렉트 견적을 통해 확인하시기 바랍니다.
        </NoticeBox>
      </div>

      <RelatedCalculators currentHref="/car-insurance-calculator" />

      <section className="mt-14 prose-seo">
        <h2>자동차보험료의 구조</h2>
        <p>
          자동차보험료는 크게 <strong>의무보험(대인배상Ⅰ, 대물 일부)</strong>과{" "}
          <strong>임의보험(대인배상Ⅱ, 대물 추가, 자기신체사고, 자기차량손해, 무보험차상해)</strong>
          으로 구성됩니다. 의무보험은 모든 차량이 가입해야 하며, 임의보험은
          선택이지만 큰 사고 시 보장 공백을 막기 위해 대부분 가입합니다.
        </p>
        <p>
          기본요율은 차종, 차량가액, 안전장치 장착 여부 등에 따라 결정되고, 여기에
          운전자 연령·경력·사고 이력에 따른 가감 요율이 곱해져 최종 보험료가
          산정됩니다.
        </p>

        <h2>보험료에 영향을 주는 핵심 요소</h2>
        <ul>
          <li>
            <strong>운전자 연령:</strong> 통상 26세 이상부터 표준 요율, 그 이하는 할증이 적용됩니다.
          </li>
          <li>
            <strong>운전 경력:</strong> 보험가입경력이 길수록 할인폭이 커집니다.
          </li>
          <li>
            <strong>사고 이력:</strong> 최근 3년간 유책 사고가 있으면 할증이 적용됩니다.
          </li>
          <li>
            <strong>차량가액·차종:</strong> 고가차·스포츠카는 보험료가 높게 산정됩니다.
          </li>
          <li>
            <strong>특약 가입:</strong> 마일리지·블랙박스·자녀할인 등 특약으로 보험료를 낮출 수 있습니다.
          </li>
        </ul>

        <h2>자주 하는 실수</h2>
        <ul>
          <li>
            <strong>대물 보장금액을 너무 낮게 설정:</strong> 외제차 사고 시 1억 원 이상 손해도
            발생할 수 있어 충분한 한도가 권장됩니다.
          </li>
          <li>
            <strong>자기차량손해 미가입:</strong> 본인 과실 사고나 단독 사고 시 차량 수리비를 전액
            부담하게 될 수 있습니다.
          </li>
          <li>
            <strong>운전자 한정 특약을 잘못 설정:</strong> 한정된 운전자 외 사고 시 보장이 거절될 수
            있으니 가족 구성원·범위를 정확히 확인해야 합니다.
          </li>
          <li>
            <strong>할인 특약 누락:</strong> 마일리지, 블랙박스, 안전운전, 자녀할인 등 적용 가능한
            할인을 빠뜨리면 보험료가 더 높게 산정됩니다.
          </li>
        </ul>

        <h2>보험료 절약 팁</h2>
        <p>
          매년 갱신 시 <strong>2~3개 보험사 다이렉트 견적을 비교</strong>하는 것이 가장 효과적입니다.
          또한 마일리지 특약은 연 주행거리가 적을수록 할인폭이 크고, 블랙박스·차선이탈경고장치 등
          안전장치 할인도 누적하면 의미 있는 절감이 됩니다.
        </p>
        <p>
          무사고 기간을 유지하는 것이 가장 강력한 보험료 절약 수단입니다. 작은 사고라면 자비 처리
          여부를 사고처리 비용과 향후 할증액을 비교해 결정하는 것이 합리적입니다.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <div className="mt-10">
        <NoticeBox variant="info">
          본 페이지의 정보와 계산 결과는 참고 목적이며, 특정 보험사·상품 가입 권유나 재무 자문이
          아닙니다. 가입 전 반드시 약관과 보험사 공식 견적을 확인하시기 바랍니다.
        </NoticeBox>
      </div>

      <RelatedGuides cluster="car" />

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
            href="/insurance-premium-calculator"
            className="text-brand-600 hover:underline"
          >
            보험료 계산기
          </a>
        </div>
      </div>
    </article>
  );
}
