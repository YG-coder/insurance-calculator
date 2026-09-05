// G-9 — 5세대 다회의 **누적 금액 세 축**을 엄격하게 검증한다.
//   ① 기존 지급보험금(`priorInsuranceByAxis`, 8축)
//   ② 연간 보험가입금액(`annualLimitByAxis`, 일반 4축)
//   ③ 통원 가입금액(`outpatientLimitByAxis`, 일반 4축)
//
// ⚠ G-9 당시 `priorDeductible`·`priorPool`(공제금액 두 입력)은 대상이 아니었다.
//   **G-10 항목 A가 그 둘도 같은 파서로 옮겼다.** 이 파일은 세 축의 계약을 계속 지키고,
//   공제금액 두 입력의 형식·경계·차단은 `gen2026DeductibleInput.test.ts`가 본다.
//   아래 무회귀 절은 둘이 **함께 있을 때** 서로를 가리지 않는지만 확인한다.
//
// 종전 동작(기준선 `181fecd`를 실제로 실행해 확인): 세 입력 모두 맨 `<input>` + 공용 `num()`.
//   `num()`은 `/[^0-9.]/`를 지우므로 **점을 남긴다** — 4세대 `digits()`·2·3세대 `onlyNum()`과
//   동작이 다르다.
//     `-1`·`+1`→1, **`1.5`→1.5(소수가 그대로 전달)**, `1e3`→13, `20만`→20, `1,0`→10,
//     `abc`·`1.2.3`·공백만→0, `9007199254740993`→`…992`.
//   ⚠ 맨 `<input>`이라 **절단은 없다** — `1000000000000000`은 종전에도 그대로 전달됐다.
//   ⚠ 잘못된 입력의 방향은 비교 대상인 실제 이력·계약값을 알 때만 말할 수 있다. 여기서는
//     **원문이 다른 숫자로 바뀌거나 0으로 지워졌다**는 사실과 계산 결과만 기록한다.
//
// 이번 계약
//   - 초기값 유지: 지급보험금 `"0"`, 가입금액 두 종류 `""`.
//   - **빈 문자열의 뜻이 필드마다 다르다** — 지급보험금은 `0`, 가입금액 두 종류는
//     `undefined`(미적용). 한쪽 규칙을 다른 쪽에 옮기지 않는다.
//   - 명시적 `0`·`00`은 숫자 `0`을 전달하고 엔진의 종전 처리를 그대로 따른다.
//     **0에 대한 새 안내는 이번에 붙이지 않는다.**
//   - 공백만·앞뒤 공백·부호·소수·지수 표기·문자·잘못된 쉼표·안전 정수 초과는 차단.
//     **소수 차단은 승인한 의도된 동작 변경**이다.
//   - 올바른 정수·천 단위 쉼표·**안전한 16자리 정수**는 원문과 값을 보존한다.
//   - 경로가 실제로 쓰는 금액만 검증한다.
import { readFileSync } from "node:fs";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const UI_PATH = "src/components/calculators/HealthCalcMulti2026.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

type Comp = () => unknown;
const setup = () => { const h = mount(HealthCalcMulti2026 as unknown as Comp, names); h.set("submitted", true); return h; };
type H = ReturnType<typeof setup>;
const findIn = (el: unknown, t: string): { props: Record<string, unknown> } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findIn(c, t); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === t && typeof e.props?.onChange === "function") return e as never;
  return findIn(e.props?.children, t);
};
const labelOf = (h: H, p: string) => h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(p));
const pick = (h: H, p: string, v: string) => {
  const l = labelOf(h, p); const s = l === undefined ? null : findIn(l.props.children, "select");
  if (s === null) throw new Error("선택창을 찾지 못했습니다: " + p);
  if (s.props.disabled === true) throw new Error("선택창이 비활성입니다: " + p);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
/** id로 위젯을 찾아 **공용 위젯을 실제로 호출해** 그 안의 `<input>`까지 내려간다. */
const widget = (h: H, id: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === id);
  if (n === undefined) return null;
  if (n.tag === "#RawAmountInput") return findIn((RawAmountInput as unknown as (p: never) => unknown)(n.props as never), "input");
  return n.tag === "input" ? { props: n.props } : null;
};
const typeById = (h: H, id: string, v: string) => {
  const w = widget(h, id); if (w === null) throw new Error("입력을 찾지 못했습니다: " + id);
  (w.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shownById = (h: H, id: string) => { const w = widget(h, id); return w === null ? null : String(w.props.value); };

const PRIOR_ID = "gen2026-prior-insurance", ANNUAL_ID = "gen2026-annual-limit", OUT_ID = "gen2026-outpatient-limit";
const COV = "급여 구분", ITEM = "치료유형", SEV = "질환 구분", PUR = "약제 용도";
const VIS = "치료 형태", TIER = "입원 의료기관", CAUSE = "원인";
const DEDUCT_ID = "gen2026-prior-deductible";
const scr = (h: H) => {
  const r = h.render(); const it = r.resultItems();
  const boxes = r.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning").map((n) => String(n.text));
  const warn = boxes.join(" || ");
  // ⚠ 낱말만 보면 안 된다 — 원인 미선택 안내에도 "연간 보험가입금액"이 들어 있다.
  //   **이번에 추가한 무효 안내**만 세도록 필드 이름과 "올바르게 입력해 주세요"를
  //   같은 상자 안에서 함께 본다.
  const invalidBox = (field: string) =>
    boxes.some((t) => t.includes(field) && t.includes("올바르게 입력해 주세요"));
  return {
    calc: it !== null,
    pay: it === null ? null : (it[2]?.value ?? null),
    own: it === null ? null : (it[1]?.value ?? null),
    warn,
    wPrior: invalidBox("기존 지급보험금"), wAnnual: invalidBox("연간 보험가입금액"), wOut: invalidBox("통원 가입금액"),
  };
};
/** 경로 진입 — 전부 실제 선택창을 거친다. 급여를 지나 초기화하므로 숨은 선택창을 우회하지 않는다. */
const gen = (h: H, sev: string, cause: string, visit: string, tier?: string) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "general"); pick(h, SEV, sev); pick(h, CAUSE, cause); pick(h, VIS, visit);
  if (tier) pick(h, TIER, tier);
  h.set("priorVisits", "0"); h.set("priorOutDays", "0"); h.set("amounts", ["3000000", "3000000"]);
  return h;
};
const route = (h: H, item: string, sev: string, cause: string, purpose?: string) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, item); pick(h, SEV, sev); if (purpose) pick(h, PUR, purpose);
  pick(h, CAUSE, cause); pick(h, VIS, "outpatient");
  h.set("priorVisits", "0"); h.set("priorOutDays", "0"); h.set("amounts", ["3000000"]);
  return h;
};
const item = (h: H, it: string, sev: string, purpose?: string) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, it); pick(h, SEV, sev); if (purpose) pick(h, PUR, purpose);
  h.set("priorActs", "0"); h.set("priorCountByItem", { musculoskeletal_esw: "0", injection: "0" });
  h.set("rows", [{ amount: "1000000", visit: "outpatient", tier: "" }]);
  return h;
};
const room = (h: H, sev: string, cause: string) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "room_charge"); pick(h, SEV, sev); pick(h, CAUSE, cause);
  h.set("rcRows", [{ amount: "600000", days: "3" }]);
  return h;
};

const VALID: [string, string][] = [
  ["명시적 0", "0"], ["0 반복", "00"], ["정수", "300000"], ["천 단위 쉼표", "300,000"],
  ["안전한 16자리", "1000000000000000"], ["안전 정수 최대값", "9007199254740991"],
];
const INVALID: [string, string][] = [
  ["공백만", "   "], ["탭만", "\t"], ["앞 공백", " 300000"], ["뒤 공백", "300000 "],
  ["가운데 공백", "300 000"], ["음수", "-1"], ["양부호", "+1"], ["소수", "1.5"],
  ["끝 점", "1."], ["앞 점", ".5"], ["점 두 개", "1.2.3"], ["지수", "1e3"], ["한글 단위", "20만"],
  ["문자", "abc"], ["잘못된 쉼표", "1,0"], ["자리 어긋난 쉼표", "1,00,000"], ["앞 쉼표", ",300"],
  ["뒤 쉼표", "300,"], ["안전 정수 초과", "9007199254740993"], ["통화 기호", "₩300000"],
  ["NaN", "NaN"], ["Infinity", "Infinity"],
];

// ── 파서 계약 ────────────────────────────────────────────────────────
console.log("\n[파서] 세 축 모두 유효값은 계산되고 무효값은 차단된다");
{
  type Case = { name: string; go: (h: H) => H; id: string; want: "prior" | "annual" | "out" };
  const cases: Case[] = [
    { name: "일반 중증 통원·지급보험금", go: (h) => gen(h, "critical", "disease", "outpatient"), id: PRIOR_ID, want: "prior" },
    { name: "일반 중증 통원·연간", go: (h) => gen(h, "critical", "disease", "outpatient"), id: ANNUAL_ID, want: "annual" },
    { name: "일반 중증 통원·통원한도", go: (h) => gen(h, "critical", "disease", "outpatient"), id: OUT_ID, want: "out" },
    { name: "일반 비중증 입원·지급보험금", go: (h) => gen(h, "non_critical", "injury", "inpatient", "hospital"), id: PRIOR_ID, want: "prior" },
    { name: "일반 전환(비중증 주사)·연간", go: (h) => route(h, "injection", "non_critical", "disease"), id: ANNUAL_ID, want: "annual" },
    { name: "상급병실료·지급보험금", go: (h) => room(h, "critical", "disease"), id: PRIOR_ID, want: "prior" },
    { name: "상급병실료·연간", go: (h) => room(h, "critical", "disease"), id: ANNUAL_ID, want: "annual" },
    { name: "특약 중증 MRI·지급보험금", go: (h) => item(h, "mri", "critical"), id: PRIOR_ID, want: "prior" },
    { name: "특약 비중증 MRI·지급보험금", go: (h) => item(h, "mri", "non_critical"), id: PRIOR_ID, want: "prior" },
    { name: "특약 중증 근골격계·지급보험금", go: (h) => item(h, "musculoskeletal_esw", "critical"), id: PRIOR_ID, want: "prior" },
  ];
  for (const c of cases) {
    let ok = true; const bad: string[] = [];
    for (const [, v] of VALID) {
      const h = c.go(setup());
      // 중증 MRI 입원 pool 칸은 이번 대상이 아니므로 통원 행만 쓴다(위 item()이 통원).
      typeById(h, c.id, v);
      const s = scr(h);
      if (!s.calc) { ok = false; bad.push(`유효 ${JSON.stringify(v)} → 차단됨 (${s.warn.slice(0, 40)})`); }
      if (shownById(h, c.id) !== v) { ok = false; bad.push(`유효 ${JSON.stringify(v)} → 원문 ${shownById(h, c.id)}`); }
    }
    for (const [, v] of INVALID) {
      const h = c.go(setup());
      typeById(h, c.id, v);
      const s = scr(h);
      if (s.calc) { ok = false; bad.push(`무효 ${JSON.stringify(v)} → 계산됨 ${s.pay}`); }
      const pointed = c.want === "prior" ? s.wPrior : c.want === "annual" ? s.wAnnual : s.wOut;
      if (!pointed) { ok = false; bad.push(`무효 ${JSON.stringify(v)} → 안내가 지목하지 않음`); }
      if (shownById(h, c.id) !== v) { ok = false; bad.push(`무효 ${JSON.stringify(v)} → 원문 ${shownById(h, c.id)}`); }
    }
    check(`${c.name}: 유효 ${VALID.length}종 계산 · 무효 ${INVALID.length}종 차단 · 원문 보존`, ok, bad.slice(0, 3).join(" | "));
  }
}

// ── 빈 값·0의 필드별 계약 ────────────────────────────────────────────
console.log("\n[기존 계약] 빈 값의 뜻이 필드마다 다르다");
{
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "0"); typeById(h, ANNUAL_ID, ""); typeById(h, OUT_ID, "");
  const base = scr(h).pay;
  check("① 지급보험금 명시적 0 → 계산", base === "4,200,000원", String(base));
  typeById(h, PRIOR_ID, "");
  check("① 지급보험금 빈 값 → 0으로 계산(명시적 0과 같다)", scr(h).pay === base, String(scr(h).pay));
  typeById(h, PRIOR_ID, "0");
  typeById(h, ANNUAL_ID, "10000000");
  check("② 연간 가입금액 적용", scr(h).pay === "4,200,000원", String(scr(h).pay));
  typeById(h, ANNUAL_ID, "1000000");
  check("② 연간 한도가 결과를 줄인다", scr(h).pay === "1,000,000원", String(scr(h).pay));
  typeById(h, ANNUAL_ID, "");
  check("② 빈 값 → 한도 미적용", scr(h).pay === base, String(scr(h).pay));
  typeById(h, ANNUAL_ID, "0");
  check("② 명시적 0 → 숫자 0 전달, 엔진의 종전 처리(미적용)", scr(h).pay === base, String(scr(h).pay));
  check("② 0에 대한 새 안내를 붙이지 않는다", !scr(h).warn.includes("0을 입력해"));
  typeById(h, ANNUAL_ID, "");
  typeById(h, OUT_ID, "200000");
  check("③ 통원 가입금액 적용", scr(h).pay === "400,000원", String(scr(h).pay));
  typeById(h, OUT_ID, "");
  check("③ 빈 값 → 미적용", scr(h).pay === base, String(scr(h).pay));
  typeById(h, OUT_ID, "0");
  check("③ 명시적 0 → 엔진의 종전 처리(미적용)", scr(h).pay === base, String(scr(h).pay));
}
{
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, ANNUAL_ID, "50000000"); typeById(h, PRIOR_ID, "49000000");
  check("잔여 한도가 결과를 줄인다(상한·잔여액 처리 유지)", scr(h).pay === "1,000,000원", String(scr(h).pay));
  typeById(h, ANNUAL_ID, "99999999999");
  typeById(h, PRIOR_ID, "0");
  check("약관 상한 클램프 유지(입력 오류가 아니다)", scr(h).calc, scr(h).warn.slice(0, 40));
  typeById(h, PRIOR_ID, "9007199254740991");
  check("안전 정수 최대값도 계산된다", scr(h).calc);
  typeById(h, PRIOR_ID, "9007199254740993");
  check("안전 정수 초과는 차단", !scr(h).calc && scr(h).wPrior);
}

// ── 전이·동시 무효 ───────────────────────────────────────────────────
console.log("\n[전이] 정상 → 무효 → 결과 숨김 → 수정 → 재개");
{
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "0"); typeById(h, ANNUAL_ID, "50000000"); typeById(h, OUT_ID, "200000");
  check("① 정상 계산", scr(h).calc);
  typeById(h, ANNUAL_ID, "1.5");
  check("② 소수 → 결과 숨김 · 연간만 지목", !scr(h).calc && scr(h).wAnnual && !scr(h).wPrior && !scr(h).wOut);
  typeById(h, PRIOR_ID, "1,0"); typeById(h, OUT_ID, "   ");
  check("③ 셋 다 무효 → 세 안내 모두", scr(h).wPrior && scr(h).wAnnual && scr(h).wOut);
  typeById(h, ANNUAL_ID, "50000000");
  check("④ 하나만 고치면 아직 막힌다", !scr(h).calc && scr(h).wPrior && scr(h).wOut && !scr(h).wAnnual);
  typeById(h, PRIOR_ID, "0");
  check("⑤ 둘 고쳐도 아직 막힌다", !scr(h).calc && scr(h).wOut && !scr(h).wPrior);
  typeById(h, OUT_ID, "200000");
  check("⑥ 셋 다 고치면 재개", scr(h).calc && scr(h).pay === "400,000원", String(scr(h).pay));
}

// ── 경로별 게이트 ────────────────────────────────────────────────────
console.log("\n[경로] 그 경로가 쓰는 금액만 검증한다");
{
  // 통원 가입금액이 무효인 채로 입원·상급병실료로 이동하면 간섭하지 않는다.
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "0"); typeById(h, OUT_ID, "abc");
  check("통원: 통원 가입금액 무효로 차단", !scr(h).calc && scr(h).wOut);
  pick(h, VIS, "inpatient"); pick(h, TIER, "hospital");
  check("입원으로 이동 → 계산됨(통원 가입금액을 읽지 않는다)", scr(h).calc, scr(h).warn.slice(0, 50));
  check("입원에서는 통원 가입금액 칸도 안내도 없다", widget(h, OUT_ID) === null && !scr(h).wOut);
  pick(h, VIS, "outpatient");
  check("통원 복귀: 원문·안내 복원", shownById(h, OUT_ID) === "abc" && !scr(h).calc && scr(h).wOut);
  room(h, "critical", "disease");
  check("상급병실료로 이동 → 계산됨(통원 가입금액을 읽지 않는다)", scr(h).calc && !scr(h).wOut, scr(h).warn.slice(0, 50));
  gen(h, "critical", "disease", "outpatient");
  check("일반 통원 복귀: 다시 차단", !scr(h).calc && scr(h).wOut && shownById(h, OUT_ID) === "abc");
}
{
  // 별도 보장종목은 지급보험금만 쓴다.
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "0"); typeById(h, ANNUAL_ID, "1e3"); typeById(h, OUT_ID, "1,0");
  check("일반: 두 가입금액 무효로 차단", !scr(h).calc);
  item(h, "mri", "critical");
  check("특약으로 이동 → 계산됨(가입금액을 읽지 않는다)", scr(h).calc && !scr(h).wAnnual && !scr(h).wOut, scr(h).warn.slice(0, 50));
  check("특약에는 가입금액 칸이 없다", widget(h, ANNUAL_ID) === null && widget(h, OUT_ID) === null);
  gen(h, "critical", "disease", "outpatient");
  check("일반 복귀: 원문·안내 복원", shownById(h, ANNUAL_ID) === "1e3" && shownById(h, OUT_ID) === "1,0" && !scr(h).calc);
}
{
  // 급여는 세 금액을 하나도 쓰지 않는다.
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "abc"); typeById(h, ANNUAL_ID, "abc");
  check("비급여: 차단", !scr(h).calc);
  pick(h, COV, "benefit"); pick(h, VIS, "inpatient");
  h.set("amounts", ["1000000"]);
  const benefitPay = scr(h).pay;
  check("급여: 계산되고 세 안내가 없다", scr(h).calc && !scr(h).wPrior && !scr(h).wAnnual && !scr(h).wOut, scr(h).warn.slice(0, 50));
  const f = setup(); pick(f, COV, "benefit"); pick(f, VIS, "inpatient"); f.set("amounts", ["1000000"]);
  check("급여: 숨은 무효값이 결과를 바꾸지 않는다", benefitPay === scr(f).pay, `${benefitPay} vs ${scr(f).pay}`);
  pick(h, COV, "non_benefit");
  check("비급여 복귀: 원문·차단 복원", shownById(h, PRIOR_ID) === "abc" && !scr(h).calc);
}
{
  // 다른 보장축의 무효값은 현재 축을 막지 않는다.
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "abc");
  check("질병 축: 차단", !scr(h).calc);
  gen(h, "critical", "injury", "outpatient");
  check("상해 축: 계산됨(숨은 축이 막지 않는다)", scr(h).calc, scr(h).warn.slice(0, 50));
  gen(h, "critical", "disease", "outpatient");
  check("질병 축 복귀: 원문·안내 복원", shownById(h, PRIOR_ID) === "abc" && !scr(h).calc && scr(h).wPrior);
}
{
  // 미선택 상태에서는 어떤 축도 대신 정하지 않는다.
  const h = setup();
  pick(h, COV, "non_benefit"); pick(h, ITEM, "general"); pick(h, SEV, "critical");
  check("원인 미선택: 세 입력이 없고 세 안내도 없다",
    widget(h, PRIOR_ID) === null && widget(h, ANNUAL_ID) === null && widget(h, OUT_ID) === null
    && !scr(h).wPrior && !scr(h).wAnnual && !scr(h).wOut);
  pick(h, ITEM, "injection"); pick(h, SEV, "critical");
  check("약제 용도 미선택: 세 입력이 없다", widget(h, PRIOR_ID) === null && widget(h, ANNUAL_ID) === null);
}
{
  // 정상 공유는 그대로 — 일반 직접 ↔ 일반 전환 ↔ 상급병실료.
  const h = gen(setup(), "non_critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "1,0");
  check("일반 직접: 차단", !scr(h).calc && scr(h).wPrior);
  route(h, "injection", "non_critical", "disease");
  check("일반 전환도 같은 무효값으로 차단(같은 축 공유)", !scr(h).calc && scr(h).wPrior, scr(h).warn.slice(0, 40));
  room(h, "non_critical", "disease");
  check("상급병실료도 같은 무효값으로 차단(같은 축 공유)", !scr(h).calc && scr(h).wPrior);
  typeById(h, PRIOR_ID, "2000000");
  gen(h, "non_critical", "disease", "outpatient");
  check("상급병실료에서 고치면 일반도 재개", scr(h).calc && shownById(h, PRIOR_ID) === "2000000");
}
{
  // 무효일 때 다른 결과 분기로 우회하지 않는다 — 실제 결과로 확인한다.
  const paths: [string, (h: H) => H][] = [
    ["일반 직접", (h) => gen(h, "critical", "disease", "outpatient")],
    ["일반 전환", (h) => route(h, "injection", "non_critical", "disease")],
    ["특약 MRI", (h) => item(h, "mri", "critical")],
    ["상급병실료", (h) => room(h, "critical", "disease")],
  ];
  const bad: string[] = [];
  for (const [name, go] of paths) {
    const h = go(setup());
    typeById(h, PRIOR_ID, "abc");
    const s = scr(h);
    if (s.calc || s.pay !== null) bad.push(`${name}: ${s.pay}`);
    // 후보 금액·행별 표도 남지 않아야 한다.
    if (h.render().nodes.some((n) => n.tag === "td")) bad.push(`${name}: 행별 표 남음`);
  }
  check("네 경로 모두 무효 시 결과·후보 금액이 남지 않는다(우회 없음)", bad.length === 0, bad.join(" | "));
}

// ── 소스 계약 ────────────────────────────────────────────────────────
console.log("\n[소스] 파서·게이트·전달 형태");
{
  const code = stripComments(ui);
  check("금액 파서가 따로 선언된다(진료비·상급병실료 파서는 그대로)",
    /const GEN2026_MONEY_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\//.test(code)
    && /const gen2026Money = \(v: string\): number \| null =>/.test(code)
    && /const GEN2026_AMOUNT_FORMAT =/.test(code)
    && /const roomChargeAmount = \(v: string\): number \| null =>/.test(code));
  check("형식 검증 뒤에만 쉼표를 지운다",
    /if \(!GEN2026_MONEY_FORMAT\.test\(v\)\) return null;\s*\n\s*const n = Number\(v\.replace\(\/,\/g, ""\)\);/.test(code));
  check("안전 정수·음수 검사가 있고 자릿수 제한은 없다",
    /return Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(code)
    && !/MAX_AMOUNT_DIGITS/.test(code) && !/\.slice\(0, 1[0-9]\)/.test(code));
  // ⚠ 금액 파서만 본다. 상급병실료 입원일수 `positiveDays`의 `trim()`은 종전 그대로다.
  const moneyParser = (code.match(/const gen2026Money = [\s\S]*?\n\};/) ?? [""])[0];
  check("금액 파서가 trim으로 정리해 통과시키지 않는다",
    moneyParser !== "" && !/trim\(\)/.test(moneyParser));
  check("상급병실료 일수 파서의 trim은 그대로다(범위 밖)",
    /const positiveDays = \(v: string\): number \| null => \{\s*\n\s*const t = v\.trim\(\);/.test(code));
  check("빈 값의 뜻이 필드마다 다르게 적혀 있다",
    /const priorInsuranceNum = priorInsurance === "" \? 0 : gen2026Money\(priorInsurance\);/.test(code)
    && /const annualLimitNum = !usesAnnualLimit \|\| annualLimit === "" \? undefined : gen2026Money\(annualLimit\);/.test(code)
    && /\? undefined : gen2026Money\(outpatientLimit\);/.test(code));
  check("경로가 쓰는 금액만 검증한다",
    /const usesAnnualLimit = \(showGeneralForm \|\| showRoomChargeForm\) && generalAxis !== null;/.test(code)
    && /const usesOutpatientLimit = showGeneralForm && generalAxis !== null && visit === "outpatient";/.test(code));
  check("null을 배제해야 엔진 인자가 만들어진다(타입 단언 없음)",
    /const money = priorInsuranceNum === null \|\| annualLimitNum === null \|\| outpatientLimitNum === null/.test(code)
    && !/priorInsuranceNum as number/.test(code) && !/annualLimitNum as number/.test(code));
  check("무효값을 0·undefined로 대체하는 경로가 없다",
    !/gen2026Money\([^)]*\) \?\? 0/.test(code) && !/gen2026Money\([^)]*\) \?\? undefined/.test(code));
  // ⚠ **낡은 계약을 교체했다.** G-10 항목 A가 공제금액 두 입력의 게이트(`deductibles`)를
  //   같은 두 분기에 함께 걸었다. 상급병실료 분기는 그대로다 — 그 경로는 두 축을 쓰지 않고
  //   `roomCharge2026`의 `UNUSED_KEYS`가 오히려 전달을 거부하기 때문이다.
  check("세 결과 분기에 게이트가 걸린다",
    /if \(money !== null && deductibles !== null\s*\n?\s*&& coverage === "non_benefit" && specialItem !== null/.test(code)
    && /if \(money !== null && showRoomChargeForm && !rcIncomplete\)/.test(code)
    && /: money !== null && deductibles !== null && nonBenefitItem === "general"/.test(code));
  check("급여 분기에는 게이트를 걸지 않는다",
    /\? calculateMany2026\(\{\s*\n\s*cause: benefitCause, coverage: "benefit"/.test(code));
  check("엔진 전달 형태",
    (code.match(/priorAnnualInsurancePaid: money\.prior,/g) ?? []).length === 7
    && (code.match(/annualCoverageLimit: money\.annual,/g) ?? []).length === 3
    && (code.match(/outpatientCoverageLimit: money\.out,/g) ?? []).length === 2);
  check("세 축은 더 이상 num()을 쓰지 않는다",
    !/num\(priorInsurance\)/.test(code) && !/num\(annualLimit\)/.test(code) && !/num\(outpatientLimit\)/.test(code));
  // ── 공제금액 두 입력 (G-10 항목 A로 같은 파서에 합류) ──
  // ⚠ **낡은 계약을 교체했다.** 종전 두 검사는 "여전히 num()"·"맨 <input> 그대로"를
  //   고정하고 있었다. 항목 A가 둘 다 바꿨으므로 사실과 다르다. 여기서는 **같은 파서를
  //   공유한다는 사실과 초기값 계약**만 확인하고, 형식·경계·차단은
  //   `gen2026DeductibleInput.test.ts`가 본다.
  check("공제금액 두 입력도 gen2026Money를 쓴다",
    /priorDeductible === "" \? 0 : gen2026Money\(priorDeductible\)/.test(code)
    && /priorPool === "" \? 0 : gen2026Money\(priorPool\)/.test(code)
    && !/num\(priorDeductible\)/.test(code) && !/num\(priorPool\)/.test(code));
  check("초기값 \"0\" 계약은 그대로다",
    /const \[priorDeductible, setPriorDeductible\] = useState\("0"\);/.test(code)
    && /const \[priorPool, setPriorPool\] = useState\("0"\);/.test(code));
  check("공제금액 두 칸도 RawAmountInput이다",
    /<RawAmountInput id="gen2026-prior-deductible" value=\{priorDeductible\}/.test(code)
    && /<RawAmountInput id="gen2026-prior-pool" value=\{priorPool\}/.test(code)
    && !/value=\{priorDeductible\} onChange=\{\(e\) => setPriorDeductible\(e\.target\.value\)\}/.test(code)
    && !/value=\{priorPool\} onChange=\{\(e\) => setPriorPool\(e\.target\.value\)\}/.test(code));
  // ⚠ 계약 교체(G-13A·B·C): `num(priorCount)`·`num(copyCount)`·`num(nhisRate)`가 차례로
  //   전용 파서로 바뀌면서 공용 `num()`은 마지막 사용처가 사라져 삭제됐다.
  // ⚠ `num(` 검사는 주석을 제외하고 본다 — 주석이 "공용 num()을 쓰면 안 된다"는 근거로
  //   그 이름을 언급한다.
  const noComments = code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  check("공용 num()은 완전히 사라졌고 각 축이 전용 파서를 쓴다",
    !/const num = \(v: string\) =>/.test(noComments) && !/\bnum\(/.test(noComments)
    && /const gen2026MultiNhisRate = \(v: string\): number \| null =>/.test(code)
    && /const gen2026CopyCount = \(v: string\): number \| null =>/.test(code)
    && /const coveredCount = nonNegSafeInt;/.test(code));
  check("공용 위젯 파일은 그대로다",
    !/trim\(|replace\(/.test(stripComments(readFileSync("src/components/RawAmountInput.tsx", "utf8")))
    && /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(readFileSync("src/components/AmountInput.tsx", "utf8")));
  check("G-8의 축 키·정상 공유는 그대로다",
    /const paidAxis: Gen2026PaidAxis \| null = showSpecialForm \? itemAxis/.test(code)
    && /general_non_critical_injury: "비중증 상해비급여",/.test(code));
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("엔진은 그대로다",
    /let insurancePaid = nonNegInt\(input\.priorAnnualInsurancePaid\);/.test(eng)
    && /let deductiblePaid = nonNegInt\(nb\?\.priorAnnualDeductible\);/.test(eng));
  check("다른 세대 파서를 재사용하지 않는다",
    !/gen2021Money/.test(code) && !/stdMoney/.test(code));
}

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] 공제금액·진료비·횟수·승인·복제·HOLD 그대로");
{
  // ⚠ **낡은 계약을 교체했다.** 종전에는 공제금액 무효값이 통과했다(`num("abc") = 0`).
  //   G-10 항목 A가 같은 파서로 옮겨 차단한다. 세부 형식·경계는
  //   `gen2026DeductibleInput.test.ts`가 보고, 여기서는 세 금액과의 **공존**만 본다.
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  h.set("amounts", ["10000000"]);
  typeById(h, PRIOR_ID, "0");
  typeById(h, DEDUCT_ID, "4000000");
  const withDeduct = scr(h).own;
  check("일반 입원 공제금액 400만 반영", scr(h).calc && withDeduct !== null);
  typeById(h, DEDUCT_ID, "abc");
  check("공제금액 무효는 이제 차단된다", !scr(h).calc);
  typeById(h, PRIOR_ID, "abc");
  check("  지급보험금까지 무효면 두 안내가 각각 뜬다",
    scr(h).warn.includes("기존 지급보험금") && scr(h).warn.includes("이미 누적된 공제금액"));
  typeById(h, PRIOR_ID, "0"); typeById(h, DEDUCT_ID, "4000000");
  check("고치면 종전 계산으로 복귀", scr(h).calc && scr(h).own === withDeduct);
}
{
  const h = gen(setup(), "critical", "disease", "outpatient");
  typeById(h, PRIOR_ID, "0");
  check("중증 통원 기본 계산", scr(h).pay === "4,200,000원", String(scr(h).pay));
  h.set("amounts", ["3000000", "abc"]);
  check("진료비 무효는 여전히 차단", !scr(h).calc && scr(h).warn.includes("진료비"));
  h.set("amounts", ["3000000", "3000000"]);
  h.set("priorVisits", "");
  check("중증 통원 횟수 미입력 차단 유지", !scr(h).calc);
  h.set("priorVisits", "0");
  check("복구 후 재개", scr(h).calc);
  const m = item(setup(), "musculoskeletal_esw", "critical");
  typeById(m, PRIOR_ID, "0");
  check("중증 근골격계 계산 유지", scr(m).calc, scr(m).warn.slice(0, 40));
  m.set("priorActs", "");
  check("치료행위 수 미입력 차단 유지", !scr(m).calc);
  const r = room(setup(), "critical", "disease");
  typeById(r, PRIOR_ID, "0");
  check("상급병실료 계산 유지", scr(r).calc, scr(r).warn.slice(0, 40));
  r.set("rcRows", [{ amount: "600000", days: "0" }]);
  check("상급병실료 일수 게이트 유지", !scr(r).calc && scr(r).warn.includes("총 입원일수"));
  check("진료비 파서 그대로 · 복제는 전용 파서(G-13B)",
    /const gen2026Amount = \(v: string\): number \| null =>/.test(ui)
    && /Array\.from\(\{ length: copyCountNum \}/.test(ui));
  check("승인 회차 기본값 그대로", /GEN2026_MSK_APPROVED_THROUGH_VALUES\[0\]/.test(ui));
}

console.log(`\n[5세대 금액 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
