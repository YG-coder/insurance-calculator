"use client";

type Props = {
  id: string;
  value: string;
  /** 입력한 **원문 그대로** 전달한다. 정제하지 않는다. */
  onChange: (raw: string) => void;
  placeholder?: string;
  unit?: string;
  ariaLabel?: string;
};

/**
 * 원문 보존 금액 입력 — **검증 전에 값을 바꾸지 않는다.**
 *
 * ⚠ `AmountInput`을 쓰면 안 되는 자리를 위한 컴포넌트다. `AmountInput`은 매 입력마다
 *   `replace(/[^0-9]/g, "")`로 숫자 아닌 문자를 **지우고** 15자리로 **자른다**. 그래서
 *   뒤에 아무리 엄격한 파서를 두어도 늦는다 — 파서에 닿기 전에 이미
 *   `-1`→**1**(부호를 지워 양수), `1.5`→**15**(점을 지워 10배), `1e3`→**13**,
 *   `1,0`→**10**이 되어 **다른 유효값**으로 둔갑한 뒤다.
 *   자릿수 절단도 같은 문제다. 안전 정수를 넘는 값을 잘라 유효값으로 만든다.
 *
 * ⚠ 그래서 `AmountInput`을 고치지 않고 이 컴포넌트를 따로 둔다. 공용 컴포넌트를 바꾸면
 *   진료비가 아닌 금액 입력(가입금액·기존 지급보험금·해지환급금 등)까지 함께 바뀐다.
 *   이 컴포넌트는 **호출한 자리에서만** 원문 보존 계약을 갖는다.
 *
 * ⚠ 표시도 원문 그대로다. 콤마를 자동으로 붙이지 않는다 — 화면에 보이는 값과 계산에 쓰는
 *   값이 어긋나면(4세대 다회에서 `-1`이 화면에 남고 1원으로 계산되던 것처럼) 사용자가
 *   변형 사실을 알 수 없다. 콤마는 사용자가 직접 넣을 수 있고, 파서가 형식을 검증한다.
 *
 * 형식 판정과 숫자 변환은 **호출한 쪽의 파서**가 한다. 이 컴포넌트는 판정하지 않는다.
 */
export default function RawAmountInput({
  id,
  value,
  onChange,
  placeholder,
  unit = "원",
  ariaLabel,
}: Props) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        className="input-base pr-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-slate-500">
        {unit}
      </span>
    </div>
  );
}
