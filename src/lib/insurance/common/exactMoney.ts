// 원 단위 반올림의 방향은 바꾸지 않는다. 입력된 십진 비율을 유리수로 읽어
// 이진 소수 곱셈/나눗셈이 .5 경계를 옮기지 않도록 한다. 법규 정책의 근거가 아니다.
function decimalRatio(value: number): [bigint, bigint] {
  const [coefficient, exponent = "0"] = String(value).split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const numerator = BigInt(whole + fraction);
  const scale = fraction.length - Number(exponent);
  // 호출부가 0~1로 검증하므로 지수 표기여도 scale은 음수가 아니다.
  return [numerator, 10n ** BigInt(scale)];
}

function roundPositive(numerator: bigint, denominator: bigint): number {
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

/** 검증된 원 단위 금액 × 0~1 비율. 십진 표현을 기준으로 .5 이상 올림. */
export function roundedRateAmount(amount: number, rate: number): number {
  // 외부 직접 호출의 기존 비정상 입력 처리는 해당 진입점에 맡긴다.
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    return Math.round(amount * rate);
  }
  const [numerator, denominator] = decimalRatio(rate);
  return roundPositive(BigInt(amount) * numerator, denominator);
}

/** 반올림 전 정률 금액이 상한을 넘는지 비교해 기존 상한 적용 표시를 유지한다. */
export function rateAmountExceeds(amount: number, rate: number, cap: number): boolean {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(cap) || cap < 0
    || !Number.isFinite(rate) || rate < 0 || rate > 1) return amount * rate > cap;
  const [numerator, denominator] = decimalRatio(rate);
  return BigInt(amount) * numerator > BigInt(cap) * denominator;
}

/** 금액/일수 등 검증된 비음수 정수의 나눗셈을 원 단위로 반올림. */
export function roundedIntegerRatio(amount: number, divisor: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(divisor) || divisor <= 0) {
    return Math.round(amount / divisor);
  }
  return roundPositive(BigInt(amount), BigInt(divisor));
}

/** % 입력을 비율로 옮길 때 66.6/100 → 0.6659999999999999 같은 추가 오차를 막는다. */
export function percentToRate(percent: number): number {
  const [coefficient, exponent = "0"] = String(percent).split("e");
  return Number(`${coefficient}e${Number(exponent) - 2}`);
}
