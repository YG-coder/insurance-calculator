import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import PageUpdated from "@/components/PageUpdated";
import RegulatoryBasis from "@/components/RegulatoryBasis";
import { CALCULATORS, HUBS, SITE } from "@/lib/site";
import { CONTEXT_LINKS, SILSON_GENERATIONS } from "@/lib/calculator-content";

export default function CalculatorDetails({ path }: { path: string }) {
  const calculator = CALCULATORS.find((item) => item.href === path);
  if (!calculator) return null;
  const generations = SILSON_GENERATIONS[path];
  const hub = HUBS.find((item) => item.steps.some((step) => step === path));
  const links = CONTEXT_LINKS[path] ?? [];
  const breadcrumb = [
    { name: "홈", item: SITE.url },
    ...(hub ? [{ name: hub.title, item: SITE.url + "/" + hub.slug }] : []),
    { name: calculator.title, item: SITE.url + path },
  ];
  return (
    <section id="calculation-basis" className="mt-10 scroll-mt-24 border-t border-slate-200 pt-6" aria-labelledby="calculation-basis-heading">
      <h2 id="calculation-basis-heading" className="text-xl font-bold text-slate-900">계산 기준과 참고 자료</h2>
      <PageUpdated path={path} name={calculator.title} structured={false} />
      {generations ? <RegulatoryBasis generations={generations} /> : (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          이용자가 입력한 금액과 기간으로 합계·차이·비율을 계산합니다. 보험사의 보험료 산출 요율이나
          실손보험 표준약관의 보험금 산식을 적용하는 계산기는 아닙니다. 실제 계약 금액은 보험사의
          안내에서 확인한 뒤 입력하세요.
        </p>
      )}
      {links.length > 0 && (
        <div className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
          {links.map((link) => <p key={link.href}>{link.context}{" "}
            <Link href={link.href} className="font-semibold text-brand-700 underline underline-offset-2">
              {link.label} →
            </Link>
          </p>)}
          <p className="text-xs text-slate-500">계산기 사이에 입력값은 자동으로 전달되지 않습니다.</p>
        </div>
      )}
      <nav aria-label="계산기 탐색경로" className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {breadcrumb.map((item, index) => <span key={item.item}>
          {index > 0 && <span aria-hidden="true" className="mr-2">›</span>}
          {index === breadcrumb.length - 1 ? <span aria-current="page">{item.name}</span> :
            <Link href={index === 0 ? "/" : "/" + hub!.slug} className="underline underline-offset-2">{item.name}</Link>}
        </span>)}
      </nav>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
      }} />
    </section>
  );
}
