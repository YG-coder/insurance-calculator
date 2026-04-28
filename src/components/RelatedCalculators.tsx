import Link from "next/link";
import { CALCULATORS } from "@/lib/site";

type Props = {
  currentHref: string;
};

export default function RelatedCalculators({ currentHref }: Props) {
  const related = CALCULATORS.filter((c) => c.href !== currentHref);
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-slate-900 mb-4">관련 계산기</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {related.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card hover:border-brand-300 hover:shadow-md transition flex gap-3 items-start"
          >
            <span className="text-2xl">{c.icon}</span>
            <div>
              <div className="font-semibold text-slate-900">{c.title}</div>
              <div className="text-xs text-slate-600 mt-1">{c.description}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          ← 전체 계산기 보기
        </Link>
      </div>
    </section>
  );
}
