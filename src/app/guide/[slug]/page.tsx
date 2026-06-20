import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { notFound } from "next/navigation";
import FAQ from "@/components/FAQ";
import NoticeBox from "@/components/NoticeBox";
import { SITE } from "@/lib/site";
import {
  CLUSTER_META,
  getGuide,
  publishedGuides,
  siblingGuides,
  type Guide,
} from "@/lib/guides";

type Params = { slug: string };

export function generateStaticParams() {
  return publishedGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  const url = `${SITE.url}/guide/${guide.slug}`;
  const title = guide.seoTitle ?? guide.title;

  return {
    title,
    description: guide.description,
    keywords: [guide.keyword],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${title} | ${SITE.name}`,
      description: guide.description,
      url,
    },
    robots: { index: true, follow: true },
  };
}

// 문단/리스트 텍스트의 **굵게** 표기를 <strong>으로 변환
function renderRich(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

export default async function GuidePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const g = guide as Guide;
  const cluster = CLUSTER_META[g.cluster];
  const siblings = siblingGuides(g);
  const url = `${SITE.url}/guide/${g.slug}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE.url },
      {
        "@type": "ListItem",
        position: 2,
        name: "보험 가이드",
        item: `${SITE.url}/guide`,
      },
      { "@type": "ListItem", position: 3, name: g.title, item: url },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    inLanguage: "ko-KR",
    datePublished: g.updated,
    dateModified: g.updated,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
  };

  const faqJsonLd =
    g.faqs && g.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: g.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <article className="container-base py-10">
      {/* 브레드크럼 */}
      <nav className="text-sm text-slate-500 mb-6" aria-label="breadcrumb">
        <Link href="/" className="hover:text-brand-600">
          홈
        </Link>
        <span className="mx-2">/</span>
        <Link href="/guide" className="hover:text-brand-600">
          보험 가이드
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{cluster.label}</span>
      </nav>

      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-3">
          {cluster.label} · {g.updated} 기준
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
          {g.title}
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">{g.intro}</p>
      </header>

      {/* 해당 계산기 CTA */}
      {cluster.calcHref && (
        <div className="mb-8 rounded-xl border border-brand-200 bg-brand-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-slate-700">
            예상 금액이 궁금하다면 <strong>{cluster.calcLabel}</strong>로 바로
            계산해보세요.
          </p>
          <Link href={cluster.calcHref} className="btn-primary whitespace-nowrap">
            계산기 사용하기
          </Link>
        </div>
      )}

      {/* 본문 */}
      <section className="prose-seo">
        {g.body!.map((block, bi) => (
          <div key={bi}>
            <h2>{block.h2}</h2>
            {block.p?.map((para, pi) => (
              <p key={pi}>{renderRich(para, `p-${bi}-${pi}`)}</p>
            ))}
            {block.ul && (
              <ul>
                {block.ul.map((li, li2) => (
                  <li key={li2}>{renderRich(li, `li-${bi}-${li2}`)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* FAQ */}
      {g.faqs && g.faqs.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            자주 묻는 질문
          </h2>
          <FAQ items={g.faqs} />
        </section>
      )}

      {/* 면책 */}
      <div className="mt-10">
        <NoticeBox variant="info">
          본 콘텐츠는 일반적인 정보 제공 및 참고 목적이며, 개별 보험 상품의
          가입·청구·보장 결정에 대한 법적·재무적 자문이 아닙니다. 정확한 내용은
          가입하신 보험사의 약관과 안내를 따르시기 바랍니다.
        </NoticeBox>
      </div>

      {/* 형제 가이드 */}
      {siblings.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            함께 보면 좋은 글
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {siblings.map((s) => (
              <Link
                key={s.slug}
                href={`/guide/${s.slug}`}
                className="card hover:border-brand-300 hover:shadow-md transition"
              >
                <div className="font-semibold text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {s.description}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 border-t pt-6 text-center">
        <Link
          href="/guide"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          ← 전체 가이드 보기
        </Link>
      </div>

      <Script
        id={`ld-breadcrumb-${g.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id={`ld-article-${g.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <Script
          id={`ld-faq-${g.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
    </article>
  );
}
