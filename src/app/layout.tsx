import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
    // URL 필드는 SITE.url로 만든 절대 문자열을 사용한다.
    // metadataBase를 지정하면 Next.js가 한글 도메인을 퓨니코드로 재직렬화한다.

    title: {
        default: `${SITE.name} - 실손·보장·보험 의사결정 무료 계산`,
        template: `%s | ${SITE.name}`,
    },

    description: SITE.description,

    keywords: [
        "보험계산기",
        "실손보험 계산기",
        "보험료 비중 계산기",
        "자동차보험 견적 비교 계산기",
        "본인부담금",
        "보험료 비교",
    ],

    openGraph: {
        type: "website",
        locale: "ko_KR",
        url: SITE.url,
        siteName: SITE.name,
        title: `${SITE.name} - 실손·보장·보험 의사결정 무료 계산`,
        description: SITE.description,
    },
    twitter: {
        card: "summary_large_image",
    },

    robots: {
        index: true,
        follow: true,
    },

    verification: {
        google: "m43I3sHTtVDzUX2boyrzKQqVYl4TUB504tOJFJGfpD4",
        other: {
            "naver-site-verification": "dae405d642587eca39fd9ecbf8558e23fa85bae2",
        },
    },
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        inLanguage: "ko-KR",
    };

    return (
        <html lang="ko">
        <head>
            {/* 공유 이미지는 public에서 같은 경로로 제공하고 URL 문자열을 그대로 출력한다. */}
            <meta property="og:image" content={`${SITE.url}/opengraph-image.png`} />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:image" content={`${SITE.url}/opengraph-image.png`} />
        </head>
        <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-5 focus:py-3 focus:text-brand-700 focus:shadow-lg focus:outline focus:outline-2 focus:outline-brand-600">본문으로 건너뛰기</a>
        <Header />
        <main id="main-content" tabIndex={-1} className="min-h-[60vh] scroll-mt-24">{children}</main>
        <Footer />

        <JsonLd id="ld-json-website" data={jsonLd} />
        </body>
        </html>
    );
}
