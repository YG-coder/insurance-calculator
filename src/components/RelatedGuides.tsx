import Link from "next/link";
import { guidesByCluster, type GuideCluster } from "@/lib/guides";

type Props = {
  cluster: GuideCluster;
  limit?: number;
};

// 계산기 → 가이드 내부링크. 해당 클러스터의 발행 글이 있을 때만 렌더링됩니다.
export default function RelatedGuides({ cluster, limit = 4 }: Props) {
  const guides = guidesByCluster(cluster).slice(0, limit);
  if (guides.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900">관련 가이드</h2>
        <Link
          href="/guide"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          전체 가이드 →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={`/guide/${g.slug}`}
            className="card hover:border-brand-300 hover:shadow-md transition"
          >
            <div className="font-semibold text-slate-900">{g.title}</div>
            <div className="text-xs text-slate-600 mt-1">{g.description}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
