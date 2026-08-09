import { calc2021 } from "../src/lib/insurance/generation2021";
import { reference2021 } from "./_reference2021";
import { Coverage, Visit, Tier } from "../src/lib/insurance/types";

const amounts = [0, 15000, 30000, 50000, 100000, 300000, 1000000, 5000000]; // 8
const coverages: Coverage[] = ["benefit", "non_benefit"];                    // 2
const visits: Visit[] = ["outpatient", "inpatient"];                         // 2
const tiers: Tier[] = ["clinic", "hospital"];                                // 2
// 8 * 2 * 2 * 2 = 64 케이스

let total = 0, mismatch = 0;
const fails: string[] = [];

for (const amount of amounts)
  for (const coverage of coverages)
    for (const visit of visits)
      for (const tier of tiers) {
        total++;
        const ref = reference2021(amount, coverage, visit, tier);
        const got = calc2021({ amount, coverage, visit, tier });
        const same =
          got.rateApplied === ref.rate &&
          got.minDeductible === ref.minDeductible &&
          got.ownPay === ref.ownPay &&
          got.insurancePay === ref.insurancePay;
        if (!same) {
          mismatch++;
          fails.push(
            `[${amount}/${coverage}/${visit}/${tier}] ref=${JSON.stringify(ref)} got=own:${got.ownPay},ins:${got.insurancePay},rate:${got.rateApplied},md:${got.minDeductible}`
          );
        }
      }

console.log(`[generation2021 회귀] 총 ${total}케이스, 불일치 ${mismatch}건`);
if (mismatch) { fails.forEach((f) => console.log("  MISMATCH " + f)); process.exit(1); }
else console.log("  ✅ 회귀 0불일치 — 현행 4세대 출력과 100% 동일");
