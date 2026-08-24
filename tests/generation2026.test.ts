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
// 급여 통원: 금융위 원문으로 확인한 최소공제 + 건별 건보 본인부담률
{
  const r = calc2026({ amount: 300000, coverage: "benefit", visit: "outpatient", tier: "clinic", nhisCoinsuranceRate: 0.4 });
  check("급여 통원: Max(건보율 40%, 20%, 병·의원 1만원)", r.status === "OK" && r.ownPay === 120000 && r.insurancePay === 180000, JSON.stringify(r));
  const hospitalMin = calc2026({ amount: 20000, coverage: "benefit", visit: "outpatient", tier: "hospital", nhisCoinsuranceRate: 0.2 });
  check("급여 통원: 상급·종합병원 최소공제 2만원", hospitalMin.status === "OK" && hospitalMin.ownPay === 20000 && hospitalMin.insurancePay === 0, JSON.stringify(hospitalMin));
}
// 급여 통원: 건보율 미제공은 PENDING
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
  check("중증 통원 회당 20만 한도", big.ownPay === 800000 && big.insurancePay === 200000 && big.appliedCaps.includes("GEN2026_CRITICAL_OUTPATIENT_PER_VISIT"), JSON.stringify(big));
  checkInvariant("중증 통원 한도 적용", big);
}
// #6 중증 입원 상한 500만 (상급종합·종합만)
{
  const hosp = calc2026({ amount: 30000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "hospital" });
  check("중증 입원 상한 500만 (상급종합·종합)", hosp.ownPay === 5000000 && hosp.appliedCaps.includes("GEN2026_CRITICAL_INPATIENT_OWN_PAY_ANNUAL"), JSON.stringify(hosp));
  checkInvariant("중증 입원 상한 적용", hosp);
  const accumulated = calc2026({ amount: 10000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "hospital", priorAnnualPaid: 4000000 });
  check("중증 입원 상한에 연 누적 자기부담 반영", accumulated.ownPay === 1000000 && accumulated.insurancePay === 9000000, JSON.stringify(accumulated));
  checkInvariant("중증 입원 연 누적 상한 적용", accumulated);
  const clinic = calc2026({ amount: 30000000, coverage: "non_benefit", visit: "inpatient", severity: "critical", tier: "clinic" });
  check("중증 입원 상한: 병·의원급엔 미적용", clinic.ownPay === 9000000 && clinic.appliedCaps.length === 0, JSON.stringify(clinic));
}
// #7·9 비중증 입원 50% + 회당 300만 한도
{
  const r = calc2026({ amount: 10000000, coverage: "non_benefit", visit: "inpatient", severity: "non_critical" });
  check("비중증 입원 50% + 회당 300만 한도", r.ownPay === 7000000 && r.insurancePay === 3000000 && r.appliedCaps.includes("GEN2026_NONCRITICAL_INPATIENT_PER_VISIT"), JSON.stringify(r));
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
  check("비중증 통원 일당 20만 한도", big.ownPay === 300000 && big.insurancePay === 200000 && big.appliedCaps.includes("GEN2026_NONCRITICAL_OUTPATIENT_PER_DAY"), JSON.stringify(big));
  checkInvariant("비중증 통원 한도 적용", big);
}

// ── 전 매트릭스 불변식 (settle() 정수화 이후이므로 === 비교가 안전하다) ──
{
  const amounts = [0, 1, 9999, 10000, 30000, 50000, 100000, 100001, 100003, 300001, 1000000, 10000000, 30000000, 99999999];
  const coverages = ["benefit", "non_benefit"] as const;
  const visits = ["outpatient", "inpatient"] as const;
  const tiers = ["clinic", "hospital"] as const;
  const severities = [undefined, "critical", "non_critical"] as const;
  const priors = [0, 4000000, 5000000];

  let cases = 0, bad = 0;
  const firstFails: string[] = [];
  for (const amount of amounts)
    for (const coverage of coverages)
      for (const visit of visits)
        for (const tier of tiers)
          for (const severity of severities)
            for (const priorAnnualPaid of priors) {
              cases++;
              const r = calc2026({ amount, coverage, visit, tier, severity, priorAnnualPaid });
              if (r.status !== "OK") continue; // PENDING은 금액을 반환하지 않는다
              const own = r.ownPay ?? NaN;
              const ins = r.insurancePay ?? NaN;
              const ok =
                own + ins === r.amount &&
                own >= 0 && ins >= 0 && own <= r.amount &&
                Number.isInteger(own) && Number.isInteger(ins);
              if (!ok) {
                bad++;
                if (firstFails.length < 5)
                  firstFails.push(`[${amount}/${coverage}/${visit}/${tier}/${severity}/prior:${priorAnnualPaid}] own=${own} ins=${ins} amount=${r.amount}`);
              }
            }
  check(`전 매트릭스 불변식 (${cases}케이스): 합계·비음수·정수`, bad === 0, firstFails.join(" | "));
}

// ── 반올림 정책 고정 (settle.ts ROUNDING_POLICY: ownPay 확정 + round) ──
// 이 테스트는 정책이 바뀌면 반드시 실패해야 한다. 실패 시 settle.ts 정책 블록을 먼저 확인할 것.
{
  const r = calc2026({ amount: 100001, coverage: "non_benefit", visit: "outpatient", severity: "non_critical" });
  check("반올림 정책: ownPay 확정 + round(.5 올림) → 50,000.5 → 50,001", r.ownPay === 50001 && r.insurancePay === 50000, JSON.stringify(r));
  const c = calc2026({ amount: 100005, coverage: "non_benefit", visit: "outpatient", severity: "critical" });
  check("반올림 정책: 중증 30% 타이 → 30,001.5 → 30,002", c.ownPay === 30002 && c.insurancePay === 70003, JSON.stringify(c));
}

console.log(`\n[generation2026 코어] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
