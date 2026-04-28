import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "사이트 소개",
  description: "보험계산기 사이트 소개 페이지입니다.",
  alternates: { canonical: `${SITE.url}/about` },
};

export default function AboutPage() {
  return (
    <article className="container-base py-12 max-w-3xl">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">사이트 소개</h1>
      <div className="prose-seo">
        <p>
          <strong>보험계산기</strong>는 누구나 무료로 실손보험, 일반 보험료, 자동차보험을 빠르게
          계산해볼 수 있도록 만든 참고용 계산 도구 사이트입니다. 복잡한 보험 약관과 산정식을
          단순화하여, 보험 가입 전 대략적인 비용 감을 잡을 수 있도록 돕는 것이 저희의 목표입니다.
        </p>
        <h2>제공하는 서비스</h2>
        <ul>
          <li>실손보험 자기부담금 계산기</li>
          <li>보험료 계산기 (연령·성별·흡연·보장금액 기준)</li>
          <li>자동차보험 계산기</li>
          <li>보험 관련 가이드 콘텐츠</li>
        </ul>
        <h2>운영 원칙</h2>
        <p>
          본 사이트는{" "}
          <strong>이름, 연락처 등 어떤 개인정보도 수집하지 않습니다.</strong> 모든 계산은 사용자의
          브라우저 안에서 이루어지며, 입력값은 서버로 전송되지 않습니다. 또한 특정 보험사·상품을
          추천하지 않으며, 모든 정보는 일반 참고 목적으로 제공됩니다.
        </p>
        <h2>면책</h2>
        <p>
          본 사이트의 계산 결과는 일반적인 산정 기준을 단순화한 추정치이며, 실제 보험료와 보장
          내역은 보험사·상품·약관·가입자 정보에 따라 달라질 수 있습니다. 정확한 정보는 각 보험사
          공식 채널을 통해 확인해주시기 바랍니다.
        </p>
      </div>
      <div className="mt-8">
        <Link href="/" className="btn-primary">
          홈으로 이동
        </Link>
      </div>
    </article>
  );
}
