/**
 * G-35 — 정상 계산의 0원 결과를 감추지 않는다.
 *
 * 종전 다섯 화면은 결과 카드를 **금액 조건**으로 막았다 — 다회 셋은
 * `result.totalAmount > 0`, 단건 둘은 파싱된 입력값 `num > 0`. 그래서
 * **정상 계산인데 총액이 0원**인 결과가 계산 실패·미실행과 구분되지 않았다.
 *   - 2·3세대 다회 / 4세대 다회 / 5세대 다회 / 5세대 단건: 화면 변화가 **0**이었다.
 *   - 4세대 단건: "진료비를 1원 이상 입력해 주세요."로 **정상 입력을 오류처럼** 설명했다.
 *
 * ⚠ 미입력·무효는 `result === null`, 엔진 차단은 `PENDING_UNVERIFIED`로 이미 갈린다.
 *   금액 조건은 그 위에 얹힌 **네 번째 상태**였고, 그것만 걷어냈다.
 * ⚠ 4세대 단건은 종전 게이트가 `result.status`를 **아예 보지 않아** 차단 결과도 0원 카드로
 *   그렸다. 결과 상태 기준으로 바꾸며 그 공백도 함께 닫힌다(§6).
 * ⚠ 횟수·일수 소진 계약은 **바꾸지 않았다.** 2·3세대는 0원 행이 외래 횟수를 소진하고,
 *   5세대는 소진하지 않는다 — 세대별로 다른 기존 동작을 §4가 양쪽 다 고정한다.
 * ⚠ 엔진과 `src/lib`은 변경하지 않았다. 이 커밋은 화면 렌더 조건과 라벨만 다룬다.
 */
import { readFileSync } from "node:fs";
import HealthCalc from "../src/components/calculators/HealthCalc";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import HealthCalcMulti2021 from "../src/components/calculators/HealthCalcMulti2021";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const PATHS = {
  std: "src/components/calculators/HealthCalcStandardized.tsx",
  g4: "src/components/calculators/HealthCalc.tsx",
  g5: "src/components/calculators/HealthCalc5th.tsx",
  m4: "src/components/calculators/HealthCalcMulti2021.tsx",
  m5: "src/components/calculators/HealthCalcMulti2026.tsx",
} as const;
const SRC = Object.fromEntries(
  Object.entries(PATHS).map(([k, p]) => [k, readFileSync(p, "utf8")]),
) as Record<keyof typeof PATHS, string>;
/**
 * ⚠ 주석을 걷어내고 본다. 교체 이유 주석이 **종전 조건식을 그대로 인용**하므로,
 *   원문 전체에 정규식을 걸면 "금액 조건이 사라졌다"를 확인할 수 없다.
 */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

type Comp = () => unknown;
const COMP: Record<keyof typeof PATHS, Comp> = {
  std: HealthCalcStandardized as unknown as Comp,
  g4: HealthCalc as unknown as Comp,
  g5: HealthCalc5th as unknown as Comp,
  m4: HealthCalcMulti2021 as unknown as Comp,
  m5: HealthCalcMulti2026 as unknown as Comp,
};
const NAMES = Object.fromEntries(
  Object.entries(SRC).map(([k, s]) => [k, stateNamesFrom(s)]),
) as Record<keyof typeof PATHS, string[]>;

const setup = (key: keyof typeof PATHS, over: Record<string, unknown> = {}) => {
  const h = mount(COMP[key], NAMES[key]);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
const screenOf = (key: keyof typeof PATHS, over: Record<string, unknown> = {}) => {
  const s = setup(key, over).render();
  const nodes = s.nodes as RenderedNode[];
  const items = s.resultItems();
  return {
    nodes,
    calculated: items !== null,
    values: (items ?? []).map((i) => i.value),
    text: s.text,
    live: nodes.filter((n) => n.props?.role === "status"),
    cells: nodes.filter((n) => n.tag === "td").map((n) => n.text),
    notices: nodes.filter((n) => n.tag === "#NoticeBox").map((n) => n.text),
  };
};

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 0. 게이트 — 다섯 화면 어디에도 금액 조건이 남아 있지 않다");
{
  check("2·3세대 다회: 결과 상태만 본다",
    /\{result !== null && result\.status === "OK" && \(/.test(SRC.std) && !/totalAmount > 0/.test(code(SRC.std)));
  check("4세대 다회: 결과 상태만 본다",
    /\{submitted && result !== null && result\.status === "OK" && <div/.test(SRC.m4) && !/totalAmount > 0/.test(code(SRC.m4)));
  check("5세대 다회: 결과 상태만 본다",
    /\{submitted && result && result\.status === "OK" && <div/.test(SRC.m5) && !/totalAmount > 0/.test(code(SRC.m5)));
  check("4세대 단건: 결과 상태만 본다(종전에는 status를 보지 않았다)",
    /\{submitted && result !== null && result\.status === "OK" && \(/.test(SRC.g4) && !/num > 0/.test(code(SRC.g4)));
  check("5세대 단건: 결과 상태만 본다",
    /\{result && result\.status === "OK" && \(/.test(SRC.g5) && !/num > 0/.test(code(SRC.g5)));
  check("4세대 단건의 0원 거부 문구가 렌더에서 사라졌다",
    !/<NoticeBox variant="info">진료비를 1원 이상/.test(code(SRC.g4)));
  // ⚠ **`code()`가 코드까지 지우면 위 검사가 무력해진다.** 주석만 걷어내는지 확인한다 —
  //   게이트 식과 라이브 리전이 남아 있어야 하고, 원문보다 짧아야 한다(주석이 실제로 지워졌다).
  for (const [k, src] of Object.entries(SRC) as [keyof typeof PATHS, string][]) {
    const c = code(src);
    check(`${k}: code()가 주석만 지운다(게이트·리전 보존)`,
      c.length < src.length && c.includes('result.status === "OK"') && c.includes('role="status"'),
      `${c.length} < ${src.length}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 0b. 게이트 — 다섯 화면을 실제 렌더로 각각 고정한다");
{
  // ⚠ 소스 정규식만으로는 "조건이 실제로 그렇게 동작하는가"를 말할 수 없다.
  //   화면마다 **정상 0원 → 카드 있음**과 **무효 → 카드 없음**을 함께 본다.
  const RENDER_GATE: [string, keyof typeof PATHS, Record<string, unknown>, Record<string, unknown>][] = [
    ["2·3세대 다회", "std",
      { generation: "2009", plan: "standard", priorVisits: "0", rows: [{ id: 1, amount: "0", visit: "outpatient", facility: "clinic" }] },
      { generation: "2009", plan: "standard", priorVisits: "0", rows: [{ id: 1, amount: "abc", visit: "outpatient", facility: "clinic" }] }],
    ["4세대 다회", "m4",
      { coverage: "benefit", visit: "outpatient", amounts: ["0"] },
      { coverage: "benefit", visit: "outpatient", amounts: ["abc"] }],
    ["5세대 다회", "m5",
      { coverage: "benefit", visit: "outpatient", nhisRate: "20", amounts: ["0"] },
      { coverage: "benefit", visit: "outpatient", nhisRate: "20", amounts: ["abc"] }],
    ["4세대 단건", "g4",
      { coverage: "benefit", visit: "outpatient", amount: "0" },
      { coverage: "benefit", visit: "outpatient", amount: "abc" }],
    ["5세대 단건", "g5",
      { coverage: "benefit", visit: "inpatient", amount: "0" },
      { coverage: "benefit", visit: "inpatient", amount: "abc" }],
  ];
  for (const [label, key, zero, bad] of RENDER_GATE) {
    const z = screenOf(key, zero), b = screenOf(key, bad);
    check(`${label}: 정상 0원 → 카드 있음 · 무효 → 카드 없음`,
      z.calculated && z.values.every((v) => v === "0원") && !b.calculated,
      `${z.calculated}/${z.values.join(",")} · ${b.calculated}`);
  }
  // 엔진 차단이 화면에서 도달하는 세 곳은 카드가 없어야 한다(4세대 단건은 §6에서 따로 본다).
  const blockedStd = screenOf("std", { generation: "2009", plan: null, priorVisits: "0", rows: [{ id: 1, amount: "300000", visit: "outpatient", facility: "clinic" }] });
  check("2·3세대 다회: 엔진 차단 → 카드 없음", !blockedStd.calculated);
  const blockedM4 = screenOf("m4", { coverage: "non_benefit", visit: "outpatient", rider: "manual_therapy", amounts: ["100000"], priorManualVisits: "10", approvedThrough: "" });
  check("4세대 다회: 엔진 차단 → 카드 없음", !blockedM4.calculated);
  const blockedG5 = screenOf("g5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", amount: "300000" });
  check("5세대 단건: 선행 게이트 → 카드 없음", !blockedG5.calculated);
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 1. 정상 0원 17경로 — 전부 결과 카드를 표시한다");
const ZERO_PATHS: [string, keyof typeof PATHS, Record<string, unknown>][] = [
  ["2·3세대 다회 · 통원 0원 1행", "std", { generation: "2009", plan: "standard", rows: [{ id: 1, amount: "0", visit: "outpatient", facility: "clinic" }], priorVisits: "0" }],
  ["2·3세대 다회 · 통원 0원 2행", "std", { generation: "2009", plan: "standard", rows: [{ id: 1, amount: "0", visit: "outpatient", facility: "clinic" }, { id: 2, amount: "0", visit: "outpatient", facility: "clinic" }], priorVisits: "0" }],
  ["2·3세대 다회 · 입원 0원 1행", "std", { generation: "2009", plan: "standard", rows: [{ id: 1, amount: "0", visit: "inpatient", facility: "clinic" }], priorPaid: "0" }],
  ["4세대 다회 · 급여 통원 0원", "m4", { coverage: "benefit", visit: "outpatient", amounts: ["0", "0"] }],
  ["4세대 다회 · 비급여 통원 0원", "m4", { coverage: "non_benefit", visit: "outpatient", amounts: ["0", "0"], priorOutVisits: "0" }],
  ["4세대 다회 · 도수 0원", "m4", { coverage: "non_benefit", visit: "outpatient", rider: "manual_therapy", amounts: ["0", "0"], priorManualVisits: "0", approvedThrough: "" }],
  ["5세대 다회 · 급여 통원 0원", "m5", { coverage: "benefit", visit: "outpatient", nhisRate: "20", amounts: ["0", "0"] }],
  ["5세대 다회 · 비급여 중증통원 0원", "m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["0", "0"] }],
  ["5세대 다회 · 비급여 중증입원 0원", "m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", cause: "disease", nbInpatientTier: "clinic", amounts: ["0", "0"] }],
  ["5세대 별도 · 근골격계 0원", "m5", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical", rows: [{ amount: "0", visit: "outpatient", tier: "" }, { amount: "0", visit: "outpatient", tier: "" }], priorActs: "0", priorCountByItem: { musculoskeletal_esw: "0", injection: "" } }],
  ["5세대 별도 · 주사료 0원", "m5", { coverage: "non_benefit", nonBenefitItem: "injection", severity: "critical", injectionPurpose: "general", rows: [{ amount: "0", visit: "outpatient", tier: "" }, { amount: "0", visit: "outpatient", tier: "" }], priorCountByItem: { musculoskeletal_esw: "", injection: "0" } }],
  ["5세대 별도 · MRI 0원", "m5", { coverage: "non_benefit", nonBenefitItem: "mri", severity: "critical", rows: [{ amount: "0", visit: "outpatient", tier: "" }, { amount: "0", visit: "outpatient", tier: "" }], priorPool: "0" }],
  ["5세대 상급병실료 · 0원 1입원", "m5", { coverage: "non_benefit", nonBenefitItem: "room_charge", severity: "non_critical", cause: "disease", rcRows: [{ amount: "0", days: "10" }] }],
  ["5세대 상급병실료 · 0원 2입원", "m5", { coverage: "non_benefit", nonBenefitItem: "room_charge", severity: "non_critical", cause: "disease", rcRows: [{ amount: "0", days: "10" }, { amount: "0", days: "3" }] }],
  ["4세대 단건 · 급여 통원 0원", "g4", { coverage: "benefit", visit: "outpatient", amount: "0" }],
  ["5세대 단건 · 급여 입원 0원", "g5", { coverage: "benefit", visit: "inpatient", amount: "0" }],
  ["5세대 단건 · 비급여 중증통원 0원", "g5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amount: "0" }],
];
{
  check(`모집단이 17경로다`, ZERO_PATHS.length === 17, String(ZERO_PATHS.length));
  for (const [label, key, over] of ZERO_PATHS) {
    const scr = screenOf(key, over);
    check(`${label} → 카드 표시 · 전부 0원`,
      scr.calculated && scr.values.length > 0 && scr.values.every((v) => v === "0원"),
      `${scr.calculated} / ${scr.values.join(" ")}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 2. 5상태 격자 — 0원만 바뀌고 나머지 넷은 무회귀");
{
  // 양수·혼합은 종전에도 카드가 떴다. 값까지 그대로인지 본다.
  const pos = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["300000", "300000"] });
  check("양수: 종전 값 그대로", pos.calculated && pos.values.join("/") === "600,000원/180,000원/420,000원", pos.values.join("/"));
  const mixed = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["0", "300000"] });
  check("혼합: 종전 값 그대로", mixed.calculated && mixed.values.join("/") === "300,000원/90,000원/210,000원", mixed.values.join("/"));
  // 무효: 엔진을 호출하지 않는다 → 카드 없음, 형식 안내.
  const bad = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["abc", "300000"] });
  check("무효: 카드 없음 · 형식 안내 유지",
    !bad.calculated && bad.notices.some((t) => t.includes("번째 행의")), String(bad.calculated));
  // 엔진 차단: PENDING 안내만.
  // ⚠ 화면에서 **실제로 도달하는** 엔진 차단을 쓴다 — 근골격계 승인 회차 초과.
  const blocked = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw",
    severity: "critical", approvedThrough: 10, priorActs: "10",
    priorCountByItem: { musculoskeletal_esw: "0", injection: "" },
    rows: [{ amount: "100000", visit: "outpatient", tier: "" }, { amount: "100000", visit: "outpatient", tier: "" }] });
  check("엔진 차단(근골격계 승인 회차): 카드 없음 · 차단 안내",
    !blocked.calculated && blocked.notices.some((t) => t.includes("최초 10회")),
    `${blocked.calculated} / ${blocked.notices.join(" | ").slice(0, 70)}`);
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 3. `보상` 열 — 보험금 기준으로 통일한다");
{
  // ⚠ 라벨을 **보험금**으로 가른다. 종전에는 진료비가 얼마든 지급 0원이면 전부 "보상"이었고,
  //   MRI는 회차 개념이 없어 지급이 있는 행까지 "보상"이었다. 회차 소진 여부는 세대별로
  //   다르고 HOLD도 남아 있어 새로 추정하지 않는다 — 지급 사실만 말한다.
  const cell = /!line\.covered\s*\?\s*"제외"\s*:\s*\(line\.insurancePay \?\? 0\) === 0\s*\?\s*\(line\.actIndex === null \? "지급 0원" : `\$\{line\.actIndex\}회째 · 지급 0원`\)\s*:\s*\(line\.actIndex === null \? "보상" : `\$\{line\.actIndex\}회째`\)/;
  check("라벨 식이 보험금 → 회차 순서로 갈린다", cell.test(SRC.m5));
  const msk = (over: Record<string, unknown>) => screenOf("m5", {
    coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical",
    priorActs: "0", priorCountByItem: { musculoskeletal_esw: "0", injection: "" }, ...over });
  // ⚠ 안내 문구가 아니라 **표의 셀**로 확인한다. 본문 텍스트에는 약관 안내가 함께 섞인다.
  const last = (c: string[]) => c[c.length - 1] ?? "";
  const zero = msk({ rows: [{ amount: "0", visit: "outpatient", tier: "" }] });
  check("진료비 0원·보험금 0원 → 지급 0원", last(zero.cells) === "지급 0원", zero.cells.join("|"));
  const under = msk({ rows: [{ amount: "20000", visit: "outpatient", tier: "" }] });
  check("공제 미만 양수·보험금 0원 → 지급 0원(같은 지급 사실을 같게 말한다)",
    last(under.cells) === "지급 0원", under.cells.join("|"));
  const paid = msk({ rows: [{ amount: "100000", visit: "outpatient", tier: "" }] });
  check("보험금 양수·회차 있음 → N회째(‘지급 0원’ 아님)", last(paid.cells) === "1회째", paid.cells.join("|"));
  const mri = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "mri", severity: "critical", priorPool: "0",
    rows: [{ amount: "1000000", visit: "outpatient", tier: "" }] });
  check("MRI 보험금 양수·회차 없음 → 보상", last(mri.cells) === "보상", mri.cells.join("|"));
  const excluded = msk({ rows: [{ amount: "100000", visit: "outpatient", tier: "" }], priorCountByItem: { musculoskeletal_esw: "50", injection: "" } });
  check("한도 초과 행 → 제외(종전 계약 그대로)", last(excluded.cells) === "제외", excluded.cells.join("|"));
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 4. 0원 횟수 계약 — 세대별로 다르고, 이번에 바꾸지 않았다");
{
  // 2·3세대: 0원 행이 외래 횟수를 1회 소진한다(179 + [0, 30만] → 두 번째 행이 제외).
  const std = screenOf("std", { generation: "2009", plan: "standard", priorVisits: "179",
    rows: [{ id: 1, amount: "0", visit: "outpatient", facility: "clinic" }, { id: 2, amount: "300000", visit: "outpatient", facility: "clinic" }] });
  check("2·3세대: 0원 행이 외래 횟수를 소진한다(유지)",
    std.calculated && std.values.join("/") === "300,000원/300,000원/0원", std.values.join("/"));
  // 5세대: 0원 행은 통원 횟수를 소진하지 않는다(99 + [0, 30만] → 두 번째 행이 보상).
  const g5m = screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical",
    visit: "outpatient", cause: "disease", priorVisits: "99", amounts: ["0", "300000"] });
  check("5세대: 0원 행은 통원 횟수를 소진하지 않는다(유지)",
    g5m.calculated && g5m.values.join("/") === "300,000원/90,000원/210,000원", g5m.values.join("/"));
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 5. 접근성 — 요약 한 문장만 낭독한다");
{
  const LIVE: [string, keyof typeof PATHS, Record<string, unknown>][] = [
    ["2·3세대 다회", "std", { generation: "2009", plan: "standard", priorVisits: "0" }],
    ["4세대 다회", "m4", { coverage: "benefit", visit: "outpatient", amounts: ["300000"] }],
    ["5세대 다회", "m5", { coverage: "benefit", visit: "outpatient", nhisRate: "20", amounts: ["300000"] }],
    ["4세대 단건", "g4", { coverage: "benefit", visit: "outpatient", amount: "300000" }],
    ["5세대 단건", "g5", { coverage: "benefit", visit: "inpatient", amount: "300000" }],
  ];
  for (const [label, key, over] of LIVE) {
    const scr = screenOf(key, over);
    check(`${label}: 라이브 리전이 정확히 1개`, scr.live.length === 1, String(scr.live.length));
    const n = scr.live[0];
    check(`${label}: role=status · aria-live=polite · aria-atomic=true`,
      !!n && n.props["aria-live"] === "polite" && n.props["aria-atomic"] === "true",
      JSON.stringify(n?.props));
    // ⚠ **카드 전체가 반복 낭독되지 않는지**가 이 절의 요점이다. 리전 텍스트가 한 문장이고
    //   금액 세 개만 담는지, 그리고 소스에서 카드·표가 리전 **밖**에 있는지 함께 본다.
    check(`${label}: 리전 텍스트가 요약 한 문장`,
      !!n && n.text.includes("총 진료비") && (n.text.match(/원/g) ?? []).length <= 6 && n.text.length < 160,
      n?.text);
  }
  for (const [k, s] of Object.entries(SRC) as [keyof typeof PATHS, string][]) {
    const region = /<p className="sr-only" role="status"[\s\S]*?<\/p>/.exec(s)?.[0] ?? "";
    check(`${k}: 카드·표가 라이브 리전 밖에 있다`,
      region !== "" && !region.includes("ResultCard") && !region.includes("<table"), region.slice(0, 60));
  }
  // OK가 아닐 때는 리전 자체가 없다.
  check("무효 입력: 라이브 리전이 렌더되지 않는다",
    screenOf("g5", { coverage: "benefit", visit: "inpatient", amount: "abc" }).live.length === 0);
  check("엔진 차단: 라이브 리전이 렌더되지 않는다",
    screenOf("m5", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical",
      approvedThrough: 10, priorActs: "10", priorCountByItem: { musculoskeletal_esw: "0", injection: "" },
      rows: [{ amount: "100000", visit: "outpatient", tier: "" }, { amount: "100000", visit: "outpatient", tier: "" }] }).live.length === 0);
}

// ─────────────────────────────────────────────────────────────────────
console.log("\n[G-35] 6. 4세대 단건 PENDING — 의도한 변경이고, 공개 화면에서는 도달 불가다");
{
  // ⚠ **무회귀가 아니라 의도 변경 버킷이다.** 종전 게이트는 `result.status`를 보지 않아
  //   차단 결과도 `?? 0` 때문에 전부 0원인 카드로 그렸다. 이제 그리지 않는다.
  // ⚠ 이번 커밋에서 **차단 안내 UI는 만들지 않았다.** 저장소에 공용 PENDING 컴포넌트가 없고
  //   (네 화면이 NoticeBox 패턴을 각자 반복한다), 이 화면은 `tier`를 유효 리터럴로만 싣고
  //   stray 축을 넘기지 않아 공개 화면에서 도달 경로를 찾지 못했다 — **없다고 단정하지 않는다.**
  check("4세대 단건 게이트가 status를 본다", /result !== null && result\.status === "OK"/.test(SRC.g4));
  check("화면이 급여 통원에만 종별을 싣는다(도달 불가의 근거)",
    /tier: coverage === "benefit" && visit === "outpatient" \? tier : undefined/.test(SRC.g4));
  check("종별 상태가 유효 리터럴로만 초기화된다", /useState<Tier>\("clinic"\)/.test(SRC.g4));
  check("차단 안내 UI를 새로 만들지 않았다", !/PENDING_UNVERIFIED/.test(SRC.g4));
}

console.log(`\n[G-35 정상 0원 결과 카드] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
