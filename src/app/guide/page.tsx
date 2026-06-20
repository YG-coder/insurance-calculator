import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { SITE } from "@/lib/site";
import {
  CLUSTER_META,
  guidesByCluster,
  publishedGuides,
  type GuideCluster,
} from "@/lib/guides";

const PAGE_URL = `${SITE.url}/guide`;

export const metadata: Metadata = {
  title: "보험 가이드",
  description:
    "실손보험·보험료·자동차보험 관련 가이드 모음. 청구 방법, 세대별 차이, 할인 특약, 보험료 절약법 등 실용적인 보험 정보를 정리했습니다.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    title: "보험 가이드 | 보험계산기",
    description:
      "실손·보험료·자동차보험에 대한 실용 가이드를 한곳에 모았습니다.",
    url: PAGE_URL,
  },
  robots: { index: true, follow: true },
};

const CLUSTER_ORDER: GuideCluster[] = ["hub", "health", "premium", "car"];

export default function GuideHubPage() {
  const all = publishedGuides();

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "보험 가이드",
    url: PAGE_URL,
    inLanguage: "ko-KR",
    description:
      "실손보험·보험료·자동차보험 관련 실용 가이드 모음입니다.",
    hasPart: all.map((g) => ({
      "@type": "Article",
      headline: g.title,
      url: `${SITE.url}/guide/${g.slug}`,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "보험 가이드", item: PAGE_URL },
    ],
  };

  return (
    <div className="container-base py-10">
      <nav className="text-sm text-slate-500 mb-6" aria-label="breadcrumb">
        <Link href="/" className="hover:text-brand-600">
          홈
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">보험 가이드</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          보험 가이드
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed max-w-2xl">
          실손보험 청구부터 자동차보험 할인 특약, 보험료 절약법까지 — 보험을
          고르고 활용할 때 알아두면 좋은 내용을 주제별로 정리했습니다. 각 글
          하단에서 관련 계산기로 바로 이동해 예상 금액도 확인할 수 있습니다.
        </p>
      </header>

      {/* 허브 자체 SEO 본문 (콘텐츠 깊이 확보) */}
      <section className="card mb-10 prose-seo">
        <h2>보험, 가입보다 이해가 먼저입니다</h2>
        <p>
          보험은 같은 보장이라도 가입 시기, 나이, 운전 경력, 건강 상태에 따라
          비용과 보장 범위가 크게 달라집니다. 특히 실손보험은 세대별로 자기
          부담률 구조가 다르고, 자동차보험은 할인 특약을 어떻게 챙기느냐에 따라
          보험료가 두 배 가까이 차이 나기도 합니다.
        </p>
        <p>
          이 가이드는 복잡한 보험 용어와 제도를 처음 접하는 분도 이해할 수 있도록
          핵심만 정리한 글 모음입니다. 모든 내용은 일반적인 정보 제공을 위한
          참고용이며, 실제 가입·청구는 보험사 공식 안내를 함께 확인하시기
          바랍니다.
        </p>
      </section>

      {/* 클러스터별 목록 */}
      <div className="space-y-12">
        {CLUSTER_ORDER.map((c) => {
          const list = guidesByCluster(c);
          if (list.length === 0) return null;
          const meta = CLUSTER_META[c];
          return (
            <section key={c}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  {meta.label}
                </h2>
                {meta.calcHref && (
                  <Link
                    href={meta.calcHref}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap"
                  >
                    {meta.calcLabel} →
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {list.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guide/${g.slug}`}
                    className="card hover:border-brand-300 hover:shadow-md transition flex flex-col"
                  >
                    <h3 className="font-semibold text-slate-900">{g.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed flex-1">
                      {g.description}
                    </p>
                    <span className="text-xs font-semibold text-brand-600 mt-3">
                      자세히 보기 →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Script
        id="ld-guide-collection"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <Script
        id="ld-guide-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  );
}
