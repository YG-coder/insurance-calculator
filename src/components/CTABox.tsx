export default function CTABox() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="text-2xl mb-2">💬</div>
      <p className="text-sm text-slate-600 mb-3">
        더 정확한 보험료 산출이 필요하신가요?
      </p>
      <button type="button" className="btn-disabled" disabled aria-disabled>
        보험 상담 기능 준비 중입니다
      </button>
      <p className="text-xs text-slate-400 mt-3">
        ※ 본 사이트는 개인정보를 수집하지 않습니다.
      </p>
    </div>
  );
}
