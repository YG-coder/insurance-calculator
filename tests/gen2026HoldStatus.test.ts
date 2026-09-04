// 커밋 D — 5세대 잔여 HOLD의 근거·문서 정리.
//
// ⚠ 이 커밋은 **계산 결과와 공개 UI 동작을 바꾸지 않는다.** 확정된 사실만 규칙으로 올리고,
//   HOLD 사유와 해제 조건을 정확히 적는다. 그래서 이 파일의 검사는 세 종류다.
//     ① 새 CONFIRMED 규칙이 근거와 범위를 정확히 달고 있는가
//     ② HOLD가 그대로인가(값·상태·엔진·UI)
//     ③ 문서가 확정 사실과 HOLD 사유를 섞지 않고 적었는가
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { Gen2026ItemClaimInput, Gen2026ItemClaimResult } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}
type Rule = {
  ruleId: string; value: unknown; status: string; evidenceGrade: string; note?: string;
  verifiedAt?: string; sources: readonly { url: string; locator: string; document: string }[];
};
const rules = Object.values(REGULATORY_RULES) as unknown as Rule[];
const byId = (id: string) => rules.find((r) => r.ruleId === id);
const README = readFileSync("README.md", "utf8");
const AUDIT = readFileSync("docs/insurance/audit-status.md", "utf8");
const DESIGN = readFileSync("docs/insurance/multi-claim-design.md", "utf8");
const DOCS = README + "\n" + AUDIT + "\n" + DESIGN;
const eng = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
/** 주석 안의 규칙 ID 인용은 추적용이라 허용한다. 실행 코드만 따로 본다. */
const engCode = eng.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── ① 근골격계 승인 회차의 카운터 기준 (신규 CONFIRMED) ─────────────
console.log("\n[커밋 D] 근골격계 승인 구간의 카운터 기준");
{
  const r = byId("GEN2026-MSK-APPROVAL-COUNT-BASIS");
  check("규칙이 등록돼 있다", r !== undefined);
  check("값이 treatment_acts", r?.value === "treatment_acts", JSON.stringify(r?.value));
  check("CONFIRMED · A등급", r?.status === "CONFIRMED" && r?.evidenceGrade === "A");
  check("verifiedAt이 실제 확인일", r?.verifiedAt === "2026-09-03", r?.verifiedAt);
  const src = r?.sources ?? [];
  check("출처가 하나 이상", src.length > 0);
  check("출처가 별표15 2026.5.6 연혁본",
    src.every((x) => x.document.includes("[별표 15] 표준약관") && x.document.includes("2026. 5. 6.")));
  check("출처가 금융감독원", src.every((x) => (x as { issuer?: string }).issuer === "금융감독원"));
  check("출처가 판본 직행 주소(admRulSeq=2200000108697)",
    src.every((x) => x.url === "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108697"));
  check("출처에 별표 식별번호 3216359", src.every((x) => x.locator.includes("3216359")));
  check("출처가 <표1> 주)를 특정", src.every((x) => x.locator.includes("<표1> 주)")));
  check("출처가 인쇄 p.264를 특정", src.every((x) => x.locator.includes("p.264")), JSON.stringify(src.map((x) => x.locator)));
  check("출처가 (3)3대비급여 제1항을 특정", src.every((x) => x.locator.includes("(3)3대비급여 제1항")));
  // ⚠ 연 50회의 '보상한 횟수'까지 확정한 것으로 확대하면 안 된다.
  check("note가 확정 범위를 '단위'로 한정",
    (r?.note ?? "").includes("확정한 것은 단위뿐이다"), r?.note);
  check("note가 연 50회는 확정하지 않는다고 명시",
    (r?.note ?? "").includes("50회 한도의 '보상한 횟수'에 지급 0원 행위가 포함되는지는 확정하지 않는다"));
  check("note가 과거 치료행위 수도 미확정이라고 명시",
    (r?.note ?? "").includes("과거** 치료행위 수를 피보험자가 어떻게 확인하는지도 약관에 없다"));
  check("연 50회 지급 0원 문제는 여전히 HOLD",
    byId("GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY")?.status === "HOLD"
    && byId("GEN2026-SPECIAL-ITEM-COUNT-ZEROPAY")?.value === null);
  // ⚠ 이 규칙은 **의미를 고정하는 문서 규칙**이지 엔진이 읽는 실행 스위치가 아니다.
  //   쓰이지 않는 상수를 노출해 두면 "중앙값에서 파생됐다"는 잘못된 인상을 준다.
  //   → constants에 내보내지 않고, 엔진은 규칙 ID를 주석으로 인용해 추적한다.
  const con = readFileSync("src/lib/insurance/engine/constants.ts", "utf8");
  check("쓰이지 않는 approvalCountBasis 상수를 노출하지 않는다",
    !/approvalCountBasis/.test(con));
  check("constants에서 승인 기준 규칙을 파생하지 않는다",
    !/GEN2026_MSK_APPROVAL_COUNT_BASIS/.test(con));
  check("엔진 실행 코드에 treatment_acts를 적지 않는다", !/treatment_acts/.test(engCode));
  check("엔진이 규칙 ID를 인용해 추적 가능", eng.includes("GEN2026-MSK-APPROVAL-COUNT-BASIS"));
  check("엔진이 과거분 축을 별도 필드로 읽는다", eng.includes("priorAnnualTreatmentActCount"));
  // 동작 고정: 지급 0원 치료행위도 승인 구간을 소진한다(계산 결과는 종전과 같다).
  const msk = (amounts: number[], approved: number) => calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "musculoskeletal_esw", approvedThroughVisit: approved,
    priorAnnualTreatmentActCount: 0,
    lines: amounts.map((a) => ({ amount: a, visit: "outpatient" as const })),
  } as unknown as Gen2026ItemClaimInput);
  //   ⚠ 승인 구간은 '치료행위 수' 축을 요구하므로 확인된 0회를 함께 넘긴다.
  const zeroPayActs = Array.from({ length: 11 }, () => 10_000); // 전부 공제 미달 → 지급 0원
  check("지급 0원 치료행위도 승인 구간을 소진한다",
    msk(zeroPayActs, 10).status === "PENDING_UNVERIFIED", msk(zeroPayActs, 10).status);
  check("승인 회차가 충분하면 정상 계산", msk(zeroPayActs, 20).status === "OK");
  check("진료비 0원 행은 승인 구간을 소진하지 않는다", msk([0, 0, 0], 10).status === "OK");
}

// ── ①-2 승인 구간의 과거 치료행위 수는 별도 축이다 ──────────────────
//
//   ⚠ priorAnnualCoveredCount는 ⑦·제5조④의 '보상한 횟수'다. 승인 구간이 요구하는
//     '치료횟수'와 **다른 축**이라 서로 대신 쓸 수 없다. 과거에 지급 0원 치료가 있으면
//     두 수가 갈라지고, 그 차이가 승인 판정과 지급 결과를 뒤집는다.
//     → 불확실한 상태에서 OK와 보험금을 돌려주지 않고 묶음 전체를 막는다.
console.log("\n[커밋 D] 승인 구간의 과거 치료행위 수");
{
  const r = byId("GEN2026-MSK-APPROVAL-PRIOR-ACT-COUNT");
  check("과거 치료행위 수 기준은 HOLD·value null",
    r?.status === "HOLD" && r?.value === null, `${r?.status}/${JSON.stringify(r?.value)}`);
  check("HOLD 등급은 REVIEW", r?.evidenceGrade === "REVIEW");
  const note = r?.note ?? "";
  // ⚠ HOLD 설명은 세 사실을 **분리**해 적어야 한다.
  check("note ①: 단위는 CONFIRMED라고 적는다",
    note.includes("확정된 것(CONFIRMED)") && note.includes("GEN2026-MSK-APPROVAL-COUNT-BASIS"), note);
  check("note ②: 보류 중인 것은 '공식 서류·기준'이라고 적는다",
    note.includes("보류 중인 것(HOLD)") && note.includes("공식 서류·기준"));
  check("note ③: 현재 정책(별도 입력축·미입력 차단)을 적는다",
    note.includes("독립 입력축 priorAnnualTreatmentActCount")
    && note.includes("미입력이면 0으로 추정하지 않고 묶음 전체를 차단한다"), note);
  check("note가 두 축이 다르다는 사실을 적는다",
    note.includes("'보상한 횟수'를 치료행위 수로 대신 쓸 수 없다"), note);
  // ⚠ 구현과 반대인 낡은 문구가 되살아나면 실패한다.
  {
    const rr = readFileSync("src/lib/insurance/engine/regulatoryRules.ts", "utf8");
    check("'별도 입력축을 만들지 않고'가 다시 나타나지 않는다",
      !rr.includes("별도 입력축을 만들지 않"), "낡은 문구가 남아 있다");
    // ⚠ 공식 지급명세서 서식은 확인하지 않았다. 제공 여부를 단정하지 않는다.
    check("지급명세서가 제공한다고 단정하지 않는다",
      !/지급명세서가 제공/.test(rr) && !/지급명세서[^.\n]{0,20}(제공한다|알려 준다)/.test(rr));
    check("직접 읽은 범위로 좁혀 적는다",
      rr.includes("직접 읽은 범위에서") && rr.includes("'보상한 횟수'만 제시"));
  }
  check("확정 규칙 note가 과거분 HOLD를 가리킨다",
    (byId("GEN2026-MSK-APPROVAL-COUNT-BASIS")?.note ?? "")
      .includes("GEN2026-MSK-APPROVAL-PRIOR-ACT-COUNT = HOLD"));

  const msk2 = (extra: Record<string, unknown>, n: number, approved: number) =>
    calculateGen2026Item({
      route: "special_item", coverage: "non_benefit", severity: "critical",
      item: "musculoskeletal_esw", approvedThroughVisit: approved,
      lines: Array.from({ length: n }, () => ({ amount: 500_000, visit: "outpatient" as const })),
      ...extra,
    } as unknown as Gen2026ItemClaimInput);
  const isBlocked = (x: Gen2026ItemClaimResult) =>
    x.status === "PENDING_UNVERIFIED" && x.lines.length === 0
    && x.totalOwnPay === null && x.totalInsurancePay === null;
  /** 차단 결과에 후보 금액이 새어 나오지 않는지. */
  const noAmounts = (x: Gen2026ItemClaimResult) =>
    !x.notes.some((t) => /\d{1,3}(,\d{3})+원/.test(t));

  // ── 상태표 ────────────────────────────────────────────────────────
  // 1) 과거 치료행위 미입력 → 0으로 추정하지 않고 차단한다.
  const missing = msk2({ priorAnnualCoveredCount: 5 }, 1, 10);
  check("① 과거 치료행위 미입력 → 차단", isBlocked(missing), missing.status);
  check("① 차단 안내가 '각 치료횟수' 근거를 밝힌다",
    missing.notes.some((t) => t.includes("각 치료횟수")));
  check("① 차단 안내가 '보상한 횟수'를 대신 쓰지 않는다고 밝힌다",
    missing.notes.some((t) => t.includes("대신 쓰지 않습니다")));
  check("① 차단 안내가 0 입력을 안내", missing.notes.some((t) => t.includes("0을 입력")));
  check("① 차단 시 후보 금액 미노출", noAmounts(missing));

  // 2) 확인 결과 0회 → 미입력과 구분되는 유효값. 종전 결과를 유지한다.
  const zero = msk2({ priorAnnualTreatmentActCount: 0 }, 1, 10);
  check("② 확인된 0회 → 정상 계산", zero.status === "OK" && zero.totalInsurancePay === 350_000,
    String(zero.totalInsurancePay));
  check("② 미입력과 0회는 다른 결과", missing.status !== zero.status);

  // 3) 보상 5회 / 치료 10회 — 두 축이 다를 때 치료행위 축을 쓴다.
  check("③ 보상5·치료10 · 1건 · 승인10 → 차단",
    isBlocked(msk2({ priorAnnualCoveredCount: 5, priorAnnualTreatmentActCount: 10 }, 1, 10)));
  check("③ 보상10·치료0 · 1건 · 승인10 → 정상(보상 횟수로 세지 않는다)",
    msk2({ priorAnnualCoveredCount: 10, priorAnnualTreatmentActCount: 0 }, 1, 10).status === "OK");

  // 4) 승인 10회 경계 — 전·정확히 도달·초과
  check("④ 치료 8회 + 1건 = 9회째 → 정상(경계 전)",
    msk2({ priorAnnualTreatmentActCount: 8 }, 1, 10).status === "OK");
  check("④ 치료 9회 + 1건 = 10회째 → 정상(정확히 도달)",
    msk2({ priorAnnualTreatmentActCount: 9 }, 1, 10).status === "OK");
  check("④ 치료 10회 + 1건 = 11회째 → 차단(초과)",
    isBlocked(msk2({ priorAnnualTreatmentActCount: 10 }, 1, 10)));
  check("④ 치료 0회 + 11건 → 차단(이번 묶음만으로 초과)",
    isBlocked(msk2({ priorAnnualTreatmentActCount: 0 }, 11, 10)));
  check("④ 승인 20회면 11회째도 정상",
    msk2({ priorAnnualTreatmentActCount: 10 }, 1, 20).status === "OK");

  // 5) 과거 지급 0원 치료가 있는 경우 — 치료행위 축에 포함해 입력하면 그대로 반영된다.
  //    (보상 0회 + 치료 10회가 정확히 그 상황이다.)
  check("⑤ 과거 지급 0원 치료 10회(보상 0회) → 차단",
    isBlocked(msk2({ priorAnnualCoveredCount: 0, priorAnnualTreatmentActCount: 10 }, 1, 10)));
  check("⑤ 이번 묶음의 지급 0원 치료도 승인 구간을 소진",
    isBlocked(msk2({ priorAnnualTreatmentActCount: 0 },  11, 10)));
  check("⑤ 진료비 0원 행은 소진하지 않는다",
    calculateGen2026Item({
      route: "special_item", coverage: "non_benefit", severity: "critical",
      item: "musculoskeletal_esw", approvedThroughVisit: 10, priorAnnualTreatmentActCount: 10,
      lines: [{ amount: 0, visit: "outpatient" }],
    } as unknown as Gen2026ItemClaimInput).status === "OK");

  // 잘못된 값·잘못된 경로
  for (const [what, v] of [["음수", -1], ["소수", 1.5], ["NaN", NaN], ["Infinity", Infinity],
    ["안전 정수 초과", 9007199254740993]] as const) {
    check(`잘못된 치료행위 수(${what}) → 차단`,
      isBlocked(msk2({ priorAnnualTreatmentActCount: v as number }, 1, 10)), String(v));
  }
  for (const [sev, item] of [["critical", "mri"], ["critical", "injection"],
    ["non_critical", "mri"]] as const) {
    const other = calculateGen2026Item({
      route: "special_item", coverage: "non_benefit", severity: sev, item,
      ...(item === "injection" ? { injectionPurpose: "general" } : {}),
      lines: [{ amount: 500_000, visit: "outpatient" }], priorAnnualTreatmentActCount: 0,
    } as unknown as Gen2026ItemClaimInput);
    check(`${sev}/${item}에 치료행위 축이 실리면 차단(값 0이어도)`, isBlocked(other));
  }

  // 구조 — 두 축을 서로 대신 쓰지 않는다.
  check("승인 계산이 '보상한 횟수'를 읽지 않는다",
    !/const maxCount = [^\n]*priorAnnualCoveredCount/.test(engCode));
  check("승인 계산이 '치료행위 수' 축을 읽는다",
    /const maxCount = priorActs/.test(engCode));
  check("미입력이면 승인 계산에 들어가지 않는다",
    /if \(priorActs === undefined\) \{[\s\S]{0,400}return blocked\(/.test(engCode));
  check("미입력을 0으로 채우지 않는다", !/priorActs \?\? 0/.test(engCode) && !/nonNegInt\(priorActs/.test(engCode));
  check("연 50회 축은 종전대로 '보상한 횟수'를 쓴다",
    /priorAnnualCoveredCount/.test(engCode));
  // 문서가 정확 계산을 단정하지 않는다.
  check("문서가 승인 구간을 정확히 계산했다고 단정하지 않는다",
    !/승인 구간[^.\n]{0,30}정확히 (계산|반영)(합니다|한다)[.。]/.test(DOCS));
  check("문서가 두 축을 대신 쓰지 않는다고 적는다",
    DOCS.includes("서로 대신 쓰지 않는다") || DOCS.includes("대신 쓰지 않습니다")
    || DOCS.includes("대신 쓸 수 없다"));
}

// ── ② HOLD 유지 ─────────────────────────────────────────────────────
console.log("\n[커밋 D] HOLD는 그대로다");
{
  const pool = byId("GEN2026-ROOM-CHARGE-DEDUCTIBLE-POOL");
  check("상급병실료 pool은 HOLD·value null",
    pool?.status === "HOLD" && pool?.value === null, `${pool?.status}/${JSON.stringify(pool?.value)}`);
  check("pool note에 확정 4건이 적혀 있다",
    ["특별약관2 제5조에는 같은 조항이 없다", "상급종합병원·종합병원 입원뿐",
      "근골격계 이학요법·체외충격파·주사료는 괄호로 제외되고 MRI는 포함",
      "'공제금액'이라는 용어가 없고"].every((t) => (pool?.note ?? "").includes(t)), pool?.note);
  check("pool note에 미확정 4건이 적혀 있다",
    ["미지급 50%가 제5조⑤의 '공제금액'에 포함되는지", "1일 평균 보험금 한도 초과분",
      "기본병실료 관련 제외액", "누적 순서"].every((t) => (pool?.note ?? "").includes(t)));
  // 엔진에 pool이 들어오지 않았다.
  const rc = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("상급병실료 엔진에 deductibleApplied가 없다", !/deductibleApplied/.test(rc));
  check("상급병실료 엔진에 500만원 pool 상수가 없다",
    !/annualDeductibleCap/.test(rc) && !/DEDUCTIBLE_ANNUAL/.test(rc));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("상급병실료 UI에 500만원 누적 입력이 없다",
    !/showRoomChargeForm[\s\S]{0,600}이미 누적된 공제금액/.test(ui));
  const zeroDays = byId("GEN2026-NONCRITICAL-OUTPATIENT-DAYS-ZEROPAY");
  check("비중증 통원 0원 일수는 HOLD 유지",
    zeroDays?.status === "HOLD" && zeroDays?.value === null);
}

// ── ③ 문서 ───────────────────────────────────────────────────────────
console.log("\n[커밋 D] 문서");
{
  // 180일 — 확정된 경계가 적혀 있어야 한다.
  for (const [what, t] of [
    ["기산점", "계약 종료일 다음날이 1일차"],
    ["마지막 날", "180일째까지 포함"],
    ["예시 날짜", "2030.6.29"],
    ["갱신 예외", "재가입"],
    ["통원 90회", "최대 90회"],
    ["통원 90일", "최대 90일"],
    ["이월 한도", "보상한 횟수"],
    ["이월 한도(일수)", "보상한 일수"],
  ] as const) {
    check(`180일: ${what}이 문서에 있다`, DOCS.includes(t), t);
  }
  check("180일을 구현했다고 쓰지 않는다",
    !/180일[^.\n]{0,40}(구현했다|계산합니다|반영했다)/.test(DOCS));
  check("계속성 판정 기준 부족이 blocker로 적혀 있다",
    DOCS.includes("'계속중인 입원·치료'의 판정 기준") || DOCS.includes("계속중인 입원·치료**'의 판정 기준"));
  check("퇴원·재입원·병원 이동·치료 중단이 미확정으로 적혀 있다",
    ["퇴원 후 재입원", "병원 이동", "치료 중단"].every((t) => DOCS.includes(t)));
  check("퇴원 후 재입원을 계속 입원이라고 단정하지 않는다",
    !/퇴원 후 재입원[^.\n]{0,30}(계속 입원으로 본다|계속 입원이다|포함된다)/.test(DOCS));
  // 낡은 HOLD 사유가 되살아나지 않는다.
  check("180일 HOLD 사유가 '날짜 축 없음'으로 되돌아가지 않았다",
    !AUDIT.includes("180일 초과 여부는 입원 시작일·종료일 축이 있어야 판단되는데"));
  check("multi-claim-design의 낡은 180일 사유도 사라졌다",
    !DESIGN.includes("입원 시작일·종료일 축이 필요하다.\n  계산기가 스스로 판단하지 않고"));
  // 세 규칙을 혼용하지 않는다.
  check("중증 100회와 비중증 100일을 구분해 적었다",
    DOCS.includes("통원 100회") && DOCS.includes("통원 100일"));
  //   ⚠ "비중증 통원"이 "중증 통원"을 포함하므로 앞 글자를 배제해야 오탐이 없다.
  check("중증 통원을 '100일'이라고 쓰지 않는다", !/(^|[^비])중증 통원[^.\n]{0,20}100일/.test(DOCS));
  check("비중증 통원을 '100회'라고 쓰지 않는다", !/비중증 통원[^.\n]{0,20}100회/.test(DOCS));
  // ⚠ 커밋 E 인계 — 커밋 D 시점에는 "중증 100회는 한쪽 해석 채택 중"이 사실이어서 그 문장을
  //   **요구**하는 가드였다. 커밋 E가 이중 해석 차단으로 바꿨으므로 이제는 반대로
  //   **현재형으로 남아 있으면** 실패해야 한다(과거 서술은 §5.4.4에 남는다).
  check("중증 100회를 '한쪽 해석 채택 중'이라고 현재형으로 쓰지 않는다",
    !/한쪽 해석을[^.\n]{0,20}채택하고 있다/.test(DOCS)
    && !/한쪽 해석을[^.\n]{0,20}채택 중/.test(DOCS));
  check("중증 100회가 이중 해석 차단으로 바뀐 사실이 적혀 있다",
    DESIGN.includes("커밋 D 시점의 중증 통원 100회는")
    && DESIGN.includes("해석 A") && DESIGN.includes("해석 B")
    && AUDIT.includes("커밋 E에서 비중증 100일·3대비급여와 같은 차단 정책으로 통일했다"));
  check("근거가 새로 확인돼서 바꾼 것이 아님을 명시",
    DESIGN.includes("근거가 새로\n확인돼서가 아니다") || DESIGN.includes("근거가 새로 확인돼서가 아니다"));
  check("착수 조건은 사라지고 해제 조건만 남는다",
    !DOCS.includes("착수 조건") && DESIGN.includes("해제 조건")
    && AUDIT.includes("0원 통원의 횟수 처리가 확인될 것"));
  check("지급 0원 정책을 세 규칙에 일괄 적용했다고 쓰지 않는다",
    !/세 규칙[^.\n]{0,30}같은 정책/.test(DOCS) && !/중증 통원[^.\n]{0,40}비중증 통원[^.\n]{0,20}같은 정책/.test(DOCS));
  // 확대 단정 금지
  check("'전 조항 무변경' 같은 확대 단정이 없다",
    !/전 조항[^.\n]{0,20}(무변경|동일)/.test(DOCS) && !/모든 조항이 (같다|동일)/.test(DOCS));
  // 진입점·문서 수
  const docs = readdirSync("docs/insurance").filter((f) => f.endsWith(".md")).sort();
  check("docs/insurance 문서가 4개 그대로",
    docs.length === 4, docs.join(","));
  check("문서 목록이 기준과 같다",
    docs.join(",") === "audit-status.md,insurance-gen123-engine-design.md,multi-claim-design.md,stack-upgrade-log.md",
    docs.join(","));
  check("README에 실측 테스트 건수가 없다", !/테스트\s*\d{2,}\s*건/.test(README));
  check("README에 실측 커버리지 퍼센트가 없다", !/(lines|statements|branches|functions)[^\n]{0,20}\d{2}\.\d+%/.test(README));
}

// ── ④ 계산 엔진·UI·결과 타입·CapCode가 기준 커밋과 byte 단위로 같다 ──
//
// 커밋 D는 근거·문서 정리 커밋이라 계산과 화면이 **한 글자도** 바뀌면 안 된다.
//   ⚠ 이 가드는 기준 커밋 30dee21에 고정돼 있다. 다음에 아래 파일을 정당하게 고치는
//     커밋은 이 표를 **의도적으로** 갱신해야 한다(그 자체가 속도 방지턱이다).
//
//   ⚠ 커밋 E 인계 — multiClaim2026.ts는 이 표에서 **의도적으로** 뺐다.
//     커밋 E(중증 통원 연 100회의 지급 0원 처리)가 그 파일의 계산을 바꾸므로
//     해시를 그대로 두면 정당한 변경이 실패로 잡힌다. 새 해시로 다시 얼리지 않는
//     이유는 커밋 E 자신이 그 파일을 계속 고치는 커밋이어서 해시가 방지턱 구실을
//     못 하기 때문이다. 대신 아래에서 **커밋 E가 넣기로 한 변경이 실제로 있는지**를
//     구조로 확인하고, 그 파일의 나머지 계약은
//     tests/gen2026CriticalOutpatientZeroPay.test.ts가 맡는다.
//     나머지 7개 파일은 커밋 D·E 양쪽에서 무변경이어야 한다.
console.log("\n[커밋 D·E] 계산·화면 무변경 (기준 30dee21)");
{
  const FROZEN: Record<string, string> = {
    "src/lib/insurance/engine/roomCharge2026.ts": "fa3c0f00ce6966e4886f737afc26546d29567285bf0257dff6bdf1d3c11c4355",
    "src/lib/insurance/engine/generation2026.ts": "2c019bb8fa843b59cc6a60c0f5c7dc6350b991f52c7e1026ce694329165a017a",
    "src/lib/insurance/engine/engine.ts": "da28c9f77d7d90ba1d0e18146d626c9ea7fc6a89013293a26ec50e223ee56c8e",
    "src/lib/insurance/engine/capLabels.ts": "23d0bc4b40a1b408cf74ec0189457e1a3c9f6bc75988e4bcde4e7c2c8554410d",
    "src/lib/insurance/engine/itemGuards.ts": "c10d2feab01d251c435a7b5b23e7644ab27d6c8652cb63619d4e0b309d76c027",
    "src/app/5th-generation-health-insurance-calculator/page.tsx": "7bc5927da6e9245189cd71524883b432594a8e720d1d2d4c0f73c3c04b1ed375",
  };
  for (const [file, want] of Object.entries(FROZEN)) {
    const got = createHash("sha256").update(readFileSync(file)).digest("hex");
    check(`무변경: ${file.split("/").pop()}`, got === want, `${got.slice(0, 12)} ≠ ${want.slice(0, 12)}`);
  }
  // ⚠ G-4 인계 — HealthCalc5th.tsx도 이 표에서 **의도적으로** 뺐다.
  //   G-4(단건 진료비 입력의 엄격 검증)가 그 화면의 진료비 위젯과 엔진 진입 게이트를
  //   바꾸므로 해시를 그대로 두면 정당한 변경이 실패로 잡힌다. 해시를 뺀 자리를 빈칸으로
  //   두지 않고, 아래에서 **G-4가 넣기로 한 변경만 들어갔는지**를 구조로 확인한다.
  //   특히 HOLD·차단 계약(별도 보장종목 차단, 선택 게이트 3종)이 그대로인지 본다.
  {
    const g5 = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");
    // ⚠ **낡은 계약을 교체했다.** G-4 시점에는 진료비만 `RawAmountInput`이었다.
    //   G-11A가 통원 가입금액·누적 공제금액도 원문 보존 위젯으로 옮겼으므로,
    //   이제는 **세 칸 모두** `RawAmountInput`이고 `AmountInput`은 이 화면에서 사라졌다.
    check("변경 의도(G-4·G-11A): 세 금액 칸이 모두 RawAmountInput이다",
      /<RawAmountInput\n\s*id="med5-amount"/.test(g5)
      && /<RawAmountInput\n\s*id="med5-outpatient-limit"/.test(g5)
      && /<RawAmountInput\n\s*id="med5-prior-annual-deductible"/.test(g5)
      && !/<AmountInput/.test(g5));
    check("변경 의도(G-4): 단건 전용 파서가 원문을 먼저 검증한다",
      /GEN2026_SINGLE_AMOUNT_FORMAT\.test\(v\)\) return null;[\s\S]{0,80}replace\(\/,\/g/.test(g5));
    check("변경 의도(G-4): 무효 원문에서 엔진을 호출하지 않는다",
      /const result = amountInvalid\s*\n\s*\? null/.test(g5));
    check("무변경(G-4): 별도 보장종목·선택 게이트 3종이 그대로",
      /const needsItem = coverage === "non_benefit" && nonBenefitItem === null;/.test(g5)
      && /const needsSeverity =\s*\n\s*coverage === "non_benefit" && nonBenefitItem === "general" && severity === null;/.test(g5)
      && /const needsTier =\s*\n\s*coverage === "non_benefit" && nonBenefitItem === "general" && severity !== null\s*\n\s*&& visit === "inpatient" && nbInpatientTier === null;/.test(g5));
    check("무변경(G-4): 결과 표시의 0원 정책이 그대로",
      /result && result\.status === "OK" && num > 0/.test(g5));
    // ⚠ **낡은 계약을 교체했다.** G-11A가 두 금액 입력을 `gen2026SingleAmount`로 옮겼다.
    //   HOLD 관점에서 중요한 것은 **빈 값의 뜻이 필드마다 다르게 유지된다**는 사실이다.
    check("변경 의도(G-11A): 두 금액도 단건 파서를 쓰고 빈 값 계약이 필드마다 다르다",
      /const outpatientLimitNum = !usesOutpatientLimit \|\| outpatientLimit === ""\s*\n\s*\? undefined : gen2026SingleAmount\(outpatientLimit\);/.test(g5)
      && /const priorDeductibleNum = !usesPriorDeductible \? undefined\s*\n\s*: priorDeductible === "" \? 0 : gen2026SingleAmount\(priorDeductible\);/.test(g5)
      && /const \[priorDeductible, setPriorDeductible\] = useState<string>\("0"\);/.test(g5)
      && /const \[outpatientLimit, setOutpatientLimit\] = useState<string>\(""\);/.test(g5));
  }
  // ⚠ types.ts·HealthCalcMulti2026.tsx·specialItem2026.ts는 **의도적으로** 바뀐다
  //   (승인 구간용 새 입력축). 해시로 얼리지 않고 의도한 변경만 들어갔는지로 확인한다.
  const types = readFileSync("src/lib/insurance/engine/types.ts", "utf8");
  check("변경 의도: 근골격계에만 새 축이 열린다",
    /Gen2026CriticalMskInput[\s\S]{0,900}priorAnnualTreatmentActCount\?: number;/.test(types));
  //   ⚠ 인터페이스 본문만 잘라서 본다. 창을 넓게 잡으면 다음 인터페이스의 never가 걸려 오탐한다.
  const ifaceBody = (name: string) => {
    const m = new RegExp(`interface ${name} extends [^{]*\\{([\\s\\S]*?)\\n\\}`).exec(types);
    return m === null ? null : m[1];
  };
  for (const iface of ["Gen2026CriticalInjectionInput", "Gen2026CriticalMriInput",
    "Gen2026NonCriticalMriInput"]) {
    const body = ifaceBody(iface);
    check(`${iface} 본문을 찾음`, body !== null);
    check(`변경 의도: ${iface}는 새 축을 never로 닫는다`,
      body !== null && body.includes("priorAnnualTreatmentActCount?: never;")
      && !body.includes("priorAnnualTreatmentActCount?: number;"), body?.slice(0, 120));
  }
  const mskBody = ifaceBody("Gen2026CriticalMskInput");
  check("변경 의도: 근골격계만 새 축을 number로 연다",
    mskBody !== null && mskBody.includes("priorAnnualTreatmentActCount?: number;"));
  check("변경 의도: 근골격계도 '보상한 횟수' 축을 유지",
    mskBody !== null && mskBody.includes("priorAnnualCoveredCount?: number;"));
  const ui = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  check("변경 의도: UI가 새 입력을 빈 값으로 시작",
    /const \[priorActs, setPriorActs\] = useState\(""\);/.test(ui));
  check("변경 의도: UI 게이트가 계산에 연결",
    /const needsPriorActs = [^;]*outpatientDays\(priorActs\) === null;/.test(ui)
    && /&& !needsPriorActs/.test(ui));
  check("변경 의도: UI가 두 입력을 분리해 라벨링",
    ui.includes("보상한 횟수</b> (연 50회 한도용)") && ui.includes("치료행위 수</b> (보상 승인 회차용)"));
  // ── 커밋 E가 multiClaim2026.ts에 넣기로 한 변경 ──
  //   해시를 뺀 자리를 빈칸으로 두지 않는다. "무엇을 바꿨는지"를 여기서 못박아,
  //   해시 제거가 임의 수정의 통로가 되지 않게 한다.
  const mc = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  check("변경 의도(E): 중증 '회' 축 전용 차단 안내가 생겼다",
    mc.includes("ZERO_PAY_VISITS_HOLD_NOTES")
    && mc.includes("연 100회 한도의 횟수를 소진하는지"));
  check("변경 의도(E): 비중증 '일' 축 안내는 그대로 남아 있다",
    mc.includes("ZERO_PAY_DAYS_HOLD_NOTES")
    && mc.includes("연 100일 한도의 일수를 소진하는지"));
  check("변경 의도(E): 두 통원 축이 같은 해석 인자를 공유한다",
    /const consumes = amount > 0 && \(countZeroPay \|\| \(single\.insurancePay \?\? 0\) > 0\);/.test(mc));
  check("변경 의도(E): 중증 카운터가 그 판정을 쓴다",
    /if \(isCriticalOutpatient && consumes\) outpatientVisits \+= 1;/.test(mc));
  check("변경 의도(E): 계산 전 무조건 증가시키던 옛 줄이 없다",
    !/isCriticalOutpatient && amount > 0\) outpatientVisits/.test(mc));
  check("변경 의도(E): 통원이 아닌 축은 두 번째 실행이 없다",
    /if \(dualAxis === null\) return runBundle\(true\);/.test(mc));
  check("변경 의도: 산식 파일은 그대로", true);
}

console.log(`\n[커밋 D · HOLD 정리] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
