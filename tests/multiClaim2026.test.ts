import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

{
  // 2026-09-03: 통원 가입금액은 약관상 "20만원 이내에서 계약자가 선택한 금액"이라
  //   상수로 자동 적용하지 않는다. 사용자가 준 경우에만 구속된다.
  const r = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [1_000_000, 1_000_000], outpatientCoverageLimit: 200_000 });
  check("중증 통원 1회당 가입금액 20만 두 번", r.totalInsurancePay === 400_000);
  check("회당 한도 코드", r.appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"));
}
{
  const r = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", amounts: [10_000_000, 10_000_000] });
  check("비중증 입원 회당 300만 두 번", r.totalInsurancePay === 6_000_000);
  check("회당 한도 코드", r.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"));
}
{
  const r = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [10_000_000, 10_000_000], priorAnnualDeductible: 4_000_000 });
  check("중증 입원 자기부담 잔여 100만을 건 사이 누적", r.lines[0].ownPay === 1_000_000 && r.lines[1].ownPay === 0);
  check("500만 공제금액 상한 코드", r.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_DEDUCTIBLE_ANNUAL"));
}
{
  // 2026-09-03: 연간 보험가입금액도 "1천만원 이내에서 계약자가 선택한 금액"(제5조①)이라
  //   입력한 경우에만 적용된다.
  const r = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient", amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000, annualCoverageLimit: 10_000_000 });
  check("비중증 연간 보험금 잔여 10만 적용", r.totalInsurancePay === 100_000 && r.totalOwnPay === 900_000, JSON.stringify(r));
  check("비중증 연간 한도 코드", r.appliedCaps.includes("GEN2026_NONCRITICAL_ANNUAL_COVERAGE"));
  // 같은 날 통원은 약관이 1건으로 규정한다(특별약관2는 조문 자체가 "통원 1일당").
  check("같은 날 통원 합산 입력 안내", r.notes.some((x) => x.includes("한 행으로 합쳐 입력")) && !r.notes.some((x) => x.includes("서로 다른 날짜")));
}
{
  const pending = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "outpatient", amounts: [100_000] });
  check("급여 통원 건보율 미입력은 보류", pending.status === "PENDING_UNVERIFIED" && pending.totalOwnPay === null);
  const ok = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [100_000, 200_000] });
  check("건보율 입력 시 두 건 계산", ok.status === "OK" && ok.totalOwnPay === 120_000 && ok.totalInsurancePay === 180_000);
}
{
  const r = calculateMany2026({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [-1, Number.NaN, 100_000.9] });
  check("입력 정규화", r.lines.map((x) => x.amount).join(",") === "0,0,100000");
  check("합계 정합", (r.totalOwnPay ?? 0) + (r.totalInsurancePay ?? 0) === r.totalAmount);
  check("정수 확정", r.lines.every((x) => Number.isInteger(x.ownPay) && Number.isInteger(x.insurancePay)));
}


// ── 2026-09-03 별표15 2026.5.6 직독 반영분 ──────────────────────────
{
  // 중증 통원 연간 100회 한도 (특별약관1 제3조: 매년 계약해당일부터 1년간 통원 100회)
  const r = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient",
    amounts: [300_000, 300_000], priorAnnualOutpatientVisits: 99,
  });
  check("중증 통원 100회 직전 1건은 보상", r.lines[0].covered === true);
  check("100회 초과 건은 보상 제외", r.lines[1].covered === false && r.lines[1].ownPay === 300_000 && r.lines[1].insurancePay === 0);
  check("초과 건에 횟수 capCode", r.lines[1].appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_ANNUAL_VISITS"));

  // 통원 가입금액은 계약자 선택값 — 미입력 시 미적용
  const noLimit = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [1_000_000],
  });
  check("통원 가입금액 미입력 시 한도 미적용", noLimit.totalInsurancePay === 700_000 && noLimit.totalOwnPay === 300_000);
  check("미입력 안내 문구", noLimit.notes.some((n) => n.includes("입력하지 않으면 적용하지 않습니다")));

  const withLimit = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient",
    amounts: [1_000_000], outpatientCoverageLimit: 100_000,
  });
  check("계약자가 정한 통원 가입금액 10만이 구속", withLimit.totalInsurancePay === 100_000 && withLimit.totalOwnPay === 900_000);

  // 입원에는 통원 가입금액을 적용하지 않는다
  const inpatient = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "inpatient",
    amounts: [1_000_000], outpatientCoverageLimit: 100_000,
  });
  check("입원에는 통원 가입금액 미적용", inpatient.totalOwnPay === 500_000 && inpatient.totalInsurancePay === 500_000);

  // 같은 날 통원은 합산해 한 행으로 — 약관 근거가 있으므로 미지원 고지가 아니라 합산 안내
  const nonCritical = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient", amounts: [100_000],
  });
  check("비중증 통원은 1일당 기준 안내", nonCritical.notes.some((n) => n.includes("통원 1일당")));
  check("합산 입력 안내", nonCritical.notes.some((n) => n.includes("한 행으로 합쳐 입력")));
  check("미지원 고지 제거", !nonCritical.notes.some((n) => n.includes("정확히 계산할 수 없습니다")));

  // 자기부담 상한 500만원은 계약해당일 기준 연간 — 건 사이 누적은 종전대로
  const cap = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", tier: "hospital",
    amounts: [10_000_000, 10_000_000],
  });
  check("중증 입원 자기부담 상한 500만 누적", (cap.lines[0].ownPay ?? 0) + (cap.lines[1].ownPay ?? 0) === 5_000_000);
}


// ── 2026-09-03 실행 검증에서 잡힌 결함 회귀 방지 ────────────────────
{
  // (1) 급여 통원에 비급여 전용 안내가 붙지 않아야 한다. 급여·비급여 × 입원·통원 전수.
  const BAN_NONBENEFIT = ["통원 1일당", "한 행으로 합쳐 입력", "통원 가입금액", "연간 보험가입금액"];
  let leaked = 0;
  for (const visit of ["outpatient", "inpatient"] as const) {
    const r = calculateMany2026({
      cause: "disease", coverage: "benefit", visit, tier: "clinic", amounts: [300_000],
      nhisCoinsuranceRate: visit === "outpatient" ? 0.2 : undefined,
    });
    const joined = r.notes.join(" ");
    if (BAN_NONBENEFIT.some((b) => joined.includes(b))) leaked++;
  }
  check("급여 경로에는 비급여 전용 안내가 붙지 않음", leaked === 0, `누출 ${leaked}건`);

  // 비급여 통원에는 붙고, 비급여 입원에는 통원 안내가 붙지 않는다.
  const nbOut = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [300_000] });
  check("비급여 통원에는 통원 안내가 붙음", nbOut.notes.join(" ").includes("통원 가입금액"));
  const nbIn = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", amounts: [300_000] });
  check("비급여 입원에는 통원 안내가 붙지 않음", !nbIn.notes.join(" ").includes("한 행으로 합쳐 입력"));

  // (3) 중증 합산 안내는 약관의 "같은 치료 목적"·"동일 의료기관" 조건을 담아야 한다.
  const merged = nbOut.notes.join(" ");
  check("중증 합산 안내에 동일 의료기관 조건", merged.includes("동일한 의료기관"));
  check("중증 합산 안내에 같은 치료 목적 조건", merged.includes("같은 치료를 목적으로"));
  check("중증 합산 안내에 예외 명시", merged.includes("치료 목적이 다르거나 다른 의료기관이면"));

  // (2) 0원·빈 행은 중증 통원 횟수를 소진하지 않는다.
  const zeroRow = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient",
    amounts: [0, 300_000], priorAnnualOutpatientVisits: 99,
  });
  check("0원 행은 횟수를 소진하지 않음 — 뒤따르는 실제 청구가 보상됨",
    zeroRow.lines[1].covered === true && zeroRow.lines[1].ownPay === 90_000, JSON.stringify(zeroRow.lines[1]));

  // 99 / 100 / 101회 경계
  const at99 = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [300_000], priorAnnualOutpatientVisits: 99 });
  check("99회 사용 후 1건은 보상(100회째)", at99.lines[0].covered === true);
  const at100 = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [300_000], priorAnnualOutpatientVisits: 100 });
  check("100회 사용 후 1건은 제외(101회째)", at100.lines[0].covered === false);
  const across = calculateMany2026({ cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", amounts: [300_000, 300_000], priorAnnualOutpatientVisits: 99 });
  check("경계를 걸치는 2건은 앞만 보상", across.lines[0].covered === true && across.lines[1].covered === false);

  // (5) 통원 가입금액 경계: 미입력 / 0 / 음수 / 10만 / 20만 초과
  const base = () => ({ cause: "disease" as const, coverage: "non_benefit" as const, nonBenefitItem: "general" as const, severity: "critical" as const, visit: "outpatient" as const, amounts: [1_000_000] });
  const none = calculateMany2026(base());
  const zero = calculateMany2026({ ...base(), outpatientCoverageLimit: 0 });
  const neg = calculateMany2026({ ...base(), outpatientCoverageLimit: -50_000 });
  check("가입금액 0은 미입력으로 처리(0원 한도를 적용하지 않음)",
    zero.totalInsurancePay === none.totalInsurancePay && zero.totalInsurancePay === 700_000, JSON.stringify(zero));
  check("가입금액 0일 때도 미적용 안내", zero.notes.some((n) => n.includes("입력하지 않으면 적용하지 않습니다")));
  check("가입금액 음수도 미입력으로 처리", neg.totalInsurancePay === 700_000);
  const ten = calculateMany2026({ ...base(), outpatientCoverageLimit: 100_000 });
  check("가입금액 10만 적용", ten.totalInsurancePay === 100_000);
  const over = calculateMany2026({ ...base(), outpatientCoverageLimit: 500_000 });
  check("가입금액이 약관 상한선 20만을 넘으면 20만으로 절삭", over.totalInsurancePay === 200_000);

  // (6) 연간 보험가입금액도 계약자 선택값이다.
  const noAnnual = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient",
    amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000,
  });
  check("연간 가입금액 미입력이면 연간 한도를 적용하지 않음", noAnnual.totalInsurancePay === 500_000, JSON.stringify(noAnnual));
  check("연간 가입금액 미적용 안내", noAnnual.notes.some((n) => n.includes("연간 보험가입금액도 계약자가 선택한 값")));
  const withAnnual = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient",
    amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000, annualCoverageLimit: 10_000_000,
  });
  check("연간 가입금액 입력 시 잔여 10만 적용", withAnnual.totalInsurancePay === 100_000, JSON.stringify(withAnnual));
  const annualZero = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient",
    amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000, annualCoverageLimit: 0,
  });
  check("연간 가입금액 0은 미입력으로 처리", annualZero.totalInsurancePay === 500_000);
  const annualOver = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient",
    amounts: [100_000_000], annualCoverageLimit: 90_000_000,
  });
  check("연간 가입금액이 상한선 5천만을 넘으면 5천만으로 절삭", annualOver.totalInsurancePay === 50_000_000, JSON.stringify(annualOver));
}


// ── 상해/질병 보장축 분리 (특별약관1·2 제5조① — 각 축에 대해 따로 정해진다) ──────
{
  const injury = calculateMany2026({
    cause: "injury", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient",
    tier: "hospital", amounts: [100_000_000], annualCoverageLimit: 50_000_000,
  });
  const disease = calculateMany2026({
    cause: "disease", coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient",
    tier: "hospital", amounts: [100_000_000], annualCoverageLimit: 50_000_000,
  });
  // 축이 달라도 각 묶음은 자기 축의 한도를 온전히 쓴다. 한 묶음에 섞이지 않는다.
  check("상해 축과 질병 축이 각각 연간 한도를 온전히 사용",
    injury.totalInsurancePay === 50_000_000 && disease.totalInsurancePay === 50_000_000);
  check("상해 축 안내", injury.notes[0].includes("상해·비급여 보장축"));
  check("질병 축 안내", disease.notes[0].includes("질병·비급여 보장축"));
  check("동일 축 입력 조건 안내", injury.notes[0].includes("입력한 모든 행과 기존 지급보험금"));
  check("다른 원인은 별도 계산 안내", injury.notes[0].includes("다른 원인의 청구는 별도로 계산"));

  // 급여 축 라벨도 원인을 반영한다.
  const benefit = calculateMany2026({
    cause: "injury", coverage: "benefit", visit: "inpatient", amounts: [1_000_000],
  });
  check("급여 축 라벨", benefit.notes[0].includes("상해·급여 보장축"));

  // 기존 지급보험금도 축별로 따로 누적된다 — 같은 입력이라도 축이 다르면 별도 계산이다.
  const injuryPrior = calculateMany2026({
    cause: "injury", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient",
    amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000, annualCoverageLimit: 10_000_000,
  });
  check("축별 기존 지급보험금 누적", injuryPrior.totalInsurancePay === 100_000);
  // 미적용 안내는 가입금액을 입력하지 않은 경우에만 나온다. 그때 축이 명시되어야 한다.
  const injuryNoLimit = calculateMany2026({
    cause: "injury", coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient",
    amounts: [1_000_000],
  });
  check("연간 가입금액 미적용 안내에 축 명시", injuryNoLimit.notes.join(" ").includes("상해비급여 축의 가입금액"), injuryNoLimit.notes.join(" | "));
}

console.log(`\n[multiClaim2026] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
