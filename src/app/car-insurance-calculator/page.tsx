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
      "운전자 연령, 운전 경력, 사고 이력, 차종, 차량가액을 기준으로 예상 자동차보험료를 무료로 계산하세요. 2026년 기준 참고용 자동차보험 계산기입니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "자동차보험 계산기",
    description: "운전 경력과 사고 이력을 반영한 예상 자동차보험료를 계산하세요.",
    url: URL,
  },
};

export default function CarPage() {
  const faqs = [
    {
      q: "자동차보험료는 어떻게 결정되나요?",
      a: "자동차보험료는 운전자의 연령, 운전 경력, 사고 이력, 차량의 종류·연식·가액, 그리고 보장 담보와 특약 구성에 따라 산출됩니다.",
    },
    {
      q: "사고 이력이 있으면 얼마나 할증되나요?",
      a: "일반적으로 사고 이력이 있으면 다음 해 보험료가 오를 수 있으며, 사고 횟수와 손해액에 따라 할증 폭이 달라집니다.",
    },
    {
      q: "다이렉트 자동차보험과 설계사 보험은 무엇이 다른가요?",
      a: "다이렉트 자동차보험은 가입자가 직접 온라인으로 가입해 보험료가 상대적으로 저렴한 편이고, 설계사 채널은 상담과 사고 처리 안내를 받기 쉽습니다.",
    },
    {
      q: "차량가액은 어디서 확인하나요?",
      a: "차량가액은 보험사 견적 화면, 보험개발원 기준가액, 자동차보험 갱신 안내서 등에서 확인할 수 있습니다.",
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
            운전 경력과 사고 이력, 차종·차량가액을 반영해 예상 자동차보험료를 빠르게 계산해보세요.
            개인정보 입력 없이 바로 사용할 수 있는 참고용 계산기입니다.
          </p>
        </header>

        <CarCalc />

        <div className="mt-6">
          <CTABox />
        </div>

        <div className="mt-6">
          <NoticeBox>
            <strong>실제 보험료는 보험사, 담보 구성, 특약, 할인 조건에 따라 달라질 수 있습니다.</strong>{" "}
            본 계산기는 일반적인 자동차보험 위험요율을 단순화하여 적용한 참고용 도구이며, 정확한
            보험료는 각 보험사 견적 시스템에서 확인하시기 바랍니다.
          </NoticeBox>
        </div>

        <RelatedCalculators currentHref="/car-insurance-calculator" />

        <section className="mt-14 prose-seo">
          <h2>자동차보험이란?</h2>
          <p>
            자동차보험은 자동차 운행 중 발생하는 사고로 타인에게 입힌 인적·물적 손해와, 본인 차량의
            파손 및 본인의 부상 등을 보장하는 손해보험 상품입니다. 우리나라에서는{" "}
            <strong>자동차손해배상보장법</strong>에 따라 모든 차량 소유자가 의무적으로 가입해야 하는{" "}
            <strong>책임보험</strong>이 정해져 있으며, 그 외에도 다양한 담보를 추가로 가입할 수 있습니다.
          </p>
          <p>
            일반적으로 자동차보험은{" "}
            <strong>대인배상Ⅰ·Ⅱ, 대물배상, 자기신체사고, 자동차상해, 자기차량손해, 무보험차상해</strong>
            등의 담보로 구성됩니다. 각 담보의 가입금액과 자기부담금 수준에 따라 보험료가 크게 달라지므로,
            본인의 운전 환경에 맞춰 적정한 보장 수준을 선택하는 것이 중요합니다.
          </p>

          <h2>자동차보험료에 영향을 주는 요소</h2>
          <ul>
            <li>
              <strong>운전자 연령:</strong> 20대 초반과 고령 운전자는 상대적으로 보험료가 높게 책정될 수 있습니다.
            </li>
            <li>
              <strong>운전 경력:</strong> 가입 경력이 길수록 할인 등급이 올라가며, 신규 운전자는 할증이 적용될 수 있습니다.
            </li>
            <li>
              <strong>사고 이력:</strong> 최근 사고 횟수와 손해액에 따라 다음 해 보험료가 할증될 수 있습니다.
            </li>
            <li>
              <strong>차종·차량가액:</strong> 대형차·수입차는 수리비가 높아 자기차량손해 보험료가 높아질 수 있습니다.
            </li>
            <li>
              <strong>운전자 범위:</strong> 본인 한정, 부부 한정, 가족 한정, 누구나 운전 등 범위에 따라 보험료가 달라집니다.
            </li>
            <li>
              <strong>특약:</strong> 마일리지, 블랙박스, 자녀 할인, 안전운전 특약 등에 따라 보험료가 낮아질 수 있습니다.
            </li>
          </ul>

          <h2>실제 예시: 35세 5년차 운전자, 중형차 2,500만 원</h2>
          <p>
            만 35세, 운전 경력 5년, 무사고, 중형 세단 2,500만 원 차량을 기준으로 입력하면 연 보험료가
            약 <strong>40~60만 원</strong> 수준으로 추정될 수 있습니다. 동일 조건에서 사고 이력이 있으면
            보험료가 상승할 수 있습니다.
          </p>
          <p>
            반대로 신규 운전자이거나 운전자 연령이 낮은 경우에는 같은 차량이라도 보험료가 크게 높아질 수
            있습니다. 따라서 차량 구매 전 예상 자동차보험료를 먼저 확인해보는 것이 좋습니다.
          </p>

          <h2>자동차보험료 절약 팁</h2>
          <ul>
            <li>
              <strong>다이렉트 채널 활용:</strong> 동일 보장이라도 다이렉트 가입 시 보험료가 낮아질 수 있습니다.
            </li>
            <li>
              <strong>비교 견적:</strong> 보험사별로 같은 조건에서도 보험료 차이가 크므로 여러 보험사를 비교하는 것이 좋습니다.
            </li>
            <li>
              <strong>운전자 범위 조정:</strong> 실제 운전자가 한정되어 있다면 운전자 범위를 좁히는 것이 유리할 수 있습니다.
            </li>
            <li>
              <strong>마일리지 특약:</strong> 연 주행거리가 적다면 마일리지 특약으로 보험료 환급을 받을 수 있습니다.
            </li>
            <li>
              <strong>블랙박스·안전운전 특약:</strong> 블랙박스 장착, 안전운전 점수 특약 등을 활용하면 추가 할인을 받을 수 있습니다.
            </li>
          </ul>

          <h2>자주 하는 실수</h2>
          <ul>
            <li>
              <strong>책임보험만 가입:</strong> 의무보험만으로는 본인 차량 손해나 운전자 부상 보장이 부족할 수 있습니다.
            </li>
            <li>
              <strong>대물배상 한도 부족:</strong> 수입차 사고나 다중 추돌 사고를 고려하면 충분한 한도 설정이 필요합니다.
            </li>
            <li>
              <strong>갱신 비교 생략:</strong> 매년 보험료가 달라질 수 있으므로 갱신 때마다 비교 견적을 확인하는 것이 좋습니다.
            </li>
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            자주 묻는 질문
          </h2>
          <FAQ items={faqs} />
        </section>

        <div className="mt-10">
          <NoticeBox variant="info">
            본 페이지의 정보와 계산 결과는 일반적인 정보 제공 및 참고 목적이며, 개별 자동차보험 상품의
            가입·청구·보장 결정에 대한 법적·재무적 자문이 아닙니다. 정확한 보장 내용은 가입하신
            보험사의 약관과 안내를 따르시기 바랍니다.
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