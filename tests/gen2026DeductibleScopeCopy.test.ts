// G-14A — 500만원 공제금액 상한의 **적용 범위**를 화면에서 단정하지 않게 한다.
//
// 배경(2026-09-05 별표15 2026.5.6 공포·시행본 특별약관1 제5조⑤ 직독, 인쇄 p.280):
//   "제3조(보장종목별 보상내용)에서 정한 입원의 경우 상급종합병원·종합병원의 상해·질병 및
//    3대비급여 의료비(3대비급여 중 근골격계 이학요법치료·체외충격파치료 및 주사료 관련
//    비급여의료비는 제외) 중 공제금액이 계약일 또는 매년 계약해당일부터 기산하여 연간
//    500만원을 초과하는 때에는 500만원까지 공제합니다."
//   같은 조 제1항은 연간 보험가입금액을 상해·질병으로, 제3항은 3대비급여를 "각 비급여의료비별
//   보장한도"로 **나눌 때는 나눈다고 적는데** 제5항에는 그런 분배 문언이 없다.
//
//   그런데 종전 화면은 상단 문단에서 "기존 지급보험금·**누적 공제금액**이 같은 원인 보장축의
//   것이어야 하며"라고, 무효 경고에서는 "(중증 상해비급여 보장축)"이라고 **원인 축을 단정**했다.
//   원문에 근거가 없을 뿐 아니라 `priorDeductible`은 애초에 축별 상태가 아니라 단일 상태라
//   화면 안내와 상태 구조가 서로 반대를 말하고 있었다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것을 섞지 않는다.
//   - 한다: 화면에서 축 단정을 빼고 중립 안내를 붙인다. 규칙 등록부에 HOLD를 남긴다.
//   - 하지 않는다: `priorDeductible`·`priorPool`을 합치거나 축별로 새로 나누지 않는다.
//     500만원 값·산식·엔진·전달 조건·노출 조건을 바꾸지 않는다. HOLD를 이유로 계산을
//     막거나 두 번 실행하지 않는다. "약관상 하나의 pool"이라고도 "서로 독립"이라고도
//     화면에서 단정하지 않는다.
//
// ⚠ 금지 표현은 **렌더된 화면 텍스트**로만 판정한다. 소스 문자열로 검사하면 이 주석에 적힌
//   종전 문구 자체가 걸린다(G-12·G-13A·G-13C에서 반복해 겪은 실패다).
import { readFileSync } from "node:fs";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { GEN2026 } from "../src/lib/insurance/engine/constants";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const UI_PATH = "src/components/calculators/HealthCalcMulti2026.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);

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
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const rawInput = (n: { props: Record<string, unknown> }) =>
  findIn((RawAmountInput as unknown as (q: never) => unknown)(n.props as never), "input");
const typeById = (h: H, id: string, v: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === id);
  if (n === undefined) throw new Error("입력을 찾지 못했습니다: " + id);
  const w = rawInput(n as unknown as { props: Record<string, unknown> });
  (w!.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shownById = (h: H, id: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === id);
  return n === undefined ? null : String(n.props.value);
};
const rowLabels = (h: H, p: string) => h.render().nodes.filter((n: RenderedNode) => n.tag === "label" && n.text.startsWith(p));
const setRow = (h: H, kind: string, i: number, v: string) => {
  const s = findIn(rowLabels(h, kind)[i]?.props.children, "select");
  if (s === null) throw new Error(`${i + 1}번째 행 ${kind} 선택창이 없습니다`);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
/** 화면에 실제로 렌더된 전체 텍스트. 주석은 포함되지 않는다. */
const screenText = (h: H) => h.render().nodes.map((n: RenderedNode) => n.text).join(" ");
const payOf = (h: H) => { const it = h.render().resultItems(); return it === null ? null : (it[2]?.value ?? null); };
const warnText = (h: H) => h.render().nodes
  .filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning")
  .map((n: RenderedNode) => n.text).join(" || ");

const NEUTRAL = "상해·질병 및 다른 보장종목 청구와의 합산 범위는 가입한 상품의 약관과 보험사 안내를 확인하세요.";
const DEDUCT_ID = "gen2026-prior-deductible";
const POOL_ID = "gen2026-prior-pool";
const DEDUCT_LABEL = "계약해당일 기준 1년간 이미 누적된 공제금액";
const POOL_LABEL = "계약해당일 기준 1년간 이미 누적된 공제금액 (500만 원 상한)";
const COV = "급여 구분", ITEM = "치료유형", SEV = "질환 구분", VIS = "치료 형태", TIER = "입원 의료기관", CAUSE = "원인";

/** 일반 (1)(2) 중증 입원 상급종합·종합 — `priorDeductible`이 노출·전달되는 유일한 조합. */
const generalPath = (h: H) => {
  pick(h, COV, "non_benefit"); pick(h, ITEM, "general"); pick(h, SEV, "critical");
  pick(h, CAUSE, "injury"); pick(h, VIS, "inpatient"); pick(h, TIER, "hospital");
  typeById(h, "gen2026-amount-0", "2000000"); typeById(h, "gen2026-amount-1", "0");
  typeById(h, "gen2026-prior-insurance", "0");
  return h;
};
/** 중증 MRI — 두 행 모두 상급종합·종합 입원이라 `priorPool`이 노출·전달된다. */
const mriPath = (h: H) => {
  pick(h, COV, "non_benefit"); pick(h, ITEM, "mri"); pick(h, SEV, "critical");
  typeById(h, "gen2026-row-amount-0", "2000000"); typeById(h, "gen2026-row-amount-1", "0");
  typeById(h, "gen2026-prior-insurance", "0");
  setRow(h, "치료 형태", 0, "inpatient"); setRow(h, "의료기관", 0, "hospital");
  setRow(h, "치료 형태", 1, "inpatient"); setRow(h, "의료기관", 1, "hospital");
  return h;
};

console.log("\n[G-14A 공제금액 적용 범위] 화면에서 축을 단정하지 않는다");
{
  const h = generalPath(setup());
  const t = screenText(h);
  // 종전 단정. 지급보험금 쪽 축 안내(제5조① 근거 있음)는 그대로 두고 공제금액만 뺀다.
  check("상단 문단에서 '지급보험금·누적 공제금액' 묶음이 사라짐",
    !t.includes("기존 지급보험금·누적 공제금액"), t.slice(0, 200));
  check("지급보험금의 원인 축 안내는 그대로 남음",
    t.includes("기존 지급보험금이 같은 원인 보장축의 것이어야 하며"));
  check("연간 보험가입금액이 상해·질병 각각이라는 사실은 유지",
    t.includes("상해비급여·질병비급여 각각에 대해 따로"));
  check("별도 보장종목이 상해·질병 합산이라는 사실도 유지",
    t.includes("한도는 상해와 질병을 합산하므로 원인을 나누지 않습니다"));
  check("공제금액은 축 구분과 별개라고 안내",
    t.includes("누적 공제금액(500만 원 상한)은 이 축 구분과 별개"));
}

console.log("\n[G-14A 공제금액 적용 범위] 두 칸에 같은 중립 안내");
{
  // ⚠ 화면 전체 텍스트가 아니라 **그 입력의 <label> 안**에 있는지 본다. 전체 텍스트로 보면
  //   안내를 다른 곳으로 옮기거나 숨겨도 검사가 통과한다(변조 3에서 실제로 뚫렸다).
  const g = generalPath(setup());
  const gl = labelOf(g, DEDUCT_LABEL);
  check("일반 경로: 공제금액 칸이 그대로 노출", shownById(g, DEDUCT_ID) === "0" && gl !== undefined);
  check("일반 경로: 중립 안내가 그 칸의 라벨 안에 있음", Boolean(gl?.text.includes(NEUTRAL)), gl?.text ?? "");
  check("일반 경로: 입력값을 현재 경로에 적용한다고만 말함",
    Boolean(gl?.text.includes("계산기는 입력한 값을 현재 계산 경로에 적용합니다")));

  const m = mriPath(setup());
  const ml = labelOf(m, POOL_LABEL);
  check("중증 MRI: pool 칸이 그대로 노출", shownById(m, POOL_ID) === "0" && ml !== undefined);
  check("중증 MRI: 같은 중립 안내가 그 칸의 라벨 안에 있음", Boolean(ml?.text.includes(NEUTRAL)), ml?.text ?? "");

  // 라벨이 같은 두 입력이 서로 다른 규칙을 따르는 것처럼 보이면 안 된다.
  check("두 칸의 안내 문장이 동일",
    Boolean(gl?.text.includes(NEUTRAL)) && Boolean(ml?.text.includes(NEUTRAL)));
}

console.log("\n[G-14A 공제금액 적용 범위] 금지 표현 — 렌더 텍스트 기준");
{
  const screens = [screenText(generalPath(setup())), screenText(mriPath(setup()))];
  const BANNED = [
    // 종전 단정
    "기존 지급보험금·누적 공제금액",
    "누적 공제금액이 같은 원인 보장축",
    // 반대 방향으로의 단정도 금지다. 합산 범위는 HOLD다.
    "약관상 하나의 pool",
    "하나의 500만 원 한도로 합산",
    "다른 보장종목의 공제금액도 모두 합쳐",
    "서로 독립적으로 적용됩니다",
    "각각 500만 원까지 공제",
  ];
  for (const b of BANNED) {
    check(`화면에 단정 표현 없음: ${b}`, screens.every((s) => !s.includes(b)));
  }
}

console.log("\n[G-14A 공제금액 적용 범위] 무효 경고에서 축 라벨 제거");
{
  const h = generalPath(setup());
  typeById(h, DEDUCT_ID, "abc");
  const w = warnText(h);
  check("무효 경고가 뜬다", w.includes("이미 누적된 공제금액"));
  check("경고에 '보장축' 라벨이 없다", !w.includes("보장축"), w.slice(0, 160));
  check("경고가 적용 조건만 표시", w.includes("이미 누적된 공제금액(중증 비급여 입원, 500만 원 상한)"));
  check("경고가 종전 형식 규칙을 그대로 유지",
    w.includes("0 이상의 정수") && w.includes("500만 원을 넘는 값도 그대로 받습니다"));
  check("무효일 때 계산은 여전히 차단", payOf(h) === null);
}

console.log("\n[G-14A 공제금액 적용 범위] 계산 무회귀 — 값·전달·소진 조건 불변");
{
  // 진료비 2,000,000 · 공제 = Max(3만, 30%) = 600,000 → 보험금 1,400,000.
  // 누적 4,900,000이면 잔여 100,000까지만 공제 → 1,900,000.
  const g0 = generalPath(setup());
  check("일반: 누적 0이면 종전대로", payOf(g0) === "1,400,000원", String(payOf(g0)));
  const g1 = generalPath(setup()); typeById(g1, DEDUCT_ID, "4900000");
  check("일반: 누적 4,900,000이면 잔여까지만 공제", payOf(g1) === "1,900,000원", String(payOf(g1)));
  const g2 = generalPath(setup()); typeById(g2, DEDUCT_ID, "5000001");
  check("일반: 500만 원 초과 입력도 잔여 0으로 클램프", payOf(g2) === "2,000,000원", String(payOf(g2)));

  const m0 = mriPath(setup());
  check("중증 MRI: 누적 0이면 종전대로", payOf(m0) === "1,400,000원", String(payOf(m0)));
  const m1 = mriPath(setup()); typeById(m1, POOL_ID, "4900000");
  check("중증 MRI: 누적 4,900,000이면 잔여까지만 공제", payOf(m1) === "1,900,000원", String(payOf(m1)));

  // 소진 대상이 아닌 구성에서는 칸도 없고 결과도 종전 그대로다.
  const m2 = mriPath(setup()); typeById(m2, POOL_ID, "4900000");
  setRow(m2, "의료기관", 0, "clinic"); setRow(m2, "의료기관", 1, "clinic");
  check("중증 MRI 병·의원급: 칸이 사라지고 결과 불변", shownById(m2, POOL_ID) === null && payOf(m2) === "1,400,000원", String(payOf(m2)));
  setRow(m2, "치료 형태", 0, "inpatient"); setRow(m2, "의료기관", 0, "hospital");
  setRow(m2, "치료 형태", 1, "inpatient"); setRow(m2, "의료기관", 1, "hospital");
  check("중증 MRI 복귀: 원문과 결과가 복원", shownById(m2, POOL_ID) === "4900000" && payOf(m2) === "1,900,000원");
}

console.log("\n[G-14A 공제금액 적용 범위] 상태·전달 구조 불변 [소스]");
{
  check("두 상태가 여전히 따로 있고 합쳐지지 않음",
    /const \[priorDeductible, setPriorDeductible\] = useState\("0"\);/.test(ui)
    && /const \[priorPool, setPriorPool\] = useState\("0"\);/.test(ui));
  check("축별 Record로 새로 나누지 않음",
    !/setPriorDeductibleByAxis/.test(ui) && !/priorDeductibleByAxis/.test(ui)
    && !/priorPoolByAxis/.test(ui));
  check("두 값을 더해 전달하지 않음",
    !/deductibles\.general \+ deductibles\.pool/.test(ui)
    && !/deductibles\.pool \+ deductibles\.general/.test(ui));
  check("전달식이 종전 그대로",
    /priorAnnualDeductible: deductibles\.general,/.test(ui)
    && /priorAnnualInpatientDeductible: deductibles\.pool,/.test(ui));
  check("노출 조건이 종전 그대로",
    /const usesPriorDeductible = showGeneralForm && generalAxis !== null\s*\n\s*&& severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";/.test(ui)
    && /const usesPriorPool = showSpecialForm && severity === "critical" && specialItem === "mri"\s*\n\s*&& rows\.some\(\(r\) => r\.visit === "inpatient" && r\.tier === "hospital"\);/.test(ui));
  check("파서·빈 값 처리가 종전 그대로",
    /priorDeductible === "" \? 0 : gen2026Money\(priorDeductible\)/.test(ui)
    && /priorPool === "" \? 0 : gen2026Money\(priorPool\)/.test(ui));
}

console.log("\n[G-14A 공제금액 적용 범위] 규칙 등록부 연계");
{
  const scope = REGULATORY_RULES.GEN2026_CRITICAL_DEDUCTIBLE_POOL_SCOPE;
  const cap = REGULATORY_RULES.GEN2026_CRITICAL_ANNUAL_DEDUCTIBLE_CAP;
  check("공유 범위는 HOLD로 등록", scope.status === "HOLD" && scope.value === null);
  check("500만 원 값과 상수는 그대로",
    cap.value === 5_000_000 && GEN2026.nonBenefit.critical.annualDeductibleCap === 5_000_000);
  // HOLD는 기록이지 게이트가 아니다. 이것이 깨지면 사용자가 결과를 아예 못 본다.
  check("HOLD가 계산을 막지 않음", payOf(generalPath(setup())) === "1,400,000원");
  check("HOLD가 계산을 두 번 실행하지 않음", payOf(mriPath(setup())) === "1,400,000원");
}

console.log(`\n[G-14A 공제금액 적용 범위] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
