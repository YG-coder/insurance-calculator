// G-8 항목 X — 5세대 다회의 **누적 금액 입력을 보장축별로 분리**한다.
//
// 종전 동작: "기존 지급보험금"·"연간 보험가입금액"·"통원 가입금액"이 각각 **하나의 상태**였다.
//   질환 구분·원인·치료유형을 바꿔도 값이 그대로 남아 **다른 보장종목의 한도에 적용**됐다.
//   기준선 `e591ffd`를 실제로 실행해 재현한 사례:
//     일반 중증(연 5천만 축)에 기존 지급 900만 → 특약 중증 근골격계(연 350만 축)로 전환하면
//       값이 그대로 남아 보험금이 **0원**(정상 70만원).
//     질병 축의 기존 지급 4,950만 → 상해로 전환해도 남아 보험금 50만원(정상 210만원).
//     비중증 연간 1천만 → 중증으로 전환해도 남아 보험금 1,000만원(정상 3,500만원).
//     중증 통원 1회당 20만 → 비중증으로 전환해도 남아 보험금 20만원(정상 25만원).
//
// 축 구성은 별표15 **2026.5.6 판본 직독** 결과다(2026-09-04 재확인, 인쇄 p.279·280·308·309).
//   특약1 제5조①(p.279)·특약2 제5조①(p.308) — "(1)상해비급여에 대하여 입원과 통원의
//     보상금액을 합산하여 5천만원(비중증 1천만원) 이내에서, (2)질병비급여에 대하여 … 이내에서"
//     + 단서 "(3)3대비급여(비급여 자기공명영상진단)의 보험가입금액은 제3조(3)제1항에서 정한
//     연간 보장한도로 합니다."
//   특약1 제5조③(p.280)·특약2 제5조③(p.309) — "통원의 경우 (1)상해비급여 또는 (2)질병비급여
//     **각각에 대하여** 통원 1회당(1일당) 20만원 이내 … (3)…의 경우 각 비급여의료비별 보장한도"
//   <표1> — 별도 보장종목은 "각 상해·질병 치료행위를 합산"한다.
//   ⇒ 일반은 **질환 구분 × 원인 4축**, 축 안에서 **입원·통원 합산**.
//      별도 보장종목은 **항목 4축**(중증 근골격계·중증 주사료·중증 MRI·비중증 MRI),
//      축 안에서 **상해·질병 합산**.
//
// ⚠ 일반 직접 경로·**일반 전환 경로**·**상급병실료**는 (1)(2)에 귀속되므로 같은 일반 축을
//   공유한다. 이는 **보장종목 귀속에 따른 해석**이며 새 명문을 확인한 것이 아니다.
// ⚠ 이번은 **상태 분리만** 다룬다. 초기값("0" / 빈 문자열), 빈 값·0 처리, 파서 `num()`,
//   엔진·타입·규칙값·산식·횟수·승인 회차·진료비 게이트·상급병실료 파서·기존 HOLD는 무변경.
// ⚠ `priorDeductible`·`priorPool`의 상태·전달·계산도 이번에 바꾸지 않는다.
//   두 화면이 별도 상태라는 사실과, 엔진이 500만원 상한을 실제로 어떻게 적용하는지는
//   별개 문제다. 어느 쪽도 이 커밋에서 확정하지 않는다(설계 문서의 후속 조사 항목 참조).
import { readFileSync } from "node:fs";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
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
const setup = () => {
  const h = mount(HealthCalcMulti2026 as unknown as Comp, names);
  h.set("submitted", true);
  return h;
};
type H = ReturnType<typeof setup>;

const findIn = (el: unknown, t: string): { props: Record<string, unknown> } | null => {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const c of el) { const r = findIn(c, t); if (r !== null) return r; } return null; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === t && typeof e.props?.onChange === "function") return e as never;
  return findIn(e.props?.children, t);
};
const labelOf = (h: H, p: string) =>
  h.render().nodes.find((n: RenderedNode) => n.tag === "label" && n.text.startsWith(p));
/** 실제 선택창 핸들러를 통과시킨다. 없거나 비활성이면 예외 — 우회하지 않는다. */
const pick = (h: H, p: string, v: string) => {
  const l = labelOf(h, p);
  const s = l === undefined ? null : findIn(l.props.children, "select");
  if (s === null) throw new Error(`선택창을 찾지 못했습니다: ${p}`);
  if (s.props.disabled === true) throw new Error(`선택창이 비활성입니다(우회하지 않는다): ${p}`);
  (s.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const typeInto = (h: H, p: string, v: string) => {
  const l = labelOf(h, p);
  const i = l === undefined ? null : findIn(l.props.children, "input");
  if (i === null) throw new Error(`입력을 찾지 못했습니다: ${p}`);
  (i.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shown = (h: H, p: string) => {
  const l = labelOf(h, p);
  const i = l === undefined ? null : findIn(l.props.children, "input");
  return i === null ? null : String(i.props.value);
};
const has = (h: H, p: string) => labelOf(h, p) !== undefined;
const pay = (h: H) => { const it = h.render().resultItems(); return it === null ? null : (it[2]?.value ?? null); };
const warns = (h: H) => h.render().nodes
  .filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning")
  .map((n) => String(n.text)).join(" || ");

const COV = "급여 구분", ITEM = "치료유형", SEV = "질환 구분", PUR = "약제 용도";
const VIS = "치료 형태", TIER = "입원 의료기관", CAUSE = "원인";
const PRIOR = "계약해당일 기준 1년간 기존 지급보험금";
const PRIOR_ITEM = "계약해당일 기준 1년간 이 보장종목의 기존 지급보험금";
const ANNUAL = "연간 보험가입금액";
const OUTLIMIT = "통원 가입금액";
const DEDUCT = "계약해당일 기준 1년간 이미 누적된 공제금액";
/** 지급보험금 칸은 경로마다 라벨 접두사가 다르다. 활성 축 하나만 있어야 한다. */
const priorLabel = (h: H) => has(h, PRIOR_ITEM) ? PRIOR_ITEM : has(h, PRIOR) ? PRIOR : null;
const priorShown = (h: H) => { const p = priorLabel(h); return p === null ? null : shown(h, p); };
const priorType = (h: H, v: string) => {
  const p = priorLabel(h);
  if (p === null) throw new Error("지급보험금 입력이 없습니다");
  typeInto(h, p, v);
};

/** 8축 진입 — 전부 실제 선택창을 거친다. 급여로 한 번 돌아갔다 오므로 숨은 선택창을 우회하지 않는다. */
type Axis =
  | "general_critical_injury" | "general_critical_disease"
  | "general_non_critical_injury" | "general_non_critical_disease"
  | "item_msk_critical" | "item_injection_critical" | "item_mri_critical" | "item_mri_non_critical";
const ALL_AXES: Axis[] = [
  "general_critical_injury", "general_critical_disease",
  "general_non_critical_injury", "general_non_critical_disease",
  "item_msk_critical", "item_injection_critical", "item_mri_critical", "item_mri_non_critical",
];
const GENERAL_AXES = ALL_AXES.filter((a) => a.startsWith("general_"));
/** 별도 보장종목 4축은 항목·질환 구분으로만 정해진다(원인은 축을 가르지 않는다). */
const ITEM_SEL: Record<string, [string, string, string | null]> = {
  item_msk_critical: ["musculoskeletal_esw", "critical", null],
  item_injection_critical: ["injection", "critical", "general"],
  item_mri_critical: ["mri", "critical", null],
  item_mri_non_critical: ["mri", "non_critical", null],
};
/** ⚠ 축 키를 문자열로 쪼개지 않는다 — "general_non_critical_injury"에도 "_critical_"이
 *   들어 있어 잘못 읽힌다. 선택창에 넣을 값을 표로 명시한다. */
const GENERAL_SEL: Record<string, [string, string]> = {
  general_critical_injury: ["critical", "injury"],
  general_critical_disease: ["critical", "disease"],
  general_non_critical_injury: ["non_critical", "injury"],
  general_non_critical_disease: ["non_critical", "disease"],
};
const goAxis = (h: H, axis: Axis, opts: { cause?: string; visit?: string } = {}) => {
  pick(h, COV, "benefit");            // 항상 급여를 거쳐 초기화한다
  pick(h, COV, "non_benefit");
  if (axis.startsWith("general_")) {
    const [severity, defaultCause] = GENERAL_SEL[axis];
    const cause = opts.cause ?? defaultCause;
    pick(h, ITEM, "general");
    pick(h, SEV, severity);
    pick(h, CAUSE, cause);
    pick(h, VIS, opts.visit ?? "outpatient");
    if ((opts.visit ?? "outpatient") === "inpatient") pick(h, TIER, "hospital");
    h.set("priorVisits", "0"); h.set("priorOutDays", "0");
  } else {
    const [item, sev, purpose] = ITEM_SEL[axis];
    pick(h, ITEM, item);
    pick(h, SEV, sev);
    if (purpose !== null) pick(h, PUR, purpose);
    h.set("priorActs", "0");
    h.set("rows", [{ amount: "1000000", visit: "outpatient", tier: "" }]);
  }
  return h;
};
/** 일반 전환 경로(비급여 항목을 골랐지만 (1)(2)로 계산되는 조합). */
const goGeneralRoute = (h: H, kind: "critical_injection_exceptional" | "non_critical_injection" | "non_critical_msk", cause = "disease") => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  if (kind === "critical_injection_exceptional") { pick(h, ITEM, "injection"); pick(h, SEV, "critical"); pick(h, PUR, "anticancer"); }
  if (kind === "non_critical_injection") { pick(h, ITEM, "injection"); pick(h, SEV, "non_critical"); }
  if (kind === "non_critical_msk") { pick(h, ITEM, "musculoskeletal_esw"); pick(h, SEV, "non_critical"); }
  pick(h, CAUSE, cause); pick(h, VIS, "outpatient");
  h.set("priorVisits", "0"); h.set("priorOutDays", "0");
  return h;
};
const goRoomCharge = (h: H, severity: "critical" | "non_critical", cause = "disease") => {
  pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
  pick(h, ITEM, "room_charge"); pick(h, SEV, severity); pick(h, CAUSE, cause);
  h.set("rcRows", [{ amount: "600000", days: "3" }]);
  return h;
};

// ── 지급보험금 8축 전순열 (56쌍) ─────────────────────────────────────
console.log("\n[8축] 지급보험금은 축마다 따로 남고 복귀하면 복원된다");
{
  let pairs = 0; const bad: string[] = [];
  for (const src of ALL_AXES) {
    const h = setup();
    goAxis(h, src);
    priorType(h, "1234567");
    for (const dst of ALL_AXES) {
      if (dst === src) continue;
      pairs++;
      goAxis(h, dst);
      if (priorShown(h) !== "0") bad.push(`${src}→${dst}: 목적지 값 ${priorShown(h)}`);
      goAxis(h, src);
      if (priorShown(h) !== "1234567") bad.push(`${src}→${dst}→복귀: ${priorShown(h)}`);
    }
  }
  check(`8축 전순열 ${pairs}쌍: 값이 넘어가지 않고 복귀 시 복원된다`, pairs === 56 && bad.length === 0,
    `쌍 ${pairs} / 어긋남 ${bad.length}: ${bad.slice(0, 4).join(" | ")}`);
}
{
  // 여덟 축에 서로 다른 값을 넣고 전부 유지되는지 한 번에 본다.
  const h = setup(); const vals: Record<string, string> = {};
  ALL_AXES.forEach((a, i) => { goAxis(h, a); const v = String(1000 * (i + 1)); vals[a] = v; priorType(h, v); });
  const bad = ALL_AXES.filter((a) => { goAxis(h, a); return priorShown(h) !== vals[a]; });
  check("여덟 축의 값이 서로 섞이지 않는다", bad.length === 0, bad.join(", "));
}

// ── 가입금액 두 종류 × 일반 4축 전순열 (12쌍씩) ──────────────────────
console.log("\n[4축] 연간·통원 가입금액은 일반 4축에서만 살고 서로 별도 상태다");
for (const [what, label] of [["연간", ANNUAL], ["통원", OUTLIMIT]] as [string, string][]) {
  let pairs = 0; const bad: string[] = [];
  for (const src of GENERAL_AXES) {
    const h = setup();
    goAxis(h, src as Axis);
    typeInto(h, label, "7654321");
    for (const dst of GENERAL_AXES) {
      if (dst === src) continue;
      pairs++;
      goAxis(h, dst as Axis);
      if (shown(h, label) !== "") bad.push(`${src}→${dst}: ${shown(h, label)}`);
      goAxis(h, src as Axis);
      if (shown(h, label) !== "7654321") bad.push(`${src}→${dst}→복귀: ${shown(h, label)}`);
    }
  }
  check(`${what} 가입금액 4축 전순열 ${pairs}쌍`, pairs === 12 && bad.length === 0,
    `쌍 ${pairs} / 어긋남 ${bad.length}: ${bad.slice(0, 3).join(" | ")}`);
}
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  typeInto(h, ANNUAL, "50000000");
  typeInto(h, OUTLIMIT, "200000");
  typeInto(h, PRIOR, "1000000");
  check("세 입력이 같은 축 키를 쓰되 값은 서로 별도다",
    shown(h, ANNUAL) === "50000000" && shown(h, OUTLIMIT) === "200000" && shown(h, PRIOR) === "1000000");
  check("별도 보장종목에는 두 가입금액 칸이 없다", (() => {
    goAxis(h, "item_msk_critical");
    return !has(h, ANNUAL) && !has(h, OUTLIMIT);
  })());
}

// ── 정상 공유 ────────────────────────────────────────────────────────
console.log("\n[공유] 일반 직접·일반 전환·상급병실료는 같은 일반 축을 쓴다");
{
  const h = setup();
  goAxis(h, "general_non_critical_disease");
  typeInto(h, PRIOR, "2000000"); typeInto(h, ANNUAL, "9000000"); typeInto(h, OUTLIMIT, "150000");
  for (const kind of ["non_critical_injection", "non_critical_msk"] as const) {
    goGeneralRoute(h, kind, "disease");
    check(`일반 전환(${kind})이 같은 축 값을 본다`,
      shown(h, PRIOR) === "2000000" && shown(h, ANNUAL) === "9000000" && shown(h, OUTLIMIT) === "150000",
      `${shown(h, PRIOR)}/${shown(h, ANNUAL)}/${shown(h, OUTLIMIT)}`);
  }
  goRoomCharge(h, "non_critical", "disease");
  check("상급병실료가 같은 축 값을 본다",
    shown(h, PRIOR) === "2000000" && shown(h, ANNUAL) === "9000000",
    `${shown(h, PRIOR)}/${shown(h, ANNUAL)}`);
  typeInto(h, PRIOR, "3000000");
  goAxis(h, "general_non_critical_disease");
  check("상급병실료에서 고친 값이 일반 화면에 그대로 보인다", shown(h, PRIOR) === "3000000");
  goAxis(h, "general_non_critical_injury");
  check("다른 원인 축은 공유하지 않는다", shown(h, PRIOR) === "0" && shown(h, ANNUAL) === "");
}
{
  const h = setup();
  goGeneralRoute(h, "critical_injection_exceptional", "injury");
  typeInto(h, PRIOR, "4000000");
  goAxis(h, "general_critical_injury");
  check("중증 예외적 용도 주사(일반 전환) ↔ 직접 일반이 같은 축", shown(h, PRIOR) === "4000000");
  goAxis(h, "item_injection_critical");
  check("중증 주사 일반 용도(특약)는 다른 축", priorShown(h) === "0", String(priorShown(h)));
  goGeneralRoute(h, "critical_injection_exceptional", "injury");
  check("약제 용도를 되돌리면 일반 축 값이 복원", shown(h, PRIOR) === "4000000");
}
{
  const h = setup();
  goAxis(h, "general_critical_disease", { visit: "outpatient" });
  typeInto(h, PRIOR, "5000000"); typeInto(h, ANNUAL, "50000000");
  pick(h, VIS, "inpatient"); pick(h, TIER, "hospital");
  check("같은 축의 통원↔입원은 값을 유지한다(제5조① 합산)",
    shown(h, PRIOR) === "5000000" && shown(h, ANNUAL) === "50000000");
  pick(h, VIS, "outpatient");
  check("통원으로 돌아와도 유지", shown(h, PRIOR) === "5000000" && shown(h, ANNUAL) === "50000000");
}
{
  const h = setup();
  goAxis(h, "item_mri_critical");
  priorType(h, "2500000");
  goAxis(h, "item_mri_non_critical");
  check("중증 MRI와 비중증 MRI는 분리된다", priorShown(h) === "0", String(priorShown(h)));
  goAxis(h, "item_mri_critical");
  check("중증 MRI로 복귀하면 복원", priorShown(h) === "2500000");
}
{
  // ⚠ 특별약관 화면에는 원인 선택창이 아예 없다(상해·질병 합산이라 묻지 않는다).
  //   그래서 "원인을 바꿔도 유지"는 특약 화면 안에서 확인할 수 없다. 일반 화면에서 원인을
  //   바꾼 뒤 특약으로 돌아와 **같은 값**이 나오는지로 확인한다.
  const h = setup();
  goAxis(h, "item_msk_critical");
  check("특약 화면에는 원인 선택창이 없다", !has(h, CAUSE));
  priorType(h, "1000000");
  goAxis(h, "general_critical_disease");
  goAxis(h, "item_msk_critical");
  const viaDisease = priorShown(h);
  goAxis(h, "general_critical_injury");
  goAxis(h, "item_msk_critical");
  check("특약 축은 원인으로 나뉘지 않는다(<표1> 상해·질병 합산)",
    viaDisease === "1000000" && priorShown(h) === "1000000",
    `${viaDisease} / ${priorShown(h)}`);
}

// ── 재현했던 결함이 사라졌는가 ───────────────────────────────────────
console.log("\n[결함] 기준선에서 재현한 네 사례가 정상 값으로 계산된다");
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  h.set("amounts", ["3000000"]);
  typeInto(h, ANNUAL, "50000000"); typeInto(h, PRIOR, "9000000");
  check("① 일반 중증 통원(기존지급 900만)", pay(h) === "2,100,000원", String(pay(h)));
  goAxis(h, "item_msk_critical");
  check("① 특약 중증 근골격계로 전환 → 0원이 아니다", pay(h) === "700,000원", String(pay(h)));
}
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  h.set("amounts", ["3000000"]);
  typeInto(h, ANNUAL, "50000000"); typeInto(h, PRIOR, "49500000");
  check("② 질병·중증(잔여 50만)", pay(h) === "500,000원", String(pay(h)));
  goAxis(h, "general_critical_injury");
  h.set("amounts", ["3000000"]);
  check("② 상해로 전환 → 상해 축의 이력(0)으로 계산", pay(h) === "2,100,000원", String(pay(h)));
}
{
  const amts = ["10000000", "10000000", "10000000", "10000000", "10000000"];
  const h = setup();
  goAxis(h, "general_non_critical_disease");
  h.set("amounts", amts);
  typeInto(h, ANNUAL, "10000000");
  check("③ 비중증(연간 1천만)", pay(h) === "10,000,000원", String(pay(h)));
  goAxis(h, "general_critical_disease");
  h.set("amounts", amts);
  check("③ 중증으로 전환 → 비중증 한도가 따라오지 않는다", pay(h) === "35,000,000원", String(pay(h)));
}
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  h.set("amounts", ["500000"]);
  typeInto(h, OUTLIMIT, "200000");
  check("④ 중증 통원(1회당 20만)", pay(h) === "200,000원", String(pay(h)));
  goAxis(h, "general_non_critical_disease");
  h.set("amounts", ["500000"]);
  check("④ 비중증으로 전환 → 1회당 값이 1일당으로 따라오지 않는다", pay(h) === "250,000원", String(pay(h)));
}

// ── 미선택·급여 ──────────────────────────────────────────────────────
console.log("\n[미선택·급여] 축이 정해지기 전에는 읽지도 고치지도 않는다");
{
  const h = setup();
  pick(h, COV, "non_benefit");
  check("치료유형 미선택: 누적 입력이 없다", !has(h, PRIOR) && !has(h, PRIOR_ITEM) && !has(h, ANNUAL) && !has(h, OUTLIMIT));
  pick(h, ITEM, "general");
  check("질환 구분 미선택: 누적 입력이 없다", !has(h, PRIOR) && !has(h, ANNUAL) && !has(h, OUTLIMIT));
  pick(h, SEV, "critical");
  check("원인 미선택: 누적 입력이 없다(축을 정할 수 없다)", !has(h, PRIOR) && !has(h, ANNUAL) && !has(h, OUTLIMIT));
  check("원인 미선택: 원인 안내가 뜬다", warns(h).includes("원인"));
  pick(h, CAUSE, "disease");
  check("원인 선택 후: 세 입력이 모두 나온다", has(h, PRIOR) && has(h, ANNUAL) && has(h, OUTLIMIT));
  check("라벨에 보장축이 표시된다",
    (labelOf(h, PRIOR)?.text ?? "").includes("중증 질병비급여 보장축")
    && (labelOf(h, ANNUAL)?.text ?? "").includes("중증 질병비급여 보장축")
    && (labelOf(h, OUTLIMIT)?.text ?? "").includes("중증 질병비급여 보장축"));
}

// ── 축 이름 ──────────────────────────────────────────────────────────
console.log("\n[라벨] 네 일반 축의 이름이 각각 정확하다");
{
  /**
   * ⚠ 기대값을 **구현의 라벨 함수에서 가져오지 않는다.** 여기에 직접 적는다 —
   *   함수에서 가져오면 함수가 틀려도 검사가 같이 틀린다.
   * ⚠ "보장축"이라는 낱말이 들어 있는지만 보지 않는다. 커밋 `7944248`에서
   *   `generalAxisLabel()`이 축 키를 `split("_")`로 쪼개면서 `"non_critical"` 안의 밑줄을
   *   놓쳐 **비중증 상해가 "비중증 질병비급여"로 표시**됐고, 네 축 중 셋이 우연히 맞아
   *   낱말 검사로는 걸리지 않았다. 그래서 축마다 **정확한 문구**를 따로 못 박는다.
   */
  const EXPECTED: [string, string, string][] = [
    ["critical", "injury", "중증 상해비급여"],
    ["critical", "disease", "중증 질병비급여"],
    ["non_critical", "injury", "비중증 상해비급여"],
    ["non_critical", "disease", "비중증 질병비급여"],
  ];
  const WRONG = ["중증 상해비급여", "중증 질병비급여", "비중증 상해비급여", "비중증 질병비급여"];
  /** 라벨 텍스트가 기대 축으로 시작하고, 다른 세 축 이름은 들어 있지 않아야 한다. */
  const axisIn = (text: string, want: string) => {
    if (!text.includes(`(${want} 보장축`)) return false;
    // ⚠ "중증 상해비급여"는 "비중증 상해비급여"의 부분문자열이다. 괄호까지 붙여 비교한다.
    return WRONG.filter((w) => w !== want).every((w) => !text.includes(`(${w} 보장축`));
  };
  for (const [sev, cau, want] of EXPECTED) {
    const h = setup();
    pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
    pick(h, ITEM, "general"); pick(h, SEV, sev); pick(h, CAUSE, cau); pick(h, VIS, "outpatient");
    h.set("priorVisits", "0"); h.set("priorOutDays", "0");
    for (const [name, prefix] of [["지급보험금", PRIOR], ["연간 가입금액", ANNUAL], ["통원 가입금액", OUTLIMIT]] as [string, string][]) {
      const text = labelOf(h, prefix)?.text ?? "";
      check(`${sev}/${cau} — ${name} 라벨이 "${want}"`, axisIn(text, want), text.slice(0, 70));
    }
    // 공유 안내 문구도 같은 축을 말해야 한다.
    check(`${sev}/${cau} — 지급보험금 공유 안내가 "${want}"`,
      axisIn((labelOf(h, PRIOR)?.text ?? "").replace(/^[^(]*/, ""), want)
      && (labelOf(h, PRIOR)?.text ?? "").includes(`같은 ${want} 보장축의 일반 입원·통원과 상급병실료`),
      (labelOf(h, PRIOR)?.text ?? "").slice(0, 120));
  }
  check("비중증 상해가 질병으로 표시되지 않는다", (() => {
    const h = setup();
    pick(h, COV, "benefit"); pick(h, COV, "non_benefit");
    pick(h, ITEM, "general"); pick(h, SEV, "non_critical"); pick(h, CAUSE, "injury"); pick(h, VIS, "outpatient");
    return [PRIOR, ANNUAL, OUTLIMIT].every((p) => {
      const t = labelOf(h, p)?.text ?? "";
      return t.includes("(비중증 상해비급여 보장축") && !t.includes("(비중증 질병비급여 보장축");
    });
  })());
  // 상급병실료·일반 전환 경로도 같은 라벨을 쓴다.
  for (const [sev, cau, want] of EXPECTED) {
    const h = setup();
    goRoomCharge(h, sev as "critical" | "non_critical", cau);
    check(`상급병실료 ${sev}/${cau} 라벨이 "${want}"`,
      axisIn(labelOf(h, PRIOR)?.text ?? "", want) && axisIn(labelOf(h, ANNUAL)?.text ?? "", want),
      (labelOf(h, PRIOR)?.text ?? "").slice(0, 60));
  }
  for (const [kind, sev] of [["non_critical_injection", "non_critical"], ["non_critical_msk", "non_critical"], ["critical_injection_exceptional", "critical"]] as [string, string][]) {
    for (const cau of ["injury", "disease"]) {
      const want = `${sev === "critical" ? "중증" : "비중증"} ${cau === "injury" ? "상해" : "질병"}비급여`;
      const h = setup();
      goGeneralRoute(h, kind as "critical_injection_exceptional" | "non_critical_injection" | "non_critical_msk", cau);
      check(`일반 전환 ${kind}/${cau} 라벨이 "${want}"`,
        axisIn(labelOf(h, PRIOR)?.text ?? "", want) && axisIn(labelOf(h, ANNUAL)?.text ?? "", want),
        (labelOf(h, PRIOR)?.text ?? "").slice(0, 60));
    }
  }
}
{
  // 표시된 축과 실제 계산에 쓰인 축이 같은지 — 상해·질병에 다른 값을 넣어 결과로 확인한다.
  const h = setup();
  goAxis(h, "general_non_critical_injury");
  h.set("amounts", ["3000000"]);
  typeInto(h, ANNUAL, "10000000"); typeInto(h, PRIOR, "9500000");
  const injuryLabel = labelOf(h, PRIOR)?.text ?? "";
  const injuryPay = pay(h);
  goAxis(h, "general_non_critical_disease");
  h.set("amounts", ["3000000"]);
  typeInto(h, ANNUAL, "10000000"); typeInto(h, PRIOR, "0");
  const diseaseLabel = labelOf(h, PRIOR)?.text ?? "";
  const diseasePay = pay(h);
  check("비중증 상해 축: 라벨이 상해이고 상해 이력으로 계산된다",
    injuryLabel.includes("(비중증 상해비급여 보장축") && injuryPay === "500,000원", `${injuryLabel.slice(0, 50)} / ${injuryPay}`);
  check("비중증 질병 축: 라벨이 질병이고 질병 이력으로 계산된다",
    diseaseLabel.includes("(비중증 질병비급여 보장축") && diseasePay === "1,500,000원", `${diseaseLabel.slice(0, 50)} / ${diseasePay}`);
  goAxis(h, "general_non_critical_injury");
  check("상해로 돌아오면 라벨·값·결과가 함께 복원된다",
    (labelOf(h, PRIOR)?.text ?? "").includes("(비중증 상해비급여 보장축")
    && shown(h, PRIOR) === "9500000" && pay(h) === "500,000원",
    `${shown(h, PRIOR)} / ${pay(h)}`);
}
{
  const code = stripComments(ui);
  check("축 이름은 네 키를 모두 명시한 Record에서 온다",
    /const GEN2026_GENERAL_AXIS_LABEL: Record<Gen2026GeneralAxis, string> = \{/.test(code)
    && /general_critical_injury: "중증 상해비급여",/.test(code)
    && /general_critical_disease: "중증 질병비급여",/.test(code)
    && /general_non_critical_injury: "비중증 상해비급여",/.test(code)
    && /general_non_critical_disease: "비중증 질병비급여",/.test(code));
  check("축 키를 문자열로 쪼개지 않는다(‘non_critical’의 밑줄 때문에 깨진다)",
    !/\.split\("_"\)/.test(code) && !/generalAxis\.split/.test(code));
  check("분해 실패를 특정 축으로 돌리는 fallback이 없다",
    !/=== "injury" \? "injury" : "disease"/.test(code)
    && !/=== "critical" \? "critical" : "non_critical"/.test(code));
}
{
  const h = setup();
  pick(h, COV, "non_benefit"); pick(h, ITEM, "injection"); pick(h, SEV, "critical");
  check("약제 용도 미선택: 누적 입력이 없다", !has(h, PRIOR) && !has(h, PRIOR_ITEM));
  check("약제 용도 미선택: 안내가 뜬다", warns(h).includes("약제 용도"));
  pick(h, PUR, "general");
  check("일반 용도 선택 → 특약 축 입력", has(h, PRIOR_ITEM) && !has(h, PRIOR));
  pick(h, PUR, "anticancer");
  check("예외적 용도 선택 → 일반 경로(원인 필요)", !has(h, PRIOR_ITEM) && !has(h, PRIOR) && warns(h).includes("원인"));
}
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  typeInto(h, PRIOR, "40000000"); typeInto(h, ANNUAL, "50000000");
  h.set("amounts", ["1000000"]);
  pick(h, COV, "benefit"); pick(h, VIS, "inpatient");
  check("급여: 비급여 금액 입력을 요구하지도 노출하지도 않는다",
    !has(h, PRIOR) && !has(h, PRIOR_ITEM) && !has(h, ANNUAL) && !has(h, OUTLIMIT));
  const benefitPay = pay(h);
  const f = setup();
  pick(f, COV, "benefit"); pick(f, VIS, "inpatient"); f.set("amounts", ["1000000"]);
  check("급여: 숨은 비급여 값이 계산에 간섭하지 않는다", benefitPay === pay(f), `${benefitPay} vs ${pay(f)}`);
  pick(h, COV, "non_benefit");
  check("급여에서 돌아오면 축 값이 복원된다",
    shown(h, PRIOR) === "40000000" && shown(h, ANNUAL) === "50000000");
}

// ── 소스 계약 ────────────────────────────────────────────────────────
console.log("\n[소스] 축 키는 기존 라우팅 결과에서만 만든다");
{
  const code = stripComments(ui);
  check("축 Record 3종", /const \[priorInsuranceByAxis, setPriorInsuranceByAxis\] = useState<Record<Gen2026PaidAxis, string>>/.test(code)
    && /const \[annualLimitByAxis, setAnnualLimitByAxis\] = useState<Record<Gen2026GeneralAxis, string>>/.test(code)
    && /const \[outpatientLimitByAxis, setOutpatientLimitByAxis\] = useState<Record<Gen2026GeneralAxis, string>>/.test(code));
  check("초기값 그대로(지급보험금 \"0\" · 가입금액 \"\")",
    /GEN2026_PAID_AXES\.map\(\(k\) => \[k, "0"\]\)/.test(code)
    && (code.match(/GEN2026_GENERAL_AXES\.map\(\(k\) => \[k, ""\]\)/g) ?? []).length === 2);
  check("일반 축은 질환 구분·원인이 모두 정해져야 만들어진다",
    /const generalAxis: Gen2026GeneralAxis \| null =\s*\n?\s*severity !== "" && cause !== "" \? `general_\$\{severity\}_\$\{cause\}` : null;/.test(code));
  check("항목 축은 기존 라우팅(showSpecialForm·specialItem)에서만 만든다",
    /const itemAxis: Gen2026ItemAxis \| null = showSpecialForm && specialItem !== null && severity !== ""/.test(code)
    && /GEN2026_ITEM_AXIS_OF\[specialItem\]\[severity\] \?\? null/.test(code)
    && /const route = specialItem !== null && severity !== ""\s*\n?\s*\? routeOfGen2026Item\(/.test(code));
  check("활성 축은 폼 표시 조건과 같은 순서로 고른다",
    /const paidAxis: Gen2026PaidAxis \| null = showSpecialForm \? itemAxis\s*\n?\s*: \(showRoomChargeForm \|\| showGeneralForm\) \? generalAxis\s*\n?\s*: null;/.test(code));
  check("축이 없으면 읽지도 고치지도 않는다",
    /const priorInsurance = paidAxis === null \? "0" : priorInsuranceByAxis\[paidAxis\];/.test(code)
    && /if \(paidAxis === null\) return;/.test(code)
    && (code.match(/if \(generalAxis === null\) return;/g) ?? []).length === 2);
  check("\"undefined\" 키를 만들지 않는다",
    !/`general_\$\{severity \|\|/.test(code) && !/\$\{severity \?\? /.test(code)
    && !/String\(severity\)/.test(code) && !/`item_\$\{/.test(code));
  check("엔진 라우팅과 다른 항목 판정 로직이 없다",
    (code.match(/routeOfGen2026Item\(/g) ?? []).length === 1);
  check("전달 형태 그대로(파서 num 무변경)",
    (code.match(/priorAnnualInsurancePaid: num\(priorInsurance\)/g) ?? []).length === 7
    && (code.match(/annualCoverageLimit: annualLimit !== "" \? num\(annualLimit\) : undefined/g) ?? []).length === 3
    && (code.match(/outpatientCoverageLimit: visit === "outpatient" && outpatientLimit !== "" \? num\(outpatientLimit\) : undefined/g) ?? []).length === 2);
  check("공제금액 두 상태는 그대로다",
    /const \[priorDeductible, setPriorDeductible\] = useState\("0"\);/.test(code)
    && /const \[priorPool, setPriorPool\] = useState\("0"\);/.test(code)
    && (code.match(/priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" \? num\(priorDeductible\) : undefined/g) ?? []).length === 2
    && /priorAnnualInpatientDeductible: num\(priorPool\)/.test(code));
  check("계산 결과를 과거 지급액에 되쓰지 않는다",
    !/setPriorInsuranceByAxis\([^)]*result/.test(code)
    && !/setPriorInsurance\([^)]*result/.test(code)
    && !/setPriorInsurance\([^)]*total/.test(code));
  check("파서 num()은 그대로다", /const num = \(v: string\) => Number\(v\.replace\(\/\[\^0-9\.\]\/g, ""\)\) \|\| 0;/.test(code));
  check("진료비·상급병실료 파서 그대로",
    /const GEN2026_AMOUNT_FORMAT = \/\^\(\?:\[0-9\]\+\|\[1-9\]\[0-9\]\{0,2\}\(\?:,\[0-9\]\{3\}\)\+\)\$\/;/.test(code)
    && /const roomChargeAmount = \(v: string\): number \| null =>/.test(code)
    && /const positiveDays = \(v: string\): number \| null =>/.test(code));
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const item = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  check("엔진은 그대로다",
    /let insurancePaid = nonNegInt\(input\.priorAnnualInsurancePaid\);/.test(eng)
    && /let deductiblePaid = nonNegInt\(nb\?\.priorAnnualDeductible\);/.test(eng)
    && /let paid = nonNegInt\(input\.priorAnnualInsurancePaid\);/.test(item));
  check("4세대 축 타입을 재사용하지 않는다", !/Gen2021PaidAxis/.test(code) && !/gen2021Money/.test(code));
}

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] 진료비·횟수·승인·상급병실료·HOLD·공제금액 그대로");
{
  const h = setup();
  goAxis(h, "general_critical_disease");
  h.set("amounts", ["300000", "300000"]);
  check("중증 통원 기본 계산", pay(h) === "420,000원", String(pay(h)));
  h.set("amounts", ["300000", "abc"]);
  check("진료비 무효는 여전히 차단", pay(h) === null && warns(h).includes("진료비"));
  h.set("amounts", ["300000", "300000"]);
  h.set("priorVisits", "");
  check("중증 통원 횟수 미입력은 여전히 차단", pay(h) === null);
  h.set("priorVisits", "0");
  check("복구 후 재개", pay(h) === "420,000원", String(pay(h)));
}
{
  const h = setup();
  goAxis(h, "general_critical_disease", { visit: "inpatient" });
  h.set("amounts", ["10000000"]);
  const before = pay(h);
  typeInto(h, DEDUCT, "3000000");
  check("공제금액 입력이 여전히 계산에 반영된다", pay(h) !== before, `${before} → ${pay(h)}`);
  goAxis(h, "item_mri_critical");
  h.set("rows", [{ amount: "1000000", visit: "inpatient", tier: "hospital" }]);
  check("특약 중증 MRI의 pool 입력은 별도 상태 그대로", has(h, DEDUCT));
}
{
  const h = setup();
  goRoomCharge(h, "critical", "disease");
  check("상급병실료 계산 유지", pay(h) !== null, warns(h));
  h.set("rcRows", [{ amount: "600000", days: "0" }]);
  check("상급병실료 일수 게이트 유지", pay(h) === null && warns(h).includes("총 입원일수"));
}

console.log(`\n[5세대 누적 금액 축 분리] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
