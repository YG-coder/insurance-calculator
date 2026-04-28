import type { Metadata } from "next";
import CarCalc from "@/components/calculators/CarCalc";
import NoticeBox from "@/components/NoticeBox";
import CTABox from "@/components/CTABox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/car-insurance-calculator`;

export const metadata: Metadata = {
  title: "자동차보험 계산기",
  description:
    "운전 경력, 사고 이력, 차량가액 기준으로 예상 자동차보험료를 무료로 계산하세요. 2026년 기준 참고용 자동차보험 계산기입니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "자동차보험 계산기",
    description: "운전 경력·사고이력·차량가액 기준 예상 자동차보험료 계산.",
    url: URL,
  },
};

export default function CarPage() {
  const faqs = [
    {
      q: "자동차보험료는 어떻게 결정되나요?",
      a: "기본적으로 운전자 연령·경력·사고이력, 차량 가액·차종, 보장 범위와 한도, 특약(블랙박스, 마일리지, 자녀할인 등)에 따라 결정됩니다. 보험사별 요율 차이도 크기 때문에 동일 조건에서도 견적을 비교해야 합니다.",
    },
    {
      q: "사고 1건이 나면 보험료가 얼마나 오르나요?",
      a: "사고 종류·과실 비율·보험금 지급액에 따라 다르지만, 일반적으로 다음 갱신 시 10~30% 수준으로 할증되는 경우가 많습니다. 무사고 할인이 사라지는 영향까지 합치면 체감 인상폭은 더 큽니다.",
    },
    {
      q: "마일리지·블랙박스 특약은 효과가 있나요?",
      a: "주행거리가 짧다면 마일리지 특약으로 10~40% 할인이 가능하며, 블랙박스 특약은 보통 3~5% 할인됩니다. 자녀할인, 안전운전 특약 등도 조건이 맞으면 누적 할인 효과가 큽니다.",
    },
    {
      q: "보험사를 옮기면 무사고 할인이 사라지나요?",
      a: "아니요, 동일 보험기간 정보가 보험개발원을 통해 공유되어 다른 보험사로 옮겨도 무사고 할인 등급이 유지됩니다. 따라서 매년 갱신 시점에 비교 견적을 받아보는 것이 유리합니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2026년 기준
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">자동차보험 계산기</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          나이, 운전 경력, 최근 사고 이력, 차량가액을 입력하면 예상되는 연 자동차보험료 범위를
          확인할 수 있습니다.
        </p>
      </header>

      <CarCalc />

      <div className="mt-6">
        <CTABox />
      </div>

      <div className="mt-6">
        <NoticeBox>
          <strong>본 계산 결과는 참고용이며 실제 자동차보험료와 다를 수 있습니다.</strong> 정확한
          보험료는 보험사 공식 견적 시스템에서 확인하시기 바라며, 차종·지역·특약 등에 따라 결과가
          크게 달라질 수 있습니다.
        </NoticeBox>
      </div>

      <RelatedCalculators currentHref="/car-insurance-calculator" />

      <section className="mt-14 prose-seo">
        <h2>자동차보험의 기본 구조</h2>
        <p>
          자동차보험은 크게{" "}
          <strong>
            대인배상Ⅰ(의무가입), 대인배상Ⅱ, 대물배상, 자기신체사고(자손)·자동차상해,
            자기차량손해(자차), 무보험차상해
          </strong>
          의 6대 담보로 구성됩니다. 이 중 대인배상Ⅰ과 대물배상 일부는 자동차손해배상 보장법에 따라
          의무 가입 대상이고, 나머지는 선택입니다.
        </p>
        <p>
          최근에는 자기신체사고 대신 보장 범위가 넓은 <strong>자동차상해</strong>를 선택하는
          운전자가 많아졌고, 자차의 경우 차량 가액이 낮은 노후 차량은 보험료 대비 효익이 작아
          미가입을 선택하는 경우도 있습니다. 본인의 운전 환경과 차량 상태에 맞춰 담보를 설계하는
          것이 중요합니다.
        </p>

        <h2>보험료에 영향을 주는 핵심 요소</h2>
        <ul>
          <li>
            <strong>운전자 연령:</strong> 만 26세 미만은 보험료가 30~50% 더 비쌉니다.
          </li>
          <li>
            <strong>운전 경력:</strong> 경력 1년 미만은 할증, 3년 이상부터 본격 할인.
          </li>
          <li>
            <strong>사고 이력:</strong> 최근 3년 사고 건수와 보험금 지급액이 큰 영향.
          </li>
          <li>
            <strong>차량 가액·차종:</strong> 고가·고성능 차량일수록 자차·대물 보험료 상승.
          </li>
          <li>
            <strong>운전자 범위:</strong> 본인한정 &lt; 부부한정 &lt; 가족한정 &lt; 누구나.
          </li>
          <li>
            <strong>주행거리:</strong> 마일리지 특약을 활용하면 큰 할인 가능.
          </li>
        </ul>

        <h2>실제 예시: 35세, 경력 5년, 무사고, 2,500만 원 차량</h2>
        <p>
          만 35세, 운전 경력 5년, 최근 3년 무사고, 차량가액 <strong>2,500만 원</strong>의 가족한정
          운전자라면, 보험사·특약에 따라 다르지만 일반적인 종합보험 기준 연 60만 원~85만 원 수준의
          보험료가 산정될 수 있습니다.
        </p>
        <p>
          반면 같은 운전자가 만 24세, 경력 1년 미만이라면 같은 차량에서도 90만 원~140만 원 수준으로
          보험료가 1.5~2배까지 상승할 수 있습니다. 또한 최근 1건의 대물 사고가 있다면 추가로
          10~25% 할증이 붙어 체감 상승폭은 더 커집니다.
        </p>

        <h2>자주 하는 실수</h2>
        <ul>
          <li>
            <strong>대물배상 한도를 너무 낮게 설정:</strong> 최근 외제차·고가차량 증가로 대물 1억은
            부족할 수 있어 2~5억 권장.
          </li>
          <li>
            <strong>자동차상해 vs 자기신체사고 차이를 모름:</strong> 자동차상해가 보장 한도와 위자료
            측면에서 더 유리합니다.
          </li>
          <li>
            <strong>운전자 범위 잘못 설정:</strong> 가족이 운전 중 사고 시 ‘본인한정’이면 보장이
            거절될 수 있습니다.
          </li>
          <li>
            <strong>마일리지 약정 위반:</strong> 약정 거리를 초과하면 환급이 줄거나 사라집니다.
          </li>
          <li>
            <strong>갱신 시 비교 안 함:</strong> 같은 조건이라도 보험사별로 10~30% 차이가 흔합니다.
          </li>
        </ul>

        <h2>자동차보험료 절약 팁</h2>
        <p>
          첫째, <strong>다이렉트 자동차보험</strong>은 대면 상품 대비 보통 15~20% 저렴합니다. 둘째,
          마일리지·블랙박스·자녀할인·안전운전(T맵 등) 특약을 조합하면 누적 30% 이상 할인도
          가능합니다. 셋째, 운전자 범위를 가능한 좁게 설정하고, 필요할 때 ‘1일 자동차보험’으로
          임시 확장하는 방법도 효과적입니다.
        </p>
        <p>
          넷째, 사고가 발생했을 때 무조건 보험 처리하기보다 <strong>소액 자비 처리</strong>가
          유리한지 비교해야 합니다. 일반적으로 보험금 지급액이 50만 원 미만이면 이후 할증으로
          손해가 더 큰 경우가 많습니다. 마지막으로 매년 갱신 시점이 다가오면 최소 3~4개 보험사
          견적을 비교해 가장 유리한 보험사로 이동하는 것이 가장 큰 절약 방법입니다.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <div className="mt-10">
        <NoticeBox variant="info">
          본 페이지의 정보는 일반 참고용이며 특정 보험사·상품을 추천하지 않습니다. 가입 전 반드시
          보험사 공식 견적·약관·공시실 자료를 확인하시기 바랍니다.
        </NoticeBox>
      </div>
    </article>
  );
}
