import type { Metadata } from "next";
import Link from "next/link";
import HealthCalc from "@/components/calculators/HealthCalc";
import NoticeBox from "@/components/NoticeBox";
import CTABox from "@/components/CTABox";
import FAQ from "@/components/FAQ";
import RelatedCalculators from "@/components/RelatedCalculators";
import RelatedGuides from "@/components/RelatedGuides";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/health-insurance-calculator`;

export const metadata: Metadata = {
  title: "실손보험 자기부담금 계산기",
  description:
    "병원비 중 본인이 부담할 금액과 보험 적용 금액을 무료로 계산하세요. 4세대 실손보험 기준 본인부담률을 반영한 참고용 계산기입니다.",
  alternates: { canonical: URL },
  openGraph: {
    title: "실손보험 자기부담금 계산기",
    description: "병원비 중 본인부담금과 보험 적용 금액을 계산하세요.",
    url: URL,
  },
};

export default function HealthPage() {
  const faqs = [
    {
      q: "급여와 비급여는 어떻게 다른가요?",
      a: "급여는 국민건강보험에서 일부를 부담해주는 진료 항목이고, 비급여는 환자가 100% 부담하는 항목입니다. 실손보험은 두 항목 모두 보장하지만, 4세대부터는 비급여의 자기부담률이 더 높게 설계되어 있습니다.",
    },
    {
      q: "통원과 입원의 자기부담금 차이는?",
      a: "자기부담률 자체는 급여 20%, 비급여 30%로 입원과 통원이 동일합니다. 통원에는 회당 최소공제액(급여 1~2만 원, 비급여 3만 원)과 보험금 지급액 20만 원 한도가 적용되지만, 입원에는 이러한 회당 최소공제액과 회당 한도가 없습니다. 다만 연간 보상한도는 상해·질병과 급여·비급여 보장별로 구분되며, 각 보장 안에서 입원과 통원 보험금이 합산됩니다.",
    },
    {
      q: "실손보험 세대별로 자기부담률이 다른가요?",
      a: "네, 1세대(0%) → 2세대(10%) → 3세대(10~20%) → 4세대(급여 20%, 비급여 30%)로 갈수록 자기부담률이 높아집니다. 본 계산기는 4세대 기준을 참고용으로 적용합니다.",
    },
    {
      q: "비급여 항목 중 자주 청구되는 것은?",
      a: "도수치료, MRI/CT 일부, 비급여 주사제, 비급여 검사 등이 대표적입니다. 4세대 실손에서는 비급여 청구 횟수에 따라 다음 해 보험료가 할증되는 차등제가 적용됩니다.",
    },
  ];

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          참고용 · 2026년 기준
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          실손보험 자기부담금 계산기
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          병원비 중 본인이 부담할 금액과 실손보험으로 적용받을 수 있는 금액을 빠르게
          계산해보세요. 급여·비급여 구분과 통원 최소공제액에 따라 본인부담금이 다르게 계산됩니다.
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

      <HealthCalc />

      <div className="mt-6">
        <Link
          href="/5th-generation-health-insurance-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border-2 border-brand-200 bg-brand-50 px-5 py-4 font-semibold text-brand-800 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>2026년 5세대 실손보험에 가입하셨나요? 5세대 실손보험 기준으로 계산하기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-3">
        <Link
          href="/surrender-value-calculator"
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:border-brand-300 hover:shadow-md"
        >
          <span>보험 해지를 고민 중이라면? 해지환급금 계산기로 손익 확인하기</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-6">
        <CTABox />
      </div>

      <div className="mt-6">
        <NoticeBox>
          <strong>
            본 계산기는 국민건강보험료(직장가입자·지역가입자 보험료)가 아닌, 실손의료보험(실비보험)
            자기부담금을 계산합니다.
          </strong>{" "}
          실제 보험금은 상품, 약관, 가입 시기에 따라 달라질 수 있습니다. 본 계산기는 4세대
          실손보험 기준의 일반적인 자기부담률을 단순화하여 적용한 참고용 도구이며, 정확한 보장
          내역은 가입하신 보험사 약관과 청구 안내를 확인하시기 바랍니다.
        </NoticeBox>
      </div>

      <RelatedCalculators currentHref="/health-insurance-calculator" />

      <section className="mt-14 prose-seo">
        <h2>실손의료보험이란?</h2>
        <p>
          실손의료보험은 가입자가 질병이나 상해로 병원에서 실제 부담한 의료비를 보험사가 일정
          비율로 보장해주는 제3보험 상품입니다. 흔히 <strong>‘실비보험’</strong>으로 불리며,
          국내에서 약 4천만 명 이상이 가입한 대중적인 보험입니다. 국민 건강보험이 모든 의료비를
          보장하지 못하기 때문에, 실손보험은 건강보험이 커버하지 못하는 영역을 메우는 역할을
          합니다.
        </p>
        <p>
          실손보험은 출시 시기에 따라 1세대(2009년 이전), 2세대(2009~2017), 3세대(2017~2021),
          4세대(2021년 7월~)로 구분되며 세대별로 자기부담률, 한도, 갱신 주기 등이 다릅니다. 가장
          최근 출시된 4세대 실손보험은 비급여 청구 실적에 따라 보험료가 할인·할증되는 차등제가
          도입된 것이 특징입니다.
        </p>

        <h2>자기부담금 계산 기준</h2>
        <p>
          자기부담금은 병원비 중 가입자가 직접 부담해야 하는 금액입니다. 4세대 실손보험 기준
          자기부담률은 다음과 같이 적용됩니다.
        </p>
        <ul>
          <li>
            <strong>급여 + 통원:</strong> 본인부담률 20%와 최소공제액(병·의원급 1만 원,
            상급종합·종합병원 2만 원) 중 큰 금액
          </li>
          <li>
            <strong>급여 + 입원:</strong> 본인부담률 20% (최소공제액 없음)
          </li>
          <li>
            <strong>비급여 + 통원:</strong> 본인부담률 30%와 최소공제액 3만 원 중 큰 금액
          </li>
          <li>
            <strong>비급여 + 입원:</strong> 본인부담률 30% (최소공제액 없음)
          </li>
        </ul>
        <p>
          4세대 실손보험은 급여·비급여 모두 <strong>입원과 통원의 자기부담률이 동일</strong>합니다.
          다만 통원 진료에는 회당 최소공제액이 추가로 적용되어, 소액 치료의 경우 정률보다 최소공제액이
          본인부담금이 되는 경우가 많습니다. 급여 통원의 최소공제액은 방문한 의료기관 종류에 따라
          병·의원급은 1만 원, 상급종합병원·종합병원은 2만 원으로 나뉩니다. 또한 비급여 항목의 경우
          일부 특약(도수치료, 비급여 주사 등)은 별도의 한도와 횟수 제한이 적용됩니다.
        </p>

        <h2>실제 예시: 30만 원 비급여 통원 진료 (한도 적용 전 단순 계산)</h2>
        <p>
          아래는 <strong>자기부담률과 최소공제액만 단순 적용한 계산</strong>입니다. 비급여 통원
          진료비 <strong>30만 원</strong>에 자기부담률 30%만 단순 적용하면 본인부담금은 9만 원,
          <strong>한도 적용 전 보험 적용 대상 금액</strong>은 21만 원입니다. 이 계산에는 회당·연간
          한도와 특약별 제한이 반영되지 않아 실제 지급보험금과 다를 수 있으며, 이 금액을 실제로
          받게 될 보험금으로 해석하시면 안 됩니다.
        </p>
        <p>
          또 다른 예로, 급여 입원 치료비가 <strong>200만 원</strong>이고 자기부담률이 20%라면 본인
          부담금 40만 원, 한도 적용 전 보험 적용 대상 금액은 160만 원입니다. 입원은 자기부담률 자체는
          통원과 동일하지만 회당 최소공제액이 적용되지 않습니다. 이 예시 역시 약관상 한도와 보장 제외
          항목, 비급여 차등제를 반영하지 않은 단순 계산입니다.
        </p>

        <h2>자주 하는 실수</h2>
        <ul>
          <li>
            <strong>비급여를 무조건 다 보장받는다고 오해:</strong> 4세대부터는 비급여 차등제가
            적용되어 청구가 많을수록 다음 해 보험료가 할증됩니다.
          </li>
          <li>
            <strong>최소공제액을 빼고 계산:</strong> 통원 진료의 경우 정률보다 최소공제액이 큰
            경우, 최소공제액이 본인부담금이 됩니다.
          </li>
          <li>
            <strong>비보장 항목 청구 시도:</strong> 미용·성형, 일부 영양제, 예방접종 등은 실손에서
            제외되는 경우가 많습니다.
          </li>
          <li>
            <strong>청구 시효 놓침:</strong> 진료일로부터 3년 내 청구하지 않으면 청구권이
            소멸됩니다.
          </li>
        </ul>

        <h2>의료비 절약 팁</h2>
        <p>
          실손보험을 효율적으로 활용하려면 우선 <strong>비급여 항목 발생 전 사전 확인</strong>이
          중요합니다. 도수치료, 체외충격파, 비급여 주사 등은 본인부담률이 높고 차등제 영향도 받기
          때문입니다. 또한 1년 동안 누적 의료비가 일정 수준을 넘으면 본인부담상한제(국민건강보험)에
          의해 환급받을 수 있는 금액이 있는지 확인해보는 것도 좋습니다.
        </p>
        <p>
          마지막으로, 실손보험을 두 개 이상 가입했다고 해서 두 배로 받는 것이 아니라{" "}
          <strong>비례보상</strong> 원칙에 따라 한 번만 보장됩니다. 따라서 중복 가입은 피하는 것이
          좋고, 본인의 의료 이용 패턴에 맞춰 1세대→4세대로 전환할지 여부도 주기적으로 점검하시기
          바랍니다.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>

      <div className="mt-10">
        <NoticeBox variant="info">
          본 페이지의 정보와 계산 결과는 일반적인 정보 제공 및 참고 목적이며, 개별 보험 상품의
          가입·청구·보장 결정에 대한 법적·재무적 자문이 아닙니다. 정확한 보장 내용은 가입하신
          보험사의 약관과 안내를 따르시기 바랍니다.
        </NoticeBox>
      </div>
      <RelatedGuides cluster="health" />

      <div className="mt-12 border-t pt-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">
          다른 계산기도 확인해보세요
        </p>

        <div className="flex flex-wrap gap-3 text-sm">
          <a
              href="/insurance-premium-calculator"
              className="text-brand-600 hover:underline"
          >
            보험료 비중 계산기
          </a>

          <a
              href="/car-insurance-calculator"
              className="text-brand-600 hover:underline"
          >
            자동차보험 견적 비교 계산기
          </a>
        </div>
      </div>
    </article>
  );
}
