type Item = { label: string; value: string; highlight?: boolean };

type Props = {
  title?: string;
  items: Item[];
};

export default function ResultCard({ title = "계산 결과", items }: Props) {
  return (
    <div className="bg-gradient-to-br from-brand-50 to-white rounded-2xl border-2 border-brand-200 p-6 sm:p-8">
      <h3 className="text-lg font-bold text-brand-800 mb-5">{title}</h3>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex justify-between items-center pb-3 ${
              i < items.length - 1 ? "border-b border-brand-100" : ""
            }`}
          >
            <span className="text-sm text-slate-600">{item.label}</span>
            <span
              className={`font-bold ${
                item.highlight ? "text-2xl text-brand-700" : "text-lg text-slate-900"
              }`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
