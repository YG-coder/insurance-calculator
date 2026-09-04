// G-12 — 2·3세대 다회의 **안내(notes) 범위**를 행 구성에 맞춘다.
//
// 대상은 두 곳뿐이다.
//   ① `multiClaim.ts`의 안내 생성 조건 — 통원 행이 있을 때만 두 안내를 붙인다.
//   ② `HealthCalcStandardized.tsx`의 행별 안내 표시 — 모든 행의 notes를 모아 중복 제거.
//
// ⚠ **보험금·자기부담금·횟수·상한 계산은 바꾸지 않았다.** `MultiClaimResult` 타입도,
//   금액·횟수 입력의 노출·검증·전달도, 빈 값과 명시적 `0`의 계약도 그대로다.
//   외래·처방조제 한도 상태를 분리하지 않았고, 다른 세대 엔진·단건 화면도 건드리지 않았다.
//
// 종전 동작(기준선 `git archive 4fc2a59`를 실행해 확인한 세 결함):
//   A. 입원만 있는 묶음에서도 "회(건)당 가입금액은 … 입력하지 않으면 적용하지 않습니다.
//      증권에서 확인해 입력하면 …"가 나왔다. 그 입력칸은 **화면에 없다**.
//      원인: `if (input.perVisitCoverageLimit === undefined)` — 행 구성을 보지 않았다.
//   B. 입원만 있는 묶음에서도 "하루에 2회 이상 **통원**한 경우 …" 안내가 나왔다.
//      원인: `const outpatientCount = results.filter((r) => r.covered).length` — 이름과 달리
//      **보상된 모든 행**을 세므로 입원도 포함됐다.
//   C. 화면이 `result.lines[0].notes`만 보여줘, 혼합 묶음에서 **첫 행 종류**의 안내만 나왔다
//      (`[외래, 입원]`이면 통원 공제 설명만, `[입원, 외래]`면 입원 상한 설명만).
//
// ⚠ **문구로 종류를 판별하거나 걸러내지 않는다.** 엔진이 만든 안내를 그대로 쓰고, 화면은
//   **동일 문구만** 중복 제거한다. 그래서 외래(의원급 1만원)와 약국(8천원)처럼 금액이 다른
//   공제 설명은 서로 다른 문구라 **둘 다 남는다** — 그것이 맞다.
// ⚠ 약관상 외래·처방조제 가입금액의 공유 범위는 **이번에도 확정하지 않았다.**
import { readFileSync } from "node:fs";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import RawAmountInput from "../src/components/RawAmountInput";
import { calculateMany } from "../src/lib/insurance/engine/multiClaim";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const UI_PATH = "src/components/calculators/HealthCalcStandardized.tsx";
const ENG_PATH = "src/lib/insurance/engine/multiClaim.ts";
const code = readFileSync(UI_PATH, "utf8");
const eng = readFileSync(ENG_PATH, "utf8");
const names = stateNamesFrom(code);
const stripComments = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const body = stripComments(code);
const engBody = stripComments(eng);

// ── 화면 구동 (전부 실제 핸들러) ─────────────────────────────────────
type Comp = () => unknown;
const setup = () => { const h = mount(HealthCalcStandardized as unknown as Comp, names); h.set("submitted", true); return h; };
type H = ReturnType<typeof setup>;
const findIn = (el: unknown, t: string): { props: Record<string, unknown> } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findIn(c, t); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === t && typeof e.props?.onChange === "function") return e as never;
  return findIn(e.props?.children, t);
};
const nodeById = (h: H, id: string) => h.render().nodes.find((n: RenderedNode) => String(n.props.id) === id) ?? null;
const typeInto = (h: H, id: string, v: string) => {
  const n = nodeById(h, id);
  if (n === null) throw new Error("입력을 찾지 못했습니다: " + id);
  const w = n.tag === "#RawAmountInput"
    ? findIn((RawAmountInput as unknown as (p: never) => unknown)(n.props as never), "input") : n;
  (w!.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const rowSelect = (h: H, i: number, which: string) =>
  h.render().nodes.find((x: RenderedNode) => x.tag === "select" && x.props["aria-label"] === `${i + 1}번 ${which}`) ?? null;
const setVisit = (h: H, i: number, v: string) => {
  const n = rowSelect(h, i, "치료 형태");
  if (n === null) throw new Error(`${i + 1}번 치료 형태 선택창 없음`);
  (n.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const setFacility = (h: H, i: number, v: string) => {
  const n = rowSelect(h, i, "방문 구분");
  if (n === null) throw new Error(`${i + 1}번 방문 구분 선택창 없음`);
  if (n.props.disabled === true) throw new Error("방문 구분이 비활성입니다(우회하지 않는다)");
  (n.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const clickButton = (h: H, text: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "button" && x.text.includes(text));
  if (n === undefined || n.props.disabled === true) throw new Error(`"${text}" 버튼 사용 불가`);
  (n.props.onClick as () => void)();
};
const removeRow = (h: H, i: number) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "button" && x.props["aria-label"] === `${i + 1}번 행 삭제`);
  if (n === undefined || n.props.disabled === true) throw new Error("삭제 불가");
  (n.props.onClick as () => void)();
};
const rowIds = (h: H) => h.render().nodes
  .filter((n) => n.tag === "#RawAmountInput" && String(n.props.id).startsWith("std-amount-"))
  .map((n) => String(n.props.id));
const rowAmount = (h: H, i: number, v: string) => typeInto(h, rowIds(h)[i], v);
/** spec: "out" | "pharm" | "in" — 전부 실제 핸들러로 만든다. */
const build = (spec: string[]) => {
  const h = setup();
  clickButton(h, "표준형");
  while (rowIds(h).length > 1) removeRow(h, 1);
  while (rowIds(h).length < spec.length) clickButton(h, "행 추가");
  spec.forEach((k, i) => {
    rowAmount(h, i, k === "in" ? "3000000" : "300000");
    if (k === "in") setVisit(h, i, "inpatient");
    else { setVisit(h, i, "outpatient"); setFacility(h, i, k === "pharm" ? "pharmacy" : "clinic"); }
  });
  if (nodeById(h, "std-prior-visits") !== null) typeInto(h, "std-prior-visits", "0");
  if (nodeById(h, "std-prior-prescriptions") !== null) typeInto(h, "std-prior-prescriptions", "0");
  return h;
};
const scr = (h: H) => {
  const s = h.render(); const boxes = s.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox");
  const info = boxes.filter((n) => n.props.variant === "info").map((n) => String(n.text)).join(" || ");
  const items = s.resultItems();
  return {
    calc: items !== null,
    own: items === null ? null : (items[1]?.value ?? null),
    pay: items === null ? null : (items[2]?.value ?? null),
    rows: s.nodes.filter((n) => n.tag === "td").map((n) => n.text).join(","),
    info,
    합산안내: info.includes("하루에 2회 이상 통원한 경우"),
    미적용안내: info.includes("계약마다 다른 값이라 입력하지 않으면"),
    통원공제: info.includes("통원 공제는"),
    입원상한: info.includes("입원 자기부담은 계약일"),
  };
};

// ── ① 입원만 — 통원용 안내가 사라진다 ────────────────────────────────
console.log("\n[입원만] 통원 합산 안내와 회당 가입금액 안내가 없다");
{
  for (const spec of [["in"], ["in", "in"]]) {
    const h = build(spec); const s = scr(h);
    check(`입원 ${spec.length}행: 계산되고 두 통원 안내가 없다`,
      s.calc && !s.합산안내 && !s.미적용안내, s.info.slice(0, 90));
    check(`  입원 상한 안내는 그대로 있다`, s.입원상한);
    check(`  회당 가입금액 칸도 없다`, nodeById(h, "std-per-visit-limit") === null);
  }
}

// ── ② 통원이 있으면 두 안내가 조건대로 나온다 ────────────────────────
console.log("\n[통원 있음] 두 안내가 조건에 맞게 표시된다");
{
  for (const [name, spec] of [["외래만", ["out"]], ["처방조제만", ["pharm"]],
    ["외래+처방조제", ["out", "pharm"]], ["외래+입원", ["out", "in"]],
    ["처방조제+입원", ["pharm", "in"]], ["세 종류", ["out", "pharm", "in"]]] as [string, string[]][]) {
    const h = build(spec); const s = scr(h);
    check(`${name}: 합산 안내 있음 · 미적용 안내 있음(한도 미입력)`, s.합산안내 && s.미적용안내, s.info.slice(0, 90));
    typeInto(h, "std-per-visit-limit", "100000");
    const s2 = scr(h);
    check(`  한도를 넣으면 미적용 안내만 사라지고 합산 안내는 남는다`, s2.합산안내 && !s2.미적용안내);
  }
  // 두 안내가 함께 나올 때의 순서도 고정한다. 화면은 엔진이 만든 배열을 그대로 join하므로
  // 배열 순서가 곧 사용자에게 보이는 순서다(변조 검사 30번이 이 항목으로 검출된다).
  {
    const s = scr(build(["out"]));
    const a = s.info.indexOf("하루에 2회 이상 통원한 경우");
    const b = s.info.indexOf("회(건)당 가입금액은 계약마다 다른 값이라");
    check("두 안내가 함께 나오면 합산 안내가 먼저 온다", a >= 0 && b >= 0 && a < b, `a=${a} b=${b}`);
  }
}

// ── ③ 통원이 전부 한도 초과여도 합산 안내는 남는다 ───────────────────
console.log("\n[한도 초과] 보상 제외돼도 합산 안내는 입력 방법 안내라 남는다");
{
  const h = build(["out"]);
  typeInto(h, "std-prior-visits", "180");
  const s = scr(h);
  check("외래만 · 이미 180회: 보상 제외되지만 합산 안내 유지", s.calc && s.합산안내, s.info.slice(0, 90));
  check("  보험 적용 0원(한도 초과가 실제로 걸렸다)", s.pay === "0원", String(s.pay));
  const p = build(["pharm"]);
  typeInto(p, "std-prior-prescriptions", "180");
  const sp = scr(p);
  check("처방조제만 · 이미 180건: 합산 안내 유지", sp.calc && sp.합산안내);
  check("  소스: covered 여부로 판단하지 않는다",
    !/results\.filter\(\(r\) => r\.covered\)\.length/.test(engBody)
    && /if \(hasOutpatient\) \{/.test(engBody));
}

// ── ④ 혼합 묶음 — 행별 고유 안내가 모두 나온다 ───────────────────────
console.log("\n[혼합] 입원·통원 행별 고유 안내가 모두 표시된다");
{
  for (const [name, spec] of [["외래+입원", ["out", "in"]], ["입원+외래(순서 반대)", ["in", "out"]],
    ["세 종류", ["out", "pharm", "in"]]] as [string, string[]][]) {
    const s = scr(build(spec));
    check(`${name}: 통원 공제 설명과 입원 상한 설명이 모두 있다`, s.통원공제 && s.입원상한, s.info.slice(0, 90));
  }
  const onlyIn = scr(build(["in"]));
  check("입원만: 통원 공제 설명은 없다", !onlyIn.통원공제 && onlyIn.입원상한);
  const onlyOut = scr(build(["out"]));
  check("외래만: 입원 상한 설명은 없다", onlyOut.통원공제 && !onlyOut.입원상한);
}

// ── ⑤ 행 순서를 바꿔도 안내 집합이 같다 ──────────────────────────────
console.log("\n[순서] 행 순서를 바꿔도 안내 집합이 같다");
{
  /** 엔진이 만든 안내 전체(묶음 + 행별)를 정렬해 집합으로 본다. */
  const noteSet = (spec: string[]) => {
    const lines = spec.map((k) => k === "in"
      ? { amount: 3000000, visit: "inpatient" as const }
      : { amount: 300000, visit: "outpatient" as const, facility: k === "pharm" ? ("pharmacy" as const) : ("clinic" as const) });
    const r = calculateMany("2017", {
      plan: "standard", lines,
      priorAnnualOutpatientVisits: spec.some((k) => k === "out") ? 0 : undefined,
      priorAnnualPrescriptions: spec.some((k) => k === "pharm") ? 0 : undefined,
    });
    if (r.status !== "OK") return "BLOCKED:" + r.notes.join("|");
    return JSON.stringify([...r.notes, ...r.lines.flatMap((l) => l.notes)].sort());
  };
  check("[외래,입원] == [입원,외래]", noteSet(["out", "in"]) === noteSet(["in", "out"]));
  check("[외래,처방,입원] == [입원,처방,외래]", noteSet(["out", "pharm", "in"]) === noteSet(["in", "pharm", "out"]));
  check("[외래,처방] == [처방,외래]", noteSet(["out", "pharm"]) === noteSet(["pharm", "out"]));
}

// ── ⑥ 같은 종류 여러 행 — 동일 문구는 한 번만 ────────────────────────
console.log("\n[중복] 같은 문구는 한 번만 표시된다");
{
  const count = (s: string, frag: string) => s.split(frag).length - 1;
  for (const [name, spec] of [["외래 3행", ["out", "out", "out"]], ["입원 2행", ["in", "in"]],
    ["처방 2행", ["pharm", "pharm"]]] as [string, string[]][]) {
    const s = scr(build(spec));
    const dup = ["통원 공제는", "입원 자기부담은 계약일", "이 계산에 반영되지 않은 약관 한도"]
      .filter((f) => count(s.info, f) > 1);
    check(`${name}: 같은 문구가 두 번 나오지 않는다`, dup.length === 0, dup.join(","));
  }
  // ⚠ 외래(의원급 1만원)와 약국(8천원)은 **문구가 다르다.** 중복이 아니므로 둘 다 남는 것이 맞다.
  const mix = scr(build(["out", "pharm"]));
  check("외래+처방조제: 금액이 다른 두 공제 설명이 모두 남는다",
    mix.info.includes("통원 공제는 10,000원") && mix.info.includes("통원 공제는 8,000원"), mix.info.slice(0, 120));
}

// ── ⑦ 계산 무회귀 — 안내만 바뀌고 금액은 그대로 ──────────────────────
console.log("\n[무회귀] 계산 결과·적용 한도·행별 금액은 그대로");
{
  const CASES: [string, string[], string, string][] = [
    ["외래만", ["out"], "60,000원", "240,000원"],
    ["처방조제만", ["pharm"], "60,000원", "240,000원"],
    ["입원만", ["in"], "600,000원", "2,400,000원"],
    ["외래+입원", ["out", "in"], "660,000원", "2,640,000원"],
    ["세 종류", ["out", "pharm", "in"], "720,000원", "2,880,000원"],
  ];
  for (const [name, spec, own, pay] of CASES) {
    const s = scr(build(spec));
    check(`${name}: 본인부담 ${own} · 보험 적용 ${pay}`, s.own === own && s.pay === pay, `${s.own}/${s.pay}`);
  }
  // 회당 한도가 실제로 걸리는 경우도 그대로다.
  const h = build(["out"]); typeInto(h, "std-per-visit-limit", "100000");
  check("회당 한도 100,000 적용", scr(h).pay === "100,000원", String(scr(h).pay));
  // 200만 상한 누적도 그대로다.
  const p = build(["in", "in"]); typeInto(p, "std-prior-paid", "1500000");
  check("입원 2행 · 이미 150만 부담: 상한 누적 그대로", scr(p).own === "500,000원", String(scr(p).own));
}

// ── ⑧ 소스 — 바꾼 것과 바꾸지 않은 것 ────────────────────────────────
console.log("\n[소스] 안내 조건만 바꾸고 계산·전달은 그대로");
{
  check("엔진: 통원 행 여부를 lines에서 직접 계산한다",
    /const hasOutpatient = lines\.some\(\(line\) => line\.visit === "outpatient"\);/.test(engBody));
  check("엔진: 통원 합산 안내가 hasOutpatient로만 걸린다",
    /if \(hasOutpatient\) \{\s*\n\s*notes\.push\("각 행은 약관상 1회의 청구 단위입니다\./.test(engBody)
    && !/outpatientCount/.test(engBody));
  check("엔진: 미적용 안내가 두 조건을 모두 본다",
    /if \(hasOutpatient && input\.perVisitCoverageLimit === undefined\) \{/.test(engBody));
  check("엔진: 행별 소비 조건은 그대로다",
    /priorAnnualPaid: line\.visit === "inpatient" \? inpatientOwnPaySoFar : undefined,/.test(engBody)
    && /perVisitCoverageLimit: line\.visit === "outpatient" \? input\.perVisitCoverageLimit : undefined,/.test(engBody));
  check("엔진: 횟수 축 판정과 거부는 그대로다",
    /const usesVisits = lines\.some\(\(l\) => l\.visit === "outpatient" && !isPharmacyLine\(l\)\);/.test(engBody)
    && /const usesPrescriptions = lines\.some\(isPharmacyLine\);/.test(engBody)
    && /if \(!usesVisits && visitsRaw !== undefined\) \{/.test(engBody)
    && /if \(!usesPrescriptions && prescriptionsRaw !== undefined\) \{/.test(engBody));
  check("엔진: hasOutpatient를 계산·한도에 쓰지 않는다(안내 전용)",
    (engBody.match(/hasOutpatient/g) ?? []).length === 3);
  check("엔진: 결과 타입과 집계는 그대로다",
    /const totalOwnPay = results\.reduce\(\(sum, r\) => sum \+ \(r\.ownPay \?\? 0\), 0\);/.test(engBody)
    && /const appliedCaps = \[\.\.\.new Set\(results\.flatMap\(\(r\) => r\.appliedCaps\)\)\];/.test(engBody)
    && /status: "OK", generation, lines: results,/.test(engBody));
  check("화면: 모든 행의 notes를 모아 동일 문구만 중복 제거한다",
    /const lineNotes = result === null \|\| result\.status !== "OK"\s*\n\s*\? \[\]\s*\n\s*: \[\.\.\.new Set\(result\.lines\.flatMap\(\(line\) => line\.notes\)\)\];/.test(code)
    && /\{lineNotes\.length > 0 && \(/.test(code)
    && !/result\.lines\[0\]\?\.notes/.test(body));
  check("화면: 문구 내용으로 걸러내지 않는다",
    !/notes\.filter\(/.test(body) && !/\.includes\("통원/.test(body) && !/\.includes\("입원/.test(body));
  check("화면: 금액 입력의 노출·검증·전달은 그대로다",
    /const perVisitNum = !hasOutpatient \|\| perVisitLimit === "" \? undefined : stdMoney\(perVisitLimit\);/.test(code)
    && /const priorPaidNum = !hasInpatient \|\| priorPaid === "" \? undefined : stdMoney\(priorPaid\);/.test(code)
    && /priorAnnualPaid: money\.priorPaid,/.test(code)
    && /perVisitCoverageLimit: money\.perVisit,/.test(code));
  check("화면: 0 안내와 빈 값 계약은 그대로다",
    /const perVisitZero = perVisitNum !== undefined && perVisitNum !== null && perVisitNum <= 0;/.test(code));
  check("화면: 외래·처방조제 한도 상태를 분리하지 않았다",
    (code.match(/const \[perVisitLimit, setPerVisitLimit\]/g) ?? []).length === 1
    && !/perVisitLimitByFacility/.test(code) && !/prescriptionLimit/.test(code));
  const std = readFileSync("src/lib/insurance/engine/generationStandardized.ts", "utf8");
  check("단건 엔진과 산식은 그대로다",
    /const prior = Math\.max\(0, input\.priorAnnualPaid \?\? 0\);/.test(std)
    && /if \(value === undefined \|\| !Number\.isFinite\(value\) \|\| value <= 0\) return undefined;/.test(std)
    && /const visitLimit = perVisitLimit\(input\.perVisitCoverageLimit\);/.test(std));
  check("다른 세대 엔진을 건드리지 않았다",
    !/multiClaim2021|multiClaim2026/.test(engBody));
}

console.log(`\n[2·3세대 안내 범위] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
