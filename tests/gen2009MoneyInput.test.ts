// G-7 — 2·3세대 다회의 **진료비가 아닌 금액 입력 두 곳**을 엄격하게 검증하고,
//   행 구성에 쓰이지 않는 값은 엔진에 넘기지 않는다.
//   ① 회(건)당 보험가입금액(통원 행이 있을 때)  ② 기존 입원 자기부담금(입원 행이 있을 때)
//
// ⚠ `priorPaid`/`priorAnnualPaid`는 **지급보험금이 아니다.** 화면 라벨은 "계약해당일 기준
//   1년간 이미 부담한 입원 자기부담금"이고, generationStandardized.ts는 이 값을 연간 200만원
//   **자기부담 상한에서 이미 소진한 금액**으로 쓴다(`remaining = max(200만 − prior, 0)`).
//   값이 커질수록 남은 자기부담이 줄어 **본인부담이 줄고 보험금이 는다** — 4세대의
//   `priorAnnualInsurancePaid`(기존 지급보험금)와 방향이 반대다. 이름으로 읽으면 틀린다.
//
// 종전 동작(기준선 `17462aa`를 실제로 실행해 확인): 두 입력 모두 공용 `AmountInput` +
//   `onlyNum()`이었다. 위젯이 문자를 지우고 **15자리로 자른** 뒤 콤마를 붙여 표시했다.
//   - 임의 변환: `-1`·`+1`→1, `1.5`→15, `1e3`→13, `20만`→20, `1,0`→10, `abc`→미입력.
//     이 값들은 사용자가 의도한 유효값을 알 수 없으므로 **결과가 크다/작다고 말할 수 없고**,
//     말할 수 있는 것은 계산기가 원문을 다른 숫자로 바꾸거나 지웠다는 사실뿐이다.
//     (해석 가능한 예: `1,0`을 `1,000`의 오타로 본다면 회(건)당 한도가 10원이 되어 적게 나온다.)
//   - **정상 입력의 무단 변형**: `1000000000000000`(안전 정수인 16자리)이 `100000000000000`으로
//     잘려 자릿수가 하나 줄고, 화면에도 잘린 값이 표시돼 사용자가 알 수 없었다.
//     ⚠ 다만 자기부담금 쪽은 원래 값과 잘린 값이 **둘 다 200만원을 넘으면 결과가 같다.**
//       절단 때문에 자기부담이 0이 됐다고 단정하지 않는다 — 전달값과 안내가 달라지는 것이 사실이다.
//
// 이번 계약
//   - 초기값은 두 입력 모두 빈 문자열. `""`은 미입력(`undefined` 전달)이다.
//   - 명시적 `0`·`00`은 유효값이고 **기존 계산 정책을 그대로 따른다** — 회(건)당 가입금액은
//     엔진에서 `<= 0`이라 한도 미적용, 자기부담금은 0원 소진(빈 값과 결과 동일).
//   - 공백만·앞뒤 공백은 무효. `trim()`으로 정리해 통과시키지 않는다.
//   - **자릿수 제한과 안전 정수 검증은 다르다.** `1000000000000000`·`9007199254740991`은
//     안전 정수이므로 원문·전달값을 그대로 받고, `9007199254740993`만 차단한다.
//   - 활성 입력만 검증·전달한다. 통원 행이 없으면 회(건)당 가입금액은 `undefined`,
//     입원 행이 없으면 자기부담금은 `undefined`. 숨은 원문 상태는 지우지 않는다.
// ⚠ 엔진·외부 타입·규칙값·산식·다른 세대·공용 위젯 파일은 무변경이다.
import { readFileSync } from "node:fs";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const UI_PATH = "src/components/calculators/HealthCalcStandardized.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

type Comp = () => unknown;
const setup = () => {
  const h = mount(HealthCalcStandardized as unknown as Comp, names);
  h.set("submitted", true);
  h.set("plan", "standard");
  h.set("generation", "2017");
  return h;
};
type H = ReturnType<typeof setup>;

/** 실제 `<input>`까지 내려간다 — 공용 위젯을 **호출해서** 통과한다(화면과 같은 경로). */
const findInput = (el: unknown): { props: Record<string, unknown> } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findInput(c); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === "input" && typeof e.props?.onChange === "function") return e as never;
  if (e.type === RawAmountInput) {
    return findInput((RawAmountInput as unknown as (p: never) => unknown)(e.props as never));
  }
  return findInput(e.props?.children);
};
const nodeById = (h: H, id: string) => h.render().nodes.find((n: RenderedNode) => n.props.id === id) ?? null;
/**
 * id로 위젯을 찾아 **위젯 자신의 onChange**를 통과시킨다.
 * ⚠ 렌더러는 함수 컴포넌트를 호출하지 않고 `#RawAmountInput` 태그로만 기록한다. props의
 *   onChange를 직접 부르면 위젯이 값을 정제·절단하더라도 검사가 통과하므로, **공용 위젯을
 *   실제로 호출해** 그 안의 `<input>`까지 내려간다 — 화면과 같은 경로다.
 */
const widget = (h: H, id: string) => {
  const n = nodeById(h, id);
  if (n === null) return null;
  if (n.tag === "#RawAmountInput") {
    return findInput((RawAmountInput as unknown as (p: never) => unknown)(n.props as never));
  }
  return n.tag === "input" ? { props: n.props } : null;
};
const typeInto = (h: H, id: string, v: string) => {
  const w = widget(h, id);
  if (w === null) throw new Error(`${id} 입력을 찾지 못했습니다`);
  (w.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shown = (h: H, id: string) => {
  const w = widget(h, id);
  return w === null ? null : String(w.props.value);
};
const LIMIT = "std-per-visit-limit";
const PAID = "std-prior-paid";

/** 행 조작은 **실제 핸들러**를 통과시킨다 — 상태를 직접 넣지 않는다. */
const rowSelect = (h: H, i: number, which: "치료 형태" | "방문 구분") => {
  const n = h.render().nodes.find((x: RenderedNode) =>
    x.tag === "select" && x.props["aria-label"] === `${i + 1}번 ${which}`);
  return n ?? null;
};
const setVisit = (h: H, i: number, v: "outpatient" | "inpatient") => {
  const n = rowSelect(h, i, "치료 형태");
  if (n === null) throw new Error(`${i + 1}번 치료 형태 선택창을 찾지 못했습니다`);
  (n.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const setFacility = (h: H, i: number, v: string) => {
  const n = rowSelect(h, i, "방문 구분");
  if (n === null) throw new Error(`${i + 1}번 방문 구분 선택창을 찾지 못했습니다`);
  if (n.props.disabled === true) throw new Error("방문 구분이 비활성입니다(우회하지 않는다)");
  (n.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const clickButton = (h: H, text: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "button" && x.text.includes(text));
  if (n === undefined) throw new Error(`"${text}" 버튼을 찾지 못했습니다`);
  if (n.props.disabled === true) throw new Error(`"${text}" 버튼이 비활성입니다`);
  (n.props.onClick as () => void)();
};
const removeRow = (h: H, i: number) => {
  const n = h.render().nodes.find((x: RenderedNode) =>
    x.tag === "button" && x.props["aria-label"] === `${i + 1}번 행 삭제`);
  if (n === undefined) throw new Error(`${i + 1}번 행 삭제 버튼을 찾지 못했습니다`);
  if (n.props.disabled === true) throw new Error("삭제 버튼이 비활성입니다");
  (n.props.onClick as () => void)();
};
const rowAmount = (h: H, i: number, v: string) => {
  const rowIds = h.render().nodes.filter((n) => n.tag === "#RawAmountInput"
    && String(n.props.id).startsWith("std-amount-")).map((n) => String(n.props.id));
  const id = rowIds[i];
  if (id === undefined) throw new Error(`${i + 1}번 행 진료비 입력을 찾지 못했습니다`);
  typeInto(h, id, v);
};

const screenOf = (h: H) => {
  const s = h.render();
  const boxes = s.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox");
  const warnText = boxes.filter((n) => n.props.variant === "warning").map((n) => n.text).join(" || ");
  const infoText = boxes.filter((n) => n.props.variant === "info").map((n) => n.text).join(" || ");
  const items = s.resultItems();
  return {
    calculated: items !== null,
    own: items === null ? null : items[1]?.value ?? null,
    pay: items === null ? null : items[2]?.value ?? null,
    warnText, infoText,
    warnsLimit: warnText.includes("회(건)당 보험가입금액"),
    warnsPaid: warnText.includes("이미 부담한 입원 자기부담금"),
    zeroNote: infoText.includes("0을 입력해 현재 계산에는 해당 한도를 적용하지"),
    engineNoLimitNote: infoText.includes("계약마다 다른 값이라 입력하지 않으면"),
    engineAppliedNote: /입력하신 회\(건\)당 가입금액/.test(infoText),
  };
};
/** 행 구성 만들기 — 전부 실제 핸들러를 거친다. */
const compose = (h: H, kind: "외래만" | "처방만" | "입원만" | "외래+입원" | "외래+처방", amount = "300000") => {
  h.set("priorVisits", "0"); h.set("priorPrescriptions", "0");
  while (h.render().nodes.filter((n) => n.tag === "#RawAmountInput"
    && String(n.props.id).startsWith("std-amount-")).length > 1) removeRow(h, 1);
  rowAmount(h, 0, amount);
  const need2 = kind === "외래+입원" || kind === "외래+처방";
  if (need2) clickButton(h, "행 추가");
  if (kind === "외래만") { setVisit(h, 0, "outpatient"); setFacility(h, 0, "clinic"); }
  if (kind === "처방만") { setVisit(h, 0, "outpatient"); setFacility(h, 0, "pharmacy"); }
  if (kind === "입원만") { setVisit(h, 0, "inpatient"); }
  if (kind === "외래+입원") { setVisit(h, 0, "outpatient"); setFacility(h, 0, "clinic"); setVisit(h, 1, "inpatient"); rowAmount(h, 1, amount); }
  if (kind === "외래+처방") { setVisit(h, 0, "outpatient"); setFacility(h, 0, "clinic"); setVisit(h, 1, "outpatient"); setFacility(h, 1, "pharmacy"); rowAmount(h, 1, amount); }
  return h;
};
const make = (kind: Parameters<typeof compose>[1], amount?: string) => compose(setup(), kind, amount);

// ── 노출·전달 조건 ───────────────────────────────────────────────────
console.log("\n[노출] 활성 입력만 화면에 나온다");
{
  const cases: [Parameters<typeof compose>[1], boolean, boolean][] = [
    ["외래만", true, false], ["처방만", true, false], ["입원만", false, true],
    ["외래+입원", true, true], ["외래+처방", true, false],
  ];
  for (const [kind, wantLimit, wantPaid] of cases) {
    const h = make(kind);
    check(`${kind}: 회(건)당 가입금액 칸 ${wantLimit ? "보임" : "없음"}`, (nodeById(h, LIMIT) !== null) === wantLimit);
    check(`${kind}: 입원 자기부담금 칸 ${wantPaid ? "보임" : "없음"}`, (nodeById(h, PAID) !== null) === wantPaid);
  }
}

// ── 파서 계약 ────────────────────────────────────────────────────────
const VALID: [string, string][] = [
  ["명시적 0", "0"], ["0 반복", "00"], ["정수", "300000"], ["천 단위 쉼표", "300,000"],
  ["안전한 16자리", "1000000000000000"], ["안전 정수 최대값", "9007199254740991"],
];
const INVALID: [string, string][] = [
  ["공백만", "   "], ["탭만", "\t"], ["앞 공백", " 300000"], ["뒤 공백", "300000 "],
  ["가운데 공백", "300 000"], ["음수", "-1"], ["양부호", "+1"], ["소수", "1.5"],
  ["끝 점", "1."], ["앞 점", ".5"], ["지수", "1e3"], ["한글 단위", "20만"], ["문자", "abc"],
  ["잘못된 쉼표", "1,0"], ["자리 어긋난 쉼표", "1,00,000"], ["앞 쉼표", ",300"],
  ["뒤 쉼표", "300,"], ["안전 정수 초과", "9007199254740993"], ["통화 기호", "₩300000"],
  ["NaN", "NaN"], ["Infinity", "Infinity"],
];

console.log("\n[회(건)당 가입금액] 유효값은 계산되고 원문이 보존된다");
for (const [what, v] of VALID) {
  const h = make("외래만");
  typeInto(h, LIMIT, v);
  const scr = screenOf(h);
  check(`가입금액 ${what}(${JSON.stringify(v)}) → 계산됨`, scr.calculated, scr.warnText);
  check(`가입금액 ${what} → 원문 보존(콤마 자동 표시 없음)`, shown(h, LIMIT) === v, String(shown(h, LIMIT)));
}
console.log("\n[회(건)당 가입금액] 무효값은 계산을 막고 안내한다");
for (const [what, v] of INVALID) {
  const h = make("외래만");
  typeInto(h, LIMIT, v);
  const scr = screenOf(h);
  check(`가입금액 ${what}(${JSON.stringify(v)}) → 결과 없음`, !scr.calculated, String(scr.pay));
  check(`가입금액 ${what} → 가입금액을 지목`, scr.warnsLimit);
  check(`가입금액 ${what} → 원문 보존`, shown(h, LIMIT) === v, String(shown(h, LIMIT)));
}
console.log("\n[입원 자기부담금] 유효값은 계산되고 원문이 보존된다");
for (const [what, v] of VALID) {
  const h = make("입원만", "10000000");
  typeInto(h, PAID, v);
  check(`자기부담금 ${what}(${JSON.stringify(v)}) → 계산됨`, screenOf(h).calculated, screenOf(h).warnText);
  check(`자기부담금 ${what} → 원문 보존`, shown(h, PAID) === v, String(shown(h, PAID)));
}
console.log("\n[입원 자기부담금] 무효값은 계산을 막고 안내한다");
for (const [what, v] of INVALID) {
  const h = make("입원만", "10000000");
  typeInto(h, PAID, v);
  const scr = screenOf(h);
  check(`자기부담금 ${what}(${JSON.stringify(v)}) → 결과 없음`, !scr.calculated, String(scr.pay));
  check(`자기부담금 ${what} → 자기부담금을 지목`, scr.warnsPaid);
  check(`자기부담금 ${what} → 원문 보존`, shown(h, PAID) === v, String(shown(h, PAID)));
}

// ── 자릿수 제한과 안전 정수 검증은 다르다 ────────────────────────────
console.log("\n[자릿수] 16자리라고 자르거나 막지 않는다 — 안전 정수만 본다");
{
  const h = make("외래만");
  typeInto(h, LIMIT, "1000000000000000");
  check("안전한 16자리: 원문 그대로 보존", shown(h, LIMIT) === "1000000000000000", String(shown(h, LIMIT)));
  check("안전한 16자리: 계산되고 한도가 엔진에 전달됨",
    screenOf(h).calculated && screenOf(h).engineAppliedNote
    && screenOf(h).infoText.includes("1,000,000,000,000,000"), screenOf(h).infoText.slice(0, 120));
  typeInto(h, LIMIT, "9007199254740991");
  check("안전 정수 최대값: 계산되고 그 값이 안내에 나온다",
    screenOf(h).calculated && screenOf(h).infoText.includes("9,007,199,254,740,991"));
  typeInto(h, LIMIT, "9007199254740993");
  check("안전 정수 초과: 차단", !screenOf(h).calculated && screenOf(h).warnsLimit);
  check("안전 정수 초과: 원문 보존(자르지 않는다)", shown(h, LIMIT) === "9007199254740993");
}

// ── 빈 값·0·00의 기존 계산 정책 ──────────────────────────────────────
console.log("\n[기존 정책] 빈 값·명시적 0·00은 종전 계산을 그대로 따른다");
{
  const h = make("외래만");   // 통원 30만 · 2017 표준형 → 본인부담 60,000 / 보험금 240,000
  check("① 빈 값 → 한도 미적용", screenOf(h).pay === "240,000원", String(screenOf(h).pay));
  check("① 빈 값 → 엔진의 '입력하지 않으면 미적용' 안내", screenOf(h).engineNoLimitNote);
  check("① 빈 값 → 0 안내는 뜨지 않는다", !screenOf(h).zeroNote);
  typeInto(h, LIMIT, "0");
  check("① 명시적 0 → 한도 미적용(계산 동일)", screenOf(h).pay === "240,000원", String(screenOf(h).pay));
  check("① 명시적 0 → **UI가 0 안내를 붙인다**", screenOf(h).zeroNote);
  check("① 명시적 0 → 엔진 안내는 그대로 없다(엔진 무변경)", !screenOf(h).engineNoLimitNote);
  typeInto(h, LIMIT, "00");
  check("① 00도 같다", screenOf(h).pay === "240,000원" && screenOf(h).zeroNote);
  typeInto(h, LIMIT, "100000");
  check("① 양수 한도는 적용된다", screenOf(h).pay === "100,000원", String(screenOf(h).pay));
  check("① 양수일 때 0 안내는 없다", !screenOf(h).zeroNote);
}
{
  const h = make("입원만", "10000000");   // 상한 200만
  check("② 빈 값 → 상한 전액 남음", screenOf(h).own === "2,000,000원", String(screenOf(h).own));
  typeInto(h, PAID, "0");
  check("② 명시적 0 → 빈 값과 결과 동일", screenOf(h).own === "2,000,000원", String(screenOf(h).own));
  typeInto(h, PAID, "00");
  check("② 00도 같다", screenOf(h).own === "2,000,000원");
  typeInto(h, PAID, "500,000");
  check("② 500,000 소진 → 남은 상한만큼만 부담", screenOf(h).own === "1,500,000원", String(screenOf(h).own));
  typeInto(h, PAID, "2000000");
  check("② 상한 소진 → 본인부담 0원", screenOf(h).own === "0원", String(screenOf(h).own));
  check("② 입원만이면 0 안내를 붙이지 않는다", !screenOf(h).zeroNote);
}
{
  const h = make("입원만", "10000000");
  typeInto(h, PAID, "0");
  check("② 입원만이면 회(건)당 가입금액 안내도 UI가 새로 만들지 않는다", !screenOf(h).zeroNote);
}

// ── 정상 → 무효 → 수정 → 재개 ────────────────────────────────────────
console.log("\n[전이] 정상 → 무효 → 결과 숨김 → 수정 → 재개");
{
  const h = make("외래+입원", "300000");
  typeInto(h, LIMIT, "300000");
  typeInto(h, PAID, "0");
  check("① 정상 계산", screenOf(h).calculated);
  typeInto(h, LIMIT, "300000 ");
  check("② 가입금액 무효 → 결과 숨김", !screenOf(h).calculated);
  check("② 안내 1건(가입금액)", screenOf(h).warnsLimit && !screenOf(h).warnsPaid);
  typeInto(h, PAID, "1,0");
  check("③ 양쪽 무효 → 두 안내 모두", screenOf(h).warnsLimit && screenOf(h).warnsPaid);
  typeInto(h, LIMIT, "300000");
  check("④ 한쪽만 고치면 아직 막힌다", !screenOf(h).calculated && screenOf(h).warnsPaid && !screenOf(h).warnsLimit);
  typeInto(h, PAID, "0");
  check("⑤ 둘 다 고치면 재개", screenOf(h).calculated);
}

// ── 숨은 값 — 간섭 없음·복귀 시 복원·안내 복원 ───────────────────────
console.log("\n[숨은 값] 쓰이지 않는 입력은 검증도 전달도 하지 않는다");
{
  const h = make("외래만");
  typeInto(h, LIMIT, "abc");
  check("통원: 가입금액 무효로 차단", !screenOf(h).calculated && screenOf(h).warnsLimit);
  setVisit(h, 0, "inpatient");           // 실제 선택창 핸들러
  const afterIn = screenOf(h);
  check("입원으로 바꾸면 계산된다(숨은 무효값이 막지 않는다)", afterIn.calculated, afterIn.warnText);
  check("입원에서는 가입금액 안내가 없다", !afterIn.warnsLimit);
  check("입원에서는 가입금액 칸도 없다", nodeById(h, LIMIT) === null);
  setVisit(h, 0, "outpatient");
  check("통원 복귀: 원문 복원", shown(h, LIMIT) === "abc", String(shown(h, LIMIT)));
  check("통원 복귀: 안내 복원", !screenOf(h).calculated && screenOf(h).warnsLimit);
}
{
  // 숨은 **유효**값이 엔진에 전달되지 않는다 — 엔진 안내로 확인한다.
  const h = make("외래만");
  typeInto(h, LIMIT, "100000");
  check("통원: 한도 적용 안내", screenOf(h).engineAppliedNote && !screenOf(h).engineNoLimitNote);
  setVisit(h, 0, "inpatient");
  const hidden = screenOf(h);
  const fresh = screenOf(make("입원만", "300000"));
  check("입원 전환: 숨은 값이 전달되지 않아 '입력하지 않으면 미적용' 안내가 유지된다",
    hidden.engineNoLimitNote, hidden.infoText.slice(0, 140));
  check("입원 전환: 처음부터 빈 값인 경우와 안내가 같다",
    hidden.engineNoLimitNote === fresh.engineNoLimitNote && hidden.engineAppliedNote === fresh.engineAppliedNote);
  check("입원 전환: 계산값도 같다", hidden.own === fresh.own && hidden.pay === fresh.pay,
    `${hidden.own}/${hidden.pay} vs ${fresh.own}/${fresh.pay}`);
  setVisit(h, 0, "outpatient");
  check("통원 복귀: 값과 적용 안내가 돌아온다", shown(h, LIMIT) === "100000" && screenOf(h).engineAppliedNote);
}
{
  const h = make("입원만", "10000000");
  typeInto(h, PAID, "1.5");
  check("입원: 자기부담금 무효로 차단", !screenOf(h).calculated && screenOf(h).warnsPaid);
  setVisit(h, 0, "outpatient");
  check("통원으로 바꾸면 계산된다", screenOf(h).calculated && !screenOf(h).warnsPaid);
  setVisit(h, 0, "inpatient");
  check("입원 복귀: 원문·안내 복원", shown(h, PAID) === "1.5" && !screenOf(h).calculated && screenOf(h).warnsPaid);
}
{
  // 행 삭제로 축이 사라져도 같다.
  const h = make("외래+입원", "300000");
  typeInto(h, LIMIT, "1e3");
  typeInto(h, PAID, "0");
  check("혼합: 가입금액 무효로 차단", !screenOf(h).calculated);
  removeRow(h, 0);                        // 통원 행 삭제 → 입원만
  check("통원 행을 지우면 계산된다", screenOf(h).calculated, screenOf(h).warnText);
  check("통원 행을 지우면 가입금액 칸도 사라진다", nodeById(h, LIMIT) === null);
  clickButton(h, "행 추가");               // 통원 행 복귀(newRow 기본값은 통원)
  check("행을 다시 추가하면 원문·안내가 복원된다",
    shown(h, LIMIT) === "1e3" && !screenOf(h).calculated && screenOf(h).warnsLimit);
}

// ── 처방조제 축 ──────────────────────────────────────────────────────
console.log("\n[처방조제] 약국 행도 통원이라 회(건)당 한도를 쓴다");
{
  const h = make("처방만");
  typeInto(h, LIMIT, "abc");
  check("처방조제만: 가입금액 무효로 차단", !screenOf(h).calculated && screenOf(h).warnsLimit);
  typeInto(h, LIMIT, "50000");
  check("처방조제만: 한도가 적용된다", screenOf(h).pay === "50,000원", String(screenOf(h).pay));
  const p = make("외래+처방");
  typeInto(p, LIMIT, "0");
  check("외래+처방: 0 안내가 뜬다", screenOf(p).zeroNote);
  check("외래+처방: 입원 자기부담금 칸은 없다", nodeById(p, PAID) === null);
}

// ── 소스 계약 ────────────────────────────────────────────────────────
console.log("\n[소스] 파서·게이트·전달 형태");
{
  const code = stripComments(ui);
  check("금액 파서가 따로 선언된다(진료비 파서는 그대로)",
    /const STD_MONEY_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\//.test(code)
    && /const stdMoney = \(v: string\): number \| null =>/.test(code)
    && /const STD_AMOUNT_FORMAT =/.test(code));
  check("형식 검증 뒤에만 쉼표를 지운다",
    /if \(!STD_MONEY_FORMAT\.test\(v\)\) return null;\s*\n\s*const n = Number\(v\.replace\(\/,\/g, ""\)\);/.test(code));
  check("안전 정수·음수 검사가 있다", /return Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(code));
  check("자릿수 제한을 두지 않는다",
    !/MAX_AMOUNT_DIGITS/.test(code) && !/\.slice\(0, 1[0-9]\)/.test(code)
    && !/maxLength/.test(code) && !/length > 1[0-9]/.test(code));
  check("trim으로 정리해 통과시키지 않는다", !/\.trim\(\)/.test(code));
  check("활성 입력만 검증·전달한다",
    /const perVisitNum = !hasOutpatient \|\| perVisitLimit === "" \? undefined : stdMoney\(perVisitLimit\);/.test(code)
    && /const priorPaidNum = !hasInpatient \|\| priorPaid === "" \? undefined : stdMoney\(priorPaid\);/.test(code));
  check("게이트에 두 축이 합류한다",
    /const gated = needsVisits \|\| needsPrescriptions \|\| needsAmounts \|\| perVisitInvalid \|\| priorPaidInvalid;/.test(code));
  check("null을 배제해야 엔진 인자가 만들어진다(타입 단언 없음)",
    /const money = gated \|\| perVisitNum === null \|\| priorPaidNum === null \? null : \{/.test(code)
    && /const result = money === null \? null : calculateMany\(/.test(code)
    && !/perVisitNum as number/.test(code) && !/priorPaidNum as number/.test(code));
  check("무효값을 0·undefined로 대체하는 경로가 없다",
    !/stdMoney\([^)]*\) \?\? 0/.test(code) && !/stdMoney\([^)]*\) \?\? undefined/.test(code));
  check("엔진 전달 형태", /priorAnnualPaid: money\.priorPaid,/.test(code)
    && /perVisitCoverageLimit: money\.perVisit,/.test(code));
  check("0 안내는 UI가 만들고 숫자 0을 undefined로 바꾸지 않는다",
    /const perVisitZero = perVisitNum !== undefined && perVisitNum !== null && perVisitNum <= 0;/.test(code)
    && !/perVisitNum <= 0 \? undefined/.test(code));
  check("공용 위젯 파일은 그대로다",
    /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/
      .test(readFileSync("src/components/AmountInput.tsx", "utf8"))
    && !/trim\(|replace\(/.test(stripComments(readFileSync("src/components/RawAmountInput.tsx", "utf8"))));
  const eng = readFileSync("src/lib/insurance/engine/generationStandardized.ts", "utf8");
  const multi = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("엔진은 그대로다(200만 상한·회당 한도·미적용 안내)",
    /const prior = Math\.max\(0, input\.priorAnnualPaid \?\? 0\);/.test(eng)
    && /if \(value === undefined \|\| !Number\.isFinite\(value\) \|\| value <= 0\) return undefined;/.test(eng)
    && /if \(input\.perVisitCoverageLimit === undefined\) \{/.test(multi));
  check("4·5세대 금액 파서를 재사용하지 않는다",
    !/gen2021Money/.test(code) && !/GEN2021_MONEY_FORMAT/.test(code));
}

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] 진료비·횟수·빠른채우기·상한 계약 그대로");
{
  const h = make("외래만");
  check("통원 기본 계산", screenOf(h).pay === "240,000원", String(screenOf(h).pay));
  const i = make("입원만", "10000000");
  check("입원 기본 계산", screenOf(i).own === "2,000,000원", String(screenOf(i).own));
  rowAmount(h, 0, "abc");
  check("진료비 무효는 여전히 차단", !screenOf(h).calculated && screenOf(h).warnText.includes("진료비"));
  rowAmount(h, 0, "300000");
  h.set("priorVisits", "");
  check("횟수 미입력은 여전히 차단", !screenOf(h).calculated);
  h.set("priorVisits", "0");
  check("횟수 복구 후 재개", screenOf(h).calculated);
  check("진료비 파서 그대로", /const STD_AMOUNT_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\/;/.test(ui));
  check("횟수 파서 그대로", /const STD_COUNT_FORMAT = \/\^\[0-9\]\+\$\/;/.test(ui));
  check("빠른 채우기 횟수는 onlyNum 그대로", /Math\.max\(1, onlyNum\(quickCount\) \|\| 1\)/.test(ui));
  const q = make("외래만");
  typeInto(q, "std-quick-amount", "100000");
  clickButton(q, "채우기");
  check("빠른 채우기 동작 유지", q.render().nodes
    .filter((n) => n.tag === "#RawAmountInput" && String(n.props.id).startsWith("std-amount-")).length >= 1);
}

console.log(`\n[2·3세대 금액 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
