import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RelatedCalculators from "../src/components/RelatedCalculators";
import GuidePage from "../src/app/guide/[slug]/page";
import { CALCULATORS, SITE } from "../src/lib/site";
import { CONTEXT_LINKS, SILSON_GENERATIONS } from "../src/lib/calculator-content";
import { regulatoryBasis } from "../src/lib/regulatory-basis";
import { REGULATORY_HOLD_COPY } from "../src/lib/regulatory-hold-copy";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import { publishedGuides } from "../src/lib/guides";
import { contentUpdated } from "../src/lib/content-dates";

async function main() {
  const rules = Object.values(REGULATORY_RULES);
  assert.deepEqual(Object.keys(REGULATORY_HOLD_COPY).sort(),
    rules.filter((rule) => rule.status === "HOLD").map((rule) => rule.ruleId).sort());
  for (const calculator of CALCULATORS) {
    const html = renderToStaticMarkup(React.createElement(RelatedCalculators, { currentHref: calculator.href }));
    const basis = html.slice(0, html.indexOf("<h2", html.indexOf("</nav>")));
    const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]));
    const app = schemas.find((schema) => schema["@type"] === "WebApplication");
    assert.equal(app.name, calculator.title);
    assert.equal(app.url, SITE.url + calculator.href);
    assert.equal(app.dateModified, contentUpdated(calculator.href));
    assert(html.includes('id="calculation-basis"'));
    const breadcrumb = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
    assert.equal(breadcrumb.itemListElement.at(-1).item, app.url);
    assert.equal(breadcrumb.itemListElement.at(-1).name, calculator.title);
    for (const link of CONTEXT_LINKS[calculator.href] ?? []) {
      assert(CALCULATORS.some((item) => item.href === link.href));
      assert(basis.includes('href="' + link.href + '"'), calculator.href + ": 문맥 링크");
      assert(basis.includes(link.context));
    }
    const generations = SILSON_GENERATIONS[calculator.href];
    if (!generations) {
      assert(html.includes("보험사의 보험료 산출 요율"));
      continue;
    }
    const evidence = regulatoryBasis(generations);
    for (const rule of rules.filter((item) => generations.includes(item.generation) && item.status === "CONFIRMED")) {
      for (const source of rule.sources) {
        const document = evidence.documents.find((item) => item.source.document === source.document && item.source.url === source.url);
        assert(document, "같은 URL의 연혁본을 누락하지 않는다: " + source.document);
        assert(document.locations.some((location) => location.locator === source.locator && location.verifiedAt >= rule.verifiedAt));
      }
    }
    assert(evidence.documents.length > 0);
    assert(!html.includes("priorAnnual"));
    assert(!html.includes("GEN2026-"));
    if (evidence.held.length) {
      assert(html.includes("근거·입력 확인이 필요한 범위"));
      for (const rule of evidence.held) assert(html.includes(rule.summary));
    }
  }
  const linkedGuides = publishedGuides().filter((guide) => guide.calculatorHrefs?.length);
  assert.equal(linkedGuides.length, 5);
  for (const guide of linkedGuides) {
    const html = renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ slug: guide.slug }) }));
    for (const href of guide.calculatorHrefs!) {
      assert(CALCULATORS.some((item) => item.href === href));
      assert(html.includes('href="' + href + '"'));
    }
    assert(html.includes("가입한 세대에 맞게 계산하기"));
    assert(html.includes('"datePublished":"2026-06-21"'));
    assert(html.includes('"dateModified":"' + guide.updated + '"'));
  }
  console.log("✅ 계산기 11개: 출처·보류 범위·수정일·탐색경로, 가이드 5개 문맥 링크 렌더 확인");
}
main().catch((error) => { console.error(error); process.exit(1); });
