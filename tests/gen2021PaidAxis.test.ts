// G-5 — 4세대 다회의 **누적 금액 입력을 보장축별로 분리**한다.
//
// 종전 동작: "누적기간 내 기존 지급보험금"과 "증권상 연간 가입금액"이 각각 **하나의 상태**였다.
//   항목·원인·급여 구분을 바꿔도 값이 그대로 남아 **다른 한도에 그대로 적용**됐다.
//   프로덕션 재현 — 도수(연 350만)에 3,400,000을 넣고 MRI로 전환하면 값이 그대로 남아
//   MRI(연 300만) 한도에 적용돼 총 보험 적용 금액이 **0원**이 됐다.
//
// 축 구성은 별표15 **2021.7.1 판본 직독** 결과다.
//   기본형 제5조①(인쇄 p.209) — "(1)상해급여에 대하여 입원과 통원의 보상금액을 합산하여
//     5천만원 이내에서, (2)질병급여에 대하여 … 5천만원 이내에서" 계약자가 선택한 금액.
//   특별약관 제5조①(p.264) — 상해비급여·질병비급여에 같은 구조. 단서: "(3)3대비급여의
//     보험가입금액은 제3조(3)3대비급여 제1항에서 정한 연간 보상한도로 합니다."
//   특별약관 <표1>(p.252) — 세 항목 각각 "각 상해·질병 치료행위를 합산하여
//     350만원/250만원/300만원 이내". 제5조③(p.264) — "각 비급여의료비별 보상한도로 합니다."
//   ⇒ 일반은 **원인 × 급여 구분 4축**이고 축 안에서 **입원·통원 합산**,
//      특약은 **항목별 3축**이고 축 안에서 **상해·질병 합산**.
//
// ⚠ 이번은 **상태 분리만** 다룬다. 초기값("0" / 빈 문자열), 빈 값·명시적 0·무효값 처리,
//   상한 적용, 파서(`digits`), 엔진·타입·규칙값·산식·횟수·승인 회차·진료비·복제 정책은 무변경.
// ⚠ 축 키가 coverage를 쓰지 않는다고 해서 coverage 상태를 강제로 바꾸거나 새 차단을 넣지 않는다.
//   특약 선택 시 급여 선택창이 비활성화되는 기존 동작을 그대로 둔다.
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

const GENERAL = ["injury_benefit", "injury_non_benefit", "disease_benefit", "disease_non_benefit"] as const;
const RIDERS = ["manual_therapy", "injection", "mri"] as const;

type Comp = () => unknown;
const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalcMulti2021 as unknown as Comp, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
const screenOf = (h: ReturnType<typeof setup>) => {
  const s = h.render();
  return {
    s,
    calculated: s.resultItems() !== null,
    pay: (s.resultItems() ?? [])[2]?.value ?? null,
    labels: s.labels,
    warns: s.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning"),
  };
};
/**
 * 라벨 텍스트로 그 축의 실제 `<input>`을 찾아 **실제 onChange**를 통과시킨다.
 * ⚠ G-6에서 금액 두 축이 `RawAmountInput`으로 바뀌었다. 위젯을 건너뛰고 props의
 *   onChange를 직접 부르면 위젯이 값을 정제·절단하더라도 검사가 통과한다. 그래서
 *   **공용 위젯을 실제로 호출해** 그 안의 `<input>`까지 내려간다 — 화면과 같은 경로다.
 */
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
const widget = (h: ReturnType<typeof setup>, prefix: string) => {
  const label = h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(prefix));
  if (label === undefined) return null;
  return findInput(label.props.children);
};
const typeInto = (h: ReturnType<typeof setup>, prefix: string, v: string) => {
  const w = widget(h, prefix);
  if (w === null) throw new Error(`${prefix} 입력을 찾지 못했습니다`);
  w.props.onChange({ target: { value: v } });
};
const shown = (h: ReturnType<typeof setup>, prefix: string) => {
  const w = widget(h, prefix);
  return w === null ? null : String(w.props.value);
};
const PAID = "누적기간 내 기존 지급보험금";
const LIMIT = "증권상 연간 가입금액";
const CAUSE_SEL = "원인";
const COVERAGE_SEL = "급여 구분";
const VISIT_SEL = "치료 형태";
const RIDER_SEL = "3대 비급여";

const findSelect = (el: unknown): { props: { onChange: (e: unknown) => void; value?: unknown; disabled?: unknown } } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findSelect(c); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === "select" && typeof e.props?.onChange === "function") return e as never;
  return findSelect(e.props?.children);
};
const selectOf = (h: ReturnType<typeof setup>, prefix: string) => {
  const label = h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(prefix));
  return label === undefined ? null : findSelect(label.props.children);
};
/** 선택창의 **실제 onChange**를 통과시킨다. 비활성 선택창은 조작하지 않는다(우회 금지). */
const pick = (h: ReturnType<typeof setup>, prefix: string, value: string) => {
  const sel = selectOf(h, prefix);
  if (sel === null) throw new Error(`${prefix} 선택창을 찾지 못했습니다`);
  if (sel.props.disabled === true) throw new Error(`${prefix} 선택창이 비활성입니다(우회하지 않는다)`);
  sel.props.onChange({ target: { value } });
};
const selValue = (h: ReturnType<typeof setup>, prefix: string) => {
  const sel = selectOf(h, prefix);
  return sel === null ? null : String(sel.props.value);
};
const selDisabled = (h: ReturnType<typeof setup>, prefix: string) => {
  const sel = selectOf(h, prefix);
  return sel === null ? null : sel.props.disabled === true;
};
/**
 * **실제 선택창만으로** 목표 축까지 이동한다.
 *
 * ⚠ 급여 구분 선택창은 특약이 선택된 동안 비활성이다(기존 동작). 그래서 특약을 먼저
 *   "해당 없음"으로 되돌린 뒤 원인·급여 구분을 바꾸고, 마지막에 특약을 고른다 —
 *   사용자가 실제로 할 수 있는 순서다. 비활성 선택창을 우회하지 않는다.
 */
const go = (h: ReturnType<typeof setup>, cause: string, coverage: string, rider: string) => {
  if (selValue(h, RIDER_SEL) !== "none") pick(h, RIDER_SEL, "none");
  if (selValue(h, CAUSE_SEL) !== cause) pick(h, CAUSE_SEL, cause);
  if (selValue(h, COVERAGE_SEL) !== coverage) pick(h, COVERAGE_SEL, coverage);
  if (rider !== "none") pick(h, RIDER_SEL, rider);
};
/** 축 키 → 그 축에 도달하는 화면 선택. */
const SEL_OF: Record<string, [string, string, string]> = {
  injury_benefit: ["injury", "benefit", "none"],
  injury_non_benefit: ["injury", "non_benefit", "none"],
  disease_benefit: ["disease", "benefit", "none"],
  disease_non_benefit: ["disease", "non_benefit", "none"],
  manual_therapy: ["disease", "non_benefit", "manual_therapy"],
  injection: ["disease", "non_benefit", "injection"],
  mri: ["disease", "non_benefit", "mri"],
};
const goAxis = (h: ReturnType<typeof setup>, key: string) => go(h, ...SEL_OF[key]);

// ── 축 구성 ──────────────────────────────────────────────────────────
console.log("\n[축] 일반 4축 + 특약 3축, 두 입력은 서로 다른 상태다");
{
  const h = setup();
  const paid = h.get("priorPaidByAxis") as Record<string, string>;
  const limit = h.get("annualLimitByAxis") as Record<string, string>;
  check("지급보험금은 7축", Object.keys(paid).length === 7 && [...GENERAL, ...RIDERS].every((k) => k in paid),
    Object.keys(paid).join(","));
  check("가입금액은 일반 4축", Object.keys(limit).length === 4 && GENERAL.every((k) => k in limit),
    Object.keys(limit).join(","));
  check("지급보험금 초기값은 모든 축 \"0\"", Object.values(paid).every((v) => v === "0"));
  check("가입금액 초기값은 모든 축 빈 문자열", Object.values(limit).every((v) => v === ""));
  check("두 입력이 별도 상태다", paid !== (limit as unknown));
  check("축 키가 visit을 포함하지 않는다(입원·통원 합산)",
    !/paidAxis[^;\n]*visit|generalAxis[^;\n]*visit/.test(stripComments(ui)));
  check("특약 축이 cause·coverage를 포함하지 않는다(상해·질병 합산)",
    /const paidAxis: Gen2021PaidAxis = isRider \? \(rider as Gen2021RiderAxis\) : generalAxis;/.test(ui));
  check("일반 축이 원인 × 급여 구분이다",
    /const generalAxis: Gen2021GeneralAxis = `\$\{cause\}_\$\{coverage\}`;/.test(ui));
}

// ── 전이: 실제 선택창으로 모든 쌍 ────────────────────────────────────
console.log("\n[전이] 실제 선택창 onChange만으로 7축의 모든 출발→도착 쌍을 검사한다");
{
  const PAID_AXES = [...GENERAL, ...RIDERS] as readonly string[];
  const V: Record<string, string> = {
    injury_benefit: "1000", injury_non_benefit: "2000",
    disease_benefit: "3000", disease_non_benefit: "4000",
    manual_therapy: "5000", injection: "6000", mri: "7000",
  };
  const seed = () => {
    const h = setup({ priorOutVisits: "0", priorManualVisits: "0", priorInjectionVisits: "0" });
    for (const k of PAID_AXES) { goAxis(h, k); typeInto(h, PAID, V[k]); }
    return h;
  };
  const h0 = seed();
  check("선택창만으로 7축에 서로 다른 값이 들어간다",
    JSON.stringify(h0.get("priorPaidByAxis")) === JSON.stringify(V), JSON.stringify(h0.get("priorPaidByAxis")));
  let pairs = 0; const bad: string[] = [];
  for (const from of PAID_AXES) for (const to of PAID_AXES) {
    if (from === to) continue;
    pairs++;
    const h = seed();
    goAxis(h, from);
    const atFrom = shown(h, PAID);
    goAxis(h, to);
    const atTo = shown(h, PAID);
    goAxis(h, from);
    const back = shown(h, PAID);
    if (!(atFrom === V[from] && atTo === V[to] && back === V[from])) {
      bad.push(`${from}→${to}: ${atFrom}/${atTo}/${back}`);
    }
  }
  check(`지급보험금 ${pairs}개 쌍 모두 표시·복귀가 축을 따른다`, bad.length === 0, bad.slice(0, 4).join(" | "));
  check("검사한 쌍이 7축 전순열이다", pairs === 42, String(pairs));
}

console.log("\n[전이] 가입금액 일반 4축의 모든 쌍도 실제 선택창으로 검사한다");
{
  const V: Record<string, string> = {
    injury_benefit: "11000000", injury_non_benefit: "12000000",
    disease_benefit: "13000000", disease_non_benefit: "14000000",
  };
  const seed = () => {
    const h = setup({ priorOutVisits: "0" });
    for (const k of GENERAL) { goAxis(h, k); typeInto(h, LIMIT, V[k]); }
    return h;
  };
  const h0 = seed();
  check("선택창만으로 가입금액 4축에 서로 다른 값이 들어간다",
    JSON.stringify(h0.get("annualLimitByAxis")) === JSON.stringify(V), JSON.stringify(h0.get("annualLimitByAxis")));
  let pairs = 0; const bad: string[] = [];
  for (const from of GENERAL) for (const to of GENERAL) {
    if (from === to) continue;
    pairs++;
    const h = seed();
    goAxis(h, from);
    const atFrom = shown(h, LIMIT);
    goAxis(h, to);
    const atTo = shown(h, LIMIT);
    goAxis(h, from);
    const back = shown(h, LIMIT);
    if (!(atFrom === V[from] && atTo === V[to] && back === V[from])) bad.push(`${from}→${to}: ${atFrom}/${atTo}/${back}`);
  }
  check(`가입금액 ${pairs}개 쌍 모두 표시·복귀가 축을 따른다`, bad.length === 0, bad.slice(0, 4).join(" | "));
  check("검사한 쌍이 4축 전순열이다", pairs === 12, String(pairs));
  for (const r of RIDERS) {
    const h = seed();
    goAxis(h, r);
    check(`특약(${r})에는 가입금액 입력이 노출되지 않는다`, widget(h, LIMIT) === null);
  }
  //   ⚠ 엔진 호출 인자 뭉치를 하나씩 잘라서 본다. 창을 글자수로 잡으면 앞뒤 분기가 섞여 오탐한다.
  const callArgs = ui.split("calculateMany2021({").slice(1).map((c) => c.slice(0, c.indexOf("} satisfies")));
  check("엔진 호출이 6개 분기 그대로다", callArgs.length === 6, String(callArgs.length));
  check("가입금액은 rider: \"none\" 분기에만 실린다",
    callArgs.every((a) => !a.includes("annualCoverageLimit") || a.includes('rider: "none"'))
    && callArgs.filter((a) => a.includes("annualCoverageLimit")).length === 3);
  check("특약 분기에는 가입금액이 없다",
    callArgs.filter((a) => /rider: "(manual_therapy|injection|mri)"/.test(a))
      .every((a) => !a.includes("annualCoverageLimit")));
}

// ── 급여 구분 선택창은 특약 동안 비활성이다(우회 금지) ────────────────
console.log("\n[순서] 특약 동안 급여 선택창은 비활성이고, 일반으로 돌아온 뒤에만 바뀐다");
{
  const h = setup({ priorOutVisits: "0", priorManualVisits: "0" });
  check("일반에서는 급여 선택창이 활성", selDisabled(h, COVERAGE_SEL) === false);
  pick(h, RIDER_SEL, "manual_therapy");
  check("특약을 고르면 급여 선택창이 비활성", selDisabled(h, COVERAGE_SEL) === true);
  let blocked = false;
  try { pick(h, COVERAGE_SEL, "benefit"); } catch { blocked = true; }
  check("비활성 선택창을 우회하지 않는다", blocked && selValue(h, COVERAGE_SEL) === "non_benefit");
  pick(h, RIDER_SEL, "none");
  check("일반으로 돌아오면 다시 활성", selDisabled(h, COVERAGE_SEL) === false);
  pick(h, COVERAGE_SEL, "benefit");
  check("그때서야 급여로 바뀐다", selValue(h, COVERAGE_SEL) === "benefit");
}

// ── 같은 축 안에서는 값이 유지된다 (실제 선택창) ─────────────────────
console.log("\n[합산] 같은 보장축 안에서는 값이 유지된다 — 실제 선택창으로 확인");
{
  const h = setup({ priorOutVisits: "0" });
  goAxis(h, "disease_non_benefit");
  typeInto(h, PAID, "1234000"); typeInto(h, LIMIT, "20000000");
  pick(h, VISIT_SEL, "inpatient");
  check("일반 통원→입원: 지급보험금 유지", shown(h, PAID) === "1234000", String(shown(h, PAID)));
  check("일반 통원→입원: 가입금액 유지", shown(h, LIMIT) === "20000000", String(shown(h, LIMIT)));
  check("치료 형태 선택창이 실제로 바뀌었다", selValue(h, VISIT_SEL) === "inpatient");
  pick(h, VISIT_SEL, "outpatient");
  check("일반 입원→통원 복귀: 둘 다 유지",
    shown(h, PAID) === "1234000" && shown(h, LIMIT) === "20000000");

  goAxis(h, "manual_therapy");
  typeInto(h, PAID, "2500000");
  pick(h, CAUSE_SEL, "injury");
  check("특약 질병→상해: 지급보험금 유지(상해·질병 합산)", shown(h, PAID) === "2500000", String(shown(h, PAID)));
  check("원인 선택창이 실제로 바뀌었다", selValue(h, CAUSE_SEL) === "injury");
  pick(h, CAUSE_SEL, "disease");
  check("특약 상해→질병 복귀: 유지", shown(h, PAID) === "2500000");
  for (const r of ["injection", "mri"] as const) {
    const g = setup({ priorOutVisits: "0", priorInjectionVisits: "0" });
    goAxis(g, r);
    typeInto(g, PAID, "990000");
    pick(g, CAUSE_SEL, "injury");
    check(`특약 ${r} 질병→상해: 유지`, shown(g, PAID) === "990000", String(shown(g, PAID)));
  }
}

// ── 숨은 축이 결과를 바꾸지 않는다 ───────────────────────────────────
console.log("\n[격리] 숨겨진 다른 축의 값이 현재 결과에 영향을 주지 않는다");
{
  // 재현했던 결함: 도수에 340만 → MRI로 전환하면 MRI 300만 한도가 소진돼 0원이 됐다.
  const clean = setup({ priorOutVisits: "0", amounts: ["300000", "300000"] });
  go(clean, "disease", "non_benefit", "mri");
  const cleanPay = screenOf(clean).pay;
  const dirty = setup({ priorOutVisits: "0", priorManualVisits: "0", amounts: ["300000", "300000"] });
  go(dirty, "disease", "non_benefit", "manual_therapy");
  typeInto(dirty, PAID, "3400000");
  go(dirty, "disease", "non_benefit", "mri");
  const dirtyPay = screenOf(dirty).pay;
  check("도수에 340만을 넣어도 MRI 결과가 바뀌지 않는다",
    dirtyPay === cleanPay && cleanPay !== null && cleanPay !== "0원", `${dirtyPay} vs ${cleanPay}`);
  check("MRI 화면의 지급보험금은 MRI 축 값(0)이다", shown(dirty, PAID) === "0", String(shown(dirty, PAID)));
  // 일반 축도 서로 격리된다.
  const g = setup({ priorOutVisits: "0", amounts: ["300000"] });
  go(g, "disease", "non_benefit", "none");
  typeInto(g, LIMIT, "100000"); typeInto(g, PAID, "90000");
  const dPay = screenOf(g).pay;
  go(g, "injury", "non_benefit", "none");
  const iPay = screenOf(g).pay;
  check("질병 축의 가입금액·지급액이 상해 축 결과를 바꾸지 않는다",
    dPay !== iPay && shown(g, LIMIT) === "" && shown(g, PAID) === "0", `${dPay} vs ${iPay}`);
  const base = setup({ priorOutVisits: "0", amounts: ["300000"] });
  go(base, "injury", "non_benefit", "none");
  check("상해 축 결과가 아무 값도 넣지 않은 기준과 같다", iPay === screenOf(base).pay);
}

// ── 결과가 같아도 상태는 분리돼 있다 ─────────────────────────────────
console.log("\n[분리] 결과 차이가 없는 전환도 표시·전달값으로 분리를 확인한다");
{
  const h = setup({ priorOutVisits: "0", amounts: ["300000"] });
  go(h, "disease", "non_benefit", "none");
  typeInto(h, PAID, "0"); typeInto(h, LIMIT, "");
  const a = screenOf(h).pay;
  go(h, "disease", "benefit", "none");
  typeInto(h, PAID, "777000");
  go(h, "disease", "non_benefit", "none");
  check("급여 축에 값을 넣어도 비급여 결과가 그대로다", screenOf(h).pay === a, `${screenOf(h).pay} vs ${a}`);
  check("표시값으로 분리가 확인된다(비급여 0 / 급여 777000)",
    shown(h, PAID) === "0" && (h.get("priorPaidByAxis") as Record<string, string>).disease_benefit === "777000");
}

// ── 라벨 ─────────────────────────────────────────────────────────────
console.log("\n[라벨] 현재 보장축을 밝힌다");
{
  const cases: [string, string, string, string][] = [
    ["injury", "benefit", "none", "상해·급여"],
    ["injury", "non_benefit", "none", "상해·비급여"],
    ["disease", "benefit", "none", "질병·급여"],
    ["disease", "non_benefit", "none", "질병·비급여"],
  ];
  for (const [cause, coverage, rider, want] of cases) {
    const h = setup({ priorOutVisits: "0" });
    go(h, cause, coverage, rider);
    const ls = screenOf(h).labels;
    check(`일반 ${want}: 두 라벨이 축을 밝힌다`,
      ls.some((l) => l.startsWith(`${PAID} (${want} 보장축)`)) && ls.some((l) => l.startsWith(`${LIMIT} (${want} 보장축)`)),
      ls.filter((l) => l.startsWith(PAID) || l.startsWith(LIMIT)).map((l) => l.slice(0, 40)).join(" | "));
  }
  const riderLabels: [string, string][] = [
    ["manual_therapy", "도수·체외충격파·증식치료"], ["injection", "비급여 주사료"], ["mri", "비급여 MRI·MRA"],
  ];
  for (const [r, want] of riderLabels) {
    const h = setup({ priorOutVisits: "0", priorManualVisits: "0", priorInjectionVisits: "0" });
    go(h, "disease", "non_benefit", r);
    check(`특약 ${want}: 라벨이 항목 축을 밝힌다`,
      screenOf(h).labels.some((l) => l.startsWith(`${PAID} (${want})`)),
      screenOf(h).labels.filter((l) => l.startsWith(PAID)).map((l) => l.slice(0, 40)).join(" | "));
    check(`특약 ${want}: 상해·질병 합산임을 밝힌다`,
      screenOf(h).labels.some((l) => l.startsWith(PAID) && l.includes("각 상해·질병 치료행위를 합산")));
  }
}

// ── 유지해야 할 계약 ─────────────────────────────────────────────────
console.log("\n[무회귀] 파서·초기값·상한·기존 동작은 그대로다");
{
  // ⚠ G-6이 금액 두 축의 파서를 `digits()`에서 `gen2021Money`로 바꿨다. 축 분리(G-5)
  //   계약은 그대로여야 하므로, 여기서는 **활성 축의 값이 그대로 전달되는지**를 본다.
  check("복제 횟수는 여전히 digits()다(범위 밖)",
    /const digits = \(v: string\) => Number\(v\.replace\(\/\[\^0-9\]\/g, ""\)\) \|\| 0;/.test(ui)
    && /Math\.min\(100, digits\(copyCount\)\)/.test(ui));
  check("지급보험금은 활성 축 값 하나만 전달한다",
    /priorAnnualRiderPaid: isRider \? money\.priorPaid : undefined,/.test(ui)
    && (ui.match(/priorAnnualInsurancePaid: money\.priorPaid,/g) ?? []).length === 3
    && /const priorPaidNum = priorPaid === "" \? 0 : gen2021Money\(priorPaid\);/.test(ui));
  check("가입금액의 빈 값 미적용 정책 그대로",
    /const annualLimitNum = isRider \|\| annualLimit === "" \? undefined : gen2021Money\(annualLimit\);/.test(ui)
    && (ui.match(/annualCoverageLimit: money\.annualLimit,/g) ?? []).length === 3);
  check("특약 선택 시 급여 선택창 비활성화가 그대로",
    /value=\{coverage\} onChange=\{\(e\) => setCoverage\(e\.target\.value as Coverage\)\} disabled=\{isRider\}/.test(ui));
  check("coverage 상태를 강제로 바꾸지 않는다",
    (stripComments(ui).match(/setCoverage\(/g) ?? []).length === 1);
  check("횟수 축 상태는 그대로 분리돼 있다",
    /const \[priorOutVisits, setPriorOutVisits\] = useState\(""\);/.test(ui)
    && /const \[priorManualVisits, setPriorManualVisits\] = useState\(""\);/.test(ui)
    && /const \[priorInjectionVisits, setPriorInjectionVisits\] = useState\(""\);/.test(ui));
  check("승인 회차 축 그대로", /approvedThroughVisit: approvedThrough === "" \? undefined : approvedThrough/.test(ui));
  check("진료비·복제 계약 그대로",
    /const gen2021Amount = \(v: string\): number \| null =>/.test(ui)
    && /const copySourceInvalid = gen2021Amount\(amounts\[0\] \?\? ""\) === null;/.test(ui)
    && /Math\.max\(1, Math\.min\(100, digits\(copyCount\)\)\)/.test(ui));

  // 상한 적용과 기존 계산은 그대로 — 축 하나만 쓰는 계산은 종전과 같은 값이다.
  //   축 이동은 여기서도 실제 선택창으로만 한다.
  const one = (axis: string) => {
    const h = setup({ priorOutVisits: "0", amounts: ["300000"] });
    goAxis(h, axis);
    return screenOf(h);
  };
  check("비급여 통원 기본 계산", one("disease_non_benefit").pay === "200,000원", String(one("disease_non_benefit").pay));
  check("급여 통원 기본 계산", one("disease_benefit").pay === "200,000원", String(one("disease_benefit").pay));
  const capped = setup({ priorOutVisits: "0", amounts: ["300000"] });
  go(capped, "disease", "non_benefit", "none");
  typeInto(capped, LIMIT, "100000");
  check("가입금액 한도가 그대로 적용된다", screenOf(capped).pay === "100,000원", String(screenOf(capped).pay));
  typeInto(capped, LIMIT, "99999999999");
  check("약관상 5천만 상한 클램프가 그대로", screenOf(capped).pay === "200,000원", String(screenOf(capped).pay));
  // ⚠ 종전에는 `abc`가 digits()에서 0이 되어 **한도 미적용**으로 계산됐다(200,000원).
  //   G-6이 이를 차단으로 바꿨다 — 이번에 승인한 의도된 동작 변경이다.
  typeInto(capped, LIMIT, "abc");
  check("무효 가입금액은 이제 차단된다(G-6)", screenOf(capped).pay === null);
  typeInto(capped, LIMIT, "");
  typeInto(capped, PAID, "49900000");
  check("지급보험금 누적의 종전 처리 그대로(가입금액 없으면 미적용)", screenOf(capped).pay === "200,000원");
}

console.log(`\n[4세대 누적 금액 축 분리] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
