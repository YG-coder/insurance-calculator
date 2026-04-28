import Link from "next/link";

type Props = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

export default function CalculatorCard({ title, description, href, icon }: Props) {
  return (
    <Link
      href={href}
      className="card hover:shadow-md hover:border-brand-300 transition-all group block"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-700">
        {title}
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      <div className="mt-4 text-sm font-semibold text-brand-600">계산하기 →</div>
    </Link>
  );
}
