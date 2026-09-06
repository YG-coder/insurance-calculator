// G-11A — 5세대 **단건**의 두 금액 입력을 엄격하게 검증한다.
//   ① `outpatientLimit`   / 통원 가입금액 (선택)
//   ② `priorDeductible`   / 계약해당일 기준 1년간 이미 누적된 중증 비급여 입원 공제금액
//
// ⚠ **`nhisRate`(건강보험 본인부담률)는 이번 대상이 아니다.** 비율 필드는 금액과 계약이
//   다르고(표기 허용 범위·소수 자릿수·0~100 범위·모바일 키보드 영향), `type="number"`의
//   브라우저별 실제 도달 가능 입력을 먼저 정해야 한다. G-11B로 분리했다.
//   같은 페이지에서 단건과 다회가 **동일한 "건강보험 본인부담률 (%)" 라벨을 두 번** 렌더하는
//   문제도 G-11B에서 함께 다룬다.
//
// 종전 동작(기준선 `git archive 9f86643`을 실제로 실행해 확인): 두 칸 모두 공용 `AmountInput`.
//   위젯이 매 입력마다 `replace(/[^0-9]/g,"")`로 숫자 아닌 문자를 **지우고 15자리로 자른다**.
//     `-1`·`+1`→1, `1.5`→15, `1e3`→13, `1,0`→10, `20만`→20,
//     `abc`·공백만→`""`, `9007199254740993`→`900719925474099`(절단).
//   그 값이 그대로 엔진에 갔다. 관측된 결과:
//     · 통원 가입금액 `1e3` → 1회당 한도 **13원** → 보험 적용 13원(공개 화면에서 재현).
//     · 누적 공제금액 `9007199254740993` → 절단값이 남은 여지를 0으로 만들어 **공제 0원**
//       → 본인부담 0원 / 보험 적용 전액(공개 화면에서 재현).
//   ⚠ 방향(과다·과소)은 비교 대상인 실제 계약값·이력을 알 때만 말할 수 있다. 여기서는
//     **원문이 다른 숫자로 바뀌거나 절단됐다**는 사실과 계산 결과만 기록한다.
//
// 이번 계약
//   - 파서는 같은 화면의 `gen2026SingleAmount`를 **재사용**한다. 다회의 `gen2026Money`는
//     다른 화면이므로 가져오지 않는다.
//   - 위젯은 두 칸 모두 `RawAmountInput`. **공용 위젯 파일은 수정하지 않았다.**
//   - **빈 값의 뜻이 서로 다르다** — 통원 가입금액 `undefined`(미적용), 공제금액 `0`.
//     기존 계약을 유지한 것이며, 그렇게 보는 것이 안전하다고 확정한 것이 아니다.
//   - 통원 가입금액의 상한(20만원)과 `0 = 미입력` 판정은 **엔진 정책**이라 그대로 둔다.
//   - 활성 경로가 실제로 쓰는 입력만 검증한다. 숨은 입력은 검증도 전달도 하지 않는다.
//   - 중증·비중증 통원 상태는 이번에 **분리하지 않는다**(약관상 두 계약값의 관계 미확정).
//
// 검사의 역할 분담
//   - 노출·숨김·복원은 화면을 직접 본다. **전달 형태는 소스 검사**로 확인한다.
//   - 계산 결과 비교는 **무회귀와 차단**을 확인하는 역할이다.
//   - 값 입력은 전부 실제 위젯 `onChange`를 거친다.
import { readFileSync } from "node:fs";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
const UI_PATH = "src/components/calculators/HealthCalc5th.tsx";
const code = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(code);
/** 주석 줄을 뺀 소스. 금지 패턴 검사는 **주석에 걸리면 안 되므로** 이쪽을 본다. */
const body = code.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

type Comp = () => unknown;
const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalc5th as unknown as Comp, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
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
/** id로 위젯을 찾아 **공용 위젯을 실제로 호출해** 그 안의 `<input>`까지 내려간다. */
const widget = (h: H, id: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.props.id === id);
  if (n === undefined) return null;
  if (n.tag === "#RawAmountInput") return findIn((RawAmountInput as unknown as (p: never) => unknown)(n.props as never), "input");
  return n.tag === "input" ? { props: n.props } : null;
};
const has = (h: H, id: string) => widget(h, id) !== null;
const typeInto = (h: H, id: string, v: string) => {
  const w = widget(h, id); if (w === null) throw new Error("입력을 찾지 못했습니다: " + id);
  (w.props.onChange as (e: unknown) => void)({ target: { value: v } });
};
const shown = (h: H, id: string) => { const w = widget(h, id); return w === null ? null : String(w.props.value); };
const scr = (h: H) => {
  const r = h.render(); const it = r.resultItems();
  const boxes = r.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox" && n.props.variant === "warning").map((n) => String(n.text));
  return {
    calc: it !== null,
    own: it === null ? null : (it[2]?.value ?? null),
    pay: it === null ? null : (it[3]?.value ?? null),
    warn: boxes.join(" || "),
    invalidBox: (field: string) => boxes.some((t) => t.includes(field) && t.includes("올바르게 입력해 주세요")),
  };
};
const LIMIT = "med5-outpatient-limit", DEDUCT = "med5-prior-annual-deductible", AMT = "med5-amount";

/** 중증 통원 — 통원 가입금액이 보이는 경로. */
const outp = (over: Record<string, unknown> = {}) =>
  setup({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amount: "300000", ...over });
/** 중증 입원 상급종합·종합병원 — 누적 공제금액이 보이는 경로. */
const inp = (over: Record<string, unknown> = {}) =>
  setup({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "hospital", amount: "10000000", ...over });

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
console.log("\n[파서] 두 입력 모두 유효값은 계산되고 무효값은 차단된다");
{
  const CASES: [string, () => H, string, string][] = [
    ["통원 가입금액", () => outp(), LIMIT, "통원 가입금액"],
    ["누적 공제금액", () => inp(), DEDUCT, "이미 누적된 공제금액"],
  ];
  for (const [name, make, id, field] of CASES) {
    let okValid = 0, okInvalid = 0, okRaw = 0;
    for (const [, v] of VALID) {
      const h = make(); typeInto(h, id, v);
      if (scr(h).calc && !scr(h).invalidBox(field)) okValid++;
      if (shown(h, id) === v) okRaw++;      // 원문 보존 — 정제·절단하지 않는다
    }
    for (const [, v] of INVALID) {
      const h = make(); typeInto(h, id, v);
      const s = scr(h);
      if (!s.calc && s.invalidBox(field) && shown(h, id) === v) okInvalid++;
    }
    check(`${name}: 유효 ${VALID.length}종 계산 · 무효 ${INVALID.length}종 차단 · 원문 보존`,
      okValid === VALID.length && okInvalid === INVALID.length && okRaw === VALID.length,
      `유효 ${okValid}/${VALID.length} · 무효 ${okInvalid}/${INVALID.length} · 원문 ${okRaw}/${VALID.length}`);
  }
}

// ── 빈 값의 뜻이 필드마다 다르다 ──────────────────────────────────────
console.log("\n[기존 계약] 빈 값의 뜻이 두 필드에서 다르다");
{
  check("통원 가입금액 초기값은 \"\"", shown(outp(), LIMIT) === "");
  check("누적 공제금액 초기값은 \"0\"", shown(inp(), DEDUCT) === "0");

  const base = outp();                                   // 빈 값 = 미적용
  const noLimit = scr(base).own;
  const zero = outp(); typeInto(zero, LIMIT, "0");
  check("통원 가입금액 빈 값 → 미적용", noLimit === "90,000원", String(noLimit));
  check("  명시적 0도 같은 결과(엔진이 0을 미입력으로 본다)", scr(zero).calc && scr(zero).own === noLimit,
    `${noLimit} vs ${scr(zero).own}`);
  check("  둘 다 무효 안내가 없다", !scr(base).invalidBox("통원 가입금액") && !scr(zero).invalidBox("통원 가입금액"));
  const applied = outp(); typeInto(applied, LIMIT, "100,000");
  check("  100,000 입력 → 1회당 한도 적용", scr(applied).own === "200,000원", String(scr(applied).own));

  const dZero = inp();                                   // 초기값 "0"
  const withZero = scr(dZero).own;
  const dEmpty = inp(); typeInto(dEmpty, DEDUCT, "");
  check("누적 공제금액 빈 값 → 0과 같은 계산", scr(dEmpty).calc && scr(dEmpty).own === withZero,
    `${withZero} vs ${scr(dEmpty).own}`);
  check("  빈 값에는 무효 안내가 없다", !scr(dEmpty).invalidBox("이미 누적된 공제금액"));
  check("  빈 원문이 0으로 되쓰이지 않는다", shown(dEmpty, DEDUCT) === "");
}

// ── 계산 영향 (한도가 가리지 않는 사례) ───────────────────────────────
console.log("\n[계산 영향] 값이 실제로 결과를 바꾼다");
{
  // 중증 통원 300,000원 · 공제 Max(30%, 3만) = 90,000원. 1회당 한도가 보험금을 깎는다.
  const h = outp();
  typeInto(h, LIMIT, "200,000");
  check("통원 한도 200,000 → 보험 적용 200,000원", scr(h).pay === "200,000원", String(scr(h).pay));
  typeInto(h, LIMIT, "");
  check("  비우면 한도 미적용 → 210,000원", scr(h).pay === "210,000원", String(scr(h).pay));

  // 중증 입원 상급종합·종합병원 10,000,000원 · 공제 30% = 300만, 상한 500만.
  const d = inp();
  typeInto(d, DEDUCT, "0");
  check("공제 0 → 본인부담 3,000,000원", scr(d).own === "3,000,000원", String(scr(d).own));
  typeInto(d, DEDUCT, "4,000,000");
  check("공제 400만 누적 → 남은 여지 100만까지만", scr(d).own === "1,000,000원", String(scr(d).own));
  typeInto(d, DEDUCT, "5000000");
  check("상한 소진 → 공제 0원", scr(d).own === "0원", String(scr(d).own));
  typeInto(d, DEDUCT, "9000000");
  check("500만 초과 유효값도 그대로 받는다(엔진이 상한 처리)", scr(d).calc && scr(d).own === "0원", String(scr(d).own));
}

// ── 활성 조건 ────────────────────────────────────────────────────────
console.log("\n[활성 조건] 노출·검증·전달이 엔진 소비 조건과 같다");
{
  check("일반 비급여 통원: 통원 가입금액 칸이 보인다", has(outp(), LIMIT));
  check("  일반 비급여 입원: 칸이 없다", !has(outp({ visit: "inpatient", nbInpatientTier: "clinic" }), LIMIT));
  check("  급여 통원: 칸이 없다", !has(setup({ coverage: "benefit", visit: "outpatient", amount: "300000" }), LIMIT));
  check("  별도 보장종목 통원: 칸이 없다", !has(outp({ nonBenefitItem: "mri" }), LIMIT));
  check("  비중증 통원에도 보인다(중증·비중증이 같은 상태를 쓴다)", has(outp({ severity: "non_critical" }), LIMIT));

  check("중증 입원 상급종합·종합병원: 공제금액 칸이 보인다", has(inp(), DEDUCT));
  check("  병·의원급: 칸이 없다", !has(inp({ nbInpatientTier: "clinic" }), DEDUCT));
  check("  비중증: 칸이 없다", !has(inp({ severity: "non_critical" }), DEDUCT));
  check("  통원: 칸이 없다", !has(inp({ visit: "outpatient" }), DEDUCT));
  check("  급여: 칸이 없다", !has(setup({ coverage: "benefit", visit: "inpatient", amount: "300000" }), DEDUCT));
  check("두 칸이 같은 화면에 함께 뜨지 않는다", !has(outp(), DEDUCT) && !has(inp(), LIMIT));
}

// ── 숨은 값 격리 ─────────────────────────────────────────────────────
console.log("\n[숨은 값] 검증도 전달도 하지 않고 원문만 보존한다");
{
  const h = outp();
  typeInto(h, LIMIT, "1e3");
  check("통원 가입금액 무효: 차단되고 안내가 뜬다", !scr(h).calc && scr(h).invalidBox("통원 가입금액"));
  h.set("visit", "inpatient"); h.set("nbInpatientTier", "clinic");
  check("입원으로 전환: 칸·안내가 사라지고 계산 재개", !has(h, LIMIT) && scr(h).calc && !scr(h).invalidBox("통원 가입금액"));
  const clean = outp({ visit: "inpatient", nbInpatientTier: "clinic" });
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(h).own === scr(clean).own, `${scr(h).own} vs ${scr(clean).own}`);
  h.set("visit", "outpatient");
  check("통원으로 복귀: 원문과 무효 안내가 함께 돌아온다",
    shown(h, LIMIT) === "1e3" && !scr(h).calc && scr(h).invalidBox("통원 가입금액"));
  typeInto(h, LIMIT, "200,000");
  check("고치면 계산 재개", scr(h).calc && scr(h).pay === "200,000원", String(scr(h).pay));
}
{
  const d = inp();
  typeInto(d, DEDUCT, "9007199254740993");
  check("공제금액 무효: 차단되고 안내가 뜬다", !scr(d).calc && scr(d).invalidBox("이미 누적된 공제금액"));
  d.set("nbInpatientTier", "clinic");
  check("병·의원급으로 전환: 칸·안내가 사라지고 계산 재개", !has(d, DEDUCT) && scr(d).calc && !scr(d).invalidBox("이미 누적된 공제금액"));
  const clean = inp({ nbInpatientTier: "clinic" });
  check("  숨은 무효값이 계산에 섞이지 않는다", scr(d).own === scr(clean).own, `${scr(d).own} vs ${scr(clean).own}`);
  d.set("nbInpatientTier", "hospital");
  check("복귀: 원문과 무효 안내가 함께 돌아온다",
    shown(d, DEDUCT) === "9007199254740993" && !scr(d).calc && scr(d).invalidBox("이미 누적된 공제금액"));
}
{
  // 별도 보장종목으로 이동하면 두 값 모두 숨은 값이 된다(엔진이 그 항목을 먼저 차단한다).
  const h = outp();
  typeInto(h, LIMIT, "abc");
  check("일반 비급여에서 무효값을 남긴 뒤", !scr(h).calc);
  h.set("nonBenefitItem", "mri");
  check("별도 보장종목으로 이동: 무효 안내가 사라지고 엔진 차단 안내만 남는다",
    !scr(h).invalidBox("통원 가입금액") && scr(h).warn.includes("현재 계산 대상이 아닙니다"));
  h.set("nonBenefitItem", "general");
  check("일반으로 돌아오면 무효 안내가 다시 나타난다", shown(h, LIMIT) === "abc" && scr(h).invalidBox("통원 가입금액"));
}

// ── 다른 안내와의 순서·공존 ──────────────────────────────────────────
console.log("\n[안내] 병원비 우선 정책을 지키고 서로 가리지 않는다");
{
  const h = outp({ amount: "abc" });
  typeInto(h, LIMIT, "1e3");
  check("병원비가 무효인 동안에는 새 안내를 만들지 않는다(G-4 정책)",
    scr(h).warn.includes("병원비") && !scr(h).invalidBox("통원 가입금액"));
  typeInto(h, AMT, "300000");
  check("  병원비를 고치면 통원 가입금액 안내가 나타난다", scr(h).invalidBox("통원 가입금액"));
}
{
  // 두 필드가 동시에 활성인 경로는 없다(통원 ↔ 입원). 각 경로에서 자기 안내만 뜬다.
  const a = outp(); typeInto(a, LIMIT, "-1");
  check("통원 경로: 통원 가입금액 안내만", scr(a).invalidBox("통원 가입금액") && !scr(a).invalidBox("이미 누적된 공제금액"));
  const b = inp(); typeInto(b, DEDUCT, "-1");
  check("입원 경로: 공제금액 안내만", scr(b).invalidBox("이미 누적된 공제금액") && !scr(b).invalidBox("통원 가입금액"));
}

// ── 무변경 영역 ──────────────────────────────────────────────────────
console.log("\n[무변경] 진료비·선택 게이트·별도 보장종목 차단은 그대로");
{
  const h = inp();
  check("급여 입원 계산 유지", scr(setup({ coverage: "benefit", visit: "inpatient", amount: "300000" })).own === "60,000원");
  check("비급여 중증 입원 상급종합·종합병원 기본 계산 유지", scr(h).own === "3,000,000원", String(scr(h).own));
  check("진료비 0원 정책 유지(안내 없이 결과만 숨김)", !scr(inp({ amount: "0" })).calc);
  check("진료비 무효는 여전히 차단", !scr(inp({ amount: "abc" })).calc && scr(inp({ amount: "abc" })).warn.includes("병원비"));
  check("치료유형 미선택 차단 유지", !scr(setup({ coverage: "non_benefit", amount: "300000" })).calc);
  check("질환 구분 미선택 차단 유지", !scr(setup({ coverage: "non_benefit", nonBenefitItem: "general", amount: "300000" })).calc);
  check("입원 종별 미선택 차단 유지",
    !scr(setup({ coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", amount: "300000" })).calc);
  for (const it of ["musculoskeletal_esw", "injection", "mri", "room_charge"]) {
    check(`별도 보장종목 차단 유지(${it})`,
      !scr(setup({ coverage: "non_benefit", nonBenefitItem: it, amount: "300000" })).calc);
  }
  check("비중증 입원 병·의원급 1회당 300만 한도 유지",
    scr(inp({ severity: "non_critical", nbInpatientTier: "clinic" })).pay === "3,000,000원",
    String(scr(inp({ severity: "non_critical", nbInpatientTier: "clinic" })).pay));
}

// ── 소스 — 전달 형태와 금지 사항 ─────────────────────────────────────
console.log("\n[소스] 형식 우선 검증 · 전달 조건 · 금지 사항");
{
  check("파서는 같은 화면의 gen2026SingleAmount를 재사용한다",
    /const outpatientLimitNum = !usesOutpatientLimit \|\| outpatientLimit === ""\s*\n\s*\? undefined : gen2026SingleAmount\(outpatientLimit\);/.test(code)
    && /const priorDeductibleNum = !usesPriorDeductible \? undefined\s*\n\s*: priorDeductible === "" \? 0 : gen2026SingleAmount\(priorDeductible\);/.test(code));
  check("다회 파서를 가져오지 않는다",
    !/gen2026Money/.test(body) && !/roomChargeAmount/.test(body) && !/stdAmount/.test(body)
    && !/\bgen2026Amount\(/.test(body));
  check("전용 파서를 새로 만들지 않았다",
    (code.match(/const GEN2026_SINGLE_AMOUNT_FORMAT = /g) ?? []).length === 1
    && !/SINGLE_LIMIT_FORMAT/.test(code) && !/SINGLE_DEDUCTIBLE_FORMAT/.test(code));
  check("형식을 먼저 보고 그 뒤에 쉼표를 지운다",
    /if \(!GEN2026_SINGLE_AMOUNT_FORMAT\.test\(v\)\) return null;\s*\n\s*const n = Number\(v\.replace\(\/,\/g, ""\)\);/.test(code));
  check("쉼표를 선제거하지 않는다",
    !/outpatientLimit\.replace\(/.test(body) && !/priorDeductible\.replace\(/.test(body));
  // ⚠ `nhisRate.trim()`은 남아 있다 — 비율 필드는 G-11B다. 두 금액 필드만 본다.
  check("trim()으로 통과시키지 않는다",
    !/outpatientLimit\.trim\(\)/.test(body) && !/priorDeductible\.trim\(\)/.test(body));
  check("자릿수를 제한하지 않는다",
    !/outpatientLimit\.slice\(/.test(body) && !/priorDeductible\.slice\(/.test(body));
  check("안전 정수 검사가 살아 있다", /Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(code));
  check("화면에서 상한(20만·500만)을 깎지 않는다",
    !/Math\.min\(200000/.test(body) && !/Math\.min\(5000000/.test(body));
  check("활성 조건이 엔진 소비 조건과 같다",
    /const usesOutpatientLimit =\s*\n\s*coverage === "non_benefit" && nonBenefitItem === "general" && visit === "outpatient";/.test(code)
    && /const usesPriorDeductible =\s*\n\s*coverage === "non_benefit" && nonBenefitItem === "general"\s*\n\s*&& severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital";/.test(code));
  // ⚠ **미전달은 여기서 확인한다.** 결과 비교로는 증명되지 않는다.
  check("전달은 null을 배제한 파생만 쓴다 — 비활성이면 undefined",
    /priorAnnualDeductible: limits\.deductible,/.test(code)
    && /perVisitCoverageLimit: limits\.perVisit,/.test(code)
    && !/perVisitCoverageLimit:\s*\n?\s*visit === "outpatient"/.test(code)
    && !/priorAnnualDeductible:\s*\n?\s*severity === "critical"/.test(code));
  check("null을 배제해야 객체가 만들어진다(새 파싱 결과에 타입 단언 없음)",
    /const limits = outpatientLimitNum === null \|\| priorDeductibleNum === null\s*\n\s*\? null\s*\n\s*: \{ perVisit: outpatientLimitNum, deductible: priorDeductibleNum \};/.test(code)
    && !/outpatientLimitNum as number/.test(code) && !/priorDeductibleNum as number/.test(code)
    && !/outpatientLimitNum \?\? 0/.test(code) && !/priorDeductibleNum \?\? 0/.test(code));
  // ⚠ 종전부터 있던 `nonBenefitItem as Gen2026NonBenefitItem` 단언은 이번 대상이 아니다.
  //   "타입 단언을 쓰지 않는다"는 **새 금액 파싱 결과**에 한정된 말이다.
  check("종전 단언은 그대로 남아 있다(이번 범위 밖임을 명시)",
    /nonBenefitItem: nonBenefitItem as Gen2026NonBenefitItem,/.test(code));
  check("게이트가 기존 선택 게이트와 함께 걸린다",
    /needsItem \|\| needsSeverity \|\| needsTier \|\| limits === null/.test(code));
  // ⚠ G-11B가 급여 분기에 **본인부담률 전용** 게이트(`nhisRateNum === null`)를 넣었다.
  //   여기서 확인할 것은 **두 금액의 게이트(`limits`)가 급여 분기에 붙지 않았다**는 사실이다.
  check("급여 분기에는 두 금액의 게이트를 걸지 않는다(급여가 쓰지 않는 값이다)",
    // 급여 분기의 게이트 줄에는 `nhisRateNum`만 있고 `limits`가 없다.
    /\? nhisRateNum === null\s*\n\s*\? null\s*\n\s*: calc2026\(\{\s*\n\s*amount: num,\s*\n\s*coverage: "benefit",/.test(code)
    && !/nhisRateNum === null \|\| limits === null/.test(code)
    && !/limits === null \|\| nhisRateNum === null/.test(code)
    // 비급여 분기의 게이트 줄에는 `limits`가 있고 `nhisRateNum`이 없다.
    && /: needsItem \|\| needsSeverity \|\| needsTier \|\| limits === null\s+\? null/.test(code)
    && !/needsTier \|\| limits === null \|\| nhisRateNum/.test(code));
  check("두 칸 모두 RawAmountInput이고 AmountInput은 남아 있지 않다",
    /<RawAmountInput\n\s*id="med5-outpatient-limit"/.test(code)
    && /<RawAmountInput\n\s*id="med5-prior-annual-deductible"/.test(code)
    && !/AmountInput from "@\/components\/AmountInput"/.test(body)
    && !/<AmountInput/.test(body));
  check("초기값 계약은 그대로다",
    /const \[priorDeductible, setPriorDeductible\] = useState<string>\("0"\);/.test(code)
    && /const \[outpatientLimit, setOutpatientLimit\] = useState<string>\(""\);/.test(code));
  check("중증·비중증 통원 상태를 분리하지 않았다",
    !/outpatientLimitCritical/.test(code) && !/outpatientLimitBySeverity/.test(code)
    && (code.match(/const \[outpatientLimit, setOutpatientLimit\]/g) ?? []).length === 1);
  check("두 상태를 합치거나 서로 복사하지 않는다",
    !/setOutpatientLimit\(priorDeductible/.test(code) && !/setPriorDeductible\(outpatientLimit/.test(code));
  check("계산 결과를 과거 누적액에 되쓰지 않는다",
    !/setPriorDeductible\([^)]*result/.test(code) && !/setOutpatientLimit\([^)]*result/.test(code));
  // ── 이번 범위 밖 ──
  // ⚠ **낡은 계약을 교체했다.** G-11A 시점에는 `nhisRate`가 `type="number"` + 자동 보정이었다.
  //   G-11B가 그것을 바꿨으므로, 여기서는 **두 금액 필드와 섞이지 않았다**는 것만 본다.
  //   비율 필드의 계약은 `gen2026NhisRate.test.ts`가 본다.
  check("비율 필드는 금액 파서와 분리돼 있다",
    /const GEN2026_NHIS_RATE_FORMAT = /.test(code)
    && !/gen2026SingleAmount\(nhisRate\)/.test(code)
    && !/gen2026NhisRate\(outpatientLimit\)/.test(body)
    && !/gen2026NhisRate\(priorDeductible\)/.test(body)
    && /const \[nhisRate, setNhisRate\] = useState<string>\(""\);/.test(code));
  const widgetSrc = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  check("공용 위젯 파일은 그대로다",
    !/\.trim\(/.test(widgetSrc) && !/\.replace\(/.test(widgetSrc) && !/slice\(/.test(widgetSrc));
  const eng = readFileSync("src/lib/insurance/engine/generation2026.ts", "utf8");
  // ⚠ **낡은 계약을 교체했다.** G-11A 시점의 `outpatientLimit()`은 `value <= 0`과
  //   `!Number.isFinite(value)`를 한 줄에 묶어 명시적 `0`과 무효값을 **함께 미입력으로**
  //   처리했고, 그 한 줄을 그대로 고정하고 있었다. G-24가 네 상태로 나눴으므로 확인 대상을
  //   새 모양으로 옮긴다. 이 커밋(G-11A)이 고정하려는 요지는 **화면이 이 판정을 대신하지
  //   않는다**는 것이며, 그 요지는 아래 세 검사가 그대로 유지한다.
  check("엔진의 소비 조건·정책은 그대로다",
    /function outpatientLimit\(value: unknown, max: number\): OutpatientLimitCheck \{/.test(eng)
    && /if \(value === undefined\) return \{ state: "unset" \};/.test(eng)
    && /if \(value === 0\) return \{ state: "zero" \};/.test(eng)
    && /return \{ state: "applied", limit: Math\.min\(value, max\) \};/.test(eng)
    // ⚠ **낡은 앵커를 교체했다(G-30).** 위치·기존 의미(500만원 상한의 소비 조건·산식이
    //   그대로다)는 변함이 없다. G-30이 이 축을 **한 번만 읽어** 미소비 조합을 거부하게
    //   바꾸면서 `input.priorAnnualDeductible`을 다시 읽던 자리가 검증한 값(`rawDeductible`)을
    //   쓰는 형태로 바뀌었다. `Math.max(0, …)`와 `remaining` 산식은 한 글자도 바뀌지 않았다.
    && /const priorDeductible = Math\.max\(0, \(rawDeductible as number \| undefined\) \?\? 0\);/.test(eng)
    && /const remaining = Math\.max\(c\.annualDeductibleCap - priorDeductible, 0\);/.test(eng));
  // 화면은 여전히 이 판정을 대신하지 않는다(0·상한 판정은 엔진이 한다).
  check("화면이 통원 가입금액을 깎거나 0을 미입력으로 바꾸지 않는다",
    !/Math\.min\([^)]*outpatientLimit/.test(code) && !/outpatientLimitNum === 0 \? undefined/.test(code));
  const multi = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("다회 화면은 건드리지 않았다(G-10 계약 그대로)",
    /const priorDeductibleNum = !usesPriorDeductible \? undefined/.test(multi)
    && /priorAnnualDeductible: deductibles\.general,/.test(multi));
}

console.log(`\n[5세대 단건 두 금액 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
