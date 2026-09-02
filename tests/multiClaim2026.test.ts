import { calculateMany2026 } from "../src/lib/insurance/engine/multiClaim2026";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

{
  const r = calculateMany2026({ coverage: "non_benefit", severity: "critical", visit: "outpatient", amounts: [1_000_000, 1_000_000] });
  check("중증 통원 회당 20만 두 번", r.totalInsurancePay === 400_000);
  check("회당 한도 코드", r.appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"));
}
{
  const r = calculateMany2026({ coverage: "non_benefit", severity: "non_critical", visit: "inpatient", amounts: [10_000_000, 10_000_000] });
  check("비중증 입원 회당 300만 두 번", r.totalInsurancePay === 6_000_000);
  check("회당 한도 코드", r.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"));
}
{
  const r = calculateMany2026({ coverage: "non_benefit", severity: "critical", visit: "inpatient", tier: "hospital", amounts: [10_000_000, 10_000_000], priorAnnualOwnPay: 4_000_000 });
  check("중증 입원 자기부담 잔여 100만을 건 사이 누적", r.lines[0].ownPay === 1_000_000 && r.lines[1].ownPay === 0);
  check("500만 자기부담 상한 코드", r.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL"));
}
{
  const r = calculateMany2026({ coverage: "non_benefit", severity: "non_critical", visit: "outpatient", amounts: [1_000_000], priorAnnualInsurancePaid: 9_900_000 });
  check("비중증 연간 보험금 잔여 10만 적용", r.totalInsurancePay === 100_000 && r.totalOwnPay === 900_000, JSON.stringify(r));
  check("비중증 연간 한도 코드", r.appliedCaps.includes("GEN2026_NONCRITICAL_ANNUAL_COVERAGE"));
  check("같은 날 다회 통원 미지원 고지", r.notes.some((x) => x.includes("서로 다른 날짜")) && !r.notes.some((x) => x.includes("한 행으로 합쳐")));
}
{
  const pending = calculateMany2026({ coverage: "benefit", visit: "outpatient", amounts: [100_000] });
  check("급여 통원 건보율 미입력은 보류", pending.status === "PENDING_UNVERIFIED" && pending.totalOwnPay === null);
  const ok = calculateMany2026({ coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4, amounts: [100_000, 200_000] });
  check("건보율 입력 시 두 건 계산", ok.status === "OK" && ok.totalOwnPay === 120_000 && ok.totalInsurancePay === 180_000);
}
{
  const r = calculateMany2026({ coverage: "benefit", visit: "inpatient", amounts: [-1, Number.NaN, 100_000.9] });
  check("입력 정규화", r.lines.map((x) => x.amount).join(",") === "0,0,100000");
  check("합계 정합", (r.totalOwnPay ?? 0) + (r.totalInsurancePay ?? 0) === r.totalAmount);
  check("정수 확정", r.lines.every((x) => Number.isInteger(x.ownPay) && Number.isInteger(x.insurancePay)));
}

console.log(`\n[multiClaim2026] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
