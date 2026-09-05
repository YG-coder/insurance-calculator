// G-11B — 5세대 **단건**의 건강보험 본인부담률(%) 입력 계약과 라벨 연결.
//
// 대상은 `HealthCalc5th.tsx`의 `nhisRate` 한 필드와 그 라벨뿐이다.
//   ⚠ 다회 계산기(`HealthCalcMulti2026.tsx`)의 `nhisRate`는 **범위 밖**이다.
//   ⚠ `calc2026`·20% 하한·산식·규칙값, 병원비·통원 가입금액·누적 공제금액의
//     G-4/G-11A 계약, 공용 위젯 파일은 건드리지 않는다.
//
// 종전 동작(기준선 `git archive 93ac298`을 실행해 확인):
//   위젯이 `type="number"`라 브라우저가 문자를 지웠고(`abc` → 화면·상태 모두 `""`),
//   파서는 `Math.min(100, Math.max(0, Number(nhisRate))) / 100`으로 **조용히 보정**했다.
//     `1e3`(1000%)·`300000`(300000%) → **100%로 깎여** 보험 적용 0원,
//     `-1` → **0%로 올라가** 하한 20%로 계산, `1.5` → 0.015 → 하한 20%.
//     `300,000`·`1,0`·`20만`·`abc`는 코드상 `NaN`이 전달되지만, Chrome의 `type="number"`가
//     그 문자를 키보드 입력 단계에서 걸러 **공개 화면에서는 도달하지 못했다**(조사 기록).
//   ⚠ 방향(과다·과소)은 비교 대상인 실제 계약값을 알 때만 말할 수 있다. 여기서는
//     **원문이 다른 비율로 보정됐다**는 사실과 관측된 결과만 기록한다.
//
// 이번 계약
//   - 위젯을 `type="text"` + `inputMode="decimal"`로 바꿔 **원문을 보존**한다.
//     `min`/`max`/`step`은 없앤다 — `type="text"`에서 동작하지 않고, `step="0.1"`은 약관이
//     소수 한 자리로 정했다는 근거가 아니다. **소수 자릿수 제한을 새로 만들지 않는다.**
//   - **로컬 전용 비율 파서**를 둔다. 금액 파서(`gen2026SingleAmount`)와 합치지 않는다 —
//     비율은 소수를 허용하고, 쉼표를 쓰지 않으며, 0~100으로 범위가 닫혀 있다.
//   - **0~100 밖은 깎지 않고 차단한다.** `Math.min`/`Math.max` 자동 보정을 없앴다.
//   - **빈 문자열만** `undefined` → 엔진의 종전 `PENDING_UNVERIFIED` 안내 유지.
//     **공백만은 빈 값이 아니라 무효.**
//   - 명시적 `0`은 숫자 0을 전달하고 엔진의 종전 20% 하한 처리를 그대로 따른다.
//
// 라벨 — **단건 내부에 중복은 없었다.** 소스에도 DOM에도 이 화면의 라벨은 하나다.
//   같은 페이지에서 라벨이 둘로 보이는 것은 다회 계산기가 자기 라벨을 갖기 때문이며,
//   그것은 다른 컴포넌트의 정상 라벨이라 건드리지 않는다. 여기서는 **단건 입력에 연결된
//   라벨이 정확히 하나**이고 `aria-describedby`가 실제 안내 요소의 고유 id를 가리키는지 본다.
import { readFileSync } from "node:fs";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const UI_PATH = "src/components/calculators/HealthCalc5th.tsx";
const code = readFileSync(UI_PATH, "utf8");
/**
 * 주석을 걷어낸 소스. 금지 패턴 검사는 **주석에 걸리면 안 되므로** 이쪽을 본다.
 * ⚠ 줄 단위 필터만으로는 부족하다 — 여러 줄에 걸친 `{/* … *\/}` 블록의 **가운데 줄**은
 *   `//`로 시작하지 않아 살아남는다(실제로 `step="0.1"` 설명 줄이 그랬다).
 *   블록 주석을 먼저 통째로 지운 뒤 줄 단위로 한 번 더 거른다.
 */
const body = code
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const names = stateNamesFrom(code);
const RATE = "med5-nhis-rate", HELP = "med5-nhis-rate-help";

type Comp = () => unknown;
const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalc5th as unknown as Comp, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
type H = ReturnType<typeof setup>;
const nodeById = (h: H, id: string) => h.render().nodes.find((n: RenderedNode) => String(n.props.id) === id);
const has = (h: H, id: string) => nodeById(h, id) !== undefined;
/** 이 입력은 공용 위젯을 쓰지 않는다 — 맨 `<input>`이라 그대로 핸들러를 부른다. */
const typeInto = (h: H, v: string) => {
  const n = nodeById(h, RATE);
  if (n === undefined || typeof n.props.onChange !== "function") throw new Error("본인부담률 입력을 찾지 못했습니다");
  (n.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shown = (h: H) => { const n = nodeById(h, RATE); return n === undefined ? null : String(n.props.value); };
const scr = (h: H) => {
  const r = h.render(); const it = r.resultItems();
  const boxes = r.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox").map((n) => `${n.props.variant}:${String(n.text)}`);
  return {
    calc: it !== null,
    own: it === null ? null : (it[2]?.value ?? null),
    pay: it === null ? null : (it[3]?.value ?? null),
    boxes,
    warn: boxes.filter((t) => t.startsWith("warning")).join(" || "),
    rateInvalid: boxes.some((t) => t.includes("건강보험 본인부담률") && t.includes("올바르게 입력해 주세요")),
    pending: boxes.some((t) => t.includes("건강보험 본인부담률 미제공")),
  };
};
/** 급여 통원 — 본인부담률이 보이는 유일한 경로. */
const ben = (over: Record<string, unknown> = {}) =>
  setup({ coverage: "benefit", visit: "outpatient", benefitTier: "clinic", amount: "300000", ...over });

const VALID: [string, string, number][] = [
  ["명시적 0", "0", 0], ["0 반복", "00", 0], ["앞자리 0", "01", 0.01], ["정수", "20", 0.2],
  ["소수", "12.5", 0.125], ["소수 두 자리", "12.50", 0.125], ["상한", "100", 1],
  ["상한 소수 표기", "100.0", 1], ["아주 작은 소수", "0.001", 0.00001],
];
const INVALID: [string, string][] = [
  ["앞 점", ".5"], ["끝 점", "1."], ["양부호", "+1"], ["음수", "-1"], ["지수", "1e3"],
  ["잘못된 쉼표", "1,0"], ["천 단위 쉼표", "300,000"], ["한글 단위", "20만"], ["문자", "abc"],
  ["공백만", "   "], ["탭만", "\t"], ["앞 공백", " 20"], ["뒤 공백", "20 "],
  ["NaN", "NaN"], ["Infinity", "Infinity"],
  ["범위 초과(소수)", "100.1"], ["범위 초과(정수)", "101"], ["아주 큰 수", "999999999999999999999"],
  ["백분율 기호", "20%"], ["점 두 개", "1.2.3"],
];

// ── 파서 계약 ────────────────────────────────────────────────────────
console.log("\n[파서] 0~100의 숫자·소수만 받고 나머지는 차단한다");
{
  let okV = 0, okRaw = 0;
  for (const [, v] of VALID) {
    const h = ben(); typeInto(h, v);
    if (scr(h).calc && !scr(h).rateInvalid) okV++;
    if (shown(h) === v) okRaw++;
  }
  check(`유효 ${VALID.length}종이 계산되고 원문이 보존된다`, okV === VALID.length && okRaw === VALID.length,
    `계산 ${okV}/${VALID.length} · 원문 ${okRaw}/${VALID.length}`);
  let okI = 0;
  for (const [, v] of INVALID) {
    const h = ben(); typeInto(h, v);
    const s = scr(h);
    // 차단 + 안내 + 원문 보존 + 엔진 안내(PENDING)도 나오지 않음
    if (!s.calc && s.rateInvalid && !s.pending && shown(h) === v) okI++;
  }
  check(`무효 ${INVALID.length}종이 차단되고 원문이 보존된다`, okI === INVALID.length, `${okI}/${INVALID.length}`);
}

// ── 값별 계산 (엔진 종전 처리 유지) ──────────────────────────────────
console.log("\n[계산] 엔진의 20% 하한·상한 처리는 그대로");
{
  const zero = ben(); typeInto(zero, "0");
  check("0 → 20% 하한이 적용된다", scr(zero).own === "60,000원", String(scr(zero).own));
  const low = ben(); typeInto(low, "12.5");
  check("12.5 → 하한보다 낮아 20%로 계산", scr(low).own === "60,000원", String(scr(low).own));
  const mid = ben(); typeInto(mid, "30");
  check("30 → 30%로 계산", scr(mid).own === "90,000원", String(scr(mid).own));
  const full = ben(); typeInto(full, "100");
  check("100 → 100%", scr(full).own === "300,000원" && scr(full).pay === "0원", `${scr(full).own}/${scr(full).pay}`);
  const full2 = ben(); typeInto(full2, "100.0");
  check("100.0 → 100과 같다", scr(full2).own === scr(full).own && scr(full2).pay === scr(full).pay);
  const one = ben(); typeInto(one, "01");
  check("01 → 1%로 읽고 하한 20% 적용", scr(one).own === "60,000원", String(scr(one).own));
}

// ── 표시 비율과 계산 비율의 일치 ─────────────────────────────────────
console.log("\n[표시] 적용 비율 라벨이 계산에 쓰인 비율과 같다");
{
  /**
   * ⚠ 종전 라벨은 `((rateApplied ?? 0) * 100).toFixed(0)`이라 **정수로 반올림**했다.
   *   이번 계약은 소수 자릿수를 제한하지 않으므로 그대로 두면 입력·계산과 표시가 어긋난다 —
   *   `30.5`는 `31%`, `20.25`는 `20%`로 보였다. 표시만 정렬했고 산식·엔진은 그대로다.
   * ⚠ 부동소수점 흔적도 새어 나오면 안 된다 — 실측으로 `0.259 * 100 = 25.900000000000002`,
   *   `0.269 * 100 = 26.900000000000002`다(`0.305 * 100`은 정확히 30.5라 흔적이 없다).
   *   급여 통원 라벨은 아예 곱셈을 거치지 않은 값을 쓰므로 흔적도 절단도 없다.
   */
  const rateLabel = (h: H) => {
    const it = h.render().resultItems();
    const found = it === null ? undefined : it.find((x: { label: string }) => x.label.startsWith("자기부담률"));
    return found === undefined ? null : found.label;
  };
  const CASES: [string, string, string][] = [
    // [입력, 기대 표시 비율, 기대 본인부담금]
    ["20", "20", "60,000원"],
    ["30", "30", "90,000원"],
    ["100", "100", "300,000원"],
    ["100.0", "100", "300,000원"],
    ["20.25", "20.25", "60,750원"],
    ["30.5", "30.5", "91,500원"],
    ["99.99", "99.99", "299,970원"],
    // ⚠ 아래 둘은 **이진 부동소수점 흔적이 실제로 생기는** 값이다(실측) —
    //   `0.259 * 100 = 25.900000000000002`, `0.269 * 100 = 26.900000000000002`.
    //   반대로 `0.305 * 100`은 정확히 `30.5`라 흔적이 없다. 값에 따라 다르므로
    //   흔적이 실제로 생기는 값을 골라 넣는다.
    ["25.9", "25.9", "77,700원"],
    ["26.9", "26.9", "80,700원"],
    // ⚠ 자릿수 제한이 없다는 계약을 지키는지 본다. `rate * 100`을 반올림해 그리면
    //   `toFixed(10)`에서 `20.123456789`로 **잘린다.** 라벨은 `/100` 이전의 검증된 값을
    //   쓰므로 잘리지 않는다. (300,000 × 0.2012345678901 = 60,370.37… → 60,370원)
    ["20.12345678901", "20.12345678901", "60,370원"],
  ];
  for (const [input, want, own] of CASES) {
    const h = ben(); typeInto(h, input);
    const label = rateLabel(h);
    check(`${input} → 라벨 "${want}%" · 본인부담 ${own}`,
      label !== null && label.startsWith(`자기부담률 (${want}%`) && scr(h).own === own,
      `${label} / ${scr(h).own}`);
  }
  // 20% 하한 아래는 하한이 적용된 **실제 계산 비율**을 보여준다.
  for (const [input, own] of [["12.5", "60,000원"], ["0", "60,000원"], ["01", "60,000원"],
    ["0.001", "60,000원"]] as [string, string][]) {
    const h = ben(); typeInto(h, input);
    const label = rateLabel(h);
    check(`${input} → 하한이 적용돼 라벨은 "20%" · 본인부담 ${own}`,
      label !== null && label.startsWith("자기부담률 (20%") && scr(h).own === own,
      `${label} / ${scr(h).own}`);
  }
  // 부동소수점 흔적이 라벨에 남지 않는다.
  for (const input of ["25.9", "26.9", "30.5", "99.99", "20.25", "20.12345678901", "0.001"]) {
    const h = ben(); typeInto(h, input);
    const label = String(rateLabel(h));
    // ⚠ "긴 숫자"를 흔적으로 보면 안 된다 — `20.12345678901`은 사용자가 실제로 친
    //   **정당한** 11자리다. 흔적은 `0`이나 `9`가 길게 이어지는 꼬리로 나타난다
    //   (`25.900000000000002`, `26.900000000000002`).
    check(`  ${input}: 라벨에 부동소수점 흔적이 없다`,
      !/(0{6,}|9{6,})\d*%/.test(label), label);
  }
  // 비급여 경로의 라벨(고정 비율)도 종전 형태 그대로다.
  const nb = setup({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
    visit: "inpatient", nbInpatientTier: "clinic", amount: "10000000" });
  check("비급여 중증 입원 라벨은 종전대로 \"30%\"", String(rateLabel(nb)).startsWith("자기부담률 (30%"), String(rateLabel(nb)));
  const nb2 = setup({ coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical",
    visit: "inpatient", nbInpatientTier: "clinic", amount: "10000000" });
  check("비급여 비중증 입원 라벨은 종전대로 \"50%\"", String(rateLabel(nb2)).startsWith("자기부담률 (50%"), String(rateLabel(nb2)));
  const bi = setup({ coverage: "benefit", visit: "inpatient", amount: "300000" });
  check("급여 입원 라벨은 종전대로 \"20%\"", String(rateLabel(bi)).startsWith("자기부담률 (20%"), String(rateLabel(bi)));
  // 최소공제액 비교 문구는 종전대로 붙는다.
  const withMin = ben(); typeInto(withMin, "30");
  check("최소공제액 비교 문구가 그대로 붙는다", String(rateLabel(withMin)).includes("최소공제액 10,000원 비교"));

  // ⚠ **표시가 계산을 대신 말한다.** 라벨의 숫자를 다시 비율로 되돌려 엔진이 실제로 쓴
  //   비율(하한 적용 후)과 같은지 본다. 자릿수가 잘리거나 반올림되면 여기서 어긋난다.
  for (const input of ["20", "20.25", "25.9", "26.9", "30.5", "99.99", "20.12345678901", "12.5", "0", "100"]) {
    const h = ben(); typeInto(h, input);
    const label = String(rateLabel(h));
    const m = /자기부담률 \(([^%]+)%/.exec(label);
    const engineRate = Math.max(Number(input) / 100, 0.2);
    check(`  ${input}: 라벨 비율이 엔진이 쓴 비율과 같다`,
      m !== null && Math.abs(Number(m[1]) / 100 - engineRate) < 1e-12,
      `${label} vs ${engineRate}`);
  }

  check("소스: 정수 반올림을 쓰지 않는다",
    !/rateApplied \?\? 0\) \* 100\)\.toFixed\(0\)/.test(body)
    && !/toFixed\(0\)/.test(body)
    && /label: `자기부담률 \(\$\{benefitOutpatientPct === null \? pct\(result\.rateApplied \?\? 0\) : String\(benefitOutpatientPct\)\}%/.test(code));
  check("소스: 표시 전용 포맷터이고 계산에는 쓰이지 않는다",
    /const pct = \(rate: number\) => \{/.test(code)
    && (body.match(/pct\(/g) ?? []).length === 1
    && !/nhisCoinsuranceRate: [^\n]*pct\(/.test(body));
  check("소스: 급여 통원 라벨은 /100 이전의 검증된 값을 쓴다(곱셈 흔적 회피)",
    /const benefitOutpatientPct = !usesNhisRate \|\| nhisRateNum === null \|\| nhisRateNum === undefined\s*\n\s*\? null\s*\n\s*: Math\.max\(nhisRateNum, GEN2026\.benefit\.outpatient\.floorRate \* 100\);/.test(code)
    && /benefitOutpatientPct === null \? pct\(result\.rateApplied \?\? 0\) : String\(benefitOutpatientPct\)/.test(code));
  check("소스: 하한을 화면에 하드코딩하지 않는다(엔진과 같은 규칙값)",
    /GEN2026\.benefit\.outpatient\.floorRate/.test(body)
    && !/Math\.max\(nhisRateNum, 20\)/.test(body));
  check("소스: 표시용 값이 엔진 인자로 새지 않는다",
    !/nhisCoinsuranceRate: [^\n]*benefitOutpatientPct/.test(body)
    && /nhisCoinsuranceRate: nhisRateNum === undefined \? undefined : nhisRateNum \/ 100,/.test(code));
}

// ── 빈 값 / 공백 ─────────────────────────────────────────────────────
console.log("\n[빈 값] 빈 문자열만 미입력이다");
{
  const e = ben(); typeInto(e, "");
  check("빈 값 → 엔진의 PENDING 안내 유지", !scr(e).calc && scr(e).pending, scr(e).warn.slice(0, 50));
  check("  무효 안내는 뜨지 않는다", !scr(e).rateInvalid);
  check("  초기값도 빈 문자열", shown(ben()) === "" && scr(ben()).pending);
  const b = ben(); typeInto(b, "   ");
  check("공백만 → 빈 값이 아니라 무효", !scr(b).calc && scr(b).rateInvalid && !scr(b).pending);
  check("  공백 원문이 그대로 남는다(trim하지 않는다)", shown(b) === "   ");
}

// ── 종전 자동 보정이 차단으로 바뀐 값 ────────────────────────────────
console.log("\n[보정→차단] 종전에 조용히 깎이던 값들");
{
  for (const [what, v] of [["1e3 (종전 1000%→100%)", "1e3"], ["101 (종전 100%로 깎임)", "101"],
    ["-1 (종전 0%로 올라감)", "-1"], ["100.1 (종전 100%로 깎임)", "100.1"]] as [string, string][]) {
    const h = ben(); typeInto(h, v);
    check(`${what} → 이제 차단`, !scr(h).calc && scr(h).rateInvalid && shown(h) === v);
  }
  check("소스에 Math.min/Math.max 자동 보정이 없다",
    !/Math\.min\(100, Math\.max\(0, Number\(nhisRate\)\)\)/.test(body)
    && !/Math\.min\(100/.test(body) && !/Math\.max\(0, Number/.test(body));
}

// ── 활성 조건·숨은 값 ────────────────────────────────────────────────
console.log("\n[활성 조건] 급여 통원에서만 검증·전달한다");
{
  check("급여 통원: 칸이 보인다", has(ben(), RATE));
  check("  급여 입원: 칸이 없다", !has(ben({ visit: "inpatient" }), RATE));
  check("  비급여 통원: 칸이 없다",
    !has(ben({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical" }), RATE));
  check("  비급여 입원: 칸이 없다",
    !has(ben({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "clinic" }), RATE));

  const h = ben(); typeInto(h, "1e3");
  check("무효 상태에서 차단", !scr(h).calc && scr(h).rateInvalid);
  h.set("visit", "inpatient");
  check("급여 입원으로 이동: 칸·안내가 사라지고 계산 재개", !has(h, RATE) && scr(h).calc && !scr(h).rateInvalid);
  const cleanInp = ben({ visit: "inpatient" });
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(h).own === scr(cleanInp).own, `${scr(h).own} vs ${scr(cleanInp).own}`);
  h.set("coverage", "non_benefit"); h.set("nonBenefitItem", "general"); h.set("severity", "critical"); h.set("visit", "outpatient");
  check("비급여 통원으로 이동: 여전히 간섭하지 않는다", !has(h, RATE) && scr(h).calc && !scr(h).rateInvalid);
  const cleanNb = ben({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical" });
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(h).own === scr(cleanNb).own, `${scr(h).own} vs ${scr(cleanNb).own}`);
  h.set("coverage", "benefit"); h.set("visit", "outpatient");
  check("급여 통원 복귀: 원문과 무효 안내가 함께 돌아온다", shown(h) === "1e3" && !scr(h).calc && scr(h).rateInvalid);
  typeInto(h, "30");
  check("고치면 계산 재개", scr(h).calc && scr(h).own === "90,000원", String(scr(h).own));
}

// ── 병원비 우선 안내 ─────────────────────────────────────────────────
console.log("\n[안내 순서] 병원비가 무효인 동안에는 본인부담률 안내를 만들지 않는다");
{
  const h = ben({ amount: "abc" });
  typeInto(h, "1e3");
  check("병원비 안내만 뜬다", scr(h).warn.includes("병원비") && !scr(h).rateInvalid);
  typeInto(h, "");
  check("  병원비가 무효면 PENDING 안내도 나오지 않는다", !scr(h).pending);
  h.set("amount", "300000"); typeInto(h, "1e3");
  check("병원비를 고치면 본인부담률 안내가 나타난다", scr(h).rateInvalid && !scr(h).warn.includes("병원비"));
}

// ── 라벨·접근성 ──────────────────────────────────────────────────────
console.log("\n[라벨] 단건 입력에 연결된 라벨은 정확히 하나다");
{
  const h = ben();
  const labels = h.render().nodes.filter((n: RenderedNode) => n.tag === "label" && String(n.props.htmlFor) === RATE);
  check("htmlFor로 이 입력을 가리키는 라벨이 정확히 1개", labels.length === 1, String(labels.length));
  const named = h.render().nodes.filter((n: RenderedNode) => n.tag === "label" && n.text.startsWith("건강보험 본인부담률"));
  check("  같은 이름의 라벨도 이 컴포넌트 안에서는 1개", named.length === 1, String(named.length));
  check("  소스에도 htmlFor가 1개뿐", (code.match(/htmlFor="med5-nhis-rate"/g) ?? []).length === 1);
  const input = nodeById(h, RATE);
  check("입력이 type=text이고 inputMode=decimal이다",
    input?.props.type === "text" && input?.props.inputMode === "decimal");
  check("  min·max·step은 없다",
    input?.props.min === undefined && input?.props.max === undefined && input?.props.step === undefined);
  check("aria-describedby가 실제 안내 요소를 가리킨다",
    input?.props["aria-describedby"] === HELP && has(h, HELP));
  const helps = h.render().nodes.filter((n: RenderedNode) => String(n.props.id) === HELP);
  check("  그 id가 화면에 정확히 1개", helps.length === 1, String(helps.length));
  check("  안내에 0~100과 예시 20·12.5가 있다",
    String(helps[0]?.text ?? "").includes("0~100") && String(helps[0]?.text ?? "").includes("12.5"));

  // 무효 안내 문구 요건
  const bad = ben(); typeInto(bad, "101");
  const boxText = scr(bad).boxes.find((t) => t.includes("건강보험 본인부담률")) ?? "";
  check("무효 안내가 0~100·소수·예시·자동 변환 없음을 밝힌다",
    boxText.includes("0~100") && boxText.includes("소수") && boxText.includes("12.5")
    && boxText.includes("0%나 100%로 바꾸지 않으며"));
}
{
  // 다회 계산기의 라벨은 그대로다(범위 밖). id 충돌도 없다.
  const multiSrc = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  // ⚠ 계약 교체(G-13C): 다회의 본인부담률도 엄격 검증으로 바뀌었다(전용 파서
  //   `gen2026MultiNhisRate`, 원문 보존 위젯). 이 파일의 관심사는 **단건**이므로, 여기서는
  //   다회가 단건 파서를 재사용하지 않는다는 것과 id가 겹치지 않는다는 것만 본다.
  check("다회 라벨은 그대로 존재한다(위젯은 원문 보존으로 교체)",
    /건강보험 본인부담률 \(%\)<input className="input-base mt-1" type="text" inputMode="decimal"/.test(multiSrc));
  // ⚠ 주석을 제외하고 본다. 다회 소스의 주석은 "단건의 gen2026NhisRate를 재사용하지 않는다"는
  //   근거로 그 이름을 언급하므로, 주석까지 함께 보는 검사로는 판정할 수 없다.
  const multiBody = multiSrc
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  check("  다회는 단건 파서를 재사용하지 않는다",
    /const gen2026MultiNhisRate = \(v: string\): number \| null =>/.test(multiBody)
    && !multiBody.includes("gen2026NhisRate"));
  const mh = mount(HealthCalcMulti2026 as unknown as Comp,
    stateNamesFrom(multiSrc));
  mh.set("submitted", true); mh.set("coverage", "benefit"); mh.set("visit", "outpatient");
  const mIds = mh.render().nodes.filter((n: RenderedNode) => typeof n.props.id === "string" && String(n.props.id).startsWith("med5-"));
  check("  다회에는 med5- 접두사 id가 없다(단건과 충돌하지 않는다)", mIds.length === 0, String(mIds.length));
}

// ── 소스 — 파서 분리와 금지 사항 ─────────────────────────────────────
console.log("\n[소스] 비율 전용 파서 · 게이트 · 금지 사항");
{
  check("비율 전용 파서가 따로 있다",
    /const GEN2026_NHIS_RATE_FORMAT = \/\^\[0-9\]\+\(\?:\\\.\[0-9\]\+\)\?\$\/;/.test(code)
    && /const gen2026NhisRate = \(v: string\): number \| null => \{/.test(code));
  check("금액 파서와 합치지 않았다",
    !/gen2026SingleAmount\(nhisRate\)/.test(body) && !/gen2026NhisRate\(amount\)/.test(body)
    && !/gen2026NhisRate\(outpatientLimit\)/.test(body) && !/gen2026NhisRate\(priorDeductible\)/.test(body)
    && /const GEN2026_SINGLE_AMOUNT_FORMAT = /.test(code));
  check("공용 금액 위젯을 재사용하지 않았다",
    !/<RawAmountInput[\s\S]{0,120}med5-nhis-rate/.test(body) && !/<AmountInput/.test(body));
  check("범위를 0~100으로 검증한다(깎지 않는다)",
    /return Number\.isFinite\(n\) && n >= 0 && n <= 100 \? n : null;/.test(code));
  // ⚠ 자리 제한은 **파서 형식과 입력 속성**에서 본다. 결과 표시의 `toFixed(0)`는 종전부터
  //   있던 `rateApplied` 표기이고 입력 제약이 아니므로 여기에 걸리면 안 된다.
  //   `step="0.1"`은 주석에만 남아 있다(속성은 위 라벨 절에서 undefined로 확인했다).
  check("소수 자릿수 제한을 새로 만들지 않았다",
    // 소수부는 `[0-9]+` — 자릿수 상한이 없다.
    /GEN2026_NHIS_RATE_FORMAT = \/\^\[0-9\]\+\(\?:\\\.\[0-9\]\+\)\?\$\//.test(code)
    && !/\[0-9\]\{1,\d\}/.test(code)
    && !/nhisRate[\s\S]{0,60}toFixed\(/.test(body)
    && !/step=/.test(body));
  check("trim()으로 통과시키지 않는다", !/nhisRate\.trim\(\)/.test(body));
  check("활성 조건이 엔진 소비 조건과 같다",
    /const usesNhisRate = coverage === "benefit" && visit === "outpatient";/.test(code));
  check("빈 값만 undefined다",
    /const nhisRateNum = !usesNhisRate \|\| nhisRate === "" \? undefined : gen2026NhisRate\(nhisRate\);/.test(code));
  // ⚠ **미전달·전달 형태는 여기서 확인한다.** 결과 비교로는 증명되지 않는다.
  check("전달은 null을 배제한 뒤에만 일어난다(타입 단언·0 대체 없음)",
    /\? nhisRateNum === null\s*\n\s*\? null\s*\n\s*: calc2026\(\{/.test(code)
    && /nhisCoinsuranceRate: nhisRateNum === undefined \? undefined : nhisRateNum \/ 100,/.test(code)
    && !/nhisRateNum as number/.test(code) && !/nhisRateNum \?\? 0/.test(code)
    && !/gen2026NhisRate\(nhisRate\) \?\? /.test(body));
  check("결과 계산 결과에서 비율을 역산하거나 되쓰지 않는다",
    !/setNhisRate\([^)]*result/.test(body) && !/setNhisRate\([^)]*rateApplied/.test(body));
  // ── 무변경 영역 ──
  check("G-4·G-11A 계약은 그대로다",
    /const parsed = gen2026SingleAmount\(amount\);/.test(code)
    && /const outpatientLimitNum = !usesOutpatientLimit \|\| outpatientLimit === ""/.test(code)
    && /const priorDeductibleNum = !usesPriorDeductible \? undefined/.test(code)
    && /priorAnnualDeductible: limits\.deductible,/.test(code)
    && /perVisitCoverageLimit: limits\.perVisit,/.test(code)
    && /result && result\.status === "OK" && num > 0/.test(code));
  const eng = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  check("엔진과 20% 하한은 그대로다",
    /if \(nhis === undefined\) holds\.push\("급여 통원: 건강보험 본인부담률 미제공 → 계산 불가\(#2 입력 필요\)"\);/.test(eng)
    && /const rate = Math\.max\(nhis as number, GEN2026\.benefit\.outpatient\.floorRate\);/.test(eng));
  const widgetSrc = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  check("공용 위젯 파일은 그대로다",
    !/\.trim\(/.test(widgetSrc) && !/\.replace\(/.test(widgetSrc) && !/slice\(/.test(widgetSrc));
}

console.log(`\n[5세대 단건 본인부담률 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
