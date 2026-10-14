import { readdirSync, readFileSync } from "node:fs";
import { mount, stateNamesFrom } from "./_uiRender";
import Health from "../src/components/calculators/HealthCalc";
import Standardized from "../src/components/calculators/HealthCalcStandardized";
import Single from "../src/components/calculators/HealthCalc5th";
import Many from "../src/components/calculators/HealthCalcMulti2026";
import Many2021 from "../src/components/calculators/HealthCalcMulti2021";
import Surrender from "../src/components/calculators/HealthSurrenderCalc";
import Cancel from "../src/components/calculators/CancelVsKeepCalc";
import Death from "../src/components/calculators/DeathCoverageCalc";
import Car from "../src/components/calculators/CarCalc";
import Family from "../src/components/calculators/FamilyLivingCalc";
import Gap from "../src/components/calculators/CoverageGapCalc";
import Premium from "../src/components/calculators/PremiumCalc";
import Future from "../src/components/calculators/FuturePremiumCalc";
import Guide from "../src/components/calculators/PolicyGenerationGuide";
import { confirmNoPrior2021, confirmNoPrior2026 } from "./_priorInputs";
import { enterHealthExpenses } from "./_uiExpenses";

type State = Record<string, unknown>;
export type CopyCase = { name: string; component: () => unknown; state: State };
export const COPY_CASES: CopyCase[] = [];
const add = (name: string, component: () => unknown, state: State = {}) => {
  COPY_CASES.push({ name, component, state });
};
const components = {
  HealthCalc: Health, HealthCalcStandardized: Standardized, HealthCalc5th: Single,
  HealthCalcMulti2026: Many, HealthCalcMulti2021: Many2021, HealthSurrenderCalc: Surrender,
  CancelVsKeepCalc: Cancel, DeathCoverageCalc: Death, CarCalc: Car, FamilyLivingCalc: Family,
  CoverageGapCalc: Gap, PremiumCalc: Premium, FuturePremiumCalc: Future, PolicyGenerationGuide: Guide,
};
export const COVERED_COMPONENTS = Object.keys(components).sort();
export const CALCULATOR_FILES = readdirSync("src/components/calculators").filter(f => f.endsWith(".tsx")).map(f => f.replace(/\.tsx$/, "")).sort();
export function renderCopyCase({ name, component, state }: CopyCase): string {
  const h = mount(component, stateNamesFrom(readFileSync(`src/components/calculators/${name.split("/")[0]}.tsx`, "utf8")));
  if ([Health, Standardized, Single, Many, Many2021].some(candidate => candidate === component) && !/초기|미선택/.test(name)) enterHealthExpenses(h);
  // 결과 분기에서는 누적 입력을 명시한다. 초기·미선택·미입력은 빈칸 그대로 검사한다.
  if (component === Many && !/초기|미선택|누적 미입력/.test(name)) confirmNoPrior2026(h);
  if (component === Many2021 && !/초기|미선택/.test(name)) confirmNoPrior2021(h);
  for (const [key, value] of Object.entries(state)) h.set(key, value);
  return h.renderMarkup();
}
for (const [name, component] of Object.entries(components)) {
  add(name + "/초기", component);
  if (name !== "PolicyGenerationGuide") add(name + "/미선택", component, { submitted: true });
}
for (const coverage of ["benefit", "non_benefit"]) for (const visit of ["outpatient", "inpatient"]) {
  for (const tier of ["clinic", "hospital"]) for (const amount of ["300000", "0", "-1"]) {
    add("HealthCalc/" + [coverage, visit, tier, amount].join("/"), Health, { coverage, visit, tier, amount, submitted: true });
  }
}
for (const generation of ["2009", "2017"]) for (const plan of ["standard", "selective"]) {
  for (const visit of ["outpatient", "inpatient"]) for (const facility of ["clinic", "hospital", "tertiary", "pharmacy"]) {
    for (const priorPaid of ["", "0", "1900000", "-1"]) {
      add("HealthCalcStandardized/" + [generation, plan, visit, facility, priorPaid].join("/"), Standardized, {
        generation, plan, rows: [{ id: 1, amount: "300000", visit, facility }], priorPaid,
        priorVisits: "0", priorPrescriptions: "0", perVisitLimit: "150000", submitted: true,
      });
    }
  }
}
const items = ["", "general", "musculoskeletal_esw", "injection", "mri", "room_charge"];
for (const visit of ["outpatient", "inpatient"]) for (const severity of ["", "critical", "non_critical"]) {
  for (const item of items) for (const tier of ["", "clinic", "hospital"]) {
    const purposes = item === "injection" ? ["", "general", "anticancer", "antibiotic", "orphan_drug"] : [""];
    for (const injectionPurpose of purposes) {
      const suffix = [visit, severity, item, tier, injectionPurpose].join("/");
      add("HealthCalc5th/" + suffix, Single, { coverage: "non_benefit", visit, severity: severity || null,
        nonBenefitItem: item || null, nbInpatientTier: tier || null, injectionPurpose, amount: "20000000", submitted: true });
      add("HealthCalcMulti2026/" + suffix, Many, { coverage: "non_benefit", visit, severity,
        nonBenefitItem: item, nbInpatientTier: tier, injectionPurpose, nonCriticalInjectionPurpose: injectionPurpose,
        cause: "disease", priorVisits: "0", priorOutDays: "0", priorActs: "0",
        priorCountByItem: { musculoskeletal_esw: "0", injection: "0" },
        rows: [{ amount: "300000", visit, tier }], rcRows: [{ amount: "600000", days: "3" }], submitted: true });
    }
  }
}
for (const coverage of ["benefit", "non_benefit"]) for (const visit of ["outpatient", "inpatient"]) {
  for (const amount of ["", "0", "300000", "-1"]) {
    add("HealthCalc5th/금액/" + [coverage, visit, amount].join("/"), Single, { coverage, visit, amount,
      severity: "non_critical", nonBenefitItem: "general", nbInpatientTier: "clinic", nhisRate: "20", submitted: true });
    add("HealthCalcMulti2026/금액/" + [coverage, visit, amount].join("/"), Many, { coverage, visit,
      severity: "non_critical", nonBenefitItem: "general", nbInpatientTier: "clinic", cause: "injury",
      amounts: [amount], priorOutDays: "0", nhisRate: "20", submitted: true });
  }
}
for (const severity of ["critical", "non_critical"]) for (const nonBenefitItem of ["general", "injection"]) {
  add("HealthCalcMulti2026/누적 미입력/" + severity + nonBenefitItem, Many, { severity, nonBenefitItem,
    injectionPurpose: "anticancer", nonCriticalInjectionPurpose: "anticancer", cause: "", submitted: true });
}
for (const nonBenefitItem of ["general", "injection", "musculoskeletal_esw"]) {
  add("HealthCalcMulti2026/지급 0원 HOLD/" + nonBenefitItem, Many, { nonBenefitItem, severity: "critical",
    injectionPurpose: "general", cause: "disease", priorVisits: "99", priorActs: "0",
    priorCountByItem: { musculoskeletal_esw: "49", injection: "49" },
    amounts: ["20000", "300000"], rows: [{ amount: "20000", visit: "outpatient", tier: "" }, { amount: "300000", visit: "outpatient", tier: "" }], submitted: true });
}
for (const coverage of ["benefit", "non_benefit"]) for (const visit of ["outpatient", "inpatient"]) {
  for (const rider of ["none", "manual_therapy", "injection", "mri"]) for (const tier of ["clinic", "hospital"]) {
    add("HealthCalcMulti2021/" + [coverage, visit, rider, tier].join("/"), Many2021, { coverage, visit, rider, tier,
      priorOutVisits: "0", priorManualVisits: "0", priorInjectionVisits: "0", approvedThrough: 10, submitted: true });
  }
}
const demos: Record<string, State> = {
  HealthSurrenderCalc: { mode: "known", monthly: "180000", paidMonths: "24", surrender: "3000000" },
  CancelVsKeepCalc: { surrender: "3000000", future: "21600000" },
  DeathCoverageCalc: { monthlyLiving: "3000000", years: "10", extraMonths: "0", debt: "0", otherFunds: "0", existing: "50000000", assets: "0" },
  PremiumCalc: { income: "3000000", premium: "180000" },
  FuturePremiumCalc: { monthly: "180000", remaining: "120", paid: "24" },
  CoverageGapCalc: { needed: "100000000", current: "50000000" },
};
for (const [name, state] of Object.entries(demos)) {
  add(name + "/정상", components[name as keyof typeof components], { ...state, submitted: true });
  const blank = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, k === "mode" ? v : ""]));
  add(name + "/빈칸", components[name as keyof typeof components], { ...blank, submitted: true });
}
add("HealthSurrenderCalc/예상", Surrender, { ...demos.HealthSurrenderCalc, mode: "estimate", estRate: "50", ack: true, submitted: true });
add("CarCalc/정상", Car, { rows: [{ name: "A", amount: "500000" }, { name: "B", amount: "700000" }], submitted: true });
add("CarCalc/미완성", Car, { rows: [{ name: "A", amount: "500000" }, { name: "B", amount: "" }], submitted: true });
add("FamilyLivingCalc/정상", Family, { rows: [{ monthly: "3000000", years: "10", extra: "0" }, { monthly: "2000000", years: "5", extra: "6" }], submitted: true });
add("FamilyLivingCalc/0원", Family, { rows: [{ monthly: "0", years: "0", extra: "0" }], submitted: true });
add("CancelVsKeepCalc/환급금초과", Cancel, { surrender: "30000000", future: "10000000", submitted: true });
for (const date of ["2000-01-01", "2010-01-01", "2018-01-01", "2023-01-01", "2026-07-01", "bad-date"]) {
  for (const hasChangedPolicy of [false, true]) add("PolicyGenerationGuide/" + date + hasChangedPolicy, Guide, { date, hasChangedPolicy });
}
