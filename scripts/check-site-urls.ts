// 한글/퓨니코드 표기는 허용하고, 생성된 URL의 정규화된 origin과 경로를 검사한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOutputFiles } from "./build-output-files.mjs";
import { domainToUnicode } from "node:url";
import { SITE } from "../src/lib/site";
import { inspectHtmlUrls, normalizedSiteUrl, xmlText } from "./site-url-checks";

const origin = new URL(SITE.url).origin;
assert.equal(SITE.url, origin, "SITE.url은 정규화된 ASCII origin이어야 합니다.");
assert(/^[\x00-\x7F]+$/.test(SITE.url), "SITE.url은 ASCII 정본이어야 합니다.");
normalizedSiteUrl(SITE.displayUrl, origin, "SITE.displayUrl");
assert.equal(SITE.displayUrl, `${new URL(SITE.url).protocol}//${domainToUnicode(new URL(SITE.url).hostname)}`);
const output = buildOutputFiles();
const read = (file: string) => readFileSync(output.file(file), "utf8");

const urls = [...read("sitemap.xml.body").matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => xmlText(match[1]));
assert(urls.length > 0, "사이트맵의 공개 페이지가 비어 있습니다.");
const normalizedUrls = urls.map((url) => normalizedSiteUrl(url, origin, "sitemap loc"));
assert.equal(new Set(normalizedUrls.map((url) => url.href)).size, urls.length, "사이트맵 중복 주소");
for (const [index, url] of normalizedUrls.entries()) {
  const file = url.pathname === "/" ? "index.html" : `${decodeURIComponent(url.pathname.slice(1))}.html`;
  inspectHtmlUrls(read(file), origin, urls[index]);
}

const robots = read("robots.txt.body");
for (const [field, expected] of [["Host", SITE.url], ["Sitemap", `${SITE.url}/sitemap.xml`]] as const) {
  const values = [...robots.matchAll(new RegExp(`^${field}: (.+)$`, "gm"))].map((match) => match[1].trim());
  assert.equal(values.length, 1, `robots ${field} count`);
  assert.equal(normalizedSiteUrl(values[0], origin, `robots ${field}`).href, new URL(expected).href);
}

let htmlCount = 0;
let imageCount = 0;
let jsonLdUrlCount = 0;
for (const [, file] of output.html) {
  const result = inspectHtmlUrls(readFileSync(file, "utf8"), origin);
  htmlCount++;
  imageCount += result.images.length;
  jsonLdUrlCount += result.jsonLdUrlCount;
}
assert(imageCount > 0, "공유 이미지의 절대 URL이 없습니다.");
assert(jsonLdUrlCount > 0, "JSON-LD의 사이트 URL이 없습니다.");
console.log(`[주소 검사] 공개 ${urls.length}개 이미지 필수 확인·HTML ${htmlCount}개·JSON-LD URL ${jsonLdUrlCount}개·공유 이미지 URL ${imageCount}개 origin 일치`);
