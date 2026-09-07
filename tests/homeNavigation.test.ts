import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "../src/app/page";
import Footer from "../src/components/Footer";
import { CALCULATORS, HUBS } from "../src/lib/site";
import { publishedGuides } from "../src/lib/guides";
import { HOME_GROUPS, REVIEW_STEPS, PROTECTION_STEPS } from "../src/lib/home";

// 실제 렌더와 레지스트리를 대조한다. 링크 이름만 검사하거나 빈 배열을 통과시키지 않는다.
const html = renderToStaticMarkup(React.createElement(HomePage));
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const grouped = HOME_GROUPS.flatMap(g => [...g.calculators]);
assert.equal(HOME_GROUPS.length, 4);
assert.ok(CALCULATORS.length > 0);
assert.equal(new Set(grouped).size, grouped.length, "분류 내 중복 계산기 없음");
assert.deepEqual([...grouped].sort(), CALCULATORS.map(c => c.href).sort(), "전체 계산기 누락 없음");
assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
assert.equal(new Set(ids).size, ids.length, "중복 앵커 없음");
assert.ok(html.indexOf('id="start"') < html.indexOf('id="calculators"'));
for (const c of CALCULATORS) assert.ok(hrefs.includes(c.href), c.href);
for (const h of HUBS) assert.ok(hrefs.includes(`/${h.slug}`), h.slug);
const guideSlugs = new Set(publishedGuides().map(g => g.slug));
for (const group of HOME_GROUPS.slice(0, 3)) {
  assert.ok(guideSlugs.has(group.guide), `공개 가이드: ${group.guide}`);
  assert.ok(hrefs.includes(`/guide/${group.guide}`));
  assert.ok(hrefs.includes(group.start.href));
}
for (const href of new Set(hrefs)) {
  if (href.startsWith("#")) assert.ok(ids.includes(href.slice(1)), href);
  else if (href.startsWith("/guide/")) assert.ok(guideSlugs.has(href.slice(7)), href);
  else if (href.startsWith("/")) assert.ok(existsSync(`src/app${href}/page.tsx`), href);
  else assert.fail(`예상 밖 외부 링크: ${href}`);
}
assert.deepEqual(REVIEW_STEPS.map(s => s.href), [...HUBS[0].steps]);
assert.deepEqual(PROTECTION_STEPS.map(s => s.href), [...HUBS[1].steps]);
const startSection = html.slice(html.indexOf('id="start"'), html.indexOf('id="silson"'));
assert.equal((startSection.match(/<article/g) ?? []).length, 4);
for (const group of HOME_GROUPS) {
  assert.ok(group.question.length > 0);
  assert.ok(startSection.includes(`href="${group.start.href}"`));
  assert.ok(startSection.includes(`href="${group.hub}"`));
}
const protection = html.slice(html.indexOf('id="protection"'), html.indexOf('id="calculators"'));
assert.equal((protection.match(/<li[ >]/g) ?? []).length, 3);
for (const step of PROTECTION_STEPS) assert.ok(protection.includes(`href="${step.href}"`));
assert.ok(protection.includes("입력값은 자동으로 전달되지 않습니다"));
const footer = renderToStaticMarkup(React.createElement(Footer));
for (const calc of CALCULATORS) assert.equal(footer.split(`href="${calc.href}"`).length - 1, 1);
const firstFAQ = html.slice(html.indexOf("<details"), html.indexOf("</details>"));
assert.ok(firstFAQ.includes('href="/guide/silson-generations"'));
const layout = readFileSync("src/app/layout.tsx", "utf8");
assert.ok(layout.indexOf('href="#main-content"') < layout.indexOf("<Header"));
assert.match(layout, /<main id="main-content" tabIndex=\{-1\}/);
assert.ok(html.includes("현재 적용 약관"));
assert.ok(html.includes("1세대 전용 계산기는 제공하지 않습니다"));
assert.ok(html.includes("입력값은 자동으로 전달되지 않습니다"));
assert.ok(html.includes("보험금 지급을 확정하지 않습니다"));
assert.ok(html.includes("해지환급금도 자동으로 조회하나요?"));
console.log("✅ 홈: 상황별 시작·11개 계산기·발행 가이드·내부 링크·기존 허브·안내 범위 렌더 검증 통과");
