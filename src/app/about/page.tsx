import type { Metadata } from "next";
import { SITE } from "@/lib/site";

const URL = `${SITE.url}/about`;

export const metadata: Metadata = {
  title: "사이트 소개",
  description:
      "보험계산기는 실손보험·보험료·자동차보험 계산을 무료로 제공하는 참고용 보험 계산기 사이트입니다. 사이트 운영 목적과 정보의 한계를 안내합니다.",
  alternates: { canonical: URL },
};

export default function AboutPage() {
  return (
      <article className="container-base py-10">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            사이트 소개
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            보험계산기는 복잡한 보험 계산을 누구나 쉽게 할 수 있도록 만든 참고용 무료 계산기
            사이트입니다.
          </p>
        </header>

        <section className="prose-seo">
          <h2>사이트 운영 목적</h2>
          <p>
            보험은 종류가 많고 산정 방식이 복잡해 일반 소비자가 본인의 예상 보험료를 가늠하기
            어렵습니다. 본 사이트는 <strong>실손보험 자기부담금, 보험료, 자동차보험료</strong>의 세
            가지 핵심 계산을 한 곳에서 무료로 제공하여, 보험 가입 전 합리적인 의사결정에 도움이 되는
            정보를 제공하는 것을 목표로 합니다.
          </p>

          <h2>제공하는 계산기</h2>
          <ul>
            <li>
              <strong>실손보험 자기부담금 계산기:</strong> 4세대 실손보험 기준 본인부담률을 적용해
              병원비 중 본인이 부담할 금액과 예상 보험금을 계산합니다.
            </li>
            <li>
              <strong>보험료 계산기:</strong> 나이·성별·흡연 여부·보장금액 기준으로 예상 월 보험료
              범위를 추정합니다.
            </li>
            <li>
              <strong>자동차보험 계산기:</strong> 운전자 연령, 운전 경력, 사고 이력, 차종, 차량가액을
              반영해 예상 자동차보험료를 산출합니다.
            </li>
          </ul>

          <h2>계산 결과의 한계</h2>
          <p>
            본 사이트의 모든 계산 결과는 <strong>참고용 추정치</strong>입니다. 실제 보험료와 보험금은
            각 보험사의 상품, 약관, 가입자의 건강 상태, 보험사별 위험률 산정 방식 등에 따라 크게
            달라질 수 있습니다. 정확한 보험료와 보장 내역은 반드시 가입하신 보험사의 공식 채널 또는
            금융감독원 통합공시 등을 통해 확인하시기 바랍니다.
          </p>
          <p>
            본 사이트는 특정 보험 상품의 가입을 권유하거나 보험·금융·법률 자문을 제공하지 않으며, 모든
            가입 결정은 이용자 본인의 판단과 책임으로 이루어져야 합니다.
          </p>
          <p>
            보험계산기.kr의 계산 결과는 참고용 정보이며, 실제 보험 가입·청구·보상 판단은 반드시 보험사
            약관과 전문가 상담을 통해 확인해야 합니다.
          </p>

          <h2>개인정보와 광고</h2>
          <p>
            보험계산기는 <strong>이름, 연락처, 주민등록번호 등 개인정보를 일절 수집하지 않습니다.</strong>{" "}
            모든 입력값은 사용자의 브라우저 안에서만 계산에 사용되며 서버로 전송되지 않습니다. 자세한
            내용은{" "}
            <a href="/privacy" className="text-brand-600 underline">
              개인정보 처리방침
            </a>
            을 참고해주시기 바랍니다.
          </p>
          <p>
            사이트의 운영 비용 충당을 위해 <strong>Google AdSense</strong>를 통한 광고가 게재됩니다.
            광고는 콘텐츠와 명확히 구분되며, 사용자에게 강제로 노출되거나 계산 결과에 영향을 주지
            않습니다.
          </p>

          <h2>문의</h2>
          <p>
            사이트 이용 중 오류나 개선 제안이 있으시면 <strong>support@보험계산기.kr</strong>로 연락해
            주시기 바랍니다. 보내주신 의견은 사이트 개선에 큰 도움이 됩니다.
          </p>
        </section>
      </article>
  );
}