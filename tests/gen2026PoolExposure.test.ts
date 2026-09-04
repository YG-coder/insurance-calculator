// G-10 항목 B — 중증 MRI **누적 공제금액 입력의 노출·전달 조건**을 소비 조건에 맞춘다.
//
// 종전 동작: `needsRowTier`(중증 + MRI)만 보고 **행 구성과 무관하게** 입력을 띄우고
//   `priorAnnualInpatientDeductible: num(priorPool)`을 **무조건** 넘겼다. 그런데 엔진은
//   `spec.poolEligible && line.visit === "inpatient" && line.tier === "hospital"`인 행에서만
//   pool을 소진한다(`specialItem2026.ts`). `hospital`은 선택창 라벨대로
//   **상급종합·종합병원**을 뜻한다.
//   기준선 `5b2ee89`를 실행해 확인한 결과 — 통원만·입원 병·의원급·혼합(통원+병·의원급)에서는
//   500만원을 넣어도 결과가 바뀌지 않았다. 사용자는 효과 없는 칸을 보게 된다.
//
// ⚠ 이번 변경은 **노출·전달 조건뿐**이다.
//   - 파서(`num()`)·위젯(맨 `<input>`)·초기값 `"0"`·빈 값 처리는 그대로다.
//     **이번 커밋이 공제금액 입력 검증을 해결한 것이 아니다**(항목 A는 별도 작업).
//   - 500만원 상한·적용 의료기관·산식·엔진·규칙값·기존 HOLD는 무변경.
//   - 약관상 공유 범위(일반 입원과 MRI 입원이 같은 pool인지)는 **이번에 확정하지 않는다.**
//   - `priorDeductible`의 노출·전달·계산도 변경하지 않는다.
// ⚠ `needsRowTier`는 **행별 의료기관 종별 선택창**과 `rowsIncomplete`(미선택 차단)에도
//   쓰인다. 거기 맞춰 좁히면 종별을 고를 수단이 사라지므로 공제금액 전용 조건
//   `usesPriorPool`을 따로 뒀다.
//
// **검사 역할 분담** — 섞어 쓰지 않는다.
//   - 노출 여부: 화면에 칸이 있는지 직접 본다.
//   - **미전달: [소스] 절의 전달식 검사로만 확인한다.** 결과가 같다는 사실은 미전달을
//     증명하지 못한다 — 값이 전달되어도 소비 조건에 걸리지 않으면 결과가 같기 때문이다.
//     기준선이 정확히 그 상태(무조건 전달 + 비대상에서는 소비 안 됨)였다.
//   - 결과 비교: **계산 무회귀**를 본다. 대상 구성에서 종전처럼 pool이 반영되는지,
//     비대상 구성에서 종전처럼 반영되지 않는지.
//   - 행 전환은 실제 선택창·행 추가/삭제 핸들러를 쓴다. pool 값은 칸이 없는 구성에서는
//     실제 입력이 불가능하므로 상태로 주입하고, **칸이 보이는 대표 사례 하나**는
//     [실제 입력] 절에서 위젯 `onChange`를 거친다.
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
const real = (children: unknown) => {
  const d = findIn(children, "input"); if (d !== null) return d;
  const f = (el: unknown): { props: Record<string, unknown> } | null => {
    if (el === null || el === undefined || typeof el !== "object") return null;
    if (Array.isArray(el)) { for (const c of el) { const r = f(c); if (r !== null) return r; } return null; }
    const e = el as { type?: unknown; props?: Record<string, unknown> };
    if (e.type === RawAmountInput) return findIn((RawAmountInput as unknown as (q: never) => unknown)(e.props as never), "input");
    return f(e.props?.children);
  };
  return f(children);
};
const labelOf = (h: H, p: string) => h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(p));
const has = (h: H, p: string) => labelOf(h, p) !== undefined;
const pick = (h: H, p: string, v: string) => {
  const l = labelOf(h, p); const s = l === undefined ? null : findIn(l.props.children, "select");
  if (s === null) throw new Error("선택창을 찾지 못했습니다: " + p);
  if (s.props.disabled === true) throw new Error("선택창이 비활성입니다: " + p);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const typeInto = (h: H, p: string, v: string) => {
  const l = labelOf(h, p); const i = l === undefined ? null : real(l.props.children);
  if (i === null) return false; (i.props.onChange as (e: unknown) => void)({ target: { value: v } }); return true;
};
const shown = (h: H, p: string) => { const l = labelOf(h, p); const i = l === undefined ? null : real(l.props.children); return i === null ? null : String(i.props.value); };
const scr = (h: H) => {
  const r = h.render(); const it = r.resultItems();
  return { calc: it !== null, pay: it === null ? null : (it[2]?.value ?? null), own: it === null ? null : (it[1]?.value ?? null),
    rows: r.nodes.filter((n) => n.tag === "td").map((n) => n.text).join(","),
    warn: r.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning").map((n) => String(n.text)).join(" || ") };
};
const POOL = "계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)";
const DEDUCT = "계약해당일 기준 1년간 이미 누적된 공제금액";
const PRIOR_ITEM = "계약해당일 기준 1년간 이 보장종목의 기존 지급보험금";
const COV = "급여 구분", ITEM = "치료유형", SEV = "질환 구분", VIS = "치료 형태", TIER = "입원 의료기관", CAUSE = "원인";

/** 행 조작은 **실제 핸들러**만 쓴다. */
const rowLabels = (h: H, prefix: string) =>
  h.render().nodes.filter((n: RenderedNode) => n.tag === "label" && n.text.startsWith(prefix));
const setRowVisit = (h: H, i: number, v: string) => {
  const ls = rowLabels(h, "치료 형태");
  const s = ls[i] === undefined ? null : findIn(ls[i].props.children, "select");
  if (s === null) throw new Error(`${i + 1}번째 행 치료 형태 선택창이 없습니다`);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const setRowTier = (h: H, i: number, v: string) => {
  // ⚠ 행별 의료기관 선택창은 입원 행에서만 렌더된다. 없으면 예외 — 우회하지 않는다.
  const ls = rowLabels(h, "의료기관");
  const s = ls[i] === undefined ? null : findIn(ls[i].props.children, "select");
  if (s === null) throw new Error(`${i + 1}번째 행 의료기관 선택창이 없습니다`);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const rowTierSelects = (h: H) => rowLabels(h, "의료기관").length;
const addRow = (h: H) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "button" && x.text.includes("행 추가"));
  if (n === undefined) throw new Error("행 추가 버튼이 없습니다");
  (n.props.onClick as () => void)();
};
const delRow = (h: H, i: number) => {
  const bs = h.render().nodes.filter((x: RenderedNode) => x.tag === "button" && x.text.includes("삭제"));
  if (bs[i] === undefined) throw new Error(`${i + 1}번째 삭제 버튼이 없습니다`);
  if (bs[i].props.disabled === true) throw new Error("삭제 버튼이 비활성입니다");
  (bs[i].props.onClick as () => void)();
};
const rowAmt = (h: H, i: number, v: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === `gen2026-row-amount-${i}`);
  if (n === undefined) throw new Error(`${i + 1}번째 행 진료비가 없습니다`);
  const w = real(n as unknown as { props: Record<string, unknown> }) ?? findIn((RawAmountInput as unknown as (q: never) => unknown)(n.props as never), "input");
  (w!.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
/** 중증 MRI 특약 경로로 들어간다(실제 선택창). 행은 기본 2개로 시작한다. */
const mriPath = (h: H) => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "mri"); pick(h, SEV, "critical");
  return h;
};
/** 행 구성을 실제 핸들러로 만든다. spec: [visit, tier][] */
const buildRows = (h: H, spec: [string, string][]) => {
  mriPath(h);
  while (h.render().nodes.filter((n: RenderedNode) => String(n.props.id).startsWith("gen2026-row-amount-")).length > spec.length) delRow(h, 1);
  while (h.render().nodes.filter((n: RenderedNode) => String(n.props.id).startsWith("gen2026-row-amount-")).length < spec.length) addRow(h);
  spec.forEach(([visit, tier], i) => {
    rowAmt(h, i, "2000000");
    if (visit !== "") setRowVisit(h, i, visit);
    if (visit === "inpatient" && tier !== "") {
      // 입원으로 바꾼 뒤에야 의료기관 선택창이 생긴다. 몇 번째 입원 행인지 세어서 고른다.
      const idx = spec.slice(0, i + 1).filter(([v]) => v === "inpatient").length - 1;
      setRowTier(h, idx, tier);
    }
  });
  return h;
};

// ── 노출·전달이 소비 조건과 일치한다 ────────────────────────────────
console.log("\n[정렬] 500만원 pool이 실제로 소진되는 행이 있을 때만 노출·전달한다");
{
  const cases: [string, [string, string][], boolean][] = [
    ["통원만", [["outpatient", ""]], false],
    ["통원 2건", [["outpatient", ""], ["outpatient", ""]], false],
    ["입원·병·의원급", [["inpatient", "clinic"]], false],
    ["입원·상급종합·종합병원", [["inpatient", "hospital"]], true],
    ["혼합(통원 + 입원 병·의원급)", [["outpatient", ""], ["inpatient", "clinic"]], false],
    ["혼합(통원 + 입원 상급종합·종합병원)", [["outpatient", ""], ["inpatient", "hospital"]], true],
    ["혼합(입원 병·의원급 + 입원 상급종합·종합병원)", [["inpatient", "clinic"], ["inpatient", "hospital"]], true],
    ["입원 상급종합·종합병원 2건", [["inpatient", "hospital"], ["inpatient", "hospital"]], true],
  ];
  for (const [name, spec, want] of cases) {
    const h = buildRows(setup(), spec);
    typeInto(h, PRIOR_ITEM, "0");
    check(`${name}: 공제금액 칸 ${want ? "노출" : "미노출"}`, has(h, POOL) === want, `실제 ${has(h, POOL)}`);
    /**
     * ⚠ **결과가 같다는 사실은 미전달을 증명하지 못한다.** 값이 전달되더라도 소비 조건에
     *   걸리지 않으면 결과는 같기 때문이다(기준선이 정확히 그 상태였다).
     *   **미전달은 아래 [소스] 절의 전달식 검사로 확인한다.**
     *   여기서 보는 것은 두 가지다 —
     *     대상 구성: pool 값이 결과를 바꾸는 **계산 무회귀**(종전과 같은 소비가 유지되는가)
     *     비대상 구성: pool 값이 결과를 바꾸지 않는 **계산 무회귀**(종전과 같다)
     * ⚠ 비대상 구성에서는 칸이 없어 실제 입력으로 값을 넣을 수 없다. 그래서 상태로 주입한다.
     *   실제 입력 `onChange`를 거치는 대표 사례는 아래 [실제 입력] 절에 따로 뒀다.
     */
    const a = buildRows(setup(), spec); typeInto(a, PRIOR_ITEM, "0"); a.set("priorPool", "0");
    const b = buildRows(setup(), spec); typeInto(b, PRIOR_ITEM, "0"); b.set("priorPool", "5000000");
    const differs = scr(a).pay !== scr(b).pay;
    check(`${name}: pool 값의 계산 영향이 종전과 같다(${want ? "영향 있음" : "영향 없음"})`,
      differs === want, `${scr(a).pay} vs ${scr(b).pay}`);
  }
}

// ── 실제 입력 onChange를 거치는 대표 사례 ───────────────────────────
console.log("\n[실제 입력] 위젯 onChange → 숨김 → 복귀");
{
  /**
   * ⚠ 위 [정렬] 절은 비대상 구성에서 칸이 없어 값을 상태로 주입했다. 여기서는 칸이 보이는
   *   동안 **실제 입력의 onChange**로 값을 넣고, 행을 바꿔 숨긴 뒤 되돌린다.
   *   `typeInto`는 라벨 아래의 진짜 `<input>`을 찾아 그 핸들러를 부른다(위젯을 건너뛰지 않는다).
   *
   * ⚠ 행은 **하나만** 둔다. 행이 둘이면 합계가 중증 MRI 연간 보장한도 300만 원에 걸려
   *   pool 반영 여부가 한도에 가려진다. 한 행(진료비 200만 원)이면 pool 유무가 그대로 보인다.
   *   - pool 490만 원: 상한 500만 원까지 남은 공제 여지가 10만 원 → 공제 10만 원 → 190만 원
   *   - pool 0원: 공제 30%인 60만 원 → 140만 원
   *   두 값 모두 한도 300만 원 미만이라 클램프가 개입하지 않는다.
   */
  const h = buildRows(setup(), [["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0");
  check("대상 구성: 칸이 보인다", has(h, POOL));
  const typed = typeInto(h, POOL, "4900000");   // 실제 onChange
  check("실제 입력 onChange가 통했다", typed && shown(h, POOL) === "4900000", String(shown(h, POOL)));
  check("  상태에도 그대로 들어갔다", String(h.get("priorPool")) === "4900000", String(h.get("priorPool")));
  const withValue = scr(h).pay;
  check("  값이 계산에 반영된다", withValue === "1,900,000원", String(withValue));
  setRowVisit(h, 0, "outpatient");            // 실제 선택창 → 대상 행이 사라진다
  check("숨김: 칸이 사라진다", !has(h, POOL));
  check("  상태는 보존된다", String(h.get("priorPool")) === "4900000", String(h.get("priorPool")));
  const onlyOut = buildRows(setup(), [["outpatient", ""]]);
  typeInto(onlyOut, PRIOR_ITEM, "0");
  /* ⚠ 이 비교는 **계산 무회귀**를 확인한다. 값이 같다는 사실만으로 미전달이 증명되지는
   *   않는다(엔진이 비대상 행에서 이 인자를 소비하지 않으므로 전달해도 결과는 같다).
   *   실제 미전달은 아래 [소스] 절의 전달 조건 검사가 확인한다. */
  check("  통원만 구성의 계산과 같다", scr(h).pay === scr(onlyOut).pay, `${scr(h).pay} vs ${scr(onlyOut).pay}`);
  setRowVisit(h, 0, "inpatient"); setRowTier(h, 0, "hospital");   // 실제 선택창 → 대상 행 복귀
  check("복귀: 칸·원문·계산이 돌아온다",
    has(h, POOL) && shown(h, POOL) === "4900000" && scr(h).pay === withValue,
    `${shown(h, POOL)} / ${scr(h).pay}`);
  // 실제 입력으로 고친 값도 그대로 반영된다.
  typeInto(h, POOL, "0");
  check("실제 입력으로 0으로 고치면 반영된다", scr(h).pay === "1,400,000원", String(scr(h).pay));
}

// ── 경계 조건 ────────────────────────────────────────────────────────
console.log("\n[경계] 미선택·전이·삭제·경로 이탈");
{
  // 적용 대상 행 하나 + 미선택 행 → 칸은 보이고, 기존 미선택 게이트가 전체 계산을 막는다.
  const h = buildRows(setup(), [["inpatient", "hospital"], ["outpatient", ""]]);
  typeInto(h, PRIOR_ITEM, "0");
  check("대상 행 + 통원 행: 칸 보이고 계산됨", has(h, POOL) && scr(h).calc, scr(h).warn.slice(0, 40));
  setRowVisit(h, 1, "");
  check("치료 형태 미선택 행이 생기면: 칸은 보이고", has(h, POOL));
  check("  기존 미선택 게이트가 전체 계산을 막는다", !scr(h).calc && scr(h).warn.includes("치료 형태"));
  setRowVisit(h, 1, "inpatient");
  check("입원으로 바꾸면 종별 미선택 게이트가 막는다", !scr(h).calc && scr(h).warn.includes("의료기관 종별"));
  check("  그때도 칸은 보인다(대상 행이 하나 있으므로)", has(h, POOL));
  setRowTier(h, 1, "clinic");
  check("종별을 고르면 계산 재개", scr(h).calc, scr(h).warn.slice(0, 40));
}
{
  // 통원 행에 과거 hospital 상태가 남아도 대상이 아니다.
  const h = buildRows(setup(), [["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0"); h.set("priorPool", "5000000");
  const withPool = scr(h).pay;
  check("입원·상급종합·종합병원: pool 반영", withPool === "2,000,000원", String(withPool));
  setRowVisit(h, 0, "outpatient");   // tier는 상태에 hospital로 남는다
  check("통원으로 바꾸면 칸이 사라진다", !has(h, POOL));
  const stale = (h.get("rows") as { visit: string; tier: string }[])[0];
  check("  행 상태에는 tier가 hospital로 남아 있다", stale.tier === "hospital" && stale.visit === "outpatient",
    JSON.stringify(stale));
  const fresh = buildRows(setup(), [["outpatient", ""]]); typeInto(fresh, PRIOR_ITEM, "0");
  check("  남은 tier가 계산에 쓰이지 않는다", scr(h).pay === scr(fresh).pay, `${scr(h).pay} vs ${scr(fresh).pay}`);
  setRowVisit(h, 0, "inpatient");
  check("입원으로 되돌리면 칸과 값이 복원된다",
    has(h, POOL) && shown(h, POOL) === "5000000" && scr(h).pay === withPool,
    `${shown(h, POOL)} / ${scr(h).pay}`);
}
{
  // 마지막 대상 행 삭제 → 숨김, 다시 만들면 복원.
  const h = buildRows(setup(), [["outpatient", ""], ["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0"); h.set("priorPool", "4900000");
  check("혼합: 칸 보임", has(h, POOL));
  const before = scr(h).pay;
  delRow(h, 1);
  check("대상 행을 지우면 칸이 사라진다", !has(h, POOL));
  check("  원문 상태는 남는다", String(h.get("priorPool")) === "4900000");
  const only = buildRows(setup(), [["outpatient", ""]]); typeInto(only, PRIOR_ITEM, "0");
  check("  통원만 구성의 계산과 같다", scr(h).pay === scr(only).pay, `${scr(h).pay} vs ${scr(only).pay}`);
  addRow(h); rowAmt(h, 1, "2000000"); setRowVisit(h, 1, "inpatient"); setRowTier(h, 0, "hospital");
  check("행을 다시 만들면 칸·원문·계산이 복원된다",
    has(h, POOL) && shown(h, POOL) === "4900000" && scr(h).pay === before,
    `${shown(h, POOL)} / ${scr(h).pay} vs ${before}`);
}
{
  // hospital → clinic 전이.
  const h = buildRows(setup(), [["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0"); h.set("priorPool", "5000000");
  check("상급종합·종합병원: 칸 보임", has(h, POOL));
  setRowTier(h, 0, "clinic");
  check("병·의원급으로 바꾸면 칸이 사라진다", !has(h, POOL));
  const cl = buildRows(setup(), [["inpatient", "clinic"]]); typeInto(cl, PRIOR_ITEM, "0");
  check("  병·의원급 계산과 같다", scr(h).pay === scr(cl).pay, `${scr(h).pay} vs ${scr(cl).pay}`);
  setRowTier(h, 0, "hospital");
  check("되돌리면 칸·원문 복원", has(h, POOL) && shown(h, POOL) === "5000000");
}
{
  // 경로 이탈·복귀.
  const h = buildRows(setup(), [["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0"); h.set("priorPool", "3000000");
  check("중증 MRI: 칸 보임", has(h, POOL));
  pick(h, SEV, "non_critical");
  check("비중증 MRI로 가면 칸이 없다", !has(h, POOL));
  pick(h, ITEM, "musculoskeletal_esw"); pick(h, SEV, "critical");
  h.set("priorActs", "0"); h.set("priorCount", "0");
  check("중증 근골격계에도 칸이 없다", !has(h, POOL));
  pick(h, COV, "benefit");
  check("급여에도 칸이 없다", !has(h, POOL));
  pick(h, COV, "non_benefit"); pick(h, ITEM, "mri"); pick(h, SEV, "critical");
  check("중증 MRI로 돌아오면 칸·원문 복원", has(h, POOL) && shown(h, POOL) === "3000000",
    `${has(h, POOL)} / ${shown(h, POOL)}`);
}
{
  // 빈 행 배열(상태 직접 주입으로만 만들 수 있는 경계) — 크래시 없이 숨김.
  const h = mriPath(setup());
  h.set("rows", []);
  check("행이 하나도 없으면 칸이 없다", !has(h, POOL));
  check("  렌더가 깨지지 않는다", h.render().nodes.length > 0);
}

// ── 소스 계약 ────────────────────────────────────────────────────────
console.log("\n[소스] 전용 조건을 따로 두고 기존 계약을 건드리지 않는다");
{
  const code = stripComments(ui);
  check("공제금액 전용 조건이 따로 있다",
    /const usesPriorPool = showSpecialForm && severity === "critical" && specialItem === "mri"\s*\n\s*&& rows\.some\(\(r\) => r\.visit === "inpatient" && r\.tier === "hospital"\);/.test(code));
  check("visit과 tier를 함께 본다", !/rows\.some\(\(r\) => r\.tier === "hospital"\)/.test(code)
    && !/rows\.some\(\(r\) => r\.visit === "inpatient"\)\s*;/.test(code));
  check("some이다(every가 아니다)", !/rows\.every\(\(r\) => r\.visit === "inpatient" && r\.tier === "hospital"\)/.test(code));
  check("노출이 전용 조건을 쓴다", /\{usesPriorPool && <label className="text-sm font-semibold">계약해당일 기준 1년간 이미 누적된 공제금액 \(500만 원 상한\)/.test(code));
  // ⚠ **미전달은 여기서 확인한다.** 결과 비교로는 증명할 수 없다 — 값이 전달되어도
  //   소비 조건에 걸리지 않으면 결과가 같기 때문이다(기준선이 그 상태였다).
  // ⚠ G-10 항목 A가 전달 형태를 `deductibles.pool`로 바꿨다. 전용 조건은 그 파생 안으로
  //   들어갔을 뿐 사라지지 않았다 — `!usesPriorPool`이면 `undefined`다.
  check("전달이 전용 조건을 쓴다 — 비대상에서는 undefined가 넘어간다",
    /priorAnnualInpatientDeductible: deductibles\.pool,/.test(code)
    && /const priorPoolNum = !usesPriorPool \? undefined\s*\n\s*: priorPool === "" \? 0 : gen2026Money\(priorPool\);/.test(code)
    && !/priorAnnualInpatientDeductible: num\(priorPool\),/.test(code)
    && !/priorAnnualInpatientDeductible: gen2026Money\(priorPool\),/.test(code));
  // ── 기존 계약 무변경 ──
  check("needsRowTier는 그대로다",
    /const needsRowTier = showSpecialForm && severity === "critical" && specialItem === "mri";/.test(code));
  check("행별 의료기관 선택창은 needsRowTier를 그대로 쓴다",
    /\{needsRowTier && row\.visit === "inpatient"/.test(code));
  check("rowsIncomplete는 그대로다",
    /const rowsIncomplete = showSpecialForm && rows\.some\(\(r\) => r\.visit === "" \|\| \(needsRowTier && r\.visit === "inpatient" && r\.tier === ""\)\);/.test(code));
  check("미선택 안내도 needsRowTier를 그대로 쓴다",
    /\{submitted && rowsIncomplete && <div className="mt-5"><NoticeBox variant="warning">각 행의 <b>치료 형태<\/b>\{needsRowTier \?/.test(code));
  // ⚠ **낡은 계약을 교체했다.** 두 검사는 "항목 A는 아직 안 했다"를 고정하고 있었다.
  //   항목 A가 파서·위젯을 바꿨으므로, 항목 B가 만든 **노출·전달 조건 자체**가
  //   그대로인지만 남긴다.
  check("초기값은 그대로이고 pool 노출 조건은 항목 A가 건드리지 않았다",
    /const \[priorPool, setPriorPool\] = useState\("0"\);/.test(code)
    && /\{usesPriorPool && <label/.test(code));
  check("priorDeductible의 노출·전달 조건은 소비 조건과 같다",
    /const \[priorDeductible, setPriorDeductible\] = useState\("0"\);/.test(code)
    && /const usesPriorDeductible = showGeneralForm && generalAxis !== null\s*\n\s*&& severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";/.test(code)
    && /\{usesPriorDeductible && <label/.test(code)
    && (code.match(/priorAnnualDeductible: deductibles\.general,/g) ?? []).length === 2);
  check("두 상태를 합치거나 서로 복사하지 않는다",
    !/setPriorPool\(priorDeductible/.test(code) && !/setPriorDeductible\(priorPool/.test(code)
    && !/num\(priorPool\) \+ num\(priorDeductible\)/.test(code));
  check("계산 결과를 과거 누적액에 되쓰지 않는다",
    !/setPriorPool\([^)]*result/.test(code) && !/setPriorDeductible\([^)]*result/.test(code));
  check("G-9의 세 금액 계약은 그대로다",
    /const priorInsuranceNum = priorInsurance === "" \? 0 : gen2026Money\(priorInsurance\);/.test(code)
    && /const money = priorInsuranceNum === null \|\| annualLimitNum === null \|\| outpatientLimitNum === null/.test(code));
  check("G-8의 축 키는 그대로다",
    /const paidAxis: Gen2026PaidAxis \| null = showSpecialForm \? itemAxis/.test(code));
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("엔진의 pool 소비 조건·상한은 그대로다",
    /if \(spec\.poolEligible && line\.visit === "inpatient" && line\.tier === "hospital"\) \{/.test(item)
    && /const POOL_CAP = GEN2026\.nonBenefit\.critical\.annualDeductibleCap;/.test(item));
  check("급여 주석이 정정됐다(상태가 남을 수 있음과 활성 조건을 구분)",
    /`generalAxis`는 `severity`·`cause`로만 만들어지고 두 상태는 급여로 바꿔도/.test(ui)
    && /간섭을 막는 것은 축이 null이라는 사실이 아니라/.test(ui)
    && !/그때 `paidAxis`·`generalAxis`가 null이라/.test(ui));
}

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] 적용 대상 경로의 계산과 다른 입력들은 그대로다");
{
  const h = buildRows(setup(), [["inpatient", "hospital"]]);
  typeInto(h, PRIOR_ITEM, "0"); h.set("priorPool", "0");
  check("중증 MRI 입원 상급종합·종합병원 기본 계산", scr(h).pay === "1,400,000원", String(scr(h).pay));
  h.set("priorPool", "4900000");
  check("pool 490만 반영", scr(h).pay === "1,900,000원", String(scr(h).pay));
  h.set("priorPool", "5000000");
  check("pool 전액 소진 반영", scr(h).pay === "2,000,000원", String(scr(h).pay));
  h.set("priorPool", "0");
  typeInto(h, PRIOR_ITEM, "abc");
  check("지급보험금 무효는 여전히 차단(G-9)", !scr(h).calc);
  typeInto(h, PRIOR_ITEM, "0");
  rowAmt(h, 0, "abc");
  check("행 진료비 무효는 여전히 차단", !scr(h).calc && scr(h).warn.includes("진료비"));
  rowAmt(h, 0, "2000000");
  check("복구 후 재개", scr(h).calc);
}
{
  // priorDeductible 경로는 손대지 않았다.
  const g = setup();
  pick(g, COV, "benefit"); pick(g, COV, "non_benefit");
  pick(g, ITEM, "general"); pick(g, SEV, "critical"); pick(g, CAUSE, "disease");
  pick(g, VIS, "inpatient"); pick(g, TIER, "hospital");
  g.set("amounts", ["10000000"]); typeInto(g, "계약해당일 기준 1년간 기존 지급보험금", "0");
  check("일반 중증 입원 상급종합·종합병원: 공제 칸 보임", has(g, DEDUCT) && !has(g, POOL));
  typeInto(g, DEDUCT, "4000000");
  check("  공제 400만 반영", scr(g).own === "1,000,000원", String(scr(g).own));
  typeInto(g, DEDUCT, "abc");
  // ⚠ **낡은 계약을 교체했다.** 항목 A가 이 값을 엄격 검증하면서 차단하도록 바꿨다.
  check("  무효값은 이제 차단된다(항목 A)", !scr(g).calc && scr(g).warn.includes("이미 누적된 공제금액"),
    `${scr(g).calc} / ${scr(g).warn.slice(0, 40)}`);
  typeInto(g, DEDUCT, "4000000");
  check("  고치면 재개", scr(g).own === "1,000,000원", String(scr(g).own));
  pick(g, TIER, "clinic");
  check("  병·의원급에서는 칸이 없다(종전 그대로)", !has(g, DEDUCT));
}
{
  // 근골격계·비중증 MRI에는 pool 칸이 원래 없다(무변경).
  const m = setup();
  pick(m, COV, "non_benefit"); pick(m, ITEM, "musculoskeletal_esw"); pick(m, SEV, "critical");
  m.set("priorActs", "0"); m.set("priorCount", "0");
  check("중증 근골격계: pool 칸 없음", !has(m, POOL));
  check("  행별 의료기관 선택창도 없다(needsRowTier 계약)", rowTierSelects(m) === 0);
  const n = buildRows(setup(), [["inpatient", "hospital"]]);
  check("중증 MRI 입원: 행별 의료기관 선택창이 있다", rowTierSelects(n) === 1);
}

console.log(`\n[중증 MRI 공제금액 노출·전달] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
