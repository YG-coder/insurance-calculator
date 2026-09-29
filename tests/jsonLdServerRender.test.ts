/**
 * JSON-LD는 서버 HTML에 그대로 실려야 한다 — `next/script`로 넣지 않는다.
 *
 * 종전에는 사이트 전체 JSON-LD 12곳(6개 파일)을 `next/script`로 넣었다. 그러면 RSC 페이로드에만
 * 실리고 `<script type="application/ld+json">` 태그가 서버 HTML에 나오지 않아, JS를 실행하지
 * 않는 수집기(네이버 Yeti·생성형 검색 수집기·진단 도구)가 읽지 못했다. 배포본에서 홈·허브·가이드·
 * 계산기 모두 서버 HTML 기준 0개였다(2026-09-29 확인).
 *
 * 이 검사는 ① 공용 컴포넌트가 실제로 네이티브 태그를 렌더하는지(행위) ② 여섯 파일이 모두
 * 그 컴포넌트를 쓰는지 ③ `next/script`와 JSON-LD가 한 파일에 다시 섞이지 않는지를 본다.
 * ⚠ 빈 표본으로 통과하지 않도록 수집 대상과 전환 대상 파일을 이름으로 고정한다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JsonLd from "../src/components/JsonLd";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

// ── 1. 행위: 서버 렌더 결과가 네이티브 태그이고, `<`가 이스케이프된다 ──────────
console.log("\n[JSON-LD] 1. 공용 컴포넌트 렌더");
{
  const data = { "@type": "Thing", name: "</script><b>주입</b>" };
  const html = renderToStaticMarkup(React.createElement(JsonLd, { id: "t", data }));
  check("네이티브 <script type=\"application/ld+json\">로 렌더된다",
    html.startsWith('<script id="t" type="application/ld+json">') && html.endsWith("</script>"), html.slice(0, 80));
  check("값 안의 </script>가 태그를 닫지 못한다", (html.match(/<\/script>/g) ?? []).length === 1, html);
  check("`<`는 \\u003c로 이스케이프된다", html.includes("\\u003c/script>"), html);
  const inner = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  check("본문은 원래 값으로 되돌아오는 JSON이다", JSON.stringify(JSON.parse(inner)) === JSON.stringify(data), inner);
}

// ── 2. 전환 대상 여섯 파일이 모두 공용 컴포넌트를 쓴다 ─────────────────────────
console.log("\n[JSON-LD] 2. 전환 대상");
const CONVERTED = [
  "src/app/layout.tsx",
  "src/app/guide/page.tsx",
  "src/app/guide/[slug]/page.tsx",
  "src/app/disclaimer/page.tsx",
  "src/components/HubPage.tsx",
  "src/components/RelatedCalculators.tsx",
];
for (const f of CONVERTED) {
  const s = readFileSync(f, "utf8");
  check(`${f}: <JsonLd 사용`, /<JsonLd\b/.test(s));
  check(`${f}: ld+json을 직접 쓰지 않는다`, !s.includes("application/ld+json"));
}

// ── 3. 전체 소스에서 next/script + JSON-LD 조합이 다시 나오지 않는다 ─────────────
console.log("\n[JSON-LD] 3. 재발 방지");
const walk = (d: string): string[] => readdirSync(d).flatMap((name) => {
  const p = join(d, name);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
});
const files = walk("src");
check("수집 대상에 layout.tsx가 있다(빈 표본 방지)", files.includes(join("src", "app", "layout.tsx")), String(files.length));
check("수집 대상에 JsonLd.tsx가 있다", files.includes(join("src", "components", "JsonLd.tsx")));
const offenders = files.filter((f) => {
  const s = readFileSync(f, "utf8");
  return /from ["']next\/script["']/.test(s) && s.includes("application/ld+json");
});
check("next/script와 JSON-LD를 함께 쓰는 파일이 없다", offenders.length === 0, offenders.join(", "));
const directTags = files.filter((f) => f !== join("src", "components", "JsonLd.tsx")
  && readFileSync(f, "utf8").includes("application/ld+json"));
check("ld+json 태그는 JsonLd.tsx 한 곳에서만 만든다", directTags.length === 0, directTags.join(", "));

console.log(`\n[JSON-LD 서버 렌더] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
