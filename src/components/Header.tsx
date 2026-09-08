import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container-base flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand-shield.svg" width={32} height={32} alt="" aria-hidden="true" />
          <span className="font-bold text-lg text-slate-900">보험계산기</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/#calculators" className="hover:text-brand-600 transition">
            계산기
          </Link>
          <Link href="/guide" className="hover:text-brand-600 transition">
            가이드
          </Link>
        </nav>
        <nav className="flex md:hidden items-center gap-4 text-sm font-medium text-slate-600">
          <Link href="/#calculators" className="hover:text-brand-600 transition">
            계산기
          </Link>
          <Link href="/guide" className="hover:text-brand-600 transition">
            가이드
          </Link>
        </nav>
      </div>
    </header>
  );
}
