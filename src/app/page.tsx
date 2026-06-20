import type { Metadata } from "next";
import Link from "next/link";
import CalculatorCard from "@/components/CalculatorCard";
import FAQ from "@/components/FAQ";
import { CALCULATORS, SITE } from "@/lib/site";
import { publishedGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: `${SITE.name} - 실손·자동차·보험료 무료 계산`,
  description: SITE.description,
  alternates: { canonical: SITE.url },
};

export default function HomePage() {
  const faqs = [
    {
      q: "보험계산기 결과는 정확한가요?",
      a: "본 사이트의 모든 계산은 참고용입니다. 실제 보험료와 보험금은 보험사·상품·약관·가입자의 건강 상태 등에 따라 달라질 수 있어, 정확한 금액은 각 보험사 공식 채널에서 확인하시기 바랍니다.",
    },
    {
      q: "개인정보를 입력해야 하나요?",
      a: "아니요. 보험계산기는 이름, 연락처 등 어떤 개인정보도 수집하지 않습니다. 입력값은 브라우저 안에서만 계산에 사용되며 서버로 전송되지 않습니다.",
    },
    {
      q: "어떤 기준으로 계산되나요?",
      a: "2026년 기준의 일반적인 보험 산출 방식을 단순화하여 적용합니다. 4세대 실손보험 자기부담률, 일반적인 보험료 산정 요소(연령·성별·흡연·보장금액), 자동차보험 위험요율 등을 반영합니다.",
    },
    {
      q: "어떤 계산기를 쓸 수 있나요?",
      a: "현재는 실손보험 자기부담금, 보험료, 자동차보험 세 가지 계산기를 제공합니다. 향후 운전자보험·암보험 등 더 다양한 계산기를 추가할 예정입니다.",
    },
  ];

  return (
    <>
      <section className="bg-gradient-to-br from-brand-50 via-white to-brand-50/30 border-b border-slate-100">
        <div className="container-base py-16 sm:py-20 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-4">
            2026년 기준 · 참고용
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-tight">
            보험, 한 번에 계산하세요
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            실손보험 본인부담금부터 자동차보험까지, 복잡한 보험 계산을 무료로
            빠르게. 개인정보 입력 없이 바로 사용할 수 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/health-insurance-calculator" className="btn-primary">
              실손보험 계산하기
            </Link>
            <Link
              href="#calculators"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-brand-300"
            >
              전체 계산기 보기
            </Link>
          </div>
        </div>
      </section>

      <section id="calculators" className="container-base py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">계산기 모음</h2>
          <p className="mt-2 text-slate-600">필요한 보험 항목을 선택해 바로 계산해보세요.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CALCULATORS.map((c) => (
            <CalculatorCard key={c.href} {...c} />
          ))}
        </div>
      </section>

      <section className="container-base py-14">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">보험 계산기 사용 가이드</h2>
          <div className="prose-seo">
            <p>
              보험은 같은 보장이라도 가입자의{" "}
              <strong>나이, 성별, 직업, 건강 상태, 흡연 여부, 가입 시점</strong>에 따라 보험료가
              크게 달라집니다. 또한 실손보험은 1세대~4세대까지 자기부담률 구조가 다르고, 자동차
              보험은 운전 경력과 사고 이력에 따라 같은 차량이라도 보험료가 두 배 이상 차이 날 수
              있습니다.
            </p>
            <p>
              본 사이트의 계산기는 일반적인 보험 산출 방식을 기반으로 한{" "}
              <strong>참고용 추정치</strong>를 제공합니다. 정확한 보험료는 각 보험사 공식 견적을
              받아보시는 것이 좋으며, 계산기는 보험 가입 전 대략적인 비용 감을 잡는 용도로
              활용하시기 바랍니다.
            </p>
          </div>
        </div>
      </section>

      <section className="container-base py-14">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">보험료에 영향을 주는 요소</h2>
          <div className="prose-seo">
            <ul>
              <li>
                <strong>연령:</strong> 일반적으로 나이가 많을수록 위험률이 높아 보험료가 상승합니다.
              </li>
              <li>
                <strong>성별:</strong> 동일 연령대에서 평균 수명·질병률 차이로 보험료가 달라집니다.
              </li>
              <li>
                <strong>흡연 여부:</strong> 흡연자는 비흡연자보다 보험료가 20~40% 가량 높을 수
                있습니다.
              </li>
              <li>
                <strong>건강 상태·과거 병력:</strong> 가입 심사 결과에 따라 할증·부담보 등이
                적용됩니다.
              </li>
              <li>
                <strong>보장 범위·기간:</strong> 보장금액과 보장 기간이 길수록 보험료가 올라갑니다.
              </li>
              <li>
                <strong>운전·차량 정보 (자동차보험):</strong> 운전 경력, 사고 이력, 차량가액, 차종이
                핵심 요소입니다.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="container-base py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            보험 가이드
          </h2>
          <Link
            href="/guide"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            전체 보기 →
          </Link>
        </div>
        <p className="text-slate-600 mb-6">
          계산만으로는 부족하다면, 보험을 고르고 활용하는 데 도움이 되는 가이드도
          함께 확인해보세요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {publishedGuides()
            .slice(0, 6)
            .map((g) => (
              <Link
                key={g.slug}
                href={`/guide/${g.slug}`}
                className="card hover:border-brand-300 hover:shadow-md transition"
              >
                <div className="font-semibold text-slate-900">{g.title}</div>
                <div className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {g.description}
                </div>
              </Link>
            ))}
        </div>
      </section>

      <section className="container-base py-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
        <FAQ items={faqs} />
      </section>
    </>
  );
}
