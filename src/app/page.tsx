import type { Metadata } from "next";
import Link from "next/link";
import CalculatorCard from "@/components/CalculatorCard";
import FAQ from "@/components/FAQ";
import { CALCULATORS, SITE } from "@/lib/site";
import { publishedGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: `${SITE.name} - 해지환급금·사망보장·실손 자기부담금 계산`,
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
      a: "대부분의 계산기는 이용자가 직접 입력한 값을 산수로 계산합니다. 사이트가 임의의 평균값이나 추정치를 만들어 넣지 않으며, 실손보험 자기부담금은 4세대·5세대 실손보험의 자기부담률 등 공개된 기준을 그대로 반영합니다.",
    },
    {
      q: "어떤 계산기를 쓸 수 있나요?",
      a: "실손보험 자기부담금(4세대·5세대) 계산기와 함께, 해지환급금·앞으로 낼 보험료·해지 vs 유지 같은 손익 판단 계산기, 사망보장·유족 생활비·보장 공백 같은 보장 설계 계산기를 제공합니다. 보험을 유지할지 해지할지, 보장이 얼마나 부족한지 같은 의사결정에 필요한 숫자를 직접 계산할 수 있습니다.",
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
            보험, 계산해서 결정하세요
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            지금 해지하면 얼마인지, 유지하면 얼마를 더 내는지, 보장이 얼마나 부족한지 —
            입력한 값으로 직접 계산합니다. 추정값 없이, 개인정보 입력 없이 바로 사용하세요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/surrender-value-calculator" className="btn-primary">
              해지환급금 계산하기
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
          <h2 className="text-2xl font-bold text-slate-900 mb-4">이 사이트가 계산하는 방식</h2>
          <div className="prose-seo">
            <p>
              보험계산기는 <strong>보험료가 얼마 나올지 추정해 주는 사이트가 아닙니다.</strong> 대신 이미
              알고 있는 값 — 지금까지 낸 보험료, 해지환급금, 월 생활비, 현재 보장금액 등 — 을 입력하면,
              그 값으로 <strong>보험 의사결정에 필요한 숫자</strong>를 계산합니다.
            </p>
            <p>
              예를 들어 지금 해지하면 얼마를 돌려받는지(해지환급금), 유지하면 앞으로 얼마를 더 내는지
              (앞으로 낼 보험료), 필요한 보장에서 얼마가 부족한지(보장 공백)를 계산합니다. 어느 쪽이 유리한지
              단정하거나 특정 상품을 추천하지 않으며, <strong>평균값이나 추정 상수를 임의로 넣지 않습니다.</strong>
              판단에 필요한 숫자를 제공하고, 결정은 이용자가 하도록 돕는 것이 이 사이트의 방식입니다.
            </p>
          </div>
        </div>
      </section>

      <section className="container-base py-14">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">세 가지 계산으로 보험을 정리하세요</h2>
          <div className="prose-seo">
            <ul>
              <li>
                <strong>실손보험 자기부담금:</strong> 4세대·5세대 실손보험 기준으로 병원비 중 본인부담금과
                보험 적용 금액을 계산합니다. 공개된 자기부담률을 그대로 적용합니다.
              </li>
              <li>
                <strong>손익 판단 (해지환급금 · 앞으로 낼 보험료 · 해지 vs 유지):</strong> 지금 해지하면
                받는 금액과 유지하면 앞으로 낼 금액을 계산해, 해지·유지 결정에 필요한 숫자를 나란히 보여줍니다.
              </li>
              <li>
                <strong>보장 설계 (사망보장 · 유족 생활비 · 보장 공백):</strong> 유족에게 필요한 자금과
                이미 준비된 자금을 입력하면, 필요한 보장금액과 현재 보장과의 차이를 계산합니다.
              </li>
            </ul>
            <p>
              모든 계산은 이용자가 입력한 값을 기준으로 하며, 적정 금액이나 추천 상품을 제시하지 않습니다.
              정확한 보험료·보장 내역은 가입하신 보험사의 공식 채널에서 확인하시기 바랍니다.
            </p>
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
