import { REGULATORY_RULES } from "./insurance/engine/regulatoryRules";
import type { RegulatorySource, RegulatedConstant } from "./insurance/engine/regulatory";
import { REGULATORY_HOLD_COPY } from "./regulatory-hold-copy";

export type Generation = RegulatedConstant<unknown>["generation"];
type Rule = RegulatedConstant<unknown>;
type SourceLocation = { locator: string; verifiedAt: string };
export type SourceDocument = {
  source: RegulatorySource;
  locations: SourceLocation[];
};

/** URL만으로 합치면 동일 검색 주소에 있는 서로 다른 연혁본·조문이 사라진다. */
export function regulatoryBasis(generations: readonly Generation[]) {
  const rules: Rule[] = Object.values(REGULATORY_RULES)
    .filter((rule) => generations.includes(rule.generation));
  const documents = new Map<string, SourceDocument>();
  for (const rule of rules.filter((r) => r.status === "CONFIRMED")) {
    for (const source of rule.sources) {
      const key = JSON.stringify([source.url, source.document, source.issuer, source.publishedOrEffective]);
      let document = documents.get(key);
      if (!document) {
        document = { source, locations: [] };
        documents.set(key, document);
      }
      const location = document.locations.find((item) => item.locator === source.locator);
      if (!location) document.locations.push({ locator: source.locator, verifiedAt: rule.verifiedAt });
      else if (location.verifiedAt < rule.verifiedAt) location.verifiedAt = rule.verifiedAt;
    }
  }
  return {
    documents: [...documents.values()],
    held: rules.filter((rule) => rule.status === "HOLD").map((rule) => {
      const copy = REGULATORY_HOLD_COPY[rule.ruleId];
      if (!copy) throw new Error("이용자 안내가 없는 보류 규칙: " + rule.ruleId);
      return { ...rule, ...copy };
    }),
  };
}
