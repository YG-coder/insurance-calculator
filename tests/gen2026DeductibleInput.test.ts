// G-10 항목 A — 5세대 다회의 **누적 공제금액 두 입력**을 엄격하게 검증한다.
//   ① `priorDeductible` — 일반 (1)(2) 중증 입원 상급종합·종합병원의 누적 공제금액
//   ② `priorPool`      — 중증 비급여 MRI·MRA의 누적 공제금액(500만 원 상한 pool)
//
// 종전 동작(기준선 `git archive a215123`을 실제로 실행해 확인): 둘 다 맨 `<input>` +
//   공용 `num()`. `num()`은 `/[^0-9.]/`를 지우므로 **점을 남긴다**.
//     `-1`·`+1`→1, **`1.5`→1.5(소수가 그대로 전달)**, `1e3`→13, `1,0`→10,
//     `abc`·`1.2.3`·공백만→0, `9007199254740993`→`…992`.
//   ⚠ 맨 `<input>`이라 절단은 없었다 — `1000000000000000`은 종전에도 그대로 전달됐다.
//   ⚠ 잘못된 입력의 방향은 비교 대상인 실제 이력·계약값을 알 때만 말할 수 있다. 여기서는
//     **원문이 다른 숫자로 바뀌거나 0으로 지워졌다**는 사실과 계산 결과만 기록한다.
//     (다만 두 필드는 값이 커질수록 남은 공제 여지가 줄어 공제가 작아진다.)
//
// 이번 계약
//   - 파서는 G-9의 `gen2026Money`를 **그대로 재사용**한다. 형식을 먼저 보고, 통과한 뒤에만
//     쉼표를 지운다. 정제·절단·`trim()`으로 무효값을 유효값으로 바꾸지 않는다.
//   - 초기값 `"0"`과 **빈 문자열 → 0**은 기존 계약을 그대로 유지한 것이다.
//     빈 값을 0으로 보는 것이 안전하다고 확정한 것이 아니다.
//   - 500만 원을 넘는 **유효한** 값도 파서가 자르거나 거부하지 않는다. 상한 처리는 엔진에 있다.
//   - **활성 경로가 실제로 쓰는 입력만** 검증한다. 숨은 입력은 검증도 전달도 하지 않고
//     원문 상태만 보존하며, 조건이 돌아오면 무효값 안내도 다시 나타난다.
//
// 검사의 역할 분담(항목 B와 같다)
//   - 노출·숨김·복원은 화면을 직접 본다(라벨 유무, 위젯의 `value` 원문).
//   - **미전달·전달 형태는 소스 검사**로 확인한다. 결과가 같다는 사실만으로는 증명되지 않는다.
//   - 계산 결과 비교는 **무회귀**와 **차단**을 확인하는 역할이다.
//   - 값 입력은 전부 실제 위젯 `onChange`를 거친다. 선택창·행 조작도 실제 핸들러만 쓴다.
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
const code = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(code);

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
/** id로 위젯을 찾아 **공용 위젯을 실제로 호출해** 그 안의 `<input>`까지 내려간다. */
const widget = (h: H, id: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === id);
  if (n === undefined) return null;
  if (n.tag === "#RawAmountInput") return findIn((RawAmountInput as unknown as (p: never) => unknown)(n.props as never), "input");
  return n.tag === "input" ? { props: n.props } : null;
};
const has = (h: H, id: string) => widget(h, id) !== null;
const typeById = (h: H, id: string, v: string) => {
  const w = widget(h, id); if (w === null) throw new Error("입력을 찾지 못했습니다: " + id);
  (w.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shown = (h: H, id: string) => { const w = widget(h, id); return w === null ? null : String(w.props.value); };
const labelOf = (h: H, p: string) => h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(p));
const pick = (h: H, p: string, v: string) => {
  const l = labelOf(h, p); const s = l === undefined ? null : findIn(l.props.children, "select");
  if (s === null) throw new Error("선택창을 찾지 못했습니다: " + p);
  if (s.props.disabled === true) throw new Error("선택창이 비활성입니다: " + p);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const rowLabels = (h: H, prefix: string) =>
  h.render().nodes.filter((n: RenderedNode) => n.tag === "label" && n.text.startsWith(prefix));
const setRow = (h: H, prefix: string, i: number, v: string) => {
  const ls = rowLabels(h, prefix); const s = ls[i] === undefined ? null : findIn(ls[i].props.children, "select");
  if (s === null) throw new Error(`${i + 1}번째 행 ${prefix} 선택창이 없습니다`);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const addRow = (h: H) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "button" && x.text.includes("행 추가"));
  if (n === undefined) throw new Error("행 추가 버튼이 없습니다");
  (n.props.onClick as () => void)();
};
const delRow = (h: H, i: number) => {
  const bs = h.render().nodes.filter((x: RenderedNode) => x.tag === "button" && x.text.includes("삭제"));
  if (bs[i] === undefined || bs[i].props.disabled === true) throw new Error("삭제할 수 없습니다");
  (bs[i].props.onClick as () => void)();
};
const rowCount = (h: H) => h.render().nodes.filter((n: RenderedNode) => String(n.props.id).startsWith("gen2026-row-amount-")).length;
const rowAmt = (h: H, i: number, v: string) => typeById(h, `gen2026-row-amount-${i}`, v);

const scr = (h: H) => {
  const r = h.render(); const it = r.resultItems();
  const boxes = r.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning").map((n) => String(n.text));
  return {
    calc: it !== null,
    pay: it === null ? null : (it[2]?.value ?? null),
    own: it === null ? null : (it[1]?.value ?? null),
    /** 행별 결과표의 칸. 결과 카드가 사라지면 이것도 함께 사라져야 한다. */
    tds: r.nodes.filter((n) => n.tag === "td").length,
    warn: boxes.join(" || "),
    /** 필드 이름과 "올바르게 입력해 주세요"를 **같은 상자 안에서** 함께 본다. */
    invalidBox: (field: string) => boxes.some((t) => t.includes(field) && t.includes("올바르게 입력해 주세요")),
  };
};

const DEDUCT_ID = "gen2026-prior-deductible", POOL_ID = "gen2026-prior-pool";
const PRIOR_ID = "gen2026-prior-insurance";
const COV = "급여 구분", ITEM = "치료유형", SEV = "질환 구분";
const VIS = "치료 형태", TIER = "입원 의료기관", CAUSE = "원인";
const DEDUCT_MSG = "이미 누적된 공제금액";

/** 일반 (1)(2) 경로 — 전부 실제 선택창을 거친다. 급여를 지나 초기화한다. */
const gen = (h: H, sev: string, cause: string, visit: string, tier?: string) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "general"); pick(h, SEV, sev); pick(h, CAUSE, cause); pick(h, VIS, visit);
  if (tier !== undefined) pick(h, TIER, tier);
  h.set("priorVisits", "0"); h.set("priorOutDays", "0"); h.set("amounts", ["10000000"]);
  typeById(h, PRIOR_ID, "0");
  return h;
};
/** 중증 MRI 특약 경로 — 행 구성을 실제 핸들러로 만든다. spec: [visit, tier][] */
const mri = (h: H, spec: [string, string][]) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "mri"); pick(h, SEV, "critical");
  while (rowCount(h) > spec.length) delRow(h, 1);
  while (rowCount(h) < spec.length) addRow(h);
  spec.forEach(([visit, tier], i) => {
    rowAmt(h, i, "2000000");
    if (visit !== "") setRow(h, "치료 형태", i, visit);
    if (visit === "inpatient" && tier !== "") {
      const idx = spec.slice(0, i + 1).filter(([v]) => v === "inpatient").length - 1;
      setRow(h, "의료기관", idx, tier);
    }
  });
  typeById(h, PRIOR_ID, "0");   // 특약 화면의 기존 지급보험금(같은 id를 쓴다)
  return h;
};

const VALID: [string, string][] = [
  ["명시적 0", "0"], ["0 반복", "00"], ["정수", "300000"], ["천 단위 쉼표", "300,000"],
  ["500만 초과 유효값", "9000000"],
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
console.log("\n[파서] 두 입력 모두 유효값은 계산되고 무효값은 차단된다");
{
  const CASES: [string, () => H, string][] = [
    ["일반 중증 입원 상급종합·종합병원", () => gen(setup(), "critical", "disease", "inpatient", "hospital"), DEDUCT_ID],
    ["중증 MRI 입원 상급종합·종합병원", () => mri(setup(), [["inpatient", "hospital"]]), POOL_ID],
  ];
  for (const [name, make, id] of CASES) {
    let okValid = 0, okInvalid = 0, okRaw = 0;
    for (const [, v] of VALID) {
      const h = make(); typeById(h, id, v);
      if (scr(h).calc && !scr(h).invalidBox(DEDUCT_MSG)) okValid++;
      if (shown(h, id) === v) okRaw++;
    }
    for (const [, v] of INVALID) {
      const h = make(); typeById(h, id, v);
      const s = scr(h);
      // 계산 차단 + 안내 + **원문 보존**(정제·절단하지 않는다)
      if (!s.calc && s.tds === 0 && s.invalidBox(DEDUCT_MSG) && shown(h, id) === v) okInvalid++;
    }
    check(`${name}: 유효 ${VALID.length}종 계산 · 무효 ${INVALID.length}종 차단 · 원문 보존`,
      okValid === VALID.length && okInvalid === INVALID.length && okRaw === VALID.length,
      `유효 ${okValid}/${VALID.length} · 무효 ${okInvalid}/${INVALID.length} · 원문 ${okRaw}/${VALID.length}`);
  }
}

// ── 빈 값·명시적 0 (기존 계약 유지) ──────────────────────────────────
console.log("\n[기존 계약] 초기값 \"0\"과 빈 값 → 0");
{
  check("초기값이 \"0\"이다", shown(gen(setup(), "critical", "disease", "inpatient", "hospital"), DEDUCT_ID) === "0");
  const zero = gen(setup(), "critical", "disease", "inpatient", "hospital");
  const withZero = scr(zero).own;
  const empty = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(empty, DEDUCT_ID, "");
  check("빈 값은 명시적 0과 같은 계산", scr(empty).calc && scr(empty).own === withZero,
    `${withZero} vs ${scr(empty).own}`);
  check("  빈 값에는 무효 안내가 뜨지 않는다", !scr(empty).invalidBox(DEDUCT_MSG));
  check("  빈 원문은 그대로 남는다(0으로 되쓰지 않는다)", shown(empty, DEDUCT_ID) === "");
  const p0 = mri(setup(), [["inpatient", "hospital"]]);
  const pZero = scr(p0).pay;
  const pEmpty = mri(setup(), [["inpatient", "hospital"]]); typeById(pEmpty, POOL_ID, "");
  check("pool도 빈 값 = 명시적 0", scr(pEmpty).calc && scr(pEmpty).pay === pZero, `${pZero} vs ${scr(pEmpty).pay}`);
}

// ── 한도에 가려지지 않는 계산 영향 ───────────────────────────────────
console.log("\n[계산 영향] 한도가 가리지 않는 사례로 확인한다");
{
  // 일반 중증 입원 상급종합·종합병원, 진료비 1,000만 원. 연간 가입금액은 비워 두어
  //   한도가 개입하지 않는다. 공제 30% = 300만 원, 상한 500만 원.
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(h, DEDUCT_ID, "0");
  check("공제 0: 본인부담 300만 원(30%)", scr(h).own === "3,000,000원", String(scr(h).own));
  typeById(h, DEDUCT_ID, "4,000,000");
  check("공제 400만 누적: 남은 여지 100만 원까지만 공제", scr(h).own === "1,000,000원", String(scr(h).own));
  typeById(h, DEDUCT_ID, "5000000");
  check("상한 소진: 공제 0원", scr(h).own === "0원", String(scr(h).own));
  typeById(h, DEDUCT_ID, "9000000");
  check("500만 초과 유효값도 그대로 받는다(엔진이 상한 처리)", scr(h).calc && scr(h).own === "0원", String(scr(h).own));

  // 중증 MRI 1행 200만 원. 연간 보장한도 300만 원에 걸리지 않는 범위다.
  const m = mri(setup(), [["inpatient", "hospital"]]);
  typeById(m, POOL_ID, "0");
  check("pool 0: 공제 60만 → 140만 원", scr(m).pay === "1,400,000원", String(scr(m).pay));
  typeById(m, POOL_ID, "4,900,000");
  check("pool 490만: 남은 여지 10만 → 190만 원", scr(m).pay === "1,900,000원", String(scr(m).pay));
  typeById(m, POOL_ID, "5000000");
  check("pool 소진: 공제 0 → 200만 원", scr(m).pay === "2,000,000원", String(scr(m).pay));
}

// ── 활성 조건 — 경로가 실제로 쓰는 입력만 ────────────────────────────
console.log("\n[활성 조건] 노출·검증·전달이 소비 조건과 같다");
{
  check("일반 중증 입원 상급종합·종합병원: 칸이 보인다", has(gen(setup(), "critical", "disease", "inpatient", "hospital"), DEDUCT_ID));
  check("  병·의원급: 칸이 없다", !has(gen(setup(), "critical", "disease", "inpatient", "clinic"), DEDUCT_ID));
  check("  중증 통원: 칸이 없다", !has(gen(setup(), "critical", "disease", "outpatient"), DEDUCT_ID));
  check("  비중증 입원 상급종합·종합병원: 칸이 없다", !has(gen(setup(), "non_critical", "disease", "inpatient", "hospital"), DEDUCT_ID));
  const b = gen(setup(), "critical", "disease", "inpatient", "hospital");
  pick(b, COV, "benefit");
  check("  급여: 칸이 없다", !has(b, DEDUCT_ID));
  const rc = setup();
  pick(rc, COV, "benefit"); pick(rc, COV, "non_benefit");
  pick(rc, ITEM, "room_charge"); pick(rc, SEV, "critical"); pick(rc, CAUSE, "disease");
  check("  상급병실료: 칸이 없다(엔진이 이 축을 거부한다)", !has(rc, DEDUCT_ID));
  check("중증 MRI 대상 행: pool 칸이 보인다", has(mri(setup(), [["inpatient", "hospital"]]), POOL_ID));
  check("  통원만: pool 칸이 없다", !has(mri(setup(), [["outpatient", ""]]), POOL_ID));
  check("  입원 병·의원급: pool 칸이 없다", !has(mri(setup(), [["inpatient", "clinic"]]), POOL_ID));
  check("두 칸이 같은 화면에 함께 뜨지 않는다",
    !has(gen(setup(), "critical", "disease", "inpatient", "hospital"), POOL_ID)
    && !has(mri(setup(), [["inpatient", "hospital"]]), DEDUCT_ID));
}

// ── 숨은 값 격리 ─────────────────────────────────────────────────────
console.log("\n[숨은 값] 검증도 전달도 하지 않고 원문만 보존한다");
{
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(h, DEDUCT_ID, "abc");
  check("무효값: 차단되고 안내가 뜬다", !scr(h).calc && scr(h).invalidBox(DEDUCT_MSG));
  pick(h, TIER, "clinic");
  check("병·의원급으로 바꾸면: 칸이 사라지고", !has(h, DEDUCT_ID));
  check("  안내도 사라지고 계산이 재개된다", scr(h).calc && !scr(h).invalidBox(DEDUCT_MSG));
  const clean = gen(setup(), "critical", "disease", "inpatient", "clinic");
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(h).own === scr(clean).own, `${scr(h).own} vs ${scr(clean).own}`);
  pick(h, TIER, "hospital");
  check("되돌리면: 원문과 무효 안내가 함께 돌아온다",
    shown(h, DEDUCT_ID) === "abc" && !scr(h).calc && scr(h).invalidBox(DEDUCT_MSG));
  // 진료비 1,000만 원 · 공제 30% = 300만 원. 누적 400만 원이면 남은 여지는 100만 원이다.
  typeById(h, DEDUCT_ID, "4,000,000");
  check("고치면 계산 재개", scr(h).calc && scr(h).own === "1,000,000원", String(scr(h).own));
}
{
  const m = mri(setup(), [["inpatient", "hospital"]]);
  typeById(m, POOL_ID, "1.5");
  check("pool 무효값: 차단되고 안내가 뜬다", !scr(m).calc && scr(m).invalidBox(DEDUCT_MSG));
  setRow(m, "치료 형태", 0, "outpatient");
  check("통원으로 바꾸면: 칸·안내가 사라지고 계산 재개", !has(m, POOL_ID) && scr(m).calc && !scr(m).invalidBox(DEDUCT_MSG));
  const onlyOut = mri(setup(), [["outpatient", ""]]);
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(m).pay === scr(onlyOut).pay, `${scr(m).pay} vs ${scr(onlyOut).pay}`);
  setRow(m, "치료 형태", 0, "inpatient"); setRow(m, "의료기관", 0, "hospital");
  check("되돌리면: 원문과 무효 안내가 함께 돌아온다",
    shown(m, POOL_ID) === "1.5" && !scr(m).calc && scr(m).invalidBox(DEDUCT_MSG));
}
{
  // 일반 경로에 무효값을 남긴 채 특약 경로로 이동해도 서로 간섭하지 않는다.
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(h, DEDUCT_ID, "-1");
  check("일반 무효값을 남긴 뒤", !scr(h).calc);
  pick(h, ITEM, "mri");
  const spec: [string, string][] = [["inpatient", "hospital"]];
  while (rowCount(h) > spec.length) delRow(h, 1);
  rowAmt(h, 0, "2000000"); setRow(h, "치료 형태", 0, "inpatient"); setRow(h, "의료기관", 0, "hospital");
  typeById(h, PRIOR_ID, "0");
  check("중증 MRI로 이동하면 계산된다(일반 무효값은 숨은 값)", scr(h).calc, scr(h).warn.slice(0, 50));
  check("  일반 무효값은 상태에 남아 있다", has(h, POOL_ID) && !has(h, DEDUCT_ID));
  pick(h, ITEM, "general"); pick(h, CAUSE, "disease"); pick(h, VIS, "inpatient"); pick(h, TIER, "hospital");
  check("  일반으로 돌아오면 무효 안내가 다시 나타난다", shown(h, DEDUCT_ID) === "-1" && !scr(h).calc);
}

// ── 동시 무효 ────────────────────────────────────────────────────────
console.log("\n[동시 무효] 필요한 안내를 각각 표시한다");
{
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(h, PRIOR_ID, "abc"); typeById(h, DEDUCT_ID, "1e3");
  const s = scr(h);
  check("지급보험금 + 공제금액", !s.calc && s.invalidBox("기존 지급보험금") && s.invalidBox(DEDUCT_MSG));
  typeById(h, "gen2026-annual-limit", "1,0");
  check("  연간 가입금액까지 세 안내", scr(h).invalidBox("연간 보험가입금액") && scr(h).invalidBox(DEDUCT_MSG));
  h.set("amounts", ["10000000", "abc"]);
  check("  진료비 안내와도 함께 뜬다", scr(h).warn.includes("진료비") && scr(h).invalidBox(DEDUCT_MSG));
  h.set("amounts", ["10000000"]);
  typeById(h, PRIOR_ID, "0"); typeById(h, "gen2026-annual-limit", ""); typeById(h, DEDUCT_ID, "0");
  check("모두 고치면 재개", scr(h).calc);
}
{
  // 미선택 게이트와 공제금액 무효가 함께 있을 때 — 둘 다 안내한다.
  const m = mri(setup(), [["inpatient", "hospital"], ["outpatient", ""]]);
  typeById(m, POOL_ID, "abc");
  setRow(m, "치료 형태", 1, "");
  check("치료 형태 미선택 + pool 무효", !scr(m).calc
    && scr(m).warn.includes("치료 형태") && scr(m).invalidBox(DEDUCT_MSG));
  check("  pool 칸은 여전히 보인다(대상 행이 하나 있으므로)", has(m, POOL_ID));
  setRow(m, "치료 형태", 1, "outpatient"); typeById(m, POOL_ID, "0");
  check("  둘 다 고치면 재개", scr(m).calc);
}

// ── 결과 숨김 범위 ───────────────────────────────────────────────────
console.log("\n[차단 범위] 결과 카드·행별 결과표가 모두 사라진다");
{
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  const okTds = scr(h).tds;
  check("정상일 때 행별 결과표가 있다", okTds > 0 && scr(h).calc);
  typeById(h, DEDUCT_ID, "abc");
  check("무효일 때 결과 카드·행별 결과표가 모두 없다", !scr(h).calc && scr(h).tds === 0);
  const m = mri(setup(), [["inpatient", "hospital"]]);
  const mTds = scr(m).tds;
  typeById(m, POOL_ID, "abc");
  check("특약 경로도 같다", mTds > 0 && !scr(m).calc && scr(m).tds === 0);
}
{
  // 다른 결과 분기로 우회하지 않는다 — `result = itemResult ?? roomResult ?? plainResult`.
  const h = gen(setup(), "critical", "disease", "inpatient", "hospital");
  typeById(h, DEDUCT_ID, "abc");
  check("일반 무효가 상급병실료 분기로 새지 않는다", !scr(h).calc);
  const r = setup();
  pick(r, COV, "benefit"); pick(r, COV, "non_benefit");
  pick(r, ITEM, "room_charge"); pick(r, SEV, "critical"); pick(r, CAUSE, "disease");
  r.set("rcRows", [{ amount: "600000", days: "3" }]); typeById(r, PRIOR_ID, "0");
  check("상급병실료는 이 축을 쓰지 않으므로 영향이 없다", scr(r).calc && !has(r, DEDUCT_ID));
}

// ── 소스 — 전달 형태와 금지 사항 ─────────────────────────────────────
console.log("\n[소스] 형식 우선 검증 · 전달 조건 · 타입 단언 없음");
{
  check("파서는 G-9의 gen2026Money를 재사용한다",
    /const priorDeductibleNum = !usesPriorDeductible \? undefined\s*\n\s*: priorDeductible === "" \? 0 : gen2026Money\(priorDeductible\);/.test(code)
    && /const priorPoolNum = !usesPriorPool \? undefined\s*\n\s*: priorPool === "" \? 0 : gen2026Money\(priorPool\);/.test(code));
  check("전용 파서를 새로 만들지 않았다",
    !/gen2026Deductible\s*=/.test(code) && !/GEN2026_DEDUCTIBLE_FORMAT/.test(code));
  check("형식을 먼저 보고 그 뒤에 쉼표를 지운다(G-9 파서 그대로)",
    /if \(!GEN2026_MONEY_FORMAT\.test\(v\)\) return null;\s*\n\s*const n = Number\(v\.replace\(\/,\/g, ""\)\);/.test(code));
  check("쉼표를 선제거하지 않는다",
    !/priorDeductible\.replace\(/.test(code) && !/priorPool\.replace\(/.test(code));
  check("trim()으로 통과시키지 않는다",
    !/priorDeductible\.trim\(\)/.test(code) && !/priorPool\.trim\(\)/.test(code));
  check("자릿수를 제한하지 않는다",
    !/priorDeductible\.slice\(/.test(code) && !/priorPool\.slice\(/.test(code)
    && !/priorDeductible\.length >/.test(code) && !/priorPool\.length >/.test(code));
  check("안전 정수 검사가 살아 있다", /Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(code));
  check("500만 원 상한을 파서에서 다루지 않는다",
    !/priorDeductibleNum[\s\S]{0,80}5000000/.test(code) && !/priorPoolNum[\s\S]{0,80}5000000/.test(code)
    && !/Math\.min\(5000000/.test(code));
  check("활성 조건이 엔진 소비 조건과 같다",
    /const usesPriorDeductible = showGeneralForm && generalAxis !== null\s*\n\s*&& severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";/.test(code)
    && /const usesPriorPool = showSpecialForm && severity === "critical" && specialItem === "mri"\s*\n\s*&& rows\.some\(\(r\) => r\.visit === "inpatient" && r\.tier === "hospital"\);/.test(code));
  check("노출도 같은 조건을 쓴다",
    /\{usesPriorDeductible && <label/.test(code) && /\{usesPriorPool && <label/.test(code));
  // ⚠ **미전달은 여기서 확인한다.** 결과 비교로는 증명되지 않는다.
  check("전달은 null을 배제한 파생만 쓴다 — 비활성이면 undefined",
    (code.match(/priorAnnualDeductible: deductibles\.general,/g) ?? []).length === 2
    && (code.match(/priorAnnualInpatientDeductible: deductibles\.pool,/g) ?? []).length === 1
    && !/priorAnnualDeductible: num\(/.test(code) && !/priorAnnualInpatientDeductible: num\(/.test(code)
    && !/priorAnnualDeductible: gen2026Money\(/.test(code));
  check("null을 배제해야 객체가 만들어진다(타입 단언·0 대체 없음)",
    /const deductibles = priorDeductibleNum === null \|\| priorPoolNum === null\s*\n\s*\? null\s*\n\s*: \{ general: priorDeductibleNum, pool: priorPoolNum \};/.test(code)
    && !/priorDeductibleNum as number/.test(code) && !/priorPoolNum as number/.test(code)
    && !/priorDeductibleNum \?\? 0/.test(code) && !/priorPoolNum \?\? 0/.test(code));
  check("두 결과 분기에 게이트가 걸린다",
    /if \(money !== null && deductibles !== null\s*\n\s*&& coverage === "non_benefit"/.test(code)
    && /: money !== null && deductibles !== null && nonBenefitItem === "general"/.test(code));
  check("상급병실료 분기에는 걸지 않는다(그 경로가 쓰지 않는 축이다)",
    /if \(money !== null && showRoomChargeForm && !rcIncomplete\)/.test(code));
  check("급여 분기에도 걸지 않는다",
    /\? calculateMany2026\(\{\s*\n\s*cause: benefitCause, coverage: "benefit"/.test(code));
  check("두 칸 모두 RawAmountInput이다",
    /<RawAmountInput id="gen2026-prior-deductible" value=\{priorDeductible\}/.test(code)
    && /<RawAmountInput id="gen2026-prior-pool" value=\{priorPool\}/.test(code)
    && !/inputMode="numeric" value=\{priorDeductible\}/.test(code)
    && !/inputMode="numeric" value=\{priorPool\}/.test(code));
  check("초기값 \"0\"은 그대로다",
    /const \[priorDeductible, setPriorDeductible\] = useState\("0"\);/.test(code)
    && /const \[priorPool, setPriorPool\] = useState\("0"\);/.test(code));
  check("두 상태를 합치거나 서로 복사하지 않는다",
    !/setPriorPool\(priorDeductible/.test(code) && !/setPriorDeductible\(priorPool/.test(code)
    && !/deductibles\.general \+ deductibles\.pool/.test(code));
  check("계산 결과를 과거 누적액에 되쓰지 않는다",
    !/setPriorPool\([^)]*result/.test(code) && !/setPriorDeductible\([^)]*result/.test(code));
  // ── 무변경 영역 ──
  check("needsRowTier·행별 선택창·미선택 게이트는 그대로다",
    /const needsRowTier = showSpecialForm && severity === "critical" && specialItem === "mri";/.test(code)
    && /\{needsRowTier && row\.visit === "inpatient"/.test(code)
    && /const rowsIncomplete = showSpecialForm && rows\.some\(\(r\) => r\.visit === "" \|\| \(needsRowTier && r\.visit === "inpatient" && r\.tier === ""\)\);/.test(code));
  check("G-9의 세 금액 계약은 그대로다",
    /const priorInsuranceNum = priorInsurance === "" \? 0 : gen2026Money\(priorInsurance\);/.test(code)
    && /const money = priorInsuranceNum === null \|\| annualLimitNum === null \|\| outpatientLimitNum === null/.test(code)
    && (code.match(/priorAnnualInsurancePaid: money\.prior,/g) ?? []).length === 7);
  // ⚠ 계약 교체(G-13A·G-13B): `num(priorCount)`(G-13A)와 `num(copyCount)`(G-13B)는 사라졌다.
  //   각각 항목별 보상 횟수 파서와 세대별 복제 횟수 파서를 쓴다.
  //   `nhisRate`만 아직 num()이며 G-13C 범위로 남겼다.
  check("num()은 nhisRate 한 자리에만 남아 있다",
    /const num = \(v: string\) => Number\(v\.replace\(\/\[\^0-9\.\]\/g, ""\)\) \|\| 0;/.test(code)
    && /num\(nhisRate\)/.test(code)
    && !/num\(copyCount\)/.test(code) && !/num\(priorCount\)/.test(code));
  const widgetSrc = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  check("공용 위젯 파일은 그대로다",
    !/\.trim\(/.test(widgetSrc) && !/\.replace\(/.test(widgetSrc) && !/slice\(/.test(widgetSrc));
  const eng = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const many = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const spec = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("엔진의 소비 조건·상한은 그대로다",
    /const priorDeductible = Math\.max\(0, input\.priorAnnualDeductible \?\? 0\);/.test(eng)
    && /const remaining = Math\.max\(c\.annualDeductibleCap - priorDeductible, 0\);/.test(eng)
    && /let deductiblePaid = nonNegInt\(nb\?\.priorAnnualDeductible\);/.test(many)
    && /priorAnnualDeductible: severity === "critical" && nb\.visit === "inpatient" && nb\.tier === "hospital"/.test(many)
    && /spec\.poolEligible && line\.visit === "inpatient" && line\.tier === "hospital"/.test(spec));
  check("다른 세대 파서를 재사용하지 않는다", !/gen2021Money/.test(code) && !/stdMoney/.test(code));
}

console.log(`\n[5세대 누적 공제금액 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
