import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site";

const ADSENSE_CLIENT = "ca-pub-6405509957088169";

export const metadata: Metadata = {
    metadataBase: new URL(SITE.url),

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

    other: {
        "google-adsense-account": ADSENSE_CLIENT,
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
        <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-5 focus:py-3 focus:text-brand-700 focus:shadow-lg focus:outline focus:outline-2 focus:outline-brand-600">본문으로 건너뛰기</a>
        <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />

        <Header />
        <main id="main-content" tabIndex={-1} className="min-h-[60vh] scroll-mt-24">{children}</main>
        <Footer />

        <Script
            id="ld-json-website"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        </body>
        </html>
    );
}
