type Props = {
  children: React.ReactNode;
  variant?: "warning" | "info";
};

export default function NoticeBox({ children, variant = "warning" }: Props) {
  const styles =
    variant === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-slate-50 border-slate-200 text-slate-700";
  const icon = variant === "warning" ? "⚠️" : "ℹ️";

  return (
    <div className={`rounded-xl border ${styles} p-4 text-sm leading-relaxed`}>
      <div className="flex gap-2">
        <span className="flex-shrink-0">{icon}</span>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
