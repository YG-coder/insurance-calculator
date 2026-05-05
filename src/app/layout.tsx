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
        default: `${SITE.name} - 실손·자동차·보험료 무료 계산`,
        template: `%s | ${SITE.name}`,
    },

    description: SITE.description,

    keywords: [
        "보험계산기",
        "실손보험 계산기",
        "보험료 계산기",
        "자동차보험 계산기",
        "본인부담금",
        "보험료 비교",
    ],

    alternates: {
        canonical: SITE.url,
    },

    openGraph: {
        type: "website",
        locale: "ko_KR",
        url: SITE.url,
        siteName: SITE.name,
        title: `${SITE.name} - 실손·자동차·보험료 무료 계산`,
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
        <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />

        <Header />
        <main className="min-h-[60vh]">{children}</main>
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
