"use client";

type Props = {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  unit?: string;
};

const formatWithComma = (digits: string) =>
  digits ? Number(digits).toLocaleString("ko-KR") : "";

const MAX_AMOUNT_DIGITS = 15;

/**
 * 금액 입력 공통 컴포넌트
 * - 입력 중 천 단위 콤마 자동 적용 (표시 전용)
 * - 오른쪽에 단위(원) 표시
 * - onChange 는 항상 숫자만 남긴 문자열을 전달하므로 계산 로직에 영향을 주지 않음
 */
export default function AmountInput({
  id,
  value,
  onChange,
  placeholder,
  unit = "원",
}: Props) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input-base pr-12"
        value={formatWithComma(value)}
        maxLength={19}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_AMOUNT_DIGITS))}
        placeholder={placeholder}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-slate-500">
        {unit}
      </span>
    </div>
  );
}
