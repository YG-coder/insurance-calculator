// G-15 — 5세대 급여 통원의 두 입력 축을 산식 앞에서 검증한다.
//   대상: nhisCoinsuranceRate(건강보험 본인부담률, 0~1 비율) / tier(의료기관 종별)
//
// 종전 동작(기준선 69c8dab 엔진 직접 호출로 실측, UI 미경유):
//   급여 통원 분기는 두 축을 검증 없이 산식에 넣었다.
//     const rate = Math.max(nhis as number, floorRate);
//     const deduct = md[input.tier ?? "clinic"];
//   그래서 타입을 우회한 값이 그대로 닿았다.
//     - nhis가 NaN·Infinity·문자열·객체 → Math.max가 **NaN**
//     - tier가 "clinic"·"hospital" 밖의 값 → md[tier]가 **undefined** →
//       Math.max(amount * rate, undefined)가 역시 **NaN**
//   그 NaN은 settle()의 `Number.isFinite(ownPayRaw) ? ownPayRaw : 0` 폴백에 걸려
//   **자기부담금 0원 = 보험금 전액 지급**으로 끝났다 — 진료비 300,000원 청구에서
//   본인부담 0원·보험 적용 300,000원이 나왔다(**보험금 과다 산출**).
//   ⚠ settle의 불변식(ownPay + insurancePay === amount)은 그대로라 하류의 어떤 검사도
//     이것을 잡지 못했다. 값이 "이상하다"는 신호가 결과 어디에도 남지 않는다.
//
// ⚠ 이번 커밋이 하는 것과 하지 않는 것.
//   - 한다: 급여 **통원** 분기에서 두 축을 산식 앞에 검증하고 기존 pending()으로 돌린다.
//   - 하지 않는다: 산식·20% 하한·최소공제·반환 계약 변경, 급여 **입원** 변경,
//     비급여 전 경로 변경, 통원 가입금액(outpatientCoverageLimit) 처리 변경,
//     multiClaim2026.ts 변경, settle()의 유한성 폴백 제거,
//     후보 A(priorAnnualTreatmentActCount)·B(4세대 금액 축)·D(undefined 정책),
//     G-14A pool 범위 HOLD·지급 0원 HOLD 3종·상급병실료 HOLD.
//
// ⚠ 두 축의 undefined는 뜻이 다르고 그 뜻을 바꾸지 않는다.
//     nhis  — "모른다" → 종전 미제공 안내로 차단
//     tier  — **계산기의 종전 계약**(미지정을 병·의원급 최소공제로 계산) → 폴백 유지
//             ⚠ 이 폴백에 약관 근거를 붙이지 않는다. 직접 읽은 범위에서 표준약관은 종별
//               미지정의 기본값을 정하지 않으며, 유지하는 것은 기존 동작이다.
//   ⚠ 그러나 null은 **두 축 모두 거부**다. 타입 계약은 `tier?: Tier`이므로 유효값은
//     undefined·"clinic"·"hospital"뿐이고, 종전 `?? "clinic"`이 null을 병·의원급으로
//     해석한 것은 의도한 입력 계약이 아니라 관용적 부작용이었다.
import { readFileSync } from "node:fs";
import { calc2026 } from "../src/lib/insurance/engine/generation2026";
import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { CalcResult, Gen2026ClaimInput, Gen2026MultiClaimInput, MultiClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

type Caught = { threw: string } | { r: CalcResult };
const threw = (x: Caught): x is { threw: string } => "threw" in x;
const call = (input: unknown): Caught => {
  try { return { r: calc2026(input as Gen2026ClaimInput) }; }
  catch (e) { return { threw: e instanceof Error ? e.constructor.name : String(e) }; }
};
const AMOUNT = 300_000;
const out = (extra: Record<string, unknown> = {}) =>
  ({ amount: AMOUNT, coverage: "benefit", visit: "outpatient", ...extra });
const shape = (x: Caught) => threw(x) ? "THROW:" + x.threw
  : x.r.status !== "OK" ? "PENDING" : `own=${x.r.ownPay}/ins=${x.r.insurancePay}/rate=${x.r.rateApplied}/minD=${x.r.minDeductible}`;
const isPending = (x: Caught) => !threw(x) && x.r.status === "PENDING_UNVERIFIED"
  && x.r.ownPay === null && x.r.insurancePay === null && x.r.amount === AMOUNT;
const notes = (x: Caught) => threw(x) ? "" : x.r.notes.join(" ");

// 화면이 만들 수 없는 값이다 — 엔진 직접 호출 계약 전용 검사다.
const circ: Record<string, unknown> = {}; circ.self = circ;

console.log("\n[G-15] 1. 정상 입력의 결과가 그대로다");
{
  const md = GEN2026.benefit.outpatient.minDeductible;
  // 기준선(69c8dab)에서 측정한 값을 그대로 고정한다.
  for (const [label, input, want] of [
    ["rate 0 (하한 20% 적용)", out({ nhisCoinsuranceRate: 0, tier: "clinic" }), `own=60000/ins=240000/rate=0.2/minD=${md.clinic}`],
    ["rate 0.2 clinic", out({ nhisCoinsuranceRate: 0.2, tier: "clinic" }), `own=60000/ins=240000/rate=0.2/minD=${md.clinic}`],
    ["rate 0.2 hospital", out({ nhisCoinsuranceRate: 0.2, tier: "hospital" }), `own=60000/ins=240000/rate=0.2/minD=${md.hospital}`],
    ["rate 0.3", out({ nhisCoinsuranceRate: 0.3, tier: "clinic" }), `own=90000/ins=210000/rate=0.3/minD=${md.clinic}`],
    ["rate 0.1 (하한이 이김)", out({ nhisCoinsuranceRate: 0.1, tier: "clinic" }), `own=60000/ins=240000/rate=0.2/minD=${md.clinic}`],
    ["rate 1 (전액 자기부담)", out({ nhisCoinsuranceRate: 1, tier: "clinic" }), `own=300000/ins=0/rate=1/minD=${md.clinic}`],
    ["tier 미지정 = 병·의원급", out({ nhisCoinsuranceRate: 0.2 }), `own=60000/ins=240000/rate=0.2/minD=${md.clinic}`],
    ["최소공제가 이기는 소액(hospital)", { amount: 50_000, coverage: "benefit", visit: "outpatient", nhisCoinsuranceRate: 0.2, tier: "hospital" }, `own=${md.hospital}/ins=${50_000 - md.hospital}/rate=0.2/minD=${md.hospital}`],
  ] as [string, unknown, string][]) {
    check(`무회귀 — ${label}`, shape(call(input)) === want, shape(call(input)));
  }
  check("tier 미지정과 'clinic'이 같은 결과",
    shape(call(out({ nhisCoinsuranceRate: 0.2 }))) === shape(call(out({ nhisCoinsuranceRate: 0.2, tier: "clinic" }))));
  check("20% 하한 상수가 그대로", GEN2026.benefit.outpatient.floorRate === 0.2,
    String(GEN2026.benefit.outpatient.floorRate));
  check("최소공제가 종별로 다르다", md.clinic !== md.hospital, `${md.clinic}/${md.hospital}`);
}

console.log("\n[G-15] 2. nhisCoinsuranceRate — 거부 행렬");
{
  // undefined: 종전 미제공 안내 그대로
  const miss = call(out({ tier: "clinic" }));
  check("undefined → 종전 미제공 안내 그대로", isPending(miss)
    && notes(miss) === "급여 통원: 건강보험 본인부담률 미제공 → 계산 불가(#2 입력 필요)", notes(miss));

  for (const [label, v] of [
    ["null", null], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity],
    ["-0.1", -0.1], ["1.0001", 1.0001], ["20 (백분율 오인)", 20], ["100", 100],
    ["문자열 '0.2'", "0.2"], ["문자열 'abc'", "abc"], ["true", true], ["false", false],
    ["{}", {}], ["[]", []], ["[0.2]", [0.2]], ["순환 참조", circ], ["bigint", 1n], ["Symbol", Symbol("s")],
  ] as [string, unknown][]) {
    const x = call(out({ nhisCoinsuranceRate: v, tier: "clinic" }));
    check(`rate ${label} → 예외 없이 PENDING`, isPending(x), shape(x));
    check(`rate ${label} → 전용 안내`, notes(x).includes("0 이상 1 이하의 유한한 숫자"), notes(x).slice(0, 60));
  }
  // 경계값은 허용이다.
  // ⚠ 경계 바로 아래는 `Math.round`가 진료비까지 올릴 수 있으므로(0.999999 × 300,000 =
  //   299,999.7 → 300,000) 반올림이 개입하지 않는 값을 쓴다. 확인하려는 것은 **허용 여부**다.
  for (const [label, v, want] of [["0", 0, "own=60000"], ["1", 1, "own=300000"], ["0.999", 0.999, "own=299700"]] as [string, number, string][]) {
    const x = call(out({ nhisCoinsuranceRate: v, tier: "clinic" }));
    check(`rate 경계 ${label} → 허용`, !threw(x) && x.r.status === "OK" && shape(x).startsWith(want), shape(x));
  }
}

console.log("\n[G-15] 3. tier — 거부 행렬");
{
  for (const [label, v] of [
    ["null", null], ["'ZZZ'", "ZZZ"], ["'CLINIC'", "CLINIC"], ["'Clinic'", "Clinic"], ["''", ""],
    ["0", 0], ["1", 1], ["true", true], ["false", false], ["{}", {}], ["[]", []],
    ["['clinic']", ["clinic"]], ["순환 참조", circ], ["bigint", 1n], ["Symbol", Symbol("s")], ["NaN", NaN],
  ] as [string, unknown][]) {
    const x = call(out({ nhisCoinsuranceRate: 0.2, tier: v }));
    check(`tier ${label} → 예외 없이 PENDING`, isPending(x), shape(x));
    check(`tier ${label} → 전용 안내`, notes(x).includes('의료기관 종별(tier)은 "clinic" 또는 "hospital"'), notes(x).slice(0, 60));
  }
  const okUndef = call(out({ nhisCoinsuranceRate: 0.2, tier: undefined }));
  check("tier 명시적 undefined → 허용(병·의원급)", !threw(okUndef) && okUndef.r.status === "OK", shape(okUndef));
  const nul = call(out({ nhisCoinsuranceRate: 0.2, tier: null }));
  check("⚠ tier null은 더 이상 병·의원급으로 폴백하지 않는다",
    isPending(nul) && shape(nul) !== shape(okUndef), shape(nul));
}

console.log("\n[G-15] 4. 두 축이 동시에 무효이면 각각 안내한다");
{
  const both = call(out({ nhisCoinsuranceRate: "abc", tier: "ZZZ" }));
  check("두 안내가 모두 나온다", isPending(both)
    && notes(both).includes("0 이상 1 이하의 유한한 숫자")
    && notes(both).includes('의료기관 종별(tier)은 "clinic" 또는 "hospital"'), notes(both).slice(0, 80));
  check("안내가 2개다", !threw(both) && both.r.notes.length === 2,
    threw(both) ? both.threw : String(both.r.notes.length));
  const missAndTier = call(out({ tier: "ZZZ" }));
  check("미제공 + 잘못된 종별도 각각", isPending(missAndTier)
    && notes(missAndTier).includes("미제공 → 계산 불가")
    && notes(missAndTier).includes('"clinic" 또는 "hospital"'), notes(missAndTier).slice(0, 80));
  check("미제공 안내가 첫 줄이다", !threw(missAndTier)
    && missAndTier.r.notes[0] === "급여 통원: 건강보험 본인부담률 미제공 → 계산 불가(#2 입력 필요)");
}

console.log("\n[G-15] 5. 범위 밖 경로는 무변경");
{
  const inp = (extra: Record<string, unknown> = {}) =>
    ({ amount: AMOUNT, coverage: "benefit", visit: "inpatient", ...extra });
  const baseInp = shape(call(inp()));
  check("급여 입원 기준", baseInp === "own=60000/ins=240000/rate=0.2/minD=0", baseInp);
  for (const [label, extra] of [
    ["tier 'ZZZ'", { tier: "ZZZ" }], ["tier null", { tier: null }], ["rate 'abc'", { nhisCoinsuranceRate: "abc" }],
    ["rate null", { nhisCoinsuranceRate: null }], ["rate 20", { nhisCoinsuranceRate: 20 }],
  ] as [string, Record<string, unknown>][]) {
    check(`급여 입원 + ${label} → 종전 그대로`, shape(call(inp(extra))) === baseInp, shape(call(inp(extra))));
  }
  const nb = (extra: Record<string, unknown> = {}) => ({
    amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general",
    severity: "critical", visit: "outpatient", ...extra,
  });
  const baseNb = shape(call(nb()));
  for (const [label, extra] of [
    ["tier 'ZZZ'", { tier: "ZZZ" }], ["tier null", { tier: null }],
    ["rate 'abc'", { nhisCoinsuranceRate: "abc" }], ["rate null", { nhisCoinsuranceRate: null }],
  ] as [string, Record<string, unknown>][]) {
    check(`비급여 중증 통원 + ${label} → 종전 그대로`, shape(call(nb(extra))) === baseNb, shape(call(nb(extra))));
  }
  // 비급여 중증 입원의 종별 미지정 안내가 그대로 우선한다.
  const nbInp = call({ amount: 1_000_000, coverage: "non_benefit", nonBenefitItem: "general",
    severity: "critical", visit: "inpatient", tier: "ZZZ" });
  check("비급여 중증 입원의 기존 종별 안내가 그대로",
    !threw(nbInp) && nbInp.r.status === "PENDING_UNVERIFIED"
    && notes(nbInp).includes("중증 비급여 입원: 의료기관 종별 미지정"), notes(nbInp).slice(0, 60));
}

console.log("\n[G-15] 6. 다회는 기존 blocked() 계약으로 전달한다");
{
  const many = (extra: Record<string, unknown> = {}): MultiClaimResult =>
    // ⚠ **낡은 픽스처를 교체했다(G-30).** 종전에는 이 급여 입력에 `priorAnnualInsurancePaid: 0`을
    //   실었고, 급여가 그 축을 **조용히 폐기**했기 때문에 계산이 그대로 됐다. G-30이 그 조용한
    //   폐기를 닫아 이제 stray로 차단되므로, 급여와 무관한 그 축을 픽스처에서 뺀다.
    //   이 절이 보는 것(급여 통원의 rate·tier 입력 계약)은 그대로다.
    calculateMany2026({ coverage: "benefit", cause: "disease", visit: "outpatient",
      amounts: [AMOUNT, 150_000], ...extra } as unknown as Gen2026MultiClaimInput);
  const okRun = many({ nhisCoinsuranceRate: 0.2, tier: "clinic" });
  check("다회 정상 무회귀", okRun.status === "OK" && okRun.totalOwnPay === 90_000 && okRun.totalInsurancePay === 360_000,
    `${okRun.status}/${okRun.totalOwnPay}/${okRun.totalInsurancePay}`);
  for (const [label, extra] of [
    ["rate 'abc'", { nhisCoinsuranceRate: "abc", tier: "clinic" }],
    ["rate null", { nhisCoinsuranceRate: null, tier: "clinic" }],
    ["tier 'ZZZ'", { nhisCoinsuranceRate: 0.2, tier: "ZZZ" }],
    ["tier null", { nhisCoinsuranceRate: 0.2, tier: null }],
  ] as [string, Record<string, unknown>][]) {
    let r: MultiClaimResult | null = null, ex = "";
    try { r = many(extra); } catch (e) { ex = e instanceof Error ? e.constructor.name : String(e); }
    check(`다회 ${label} → blocked (totalAmount 보존)`,
      ex === "" && r !== null && r.status === "PENDING_UNVERIFIED"
      && r.totalAmount === 450_000 && r.totalOwnPay === null && r.totalInsurancePay === null
      && r.lines.length === 0,
      ex || `${r?.status}/${r?.totalAmount}`);
  }
  check("다회 tier 미지정은 계속 계산된다",
    many({ nhisCoinsuranceRate: 0.2 }).status === "OK");
}

console.log("\n[G-15] 7. 소스 계약");
{
  const raw = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  const body = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("본인부담률 범위 검사가 있다",
    /typeof nhis === "number" && Number\.isFinite\(nhis\) && nhis >= 0 && nhis <= 1/.test(body));
  check("종별 값 검사가 있다",
    /tierRaw !== undefined && tierRaw !== "clinic" && tierRaw !== "hospital"/.test(body));
  check("종별 폴백에서 ?? 를 쓰지 않는다", !/input\.tier \?\? "clinic"/.test(body));
  check("종별 폴백이 undefined만 병·의원급으로 본다",
    /const tier = tierRaw === "hospital" \? "hospital" : "clinic";/.test(body));
  check("검사가 산식보다 앞이다",
    body.indexOf('tierRaw !== "hospital"') < body.indexOf("const rate = Math.max(nhis as number"));
  check("미제공 안내가 그대로",
    /"급여 통원: 건강보험 본인부담률 미제공 → 계산 불가\(#2 입력 필요\)"/.test(body));
  check("산식이 그대로", /const s = settle\(amount, Math\.max\(amount \* rate, deduct\)\);/.test(body));
  check("20% 하한이 그대로", /Math\.max\(nhis as number, GEN2026\.benefit\.outpatient\.floorRate\)/.test(body));
  check("급여 입원 분기가 그대로",
    /const rate = GEN2026\.benefit\.inpatientRate;\n\s*const s = settle\(amount, amount \* rate\);/.test(body));
  // 안내를 만들면서 값을 문자열로 만들지 않는다 — Symbol·toString 예외를 피한다.
  check("안내에 받은 값 자체를 넣지 않는다(typeof만)",
    /받은 값의 형식: \$\{typeof nhis\}/.test(body) && /받은 값의 형식: \$\{typeof tierRaw\}/.test(body)
    && !/받은 값: \$\{/.test(body));
  check("showValue를 이 파일에 복제하지 않았다", !/const showValue/.test(body));
  const settleSrc = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  check("settle의 유한성 폴백을 건드리지 않았다",
    /const raw = Number\.isFinite\(ownPayRaw\) \? ownPayRaw : 0;/.test(settleSrc));
  const multi = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("multiClaim2026이 급여 통원 검사를 복제하지 않았다",
    !/nhis >= 0 && nhis <= 1/.test(multi) && /if \(single\.status !== "OK"\) return blocked\(single\.notes\);/.test(multi));
  // ⚠ 근거 표현 금지형 검사 — 종별 미지정의 폴백은 **계산기의 기존 계약**이지 약관 근거가
  //   아니다. 그 폴백에 약관 근거를 붙여 적으면 직접 읽은 범위를 넘는 단정이 된다.
  //   소스·이 테스트·설계 문서·감사 문서 어디에도 그 표현이 돌아오지 않아야 한다.
  //   ⚠ 패턴을 이어 붙여 만든다. 한 덩어리 리터럴로 적으면 **이 파일 자신이** 걸린다.
  const NO_TERMS_DEFAULT = new RegExp("약관" + "상[^\\n]{0,25}기" + "본");
  for (const [label, text] of [
    ["generation2026.ts", raw],
    ["이 테스트", readFileSync("tests/gen2026BenefitOutpatientInput.test.ts", "utf8")],
    ["multi-claim-design.md", readFileSync("docs/insurance/multi-claim-design.md", "utf8")],
    ["audit-status.md", readFileSync("docs/insurance/audit-status.md", "utf8")],
  ] as [string, string][]) {
    const m = text.match(NO_TERMS_DEFAULT);
    check(`${label}: 종별 폴백에 약관 근거를 붙인 표현이 없다`, m === null, m ? m[0] : "");
  }
  // 검사만 지우고 문장을 되돌리는 것을 막기 위해, 기존 계약임을 밝히는 표현도 함께 고정한다.
  check("종별 폴백을 계산기의 기존 계약으로 적는다",
    /계산기의 종전 계약/.test(raw) && /표준약관은 종별 미지정의 기본값을 정하지/.test(raw));

  const hold = readFileSync("tests/gen2026HoldStatus.test.ts", "utf8");
  check("FROZEN 표에 갱신 이유가 적혀 있다", /G-15에서 \*\*의도적으로\*\* 갱신했다\(종전 2c019bb8…\)/.test(hold));
  // ⚠ **낡은 계약을 교체했다(G-26).** 이 검사의 요지는 "G-15가 `generation2026.ts`만 바꿨고
  //   공용 가드 파일은 건드리지 않았다"였다. G-26이 진료비 축을 닫으면서 `itemGuards.ts`의
  //   `isNum`을 `isClaimAmount`로 교체했으므로 해시가 갱신됐다. 요지는 **G-15가 그 파일을
  //   바꾸지 않았다**는 것이므로, 갱신 이유가 G-26으로 기록돼 있는지를 대신 고정한다.
  check("FROZEN 표의 itemGuards 갱신 이유가 G-26으로 기록돼 있다",
    /G-26에서 \*\*의도적으로\*\* 갱신했다\(종전 ad08c2d9…\)/.test(hold)
    && /"src\/lib\/insurance\/engine\/itemGuards\.ts": "546f476a59ff0dd8ca85fd6e84c25eedeeaed80f63d042e1d662bdff0e1ebc94"/.test(hold));
}

console.log(`\n[G-15 급여 통원 입력 계약] ✅ ${pass} / ❌ ${fail}`);
if (fail) process.exit(1);
