export const INSURANCE_RULE_VERSION = "2026-v1";

export type HealthInsuranceType = "covered" | "non-covered";
export type VisitType = "outpatient" | "inpatient";

export function calcHealthInsurance({
                                        amount,
                                        type,
                                        visit,
                                    }: {
    amount: number;
    type: HealthInsuranceType;
    visit: VisitType;
}) {
    let rate = 0.2;

    if (type === "covered" && visit === "inpatient") rate = 0.1;
    if (type === "covered" && visit === "outpatient") rate = 0.2;
    if (type === "non-covered" && visit === "inpatient") rate = 0.2;
    if (type === "non-covered" && visit === "outpatient") rate = 0.3;

    const minDeductible = visit === "outpatient" ? 10000 : 0;
    const selfPay = Math.max(amount * rate, minDeductible);
    const insured = Math.max(amount - selfPay, 0);

    return {
        rate: Math.round(rate * 100),
        selfPay: Math.round(selfPay),
        insured: Math.round(insured),
    };
}

export type Gender = "male" | "female";
export type SmokeStatus = "yes" | "no";

export function calcInsurancePremium({
                                         age,
                                         gender,
                                         smoke,
                                         coverage,
                                     }: {
    age: number;
    gender: Gender;
    smoke: SmokeStatus;
    coverage: number;
}) {
    let base = (coverage / 100000000) * 30000;

    if (gender === "female") base *= 0.85;
    base *= 1 + Math.max(0, (age - 30) * 0.025);
    if (smoke === "yes") base *= 1.35;

    return {
        min: Math.round(base * 0.85),
        max: Math.round(base * 1.2),
    };
}

export type AccidentHistory = "0" | "1" | "2+";

export function calcCarInsurance({
                                     age,
                                     career,
                                     accident,
                                     carPrice,
                                 }: {
    age: number;
    career: number;
    accident: AccidentHistory;
    carPrice: number;
}) {
    let base = 600000 + (carPrice / 10000000) * 80000;

    if (age < 26) base *= 1.4;
    else if (age < 30) base *= 1.15;

    if (career < 1) base *= 1.5;
    else if (career < 3) base *= 1.2;

    if (accident === "1") base *= 1.15;
    if (accident === "2+") base *= 1.4;

    return {
        min: Math.round(base * 0.9),
        max: Math.round(base * 1.2),
    };
}