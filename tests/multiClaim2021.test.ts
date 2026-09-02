import { calculateMany2021 } from "../src/lib/insurance/engine/multiClaim2021";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

// 1건은 기존 단건 산식과 같고, 회당 20만원 한도가 각 건에 적용된다.
{
  const r = calculateMany2021({ cause: "disease", coverage: "non_benefit", visit: "outpatient", amounts: [1_000_000, 300_000] });
  check("회당 한도 두 건 독립 적용", r.totalInsurancePay === 400_000 && r.lines.every((x) => x.insurancePay === 200_000));
  check("회당 한도 코드", r.appliedCaps.includes("GEN2021_OUTPATIENT_PER_VISIT"));
  check("가입금액 미입력 고지", r.notes.some((x) => x.includes("증권의 금액")));
  check("질병·비급여 보장축을 결과에 명시", r.notes.some((x) => x.includes("질병·비급여 보장축")));

  const injury = calculateMany2021({ cause: "injury", coverage: "non_benefit", visit: "outpatient", amounts: [100_000] });
  check("상해 보장축을 별도로 명시", injury.notes.some((x) => x.includes("상해·비급여 보장축")));
}

// 비급여 통원 100회는 동일 보장축의 발생 순서대로 센다.
{
  const r = calculateMany2021({
    cause: "injury", coverage: "non_benefit", visit: "outpatient", amounts: [100_000, 100_000],
    priorAnnualOutpatientVisits: 99,
  });
  check("100번째는 보상", r.lines[0].covered && r.lines[0].insurancePay === 70_000);
  check("101번째는 전액 본인부담", !r.lines[1].covered && r.lines[1].ownPay === 100_000);
  check("연 100회 코드", r.lines[1].appliedCaps.includes("GEN2021_NONBENEFIT_OUTPATIENT_ANNUAL_VISITS"));

  const benefit = calculateMany2021({ cause: "injury", coverage: "benefit", visit: "outpatient", amounts: [100_000], priorAnnualOutpatientVisits: 100 });
  check("급여 통원에는 100회 한도 없음", benefit.lines[0].covered);
}

// 연간 가입금액은 사용자 입력값으로만 적용하고 입원·통원 보험금을 합산한다.
{
  const r = calculateMany2021({
    cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [500_000, 500_000],
    annualCoverageLimit: 1_000_000, priorAnnualInsurancePaid: 600_000,
  });
  check("연간 잔여 40만원만 지급", r.totalInsurancePay === 400_000 && r.totalOwnPay === 600_000, JSON.stringify(r));
  check("두 번째 건에서 연간 한도 소진", r.lines[0].insurancePay === 400_000 && r.lines[1].insurancePay === 0);
  check("연간 지급 한도 코드", r.appliedCaps.includes("GEN2021_ANNUAL_COVERAGE"));

  const cappedInput = calculateMany2021({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [100_000_000], annualCoverageLimit: 99_000_000 });
  check("증권 입력은 약관 최대 5천만원을 넘지 못함", cappedInput.totalInsurancePay === 50_000_000);
}

// 3대비급여: 공통 공제, 항목별 금액·횟수 한도.
{
  const manual = calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "manual_therapy",
    amounts: [100_000, 100_000], priorAnnualRiderVisits: 49,
  });
  check("도수 50번째 보상", manual.lines[0].insurancePay === 70_000);
  check("도수 51번째 제외", !manual.lines[1].covered && manual.lines[1].insurancePay === 0);

  const injection = calculateMany2021({
    cause: "injury", coverage: "non_benefit", visit: "inpatient", rider: "injection",
    amounts: [1_000_000], priorAnnualRiderPaid: 2_400_000,
  });
  check("주사료 잔여 10만원만 지급", injection.totalInsurancePay === 100_000 && injection.totalOwnPay === 900_000);
  check("주사료 금액 한도 코드", injection.appliedCaps.includes("GEN2021_INJECTION_ANNUAL"));

  const mri = calculateMany2021({
    cause: "disease", coverage: "non_benefit", visit: "outpatient", rider: "mri",
    amounts: [1_000_000], priorAnnualRiderPaid: 2_900_000, priorAnnualRiderVisits: 999,
  });
  check("MRI는 횟수 제한 없이 잔여 10만원 지급", mri.lines[0].covered && mri.totalInsurancePay === 100_000);
}

// 정규화 및 합계 불변식.
{
  const r = calculateMany2021({ cause: "disease", coverage: "benefit", visit: "inpatient", amounts: [-1, Number.NaN, 100_000.9] });
  check("금액 정규화", r.lines.map((x) => x.amount).join(",") === "0,0,100000");
  check("합계 정합", (r.totalOwnPay ?? 0) + (r.totalInsurancePay ?? 0) === r.totalAmount);
  check("모든 결과 정수", r.lines.every((x) => Number.isInteger(x.ownPay) && Number.isInteger(x.insurancePay)));
}

console.log(`\n[multiClaim2021] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
