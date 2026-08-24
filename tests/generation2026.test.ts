import { calc2026 } from "../src/lib/insurance/engine/generation2026";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

function checkInvariant(name: string, result: ReturnType<typeof calc2026>) {
  check(
    `${name}: 본인부담금 + 보험 적용 금액 = 총 진료비`,
    result.status !== "OK" || (result.ownPay ?? 0) + (result.insurancePay ?? 0) === result.amount,
    JSON.stringify(result),
  );
}

// #1 급여 입원 20%
{
  const r = calc2026({ amount: 300000, coverage: "benefit", visit: "inpatient" });
  check("급여 입원 20% (A)", r.status === "OK" && r.ownPay === 60000 && r.insurancePay === 240000, JSON.stringify(r));
}
// #3 HOLD: 급여 통원은 최소공제 미확정 → nhis 있어도 PENDING
{
  const r = calc2026({ amount: 300000, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4 });
  check("급여 통원: #3 최소공제 HOLD → PENDING (임의값 금지)", r.status === "PENDING_UNVERIFIED" && r.ownPay === null, JSON.stringify(r));
}
// 급여 통원: 건보율 미제공도 PENDING
{
  const r = calc2026({ amount: 300000, coverage: "benefit", visit: "outpatient" });
  check("급여 통원: 건보율 미제공 → PENDING", r.status === "PENDING_UNVERIFIED", JSON.stringify(r));
}
// 비급여인데 severity 미지정 → PENDING
{
  const r = calc2026({ amount: 300000, coverage: "non_benefit", visit: "inpatient" });
  check("비급여 severity 미지정 → PENDING", r.status === "PENDING_UNVERIFIED", JSON.stringify(r));
}
// #4·5 중증 통원 Max(30%,3만) + 회당 20만 한도
{
  const belowMinimum = calc2026({ amount: 10000, coverage: "non_benefit", visit: "outpatient", severity: "critical" });
  check("중증 통원: 진료비가 최소공제액보다 작으면 진료비까지만 부담", belowMinimum.ownPay === 10000 && belowMinimum.insurancePay === 0, JSON.stringify(belowMinimum));
  checkInvariant("중증 통원 최소공제 경계값", belowMinimum);
  const small = calc2026({ amount: 50000, coverage: "non_benefit", visit: "outpatient", severity: "critical" });
  check("중증 통원 Max(30%,3만): 5만→본인 3만", small.ownPay === 30000 && small.insurancePay === 20000, JSON.stringify(small));
  const big = calc2026({ amount: 1000000, coverage: "non_benefit", visit: "outpatient", severity: "critical" });
  check("중증 통원 회당 20만 한도", big.ownPay === 800000 && big.insurancePay === 200000 && !!big.cappedBy?.includes("20만"), JSON.stringify(big));
  checkInvariant("중증 통원 한도 적용", big);
}
// #6 중증 입원 상한 500만 (상급종합·종합만)
{
  const hosp = calc2026({ amount: 30000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "hospital" });
  check("중증 입원 상한 500만 (상급종합·종합)", hosp.ownPay === 5000000 && !!hosp.cappedBy?.includes("500만"), JSON.stringify(hosp));
  checkInvariant("중증 입원 상한 적용", hosp);
  const accumulated = calc2026({ amount: 10000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "hospital", priorAnnualPaid: 4000000 });
  check("중증 입원 상한에 연 누적 자기부담 반영", accumulated.ownPay === 1000000 && accumulated.insurancePay === 9000000, JSON.stringify(accumulated));
  checkInvariant("중증 입원 연 누적 상한 적용", accumulated);
  const clinic = calc2026({ amount: 30000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "clinic" });
  check("중증 입원 상한: 병·의원급엔 미적용", clinic.ownPay === 9000000 && !clinic.cappedBy, JSON.stringify(clinic));
}
// #7·9 비중증 입원 50% + 회당 300만 한도
{
  const r = calc2026({ amount: 10000000, coverage: "non_benefit", visit: "inpatient", severity: "non_critical" });
  check("비중증 입원 50% + 회당 300만 한도", r.ownPay === 7000000 && r.insurancePay === 3000000 && !!r.cappedBy?.includes("300만"), JSON.stringify(r));
  checkInvariant("비중증 입원 한도 적용", r);
}
// #7·9 비중증 통원 Max(50%,5만) + 일당 20만 한도
{
  const belowMinimum = calc2026({ amount: 10000, coverage: "non_benefit", visit: "outpatient", severity: "non_critical" });
  check("비중증 통원: 진료비가 최소공제액보다 작으면 진료비까지만 부담", belowMinimum.ownPay === 10000 && belowMinimum.insurancePay === 0, JSON.stringify(belowMinimum));
  checkInvariant("비중증 통원 최소공제 경계값", belowMinimum);
  const small = calc2026({ amount: 100000, coverage: "non_benefit", visit: "outpatient", severity: "non_critical" });
  check("비중증 통원 Max(50%,5만): 10만→본인 5만", small.ownPay === 50000 && small.insurancePay === 50000, JSON.stringify(small));
  const big = calc2026({ amount: 500000, coverage: "non_benefit", visit: "outpatient", severity: "non_critical" });
  check("비중증 통원 일당 20만 한도", big.ownPay === 300000 && big.insurancePay === 200000 && !!big.cappedBy?.includes("20만"), JSON.stringify(big));
  checkInvariant("비중증 통원 한도 적용", big);
}

console.log(`\n[generation2026 코어] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
