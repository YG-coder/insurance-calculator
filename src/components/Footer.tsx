import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20">
      <div className="container-base py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-3">보험계산기</h3>
            <p className="text-sm leading-relaxed">
              실손보험, 보험료, 자동차보험을 한 곳에서 계산할 수 있는 참고용 보험
              계산기 사이트입니다.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">계산기</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/health-insurance-calculator" className="hover:text-brand-400">
                  실손보험 계산기
                </Link>
              </li>
              <li>
                <Link href="/insurance-premium-calculator" className="hover:text-brand-400">
                  보험료 계산기
                </Link>
              </li>
              <li>
                <Link href="/car-insurance-calculator" className="hover:text-brand-400">
                  자동차보험 계산기
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">사이트 정보</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-brand-400">
                  소개
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-brand-400">
                  개인정보 처리방침
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-400">
                  이용약관
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-400">
          <p>
            본 사이트의 모든 계산 결과는{" "}
            <strong className="text-slate-200">참고용</strong>이며, 실제 보험료 및
            보험금은 보험사·상품·약관에 따라 달라질 수 있습니다. 2026년 기준.
          </p>
          <p className="mt-2">© 2026 보험계산기. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
