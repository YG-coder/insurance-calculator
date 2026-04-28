import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container-base flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
            보
          </span>
          <span className="font-bold text-lg text-slate-900">보험계산기</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/health-insurance-calculator" className="hover:text-brand-600 transition">
            실손보험
          </Link>
          <Link href="/insurance-premium-calculator" className="hover:text-brand-600 transition">
            보험료
          </Link>
          <Link href="/car-insurance-calculator" className="hover:text-brand-600 transition">
            자동차보험
          </Link>
          <Link href="/about" className="hover:text-brand-600 transition">
            소개
          </Link>
        </nav>
      </div>
    </header>
  );
}
