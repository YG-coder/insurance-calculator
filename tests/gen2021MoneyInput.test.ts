// G-6 — 4세대 다회의 **금액 입력 두 곳**을 엄격하게 검증한다.
//   ① 증권상 연간 가입금액(일반 4축)  ② 누적기간 내 기존 지급보험금(일반 4축 + 특약 3축)
//
// 종전 동작: 두 입력 모두 맨 `<input>` + 공용 `digits()`였다. 화면에는 원문이 그대로
//   남는데 계산은 다른 값으로 갔다. 기준선 `df97a8a`를 실제로 실행해 확인한 결과다.
//     가입금액 `-1`→1원, `1.5`→15원, `1e3`→13원, `20만`→20원, `1,0`→10원 (한도가 줄어 **과소**)
//     가입금액 `abc`·`   `(공백만)→한도 미적용 (한도가 사라져 **과다** 가능)
//     지급보험금 `340만`·`-1`·`1.5`·`1e3`·`abc`·`1,0`→과거 사용액이 줄어 **과다**
//     지급보험금 `9007199254740993`→`…992`로 반올림돼 조용히 계산
//   ⇒ 잘못된 입력의 결과 방향은 **입력별로 고정되지 않는다**. 같은 칸에서도 값에 따라
//     과소·과다·결과 동일이 갈린다. 그래서 어느 쪽으로도 추정하지 않고 차단한다.
//
// 이번 계약
//   - 빈 문자열 `""`만 기존 선택 입력이다 — 가입금액은 `undefined`(한도 미적용),
//     지급보험금은 `0`. **종전 계약을 보존하는 선택**이지, 미입력을 0으로 보는 것이
//     정확하거나 안전하다고 이번에 확인한 것이 아니다.
//   - 공백만 있는 입력과 앞뒤 공백이 붙은 입력은 **무효**다. trim으로 정리해 통과시키지 않는다.
//   - 명시적 `0`·`00`은 유효값(종전 처리 유지). 올바른 정수·천 단위 쉼표 허용.
//   - 음수·부호·소수·지수 표기·문자·잘못된 쉼표·**안전 정수 초과**는 차단.
//     안전 정수 초과 차단은 **이번에 승인한 의도된 동작 변경**이다.
//   - 안전 정수 최대값은 허용하고, 약관상 상한(5천만)·잔여액 처리는 엔진이 그대로 한다.
//   - 게이트는 **활성 축 기준**이다. 특약에서는 일반 가입금액을 읽지 않고, 숨은 축의
//     무효값이 지금 계산을 막지 않는다. 무효 축으로 돌아오면 원문과 안내가 살아난다.
// ⚠ 엔진·외부 타입·규칙값·산식·다른 세대·공용 위젯은 무변경이다.
import { readFileSync } from "node:fs";
import HealthCalcMulti2021 from "../src/components/calculators/HealthCalcMulti2021";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const UI_PATH = "src/components/calculators/HealthCalcMulti2021.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

type Comp = () => unknown;
const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalcMulti2021 as unknown as Comp, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
type H = ReturnType<typeof setup>;

/** 실제 `<input>`까지 내려간다 — 공용 위젯을 **호출해서** 통과한다(화면과 같은 경로). */
const findInput = (el: unknown): { props: { onChange: (e: unknown) => void; value?: unknown } } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findInput(c); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === "input" && typeof e.props?.onChange === "function") return e as never;
  if (e.type === RawAmountInput) {
    return findInput((RawAmountInput as unknown as (p: never) => unknown)(e.props as never));
  }
  return findInput(e.props?.children);
};
const findSelect = (el: unknown): { props: { onChange: (e: unknown) => void; value?: unknown; disabled?: unknown } } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findSelect(c); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === "select" && typeof e.props?.onChange === "function") return e as never;
  return findSelect(e.props?.children);
};
const labelOf = (h: H, prefix: string) =>
  h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(prefix));
const widget = (h: H, prefix: string) => {
  const l = labelOf(h, prefix);
  return l === undefined ? null : findInput(l.props.children);
};
/** 진짜 위젯의 onChange를 통과시킨다. 없으면 예외 — 조용한 통과를 막는다. */
const typeInto = (h: H, prefix: string, v: string) => {
  const w = widget(h, prefix);
  if (w === null) throw new Error(`${prefix} 입력을 찾지 못했습니다`);
  w.props.onChange({ target: { value: v } });
};
const shown = (h: H, prefix: string) => {
  const w = widget(h, prefix);
  return w === null ? null : String(w.props.value);
};
const pick = (h: H, prefix: string, value: string) => {
  const l = labelOf(h, prefix);
  const sel = l === undefined ? null : findSelect(l.props.children);
  if (sel === null) throw new Error(`${prefix} 선택창을 찾지 못했습니다`);
  if (sel.props.disabled === true) throw new Error(`${prefix} 선택창이 비활성입니다(우회하지 않는다)`);
  sel.props.onChange({ target: { value } });
};
const selValue = (h: H, prefix: string) => {
  const l = labelOf(h, prefix);
  const sel = l === undefined ? null : findSelect(l.props.children);
  return sel === null ? null : String(sel.props.value);
};

const PAID = "누적기간 내 기존 지급보험금";
const LIMIT = "증권상 연간 가입금액";
const CAUSE_SEL = "원인", COVERAGE_SEL = "급여 구분", VISIT_SEL = "치료 형태", RIDER_SEL = "3대 비급여";
/** 특약이 걸린 동안 급여 선택창은 비활성이다 — 우회하지 않고 일반으로 돌아온 뒤 바꾼다. */
const go = (h: H, cause: string, coverage: string, rider: string) => {
  if (selValue(h, RIDER_SEL) !== "none") pick(h, RIDER_SEL, "none");
  if (selValue(h, CAUSE_SEL) !== cause) pick(h, CAUSE_SEL, cause);
  if (selValue(h, COVERAGE_SEL) !== coverage) pick(h, COVERAGE_SEL, coverage);
  if (rider !== "none") pick(h, RIDER_SEL, rider);
};
const SEL_OF: Record<string, [string, string, string]> = {
  injury_benefit: ["injury", "benefit", "none"],
  injury_non_benefit: ["injury", "non_benefit", "none"],
  disease_benefit: ["disease", "benefit", "none"],
  disease_non_benefit: ["disease", "non_benefit", "none"],
  manual_therapy: ["disease", "non_benefit", "manual_therapy"],
  injection: ["disease", "non_benefit", "injection"],
  mri: ["disease", "non_benefit", "mri"],
};
const goAxis = (h: H, key: string) => go(h, ...SEL_OF[key]);

const screenOf = (h: H) => {
  const s = h.render();
  const warns = s.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning");
  const warnText = warns.map((n) => String(n.text)).join(" || ");
  return {
    calculated: s.resultItems() !== null,
    pay: (s.resultItems() ?? [])[2]?.value ?? null,
    warnText,
    warnsLimit: warnText.includes("증권상 연간 가입금액"),
    warnsPaid: warnText.includes("누적기간 내 기존 지급보험금"),
  };
};
/** 계산이 성립하는 일반 비급여 통원 기본 상태. */
const base = () => setup({ amounts: ["300000"], priorOutVisits: "0" });

// ── 파서 계약 ────────────────────────────────────────────────────────
console.log("\n[파서] 원문을 변형 전에 형식으로 판정한다");
const VALID: [string, string][] = [
  ["명시적 0", "0"], ["0 반복", "00"], ["정수", "300000"], ["천 단위 쉼표", "300,000"],
  ["큰 정수", "50000000"], ["큰 쉼표", "50,000,000"], ["안전 정수 최대값", "9007199254740991"],
];
const INVALID: [string, string][] = [
  ["공백만", "   "], ["탭만", "\t"], ["앞 공백", " 300000"], ["뒤 공백", "300000 "],
  ["가운데 공백", "300 000"], ["음수", "-1"], ["양부호", "+1"], ["소수", "1.5"],
  ["끝 점", "1."], ["앞 점", ".5"], ["지수", "1e3"], ["한글 단위", "20만"], ["문자", "abc"],
  ["잘못된 쉼표", "1,0"], ["자리 어긋난 쉼표", "1,00,000"], ["앞 쉼표", ",300"],
  ["뒤 쉼표", "300,"], ["안전 정수 초과", "9007199254740993"], ["통화 기호", "₩300000"],
  ["NaN", "NaN"], ["Infinity", "Infinity"],
];

console.log("\n[가입금액] 유효값은 그대로 계산된다");
for (const [what, v] of VALID) {
  const h = base();
  typeInto(h, LIMIT, v);
  const scr = screenOf(h);
  check(`가입금액 ${what}(${JSON.stringify(v)}) → 계산됨`, scr.calculated, scr.warnText);
  check(`가입금액 ${what} → 원문 보존`, shown(h, LIMIT) === v, String(shown(h, LIMIT)));
}
console.log("\n[가입금액] 무효값은 계산을 막고 안내한다");
for (const [what, v] of INVALID) {
  const h = base();
  typeInto(h, LIMIT, v);
  const scr = screenOf(h);
  check(`가입금액 ${what}(${JSON.stringify(v)}) → 결과 없음`, !scr.calculated, String(scr.pay));
  check(`가입금액 ${what} → 가입금액을 지목`, scr.warnsLimit);
  check(`가입금액 ${what} → 원문 보존`, shown(h, LIMIT) === v, String(shown(h, LIMIT)));
}
console.log("\n[지급보험금] 유효값은 그대로 계산된다");
for (const [what, v] of VALID) {
  const h = base();
  typeInto(h, LIMIT, "50,000,000");
  typeInto(h, PAID, v);
  check(`지급보험금 ${what}(${JSON.stringify(v)}) → 계산됨`, screenOf(h).calculated, screenOf(h).warnText);
}
console.log("\n[지급보험금] 무효값은 계산을 막고 안내한다");
for (const [what, v] of INVALID) {
  const h = base();
  typeInto(h, PAID, v);
  const scr = screenOf(h);
  check(`지급보험금 ${what}(${JSON.stringify(v)}) → 결과 없음`, !scr.calculated, String(scr.pay));
  check(`지급보험금 ${what} → 지급보험금을 지목`, scr.warnsPaid);
  check(`지급보험금 ${what} → 원문 보존`, shown(h, PAID) === v, String(shown(h, PAID)));
}

// ── 빈 값의 기존 계약 ────────────────────────────────────────────────
console.log("\n[빈 값] 종전 계약을 그대로 보존한다(새로 확정한 안전성이 아니다)");
{
  const h = base();
  typeInto(h, PAID, "0");
  typeInto(h, LIMIT, "");
  check("가입금액 빈 값 → 한도 미적용으로 계산", screenOf(h).pay === "200,000원", String(screenOf(h).pay));
  typeInto(h, LIMIT, "100000");
  check("가입금액 100,000 → 한도 적용", screenOf(h).pay === "100,000원", String(screenOf(h).pay));
  typeInto(h, PAID, "");
  check("지급보험금 빈 값 → 0원으로 계산(종전과 동일)", screenOf(h).pay === "100,000원", String(screenOf(h).pay));
  typeInto(h, PAID, "0");
  check("지급보험금 빈 값과 명시적 0의 결과가 같다", screenOf(h).pay === "100,000원", String(screenOf(h).pay));
  typeInto(h, PAID, "50000");
  check("지급보험금이 잔여 한도를 줄인다", screenOf(h).pay === "50,000원", String(screenOf(h).pay));
  // ⚠ 공백만은 빈 값이 아니다 — 종전에는 둘의 결과가 같았다.
  typeInto(h, PAID, "   ");
  check("공백만은 빈 값으로 보지 않는다", !screenOf(h).calculated);
}

// ── 상한·잔여액은 엔진이 그대로 처리한다 ─────────────────────────────
console.log("\n[상한] 약관상 상한·잔여액 처리는 그대로다");
{
  const h = base();
  typeInto(h, PAID, "0");
  typeInto(h, LIMIT, "99999999999");
  check("5천만 상한 클램프 그대로(안내 아님)", screenOf(h).pay === "200,000원", String(screenOf(h).pay));
  typeInto(h, LIMIT, "9007199254740991");
  check("안전 정수 최대값도 계산된다", screenOf(h).calculated);
  typeInto(h, LIMIT, "50000000");
  typeInto(h, PAID, "49900000");
  check("잔여 한도가 결과를 줄인다", screenOf(h).pay === "100,000원", String(screenOf(h).pay));
  typeInto(h, PAID, "50000000");
  check("잔여 0이면 보험 적용 0원", screenOf(h).pay === "0원", String(screenOf(h).pay));
}

// ── 정상 → 무효 → 수정 → 재개 연속 전이 ──────────────────────────────
console.log("\n[전이] 정상 → 무효 → 결과 사라짐 → 수정 → 재개");
{
  const h = base();
  typeInto(h, PAID, "0");
  typeInto(h, LIMIT, "50,000,000");
  check("① 정상 계산", screenOf(h).pay === "200,000원", String(screenOf(h).pay));
  typeInto(h, LIMIT, "50,000,000x");
  check("② 무효 → 결과 사라짐", !screenOf(h).calculated);
  check("② 무효 → 안내 1건(가입금액)", screenOf(h).warnsLimit && !screenOf(h).warnsPaid);
  typeInto(h, PAID, "abc");
  check("③ 양쪽 무효 → 두 안내 모두", screenOf(h).warnsLimit && screenOf(h).warnsPaid);
  typeInto(h, LIMIT, "50,000,000");
  check("④ 한쪽만 고치면 아직 막힌다", !screenOf(h).calculated && screenOf(h).warnsPaid && !screenOf(h).warnsLimit);
  typeInto(h, PAID, "0");
  check("⑤ 둘 다 고치면 재개", screenOf(h).pay === "200,000원", String(screenOf(h).pay));
}

// ── 활성 축 기준 게이트 ──────────────────────────────────────────────
console.log("\n[축] 무효값은 자기 축에서만 막는다");
{
  // 일반 가입금액이 무효인 상태에서 특약으로 이동하면 특약은 계산된다.
  const h = setup({ amounts: ["300000"], priorOutVisits: "0", priorManualVisits: "0" });
  go(h, "disease", "non_benefit", "none");
  typeInto(h, LIMIT, "abc");
  check("일반: 가입금액 무효로 차단", !screenOf(h).calculated);
  goAxis(h, "manual_therapy");
  check("특약으로 이동하면 계산된다(일반 가입금액을 읽지 않는다)", screenOf(h).calculated, screenOf(h).warnText);
  check("특약에서는 가입금액 입력 자체가 없다", widget(h, LIMIT) === null);
  check("특약에서는 가입금액 안내가 없다", !screenOf(h).warnsLimit);
  goAxis(h, "disease_non_benefit");
  check("무효 축으로 복귀하면 원문 복원", shown(h, LIMIT) === "abc", String(shown(h, LIMIT)));
  check("무효 축으로 복귀하면 안내 복원", !screenOf(h).calculated && screenOf(h).warnsLimit);

  // 다른 일반 축으로 옮기면 그 축의 값만 본다.
  goAxis(h, "injury_non_benefit");
  check("다른 일반 축은 자기 값(빈 값)을 쓴다", shown(h, LIMIT) === "");
  check("다른 일반 축은 계산된다", screenOf(h).calculated, screenOf(h).warnText);
  goAxis(h, "disease_non_benefit");
  check("되돌아오면 다시 차단", !screenOf(h).calculated && shown(h, LIMIT) === "abc");
}
{
  // 지급보험금 7축: 한 축의 무효값이 다른 6축을 막지 않는다.
  const AXES = Object.keys(SEL_OF);
  let bad = 0;
  for (const src of AXES) {
    const h = setup({ amounts: ["300000"], priorOutVisits: "0", priorManualVisits: "0", priorInjectionVisits: "0" });
    goAxis(h, src);
    typeInto(h, PAID, "1,0");
    if (screenOf(h).calculated) bad++;
    for (const dst of AXES) {
      if (dst === src) continue;
      goAxis(h, dst);
      if (!screenOf(h).calculated || screenOf(h).warnsPaid) bad++;
    }
    goAxis(h, src);
    if (shown(h, PAID) !== "1,0" || screenOf(h).calculated || !screenOf(h).warnsPaid) bad++;
  }
  check("지급보험금 7축: 무효값이 자기 축만 막고 복귀 시 복원된다", bad === 0, `어긋난 사례 ${bad}건`);
}
{
  // 같은 축 안의 입원↔통원, 특약의 상해↔질병에서는 검증 상태가 유지된다.
  const h = setup({ amounts: ["300000"], priorOutVisits: "0" });
  go(h, "disease", "non_benefit", "none");
  typeInto(h, PAID, "abc");
  check("비급여 통원: 무효로 차단", !screenOf(h).calculated);
  pick(h, VISIT_SEL, "inpatient");
  check("입원으로 바꿔도 같은 축 → 무효 유지", !screenOf(h).calculated && shown(h, PAID) === "abc");
  pick(h, VISIT_SEL, "outpatient");
  check("통원으로 돌아와도 무효 유지", !screenOf(h).calculated && shown(h, PAID) === "abc");

  const r = setup({ amounts: ["300000"], priorManualVisits: "0" });
  goAxis(r, "manual_therapy");
  typeInto(r, PAID, "1.5");
  check("특약(질병): 무효로 차단", !screenOf(r).calculated);
  pick(r, CAUSE_SEL, "injury");
  check("특약 상해로 바꿔도 같은 축 → 무효 유지", !screenOf(r).calculated && shown(r, PAID) === "1.5");
  typeInto(r, PAID, "0");
  check("특약 상해에서 고치면 재개", screenOf(r).calculated);
  pick(r, CAUSE_SEL, "disease");
  check("특약 질병으로 돌아와도 고친 값 유지", screenOf(r).calculated && shown(r, PAID) === "0");
}

// ── 위젯 ─────────────────────────────────────────────────────────────
console.log("\n[위젯] RawAmountInput을 재사용하되 공용 파일은 고치지 않는다");
{
  const h = base();
  const s = h.render();
  const ids = s.nodes.filter((n) => n.tag === "#RawAmountInput").map((n) => String(n.props.id));
  check("가입금액에 고유 id", ids.includes("gen2021-annual-limit"));
  check("지급보험금에 고유 id", ids.includes("gen2021-prior-paid"));
  check("두 id가 서로 다르고 진료비 행과도 겹치지 않는다",
    new Set(ids).size === ids.length && !ids.includes("gen2021-amount-0-limit"));
  const limitNode = s.nodes.find((n) => n.props.id === "gen2021-annual-limit");
  const paidNode = s.nodes.find((n) => n.props.id === "gen2021-prior-paid");
  check("가입금액 접근성 라벨이 보장축을 설명한다",
    String(limitNode?.props.ariaLabel) === "증권상 연간 가입금액 (질병·비급여 보장축)",
    String(limitNode?.props.ariaLabel));
  check("지급보험금 접근성 라벨이 보장축을 설명한다",
    String(paidNode?.props.ariaLabel) === "누적기간 내 기존 지급보험금 (질병·비급여 보장축)",
    String(paidNode?.props.ariaLabel));
  check("시각적 라벨과의 연결이 유지된다(감싸는 label)",
    labelOf(h, LIMIT) !== undefined && labelOf(h, PAID) !== undefined);
  // 축을 옮기면 접근성 라벨도 따라간다.
  goAxis(h, "manual_therapy");
  const rider = h.render().nodes.find((n) => n.props.id === "gen2021-prior-paid");
  check("특약 축에서 접근성 라벨이 항목 이름으로 바뀐다",
    String(rider?.props.ariaLabel) === "누적기간 내 기존 지급보험금 (도수·체외충격파·증식치료)",
    String(rider?.props.ariaLabel));
}
{
  const raw = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  const amountWidget = readFileSync("src/components/AmountInput.tsx", "utf8");
  // ⚠ 주석에 `replace(…)` 설명이 있으므로 **주석을 걷어낸 뒤** 실행 코드만 본다.
  const rawCode = stripComments(raw);
  check("RawAmountInput은 원문을 그대로 넘긴다(정제·절단 없음)",
    /onChange=\{\(e\) => onChange\(e\.target\.value\)\}/.test(rawCode)
    && !/replace\(/.test(rawCode) && !/trim\(/.test(rawCode)
    && !/slice\(/.test(rawCode) && !/maxLength/.test(rawCode));
  check("AmountInput은 그대로다", /export default function AmountInput/.test(amountWidget));
  check("4세대 다회에 맨 금액 <input>이 남아 있지 않다",
    !/<input className="input-base mt-1" inputMode="numeric" placeholder="예: 50,000,000"/.test(ui)
    && !/value=\{annualLimit\} onChange=\{\(e\) => setAnnualLimit/.test(ui)
    && !/value=\{priorPaid\} onChange=\{\(e\) => setPriorPaid/.test(ui));
}

// ── 소스 계약 ────────────────────────────────────────────────────────
console.log("\n[소스] 파서·게이트·전달 형태");
{
  const src = stripComments(ui);
  check("금액 파서가 진료비 파서와 같은 형식 규칙을 갖되 따로 선언된다",
    /const GEN2021_MONEY_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\/;/.test(src)
    && /const gen2021Money = \(v: string\): number \| null =>/.test(src)
    && /const GEN2021_AMOUNT_FORMAT =/.test(src));
  check("형식 검증 뒤에만 쉼표를 지운다",
    /if \(!GEN2021_MONEY_FORMAT\.test\(v\)\) return null;\s*\n\s*const n = Number\(v\.replace\(\/,\/g, ""\)\);/.test(src));
  check("안전 정수·음수 검사가 있다",
    /return Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(src));
  check("trim으로 정리해 통과시키지 않는다", !/trim\(\)/.test(src));
  check("빈 값만 기존 선택 입력이다",
    /const annualLimitNum = isRider \|\| annualLimit === "" \? undefined : gen2021Money\(annualLimit\);/.test(src)
    && /const priorPaidNum = priorPaid === "" \? 0 : gen2021Money\(priorPaid\);/.test(src));
  check("게이트에 두 축이 합류한다",
    /const gated = needsOutVisits \|\| needsRiderVisits \|\| needsAmounts \|\| limitInvalid \|\| paidInvalid;/.test(src));
  check("null을 배제해야 엔진 인자가 만들어진다(타입 단언 없음)",
    /const money = gated \|\| priorPaidNum === null \|\| annualLimitNum === null \? null : \{/.test(src)
    && /const result = money === null \|\| common === null \? null : /.test(src));
  check("무효값을 0·undefined로 대체하는 경로가 없다",
    !/gen2021Money\([^)]*\) \?\? 0/.test(src)
    && !/gen2021Money\([^)]*\) \?\? undefined/.test(src)
    && !/priorPaidNum as number/.test(src) && !/annualLimitNum as number/.test(src));
  check("금액 두 축에 digits()를 쓰지 않는다",
    !/digits\(priorPaid\)/.test(src) && !/digits\(annualLimit\)/.test(src));
  // ⚠ 계약 교체(G-13B): 복제 횟수가 전용 파서 `gen2021CopyCount`로 바뀌었고 공용 `digits()`는
  //   마지막 사용처가 사라져 삭제됐다. 1~GEN2021_MAX_COPIES만 허용하고 절삭하지 않는다.
  check("복제 횟수는 전용 파서 gen2021CopyCount다",
    /const gen2021CopyCount = \(v: string\): number \| null =>/.test(src)
    && !/digits\(copyCount\)/.test(src));
  check("엔진 전달 형태", (src.match(/annualCoverageLimit: money\.annualLimit,/g) ?? []).length === 3
    && (src.match(/priorAnnualInsurancePaid: money\.priorPaid,/g) ?? []).length === 3
    && /priorAnnualRiderPaid: isRider \? money\.priorPaid : undefined,/.test(src));
}
{
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("엔진은 그대로다(정규화·상한·잔여액)",
    /const nonNegInt = \(value/.test(eng)
    && /GEN2021\.annualLimitMaximum/.test(eng)
    && /const remaining = Math\.max\(selectedLimit - paid, 0\);/.test(eng));
  const g5 = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("5세대 다회는 4세대 금액 파서를 재사용하지 않는다",
    !/gen2021Money/.test(g5) && !/GEN2021_MONEY_FORMAT/.test(g5));
}

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] G-5 축 분리·횟수·승인·진료비·복제 정책 그대로");
{
  const h = base();
  typeInto(h, PAID, "0");
  check("비급여 통원 기본 계산", screenOf(h).pay === "200,000원", String(screenOf(h).pay));
  const b = setup({ amounts: ["300000"] });
  go(b, "disease", "benefit", "none");
  typeInto(b, PAID, "0");
  check("급여 통원 기본 계산", screenOf(b).pay === "200,000원", String(screenOf(b).pay));
  const inp = setup({ amounts: ["1000000"] });
  go(inp, "disease", "non_benefit", "none");
  const inpSel = inp.render().nodes.find((n) => n.tag === "label" && n.text.startsWith(VISIT_SEL));
  void inpSel;
  pick(inp, VISIT_SEL, "inpatient");
  typeInto(inp, PAID, "0");
  check("비급여 입원 기본 계산", screenOf(inp).pay === "700,000원", String(screenOf(inp).pay));
  check("횟수 파서 그대로", /const GEN2021_COUNT_FORMAT = \/\^\[0-9\]\+\$\/;/.test(ui));
  check("진료비 파서 그대로", /const GEN2021_AMOUNT_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\/;/.test(ui));
  check("승인 회차 축 그대로", /approvedThroughVisit: approvedThrough === "" \? undefined : approvedThrough/.test(ui));
  check("축별 Record 그대로",
    /const priorPaid = priorPaidByAxis\[paidAxis\];/.test(ui)
    && /const annualLimit = annualLimitByAxis\[generalAxis\];/.test(ui));
  check("특약 선택 시 급여 선택창 비활성화 그대로",
    /value=\{coverage\} onChange=\{\(e\) => setCoverage\(e\.target\.value as Coverage\)\} disabled=\{isRider\}/.test(ui));
  check("coverage 상태를 강제로 바꾸지 않는다", (stripComments(ui).match(/setCoverage\(/g) ?? []).length === 1);
}

console.log(`\n[4세대 금액 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
