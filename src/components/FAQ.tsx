type FAQItem = { q: string; a: string };

type Props = {
  items: FAQItem[];
};

export default function FAQ({ items }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <details
          key={i}
          className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-brand-300 transition"
        >
          <summary className="flex justify-between items-center cursor-pointer font-semibold text-slate-900">
            <span className="flex gap-2">
              <span className="text-brand-600">Q.</span>
              {item.q}
            </span>
            <span className="text-brand-600 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <p className="mt-3 pt-3 border-t border-slate-100 text-slate-700 leading-relaxed text-sm">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
