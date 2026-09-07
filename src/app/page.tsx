import type { Metadata } from "next";
import Link from "next/link";
import FAQ from "@/components/FAQ";
import { CALCULATORS, SITE } from "@/lib/site";
import { publishedGuides } from "@/lib/guides";
import { HOME_GROUPS, REVIEW_STEPS, PROTECTION_STEPS } from "@/lib/home";

export const metadata: Metadata = {
  title: "보험계산기 | 실손 병원비·보험 해지·가족 보장 점검",
  description: "병원비 중 내 부담은 얼마인지, 보험을 유지하면 얼마를 더 내는지, 가족에게 필요한 보장은 얼마인지. 상황에 맞는 보험 계산기와 준비할 자료를 한곳에서 확인하세요.",
  alternates: { canonical: SITE.url },
};

const faqs = [
  { q: "내 실손보험이 몇 세대인지 모르겠어요.", a: "보험증권이나 보험사 앱에서 상품명과 적용 약관을 먼저 확인하세요. 전환·재가입했다면 처음 가입한 시점만으로 선택하지 말고 현재 적용되는 계약을 기준으로 선택하세요. 이 사이트는 2·3세대, 4세대, 5세대 계산기를 제공합니다.", link: { href: "/guide/silson-generations", label: "실손보험 세대 구분 가이드" } },
  { q: "계산 결과가 실제 지급 보험금인가요?", a: "아닙니다. 입력한 조건에 따른 참고용 계산입니다. 보장 여부, 면책, 이미 사용한 한도와 상품별 약관 등에 따라 실제 지급액은 달라질 수 있습니다. 결과와 안내를 함께 확인하고 최종 금액은 보험사에 확인하세요. 기준이 확정되지 않은 일부 조건은 계산이 보류될 수 있습니다." },
  { q: "해지환급금도 자동으로 조회하나요?", a: "보험사 계약을 조회하지 않습니다. 보험사 앱이나 고객센터에서 확인한 현재 해지환급금과 납입 내역을 직접 입력해야 합니다. 해지·유지 계산은 금액을 비교하는 도구이며, 보장 상실이나 재가입 가능성까지 판단해 주지는 않습니다." },
  { q: "회원가입이나 상담 신청이 필요한가요?", a: "회원가입이나 상담 신청 없이 이용할 수 있습니다. 계산에 입력한 값은 브라우저에서 처리하며 계산을 위해 이름·연락처를 요구하지 않습니다." },
];
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4";

function calculator(href: string) {
  const item = CALCULATORS.find(c => c.href === href);
  if (!item) throw new Error(`등록되지 않은 홈 계산기: ${href}`);
  return item;
}

export default function HomePage() {
  const guides = publishedGuides();
  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="container-base grid gap-9 py-10 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-brand-700">내 보험을 이해하는 첫 계산</p>
            <h1 className="mt-4 break-keep text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl sm:leading-tight">
              병원비·보험료·가족 보장,<br />필요한 금액을 확인하세요
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              병원비, 남은 보험료, 가족에게 필요한 보장.{" "}<br className="hidden sm:block" />
              지금 궁금한 것부터 하나씩 확인하세요.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#start" className={`btn-primary ${focus}`}>내 상황에 맞게 시작하기 ↓</Link>
              <Link href="#calculators" className={`inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 ${focus}`}>전체 계산기 {CALCULATORS.length}개</Link>
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-500">회원가입 없이 · 입력값은 브라우저에서 계산 · 결과는 참고용</p>
          </div>
          <aside aria-labelledby="before-start" className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
            <p className="text-xs font-semibold tracking-widest text-indigo-200">계산 전 준비</p>
            <h2 id="before-start" className="mt-3 text-xl font-bold">이 자료를 곁에 두세요</h2>
            <dl className="mt-5 divide-y divide-slate-700 text-sm">
              {[
                ["병원비를 계산할 때", "보험증권 · 진료비 영수증 · 세부내역서"],
                ["해지와 유지를 비교할 때", "현재 해지환급금 · 월 보험료 · 남은 납입기간"],
                ["가족 보장을 점검할 때", "생활비 · 부채 · 준비된 자금 · 현재 보장금액"],
              ].map(([title, detail]) => <div key={title} className="py-4 first:pt-0 last:pb-0"><dt className="font-semibold">{title}</dt><dd className="mt-1.5 leading-6 text-slate-300">{detail}</dd></div>)}
            </dl>
          </aside>
        </div>
      </section>

      <section id="start" className="container-base scroll-mt-24 py-10 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight">지금 어떤 고민이 있으신가요?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">계산기 이름을 몰라도 괜찮습니다. 확인하려는 상황에서 시작하세요.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {HOME_GROUPS.map((group, i) => (
            <article key={group.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
              <span className="text-xs font-bold text-brand-600">0{i + 1} / {group.label}</span>
              <h3 className="mt-3 text-xl font-bold leading-snug">{group.question}</h3>
              <p className="mt-3 grow text-sm leading-6 text-slate-600">{group.description}</p>
              <Link href={group.start.href} className={`mt-5 inline-flex w-fit items-center rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 ${focus}`}>{group.start.label} →</Link>
              <Link href={group.hub} className={`mt-4 w-fit text-sm text-slate-600 underline underline-offset-4 hover:text-brand-700 ${focus}`}>{group.id === "budget" ? "자동차보험 견적 비교하기" : `${group.label} 안내 읽기`}</Link>
            </article>
          ))}
        </div>
      </section>

      <section id="silson" className="scroll-mt-24 border-y border-slate-200 bg-white py-10 sm:py-12">
        <div className="container-base">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold text-brand-700">병원비 계산의 시작</p><h2 className="mt-2 text-2xl font-bold">내 실손보험 세대를 먼저 확인하세요</h2></div>
            <Link href="/guide/silson-generations" className={`text-sm font-semibold text-brand-700 hover:underline ${focus}`}>세대 구분이 어렵다면 →</Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {HOME_GROUPS[0].calculators.map(href => {
              const calc = calculator(href);
              return <Link key={href} href={href} className={`group flex items-center justify-between rounded-xl border border-slate-200 p-5 transition-colors hover:border-brand-400 hover:bg-brand-50 ${focus}`}><div><h3 className="text-lg font-bold">{calc.short}</h3><p className="mt-1 text-sm text-slate-600">자기부담금 계산하기</p></div><span aria-hidden="true" className="text-xl text-brand-600">→</span></Link>;
            })}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">전환·재가입했다면 <strong className="font-semibold text-slate-800">현재 적용 약관</strong>을 확인하세요. 세대를 임의로 선택하면 다른 계산 결과가 나올 수 있습니다. 1세대 전용 계산기는 제공하지 않습니다.</p>
        </div>
      </section>

      <section className="container-base py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">해지 결정은 세 숫자를 확인한 뒤에</h2><p className="mt-2 text-sm leading-6 text-slate-600">돌려받을 돈과 앞으로 낼 돈은 다릅니다. 순서대로 나눠 보세요.</p></div><Link href="/insurance-cancellation" className={`text-sm font-semibold text-brand-700 hover:underline ${focus}`}>해지 전 점검사항 →</Link></div>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {REVIEW_STEPS.map((step, i) => <li key={step.href} className="border-t-2 border-brand-200 pt-5"><p className="text-xs font-bold text-brand-600">STEP 0{i + 1}</p><h3 className="mt-2 text-lg font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p><Link href={step.href} className={`mt-3 inline-block py-2 text-sm font-semibold text-brand-700 hover:underline ${focus}`}>{step.action} →</Link></li>)}
        </ol>
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">금액 비교만으로 해지를 결정하지 마세요. 사라지는 보장과 새 보험의 가입 가능성·면책 조건도 별도로 확인해야 합니다. 계산기 사이 입력값은 자동으로 전달되지 않습니다.</p>
      </section>

      <section id="protection" className="container-base scroll-mt-24 pb-10 sm:pb-14">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">가족 보장은 생활비부터 차례로</h2><p className="mt-2 text-sm leading-6 text-slate-600">필요한 자금을 먼저 정하고, 이미 준비된 보장과 비교하세요.</p></div><Link href="/protection-planning" className={`text-sm font-semibold text-brand-700 hover:underline ${focus}`}>가족 보장 점검사항 →</Link></div>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {PROTECTION_STEPS.map((step, i) => <li key={step.href} className="border-t-2 border-brand-200 pt-5"><p className="text-xs font-bold text-brand-600">STEP 0{i + 1}</p><h3 className="mt-2 text-lg font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p><Link href={step.href} className={`mt-3 inline-block py-2 text-sm font-semibold text-brand-700 hover:underline ${focus}`}>{step.action} →</Link></li>)}
        </ol>
        <p className="mt-5 text-sm leading-6 text-slate-600">계산기 사이 입력값은 자동으로 전달되지 않습니다. 앞에서 확인한 금액을 메모해 다음 계산기에 직접 입력하세요.</p>
      </section>

      <section id="calculators" className="scroll-mt-24 border-y border-slate-200 bg-white py-10 sm:py-12">
        <div className="container-base">
          <h2 className="text-2xl font-bold">전체 계산기 <span className="text-brand-600">{CALCULATORS.length}</span></h2>
          <p className="mt-2 text-sm text-slate-600">찾는 계산기가 정해져 있다면 여기에서 바로 여세요.</p>
          <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {HOME_GROUPS.map(group => <div key={group.id}><h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-500">{group.label}</h3><ul className="divide-y divide-slate-100">{group.calculators.map(href => {
              const calc = calculator(href);
              return <li key={href}><Link href={href} className={`flex items-center justify-between gap-3 rounded-lg py-4 hover:text-brand-700 ${focus}`}><span><span className="block text-sm font-semibold">{calc.short}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{calc.description}</span></span><span aria-hidden="true">↗</span></Link></li>;
            })}</ul></div>)}
          </div>
        </div>
      </section>

      <section className="container-base py-10 sm:py-14">
        <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">계산 다음에 읽을 보험 가이드</h2><Link href="/guide" className={`shrink-0 text-sm font-semibold text-brand-700 hover:underline ${focus}`}>전체 보기 →</Link></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HOME_GROUPS.slice(0, 3).map(group => {
            const guide = guides.find(g => g.slug === group.guide);
            if (!guide) return null;
            return <article key={guide.slug} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-brand-700">{group.label}</p><h3 className="mt-2 font-bold leading-6"><Link href={`/guide/${guide.slug}`} className={`hover:underline ${focus}`}>{guide.title}</Link></h3><p className="mt-2 text-sm leading-6 text-slate-600">{guide.description}</p></article>;
          })}
        </div>
        <div className="mt-10 border-t border-slate-200 pt-8"><h2 className="mb-5 text-xl font-bold">계산 전에 자주 묻는 질문</h2><FAQ items={faqs} /></div>
        <p className="mt-6 text-xs leading-6 text-slate-500">보험계산기는 특정 보험 가입·해지를 권유하거나 보험금 지급을 확정하지 않습니다. <Link href="/disclaimer" className={`underline underline-offset-4 ${focus}`}>계산 결과의 범위와 한계</Link>를 확인해 주세요.</p>
      </section>
    </>
  );
}
