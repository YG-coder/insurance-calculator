// 4세대 회귀 테스트 — 기준선(_reference2021.ts) 대비 출력 변화를 감시한다.
//
// 기준선은 동결되어 있다(정답 사양이 아니라 배포 시점 동작 기록).
// 따라서 의도된 수정으로 출력이 달라지면 INTENDED_DIVERGENCES에 등록해야 통과한다.
//   - 등록되지 않은 변화        → MISMATCH (의도치 않은 회귀)
//   - 등록됐는데 값이 다름      → WRONG_VALUE (수정이 예상과 다르게 동작)
//   - 등록됐는데 기준선과 같음  → STALE (수정이 되돌아갔거나 항목이 불필요)
import { calc2021 } from "../src/lib/insurance/engine/generation2021";
import { reference2021 } from "./_reference2021";
import { Coverage, Visit, Tier } from "../src/lib/insurance/engine/types";

type Key = string; // `${amount}/${coverage}/${visit}/${tier}`

interface Divergence { ownPay: number; insurancePay: number; reason: string }

// 의도된 출력 변경. 승인 근거와 날짜를 남긴다.
// R-1: 자기부담금이 진료비를 초과하던 결함 수정(소액 통원 경계값). 2026-08-24 승인.
//      7건 모두 보험 적용 금액은 변경 전후 0원 — 보험금 산출액은 바뀌지 않는다.
const R1 = "R-1 자기부담금이 진료비를 초과할 수 없다 (2026-08-24)";
const INTENDED_DIVERGENCES: Record<Key, Divergence> = {
  "0/benefit/outpatient/clinic":         { ownPay: 0,     insurancePay: 0, reason: R1 },
  "0/benefit/outpatient/hospital":       { ownPay: 0,     insurancePay: 0, reason: R1 },
  "0/non_benefit/outpatient/clinic":     { ownPay: 0,     insurancePay: 0, reason: R1 },
  "0/non_benefit/outpatient/hospital":   { ownPay: 0,     insurancePay: 0, reason: R1 },
  "15000/benefit/outpatient/hospital":   { ownPay: 15000, insurancePay: 0, reason: R1 },
  "15000/non_benefit/outpatient/clinic": { ownPay: 15000, insurancePay: 0, reason: R1 },
  "15000/non_benefit/outpatient/hospital": { ownPay: 15000, insurancePay: 0, reason: R1 },
};

const amounts = [0, 15000, 30000, 50000, 100000, 300000, 1000000, 5000000]; // 8
const coverages: Coverage[] = ["benefit", "non_benefit"];                    // 2
const visits: Visit[] = ["outpatient", "inpatient"];                         // 2
const tiers: Tier[] = ["clinic", "hospital"];                                // 2
// 8 * 2 * 2 * 2 = 64 케이스

let total = 0, matched = 0, diverged = 0;
const problems: string[] = [];
const usedKeys = new Set<Key>();

for (const amount of amounts)
  for (const coverage of coverages)
    for (const visit of visits)
      for (const tier of tiers) {
        total++;
        const key: Key = `${amount}/${coverage}/${visit}/${tier}`;
        const ref = reference2021(amount, coverage, visit, tier);
        const got = calc2021({ amount, coverage, visit, tier });

        // 자기부담률·최소공제는 어떤 경우에도 기준선과 같아야 한다.
        if (got.rateApplied !== ref.rate || got.minDeductible !== ref.minDeductible) {
          problems.push(`MISMATCH(rate/md) ${key} ref=${ref.rate}/${ref.minDeductible} got=${got.rateApplied}/${got.minDeductible}`);
          continue;
        }

        const same = got.ownPay === ref.ownPay && got.insurancePay === ref.insurancePay;
        const intended = INTENDED_DIVERGENCES[key];

        if (same) {
          if (intended) {
            usedKeys.add(key);
            problems.push(`STALE ${key} — INTENDED_DIVERGENCES에 등록됐으나 기준선과 동일하다. 수정이 되돌아갔거나 항목이 불필요하다.`);
          } else {
            matched++;
          }
          continue;
        }

        if (!intended) {
          problems.push(`MISMATCH ${key} ref=own:${ref.ownPay},ins:${ref.insurancePay} got=own:${got.ownPay},ins:${got.insurancePay} — 의도된 변경이면 INTENDED_DIVERGENCES에 등록하라.`);
          continue;
        }

        usedKeys.add(key);
        if (got.ownPay !== intended.ownPay || got.insurancePay !== intended.insurancePay) {
          problems.push(`WRONG_VALUE ${key} expected=own:${intended.ownPay},ins:${intended.insurancePay} got=own:${got.ownPay},ins:${got.insurancePay}`);
        } else {
          diverged++;
        }
      }

// 매트릭스에 존재하지 않는 키가 등록돼 있으면 오탐 방지를 위해 잡는다.
for (const key of Object.keys(INTENDED_DIVERGENCES)) {
  if (!usedKeys.has(key)) problems.push(`ORPHAN ${key} — 테스트 매트릭스에 없는 키가 등록돼 있다.`);
}

console.log(`[generation2021 회귀] 총 ${total}케이스 — 기준선 일치 ${matched} / 의도된 변경 ${diverged} / 문제 ${problems.length}건`);
if (problems.length) { problems.forEach((p) => console.log("  " + p)); process.exit(1); }
else console.log(`  ✅ 미등록 변경 0건 · STALE 0건 — 의도된 ${diverged}건 외 기준선과 동일`);
