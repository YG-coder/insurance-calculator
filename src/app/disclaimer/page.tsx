import type { Metadata } from "next";
import Script from "next/script";
import NoticeBox from "@/components/NoticeBox";
import FAQ from "@/components/FAQ";
import { SITE } from "@/lib/site";

const PAGE_URL = `${SITE.url}/disclaimer`;

export const metadata: Metadata = {
  title: "면책사항",
  description:
    "보험계산기 사이트의 계산 결과는 참고용 추정치입니다. 실제 보험료·보험금과의 차이, 정보 활용 범위, 면책 범위, 책임의 한계를 안내합니다.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "면책사항 | 보험계산기",
    description:
      "보험계산기 사이트의 계산 결과 활용 범위와 책임의 한계를 안내합니다.",
    url: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DisclaimerPage() {
  const lastUpdated = "2026-05-07";

  const faqs = [
    {
      q: "계산기 결과와 실제 보험료가 다르면 보상받을 수 있나요?",
      a: "본 사이트의 계산 결과는 일반적인 산정 방식을 단순화한 참고용 추정치이며, 실제 보험료·보험금과의 차이에 대해 보험계산기.kr은 어떠한 책임도 지지 않습니다. 실제 보험 거래에서 발생하는 분쟁은 해당 보험사와 금융감독원 분쟁조정 절차를 통해 해결하시기 바랍니다.",
    },
    {
      q: "이 사이트의 정보는 언제 기준인가요?",
      a: "본 사이트는 2026년 기준의 일반적인 보험 산출 방식과 4세대 실손보험 자기부담률을 적용하고 있습니다. 보험 제도와 요율은 매년 개정될 수 있으며, 사이트가 항상 최신 상태로 유지된다는 것을 보장하지 않습니다.",
    },
    {
      q: "특정 보험 상품을 추천받을 수 있나요?",
      a: "보험계산기는 특정 보험사의 상품을 추천하거나 가입을 권유하지 않습니다. 광고로 표시되는 영역은 콘텐츠와 명확히 구분되며, 광고 클릭이 계산 결과나 사이트 추천에 영향을 주지 않습니다.",
    },
    {
      q: "계산 결과를 다른 곳에 사용해도 되나요?",
      a: "개인적인 참고 용도로는 자유롭게 활용하실 수 있지만, 계산 결과를 보험 가입·해지·청구의 단독 근거로 사용하지 않기를 권장합니다. 또한 계산 결과를 상업적·법률적 자료로 인용·재배포하는 것은 권장하지 않습니다.",
    },
    {
      q: "외부 링크나 광고로 인한 손해는 누가 책임지나요?",
      a: "본 사이트에서 제공하는 외부 링크와 Google AdSense 등 제3자 광고를 통해 연결된 사이트의 콘텐츠·서비스에 대해서는 보험계산기.kr이 책임을 지지 않습니다. 외부 사이트 이용은 이용자 본인의 책임 하에 이루어집니다.",
    },
  ];

  // 면책 페이지를 FAQPage 스키마로 노출 (구글 발췌 노출용)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  // WebPage 자체 스키마
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "면책사항",
    url: PAGE_URL,
    description:
      "보험계산기 사이트의 계산 결과 활용 범위, 정보의 한계, 책임의 범위에 대한 안내입니다.",
    isPartOf: {
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
    },
    inLanguage: "ko-KR",
    dateModified: lastUpdated,
  };

  return (
    <article className="container-base py-10">
      <header className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3">
          최종 업데이트 · {lastUpdated}
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          면책사항
        </h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          보험계산기({SITE.url})에서 제공하는 모든 계산 결과와 콘텐츠의 활용
          범위, 정보의 한계, 책임의 범위에 대한 공식 안내입니다.
        </p>
      </header>

      <div className="mb-6">
        <NoticeBox>
          <strong>본 사이트의 모든 계산 결과는 참고용 추정치입니다.</strong>{" "}
          실제 보험료·보험금·자기부담금은 보험사 상품, 약관, 가입 시기, 특약,
          가입자의 건강 상태에 따라 달라질 수 있으며, 본 사이트는 그 차이에 대해
          어떠한 법적 책임도 지지 않습니다.
        </NoticeBox>
      </div>

      <section className="prose-seo">
        <h2>1. 정보 제공 목적</h2>
        <p>
          보험계산기는 일반 소비자가{" "}
          <strong>실손보험 자기부담금, 예상 보험료, 자동차보험료</strong>를 가입
          전 대략적으로 가늠할 수 있도록 만든 무료 참고용 도구입니다. 본
          사이트의 콘텐츠는 보험·금융·세무·법률 분야의 전문 자문이 아니며, 특정
          보험 상품의 가입·해지·청구 결정을 위한 단독 근거로 사용하기 위해
          제공되지 않습니다.
        </p>

        <h2>2. 계산 결과의 한계</h2>
        <p>
          본 사이트의 계산기는 일반적으로 알려진 보험 산출 방식을{" "}
          <strong>단순화하여 적용한 추정 모델</strong>입니다. 실제 보험사의
          요율은 다음과 같은 다양한 요인을 추가로 반영하므로, 본 사이트의 결과와
          상당한 차이가 발생할 수 있습니다.
        </p>
        <ul>
          <li>
            <strong>보험사별 위험률·예정사업비:</strong> 같은 조건이라도
            보험사마다 위험률 산정 기준과 사업비 구조가 달라 보험료에 차이가
            발생합니다.
          </li>
          <li>
            <strong>가입 심사 결과:</strong> 건강 상태, 직업, 가족력 등에 따라
            할증·부담보·인수 거절이 적용될 수 있습니다.
          </li>
          <li>
            <strong>특약과 옵션:</strong> 동일한 주계약이라도 선택한 특약, 갱신
            방식, 납입 기간에 따라 최종 보험료가 달라집니다.
          </li>
          <li>
            <strong>한도와 차등제:</strong> 4세대 실손의 비급여 차등제, 자동차
            보험의 사고건수요율 등은 단순 모델로 정확히 반영하기 어렵습니다.
          </li>
          <li>
            <strong>제도와 요율 개정:</strong> 금융당국 정책, 보험업법 개정,
            보험사 요율 변경 등으로 본 사이트의 기준이 최신 상태와 다를 수
            있습니다.
          </li>
        </ul>

        <h2>3. 책임의 범위</h2>
        <p>
          이용자가 본 사이트의 계산 결과나 정보를 근거로 보험 가입·해지·청구
          결정을 내려 발생한 직접적·간접적 손해에 대해 보험계산기.kr 운영자는{" "}
          <strong>법적·재무적 책임을 지지 않습니다</strong>. 본 사이트는 이용자
          본인의 판단을 보조하는 도구일 뿐이며, 최종 의사결정의 책임은 전적으로
          이용자에게 있습니다.
        </p>
        <p>
          또한 본 사이트는 다음 사항을 보장하지 않습니다.
        </p>
        <ul>
          <li>계산 결과의 정확성, 완전성, 적시성, 최신성</li>
          <li>특정 보험 상품에서의 가입 가능 여부 또는 보장 적용 여부</li>
          <li>이용자의 보험 가입 후 만족도나 경제적 이익</li>
          <li>사이트의 무중단 운영, 오류 없는 서비스 제공</li>
        </ul>

        <h2>4. 자문 행위에 해당하지 않음</h2>
        <p>
          본 사이트의 콘텐츠는 <strong>보험모집·중개·자문 행위가 아닙니다</strong>
          . 운영자는 보험업법상 보험설계사, 보험대리점, 보험중개사, 보험회사로
          등록되어 있지 않으며, 본 사이트의 정보 제공으로 인해 이용자와
          보험계약·자문 관계가 성립하지 않습니다.
        </p>
        <p>
          정확한 보험료, 보장 내역, 가입 가능 여부는 반드시{" "}
          <strong>가입하실 보험사의 공식 채널, 금융감독원 통합공시 또는 보험
          전문가</strong>를 통해 확인하시기 바랍니다.
        </p>

        <h2>5. 외부 링크 및 광고</h2>
        <p>
          본 사이트는 운영 비용 충당을 위해 Google AdSense 등 제3자 광고
          네트워크를 통한 광고를 게재할 수 있습니다. 광고는 본 사이트의 자체
          콘텐츠가 아니며, 광고에 포함된 정보·상품·서비스에 대한 책임은 해당
          광고주 및 광고 네트워크에 있습니다. 외부 링크를 통해 연결된 제3자
          사이트의 콘텐츠와 정책에 대해서도 본 사이트는 책임지지 않습니다.
        </p>

        <h2>6. 개인정보와 데이터 처리</h2>
        <p>
          본 사이트는 계산기 이용 과정에서 이름, 연락처, 주민등록번호 등 어떠한
          개인정보도 수집하지 않으며, 입력값은 이용자의 브라우저에서만 계산에
          사용됩니다. 자세한 내용은{" "}
          <a href="/privacy" className="text-brand-600 underline">
            개인정보 처리방침
          </a>
          을, 사이트 이용 조건은{" "}
          <a href="/terms" className="text-brand-600 underline">
            이용약관
          </a>
          을 참고하시기 바랍니다.
        </p>

        <h2>7. 면책사항의 변경</h2>
        <p>
          본 면책사항은 관련 법령, 사이트 운영 정책, 제공 콘텐츠의 변경에 따라
          사전 통지 없이 수정될 수 있으며, 변경된 내용은 본 페이지 게시 시점부터
          효력이 발생합니다. 이용자는 정기적으로 본 페이지를 확인할 책임이
          있습니다.
        </p>

        <h2>8. 준거법과 관할</h2>
        <p>
          본 면책사항의 해석과 본 사이트 이용에 관한 분쟁은 대한민국 법령을
          준거법으로 하며, 분쟁 발생 시 민사소송법상의 관할법원을 제1심 관할
          법원으로 합니다.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          면책사항 관련 자주 묻는 질문
        </h2>
        <FAQ items={faqs} />
      </section>

      <div className="mt-12 border-t pt-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">
          관련 페이지
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="/about" className="text-brand-600 hover:underline">
            사이트 소개
          </a>
          <a href="/privacy" className="text-brand-600 hover:underline">
            개인정보 처리방침
          </a>
          <a href="/terms" className="text-brand-600 hover:underline">
            이용약관
          </a>
          <a
            href="/health-insurance-calculator"
            className="text-brand-600 hover:underline"
          >
            실손보험 계산기
          </a>
          <a
            href="/insurance-premium-calculator"
            className="text-brand-600 hover:underline"
          >
            보험료 계산기
          </a>
          <a
            href="/car-insurance-calculator"
            className="text-brand-600 hover:underline"
          >
            자동차보험 계산기
          </a>
        </div>
      </div>

      <Script
        id="ld-disclaimer-page"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <Script
        id="ld-disclaimer-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </article>
  );
}
