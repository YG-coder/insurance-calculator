import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "보험계산기 사이트의 개인정보 처리방침입니다.",
  alternates: { canonical: `${SITE.url}/privacy` },
};

export default function PrivacyPage() {
  return (
      <article className="container-base py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">개인정보 처리방침</h1>
        <div className="prose-seo">
          <p>
            본 사이트(이하 “보험계산기”)는 이용자의 개인정보를 소중하게 생각하며,
            관련 법령을 준수합니다.
          </p>

          <h2>1. 수집하는 개인정보 항목</h2>
          <p>
            보험계산기는{" "}
            <strong>
              이름, 연락처, 주민등록번호 등 개인을 식별할 수 있는 정보를 직접 수집하지 않습니다.
            </strong>{" "}
            모든 계산은 이용자의 브라우저 안에서만 처리되며, 입력값은 서버로 전송·저장되지 않습니다.
          </p>

          <h2>2. 개인정보 수집 여부</h2>
          <p>
            현재 본 사이트에는 회원가입, 상담 신청, 문의 폼 등 개인정보를 입력하는 기능이 없습니다.
            따라서 이용자는 보험 계산기를 사용할 때 이름, 연락처, 주소, 건강정보 등을 입력할 필요가 없습니다.
          </p>

          <h2>3. 쿠키 및 광고 서비스</h2>
          <p>
            본 사이트는 개인정보를 직접 수집하지 않습니다. 다만 운영 비용 충당을 위해 Google
            AdSense 광고를 게재하고 있으며, 이 과정에서 Google 및 제휴 네트워크가 쿠키 또는 유사
            기술을 사용해 이용자의 관심사에 기반한 광고를 제공할 수 있습니다.
          </p>
          <p>
            이용자는 <a href="https://adssettings.google.com" className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서
            맞춤 광고를 관리하거나 사용을 중지할 수 있으며, 브라우저 설정을 통해 쿠키 저장을 거부할
            수 있습니다. 광고 쿠키는 광고 제공 목적에만 사용되며, 계산기 입력값 등 이용자가 입력한
            정보와 결합되지 않습니다.
          </p>

          <h2>4. 개인정보 보호 책임</h2>
          <p>
            본 사이트는 개인정보 입력 기능을 제공하지 않으며, 향후 개인정보 수집 기능이 추가되는 경우
            수집 항목, 이용 목적, 보유 기간, 동의 절차를 명확히 안내하겠습니다.
          </p>

          <h2>5. 정책 변경</h2>
          <p>
            본 방침은 관련 법령 및 서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지에 공지합니다.
          </p>
        </div>
      </article>
  );
}