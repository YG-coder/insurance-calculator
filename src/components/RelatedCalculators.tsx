import Link from "next/link";
import Script from "next/script";
import { CALCULATORS, SITE } from "@/lib/site";

type Props = {
  currentHref: string;
};

export default function RelatedCalculators({ currentHref }: Props) {
  const related = CALCULATORS.filter((c) => c.href !== currentHref);
  const current = CALCULATORS.find((c) => c.href === currentHref);
  const jsonLd = current ? {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: current.title,
    description: current.description,
    url: `${SITE.url}${current.href}`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  } : null;

  return (
    <section className="mt-12">
      {jsonLd && (
        <Script
          id={`calculator-jsonld-${currentHref.replaceAll("/", "-")}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
        />
      )}
      <h2 className="text-xl font-bold text-slate-900 mb-4">관련 계산기</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {related.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card hover:border-brand-300 hover:shadow-md transition flex gap-3 items-start"
          >
            <span className="text-2xl">{c.icon}</span>
            <div>
              <div className="font-semibold text-slate-900">{c.title}</div>
              <div className="text-xs text-slate-600 mt-1">{c.description}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          ← 전체 계산기 보기
        </Link>
      </div>
    </section>
  );
}
