import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "이용약관",
  description: "보험계산기 사이트의 이용약관입니다.",
  alternates: { canonical: `${SITE.url}/terms` },
};

export default function TermsPage() {
  return (
    <article className="container-base py-12 max-w-3xl">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">이용약관</h1>
      <div className="prose-seo">
        <h2>제1조 (목적)</h2>
        <p>
          본 약관은 보험계산기(이하 “사이트”)가 제공하는 보험 관련 계산 도구 및 정보 콘텐츠
          서비스(이하 “서비스”)의 이용 조건과 절차에 관한 사항을 규정함을 목적으로 합니다.
        </p>

        <h2>제2조 (서비스의 성격)</h2>
        <p>
          본 사이트가 제공하는 모든 계산 결과와 콘텐츠는 일반적인 정보 제공 목적의{" "}
          <strong>참고용 자료</strong>이며, 특정 보험 상품의 가입을 권유하거나 재무적·법적 자문을
          제공하지 않습니다.
        </p>

        <h2>제3조 (책임의 제한)</h2>
        <p>
          이용자는 본 서비스의 결과를 토대로 한 보험 가입·해지·청구 등의 결정을 전적으로 자신의
          책임 하에 수행하며, 이로 인해 발생한 손해에 대해 사이트는 어떠한 책임도 지지 않습니다.
        </p>

        <h2>제4조 (지식재산권)</h2>
        <p>
          본 사이트가 제공하는 콘텐츠와 디자인의 저작권은 사이트 운영자에게 있으며, 무단 복제·
          배포·수정·상업적 이용을 금합니다.
        </p>

        <h2>제5조 (약관 변경)</h2>
        <p>
          사이트는 필요 시 본 약관을 변경할 수 있으며, 변경된 약관은 본 페이지에 게시함으로써
          효력이 발생합니다.
        </p>
      </div>
    </article>
  );
}
