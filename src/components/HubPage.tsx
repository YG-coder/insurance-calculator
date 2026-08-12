import Link from "next/link";
import Script from "next/script";
import FAQ from "@/components/FAQ";
import { SITE, CALCULATORS } from "@/lib/site";
import { publishedGuides } from "@/lib/guides";

type Hub = {
  slug: string;
  title: string;
  short: string;
  tagline: string;
  icon: string;
  steps: readonly string[];
  guideSlugs: readonly string[];
};

type FaqItem = { q: string; a: string };

const calcByHref = (href: string) => CALCULATORS.find((c) => c.href === href);

// step href가 계산기면 계산기 카드, /guide/* 면 가이드 스텝으로 해석
function resolveStep(href: string) {
  const calc = calcByHref(href);
  if (calc) return { href, title: calc.title, short: calc.short, icon: calc.icon, isGuide: false };
  if (href.startsWith("/guide/")) {
    const slug = href.replace("/guide/", "");
    const g = publishedGuides().find((x) => x.slug === slug);
    if (g) return { href, title: g.title, short: g.title, icon: "📖", isGuide: true };
  }
  return null;
}

export default function HubPage({
  hub,
  intro,
  stepNotes,
  understanding,
  faqs,
}: {
  hub: Hub;
  intro: string;
  stepNotes: string[]; // 각 step의 "무엇을/왜"
  understanding: string[]; // 결과 이해하는 법 (문단들)
  faqs: FaqItem[];
}) {
  const pageUrl = `${SITE.url}/${hub.slug}`;
  const steps = hub.steps.map((href) => resolveStep(href)).filter(Boolean) as NonNullable<
    ReturnType<typeof resolveStep>
  >[];

  const relatedGuides = hub.guideSlugs.length
    ? publishedGuides().filter((g) => hub.guideSlugs.includes(g.slug))
    : [];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: hub.title,
    itemListElement: steps.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.title,
      url: `${SITE.url}${c.href}`,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE.url },
      { "@type": "ListItem", position: 2, name: hub.short, item: pageUrl },
    ],
  };

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          보험 의사결정 허브
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">{hub.title}</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">{intro}</p>
      </header>

      {/* 추천 순서 */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-4">추천 순서</h2>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {steps.map((c, i) => (
            <div key={c.href} className="flex items-center gap-3 flex-1">
              <Link
                href={c.href}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300 hover:shadow-sm transition"
              >
                <div className="text-xs text-slate-400 font-semibold mb-1">Step {i + 1}</div>
                <div className="font-semibold text-slate-800">{c.short}</div>
              </Link>
              {i < steps.length - 1 && <span className="hidden sm:block text-slate-300">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* 단계별 상세 */}
      <section className="space-y-4 mb-10">
        {steps.map((c, i) => (
          <div key={c.href} className="rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-brand-600 font-bold mb-1">STEP {i + 1}</div>
                <h3 className="text-xl font-bold text-slate-900">{c.title}</h3>
                <p className="mt-2 text-slate-600 leading-relaxed">{stepNotes[i]}</p>
              </div>
              <span className="text-3xl" aria-hidden>{c.icon}</span>
            </div>
            <Link href={c.href} className="btn-primary mt-4 inline-flex">
              {c.isGuide ? `${c.short} 읽기 →` : `${c.short} 계산하기 →`}
            </Link>
          </div>
        ))}
      </section>

      {/* 결과 이해하는 법 */}
      {understanding.length > 0 && (
        <section className="mb-10">
          <div className="card">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">결과를 이해하는 법</h2>
            <div className="prose-seo space-y-3">
              {understanding.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 관련 가이드 */}
      {relatedGuides.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">관련 가이드</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedGuides.map((g) => (
              <Link
                key={g.slug}
                href={`/guide/${g.slug}`}
                className="card hover:border-brand-300 hover:shadow-md transition"
              >
                <div className="font-semibold text-slate-900">{g.title}</div>
                <div className="text-xs text-slate-600 mt-2 leading-relaxed">{g.description}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">자주 묻는 질문</h2>
          <FAQ items={faqs} />
        </section>
      )}

      <Script id={`ld-hub-itemlist-${hub.slug}`} type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Script id={`ld-hub-faq-${hub.slug}`} type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id={`ld-hub-breadcrumb-${hub.slug}`} type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </article>
  );
}
