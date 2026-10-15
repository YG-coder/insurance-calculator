import assert from "node:assert/strict";
import { domainToUnicode } from "node:url";
import { SITE } from "../src/lib/site";
import { inspectHtmlUrls, jsonLdUrls, normalizedSiteUrl, xmlText } from "../scripts/site-url-checks";

const origin = new URL(SITE.url).origin;
const human = SITE.displayUrl;
assert.equal(SITE.url, origin);
assert(/^[\x00-\x7F]+$/.test(SITE.url));
assert.equal(human, `https://${domainToUnicode(new URL(SITE.url).hostname)}`);
for (const url of [SITE.url, human, `${human}/guide#entry`, `${SITE.url}/guide`]) {
  assert.equal(normalizedSiteUrl(url, origin, "fixture").origin, origin);
}
for (const url of ["https://example.com/", "http://보험계산기.kr/", "https://보험계산기.kr.example.com/", "/guide", "not a URL"]) {
  assert.throws(() => normalizedSiteUrl(url, origin, "fixture"));
}
assert.throws(() => normalizedSiteUrl(`https://user@${new URL(SITE.url).hostname}/`, origin, "fixture"));

const data = { "@context": "https://schema.org", "@graph": [
  { url: `${human}/guide`, "@id": `${SITE.url}/guide#page`, text: "https://outside.example/" },
  { url: [`${SITE.url}/guide`, { "@id": `${human}/guide#nested` }] },
] };
assert.equal(jsonLdUrls(data).length, 4);
const fixture = (canonical = `${human}/guide`, ld: unknown = data, image = `${SITE.url}/opengraph-image.png`) => `
<link href="${canonical}" rel="canonical"/>
<meta property="og:url" content="${SITE.url}/guide"/>
<meta property="og:image" content="${image}"/>
<meta name="twitter:image" content="${image}"/>
<meta name="twitter:card" content="summary_large_image"/>
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
assert.equal(inspectHtmlUrls(fixture(), origin, `${SITE.url}/guide`).jsonLdUrlCount, 4);
assert.equal(inspectHtmlUrls(fixture(`${SITE.url}/guide`), origin, `${human}/guide`).images.length, 2);
assert.throws(() => inspectHtmlUrls(fixture(`${human}/wrong-page`), origin, `${SITE.url}/guide`));
assert.throws(() => inspectHtmlUrls(fixture(`${human}/guide`, { "@id": "https://example.com/#page" }), origin));
assert.throws(() => inspectHtmlUrls(fixture(`${human}/guide`, { url: "https://example.com/" }), origin));
assert.throws(() => inspectHtmlUrls(fixture(`${human}/guide`, data, "/image.png"), origin));
assert.throws(() => inspectHtmlUrls(fixture() + `<link rel="canonical" href="${human}/guide"/>`, origin, `${human}/guide`));
// 주소가 모두 정상이더라도 공개 페이지의 이미지가 없으면 실패해야 한다.
const published = `${SITE.url}/guide`;
assert.throws(() => inspectHtmlUrls(fixture().replace(/<meta property="og:image"[^>]*>/, ""), origin, published), /og:image missing/);
assert.throws(() => inspectHtmlUrls(fixture().replace(/<meta name="twitter:image"[^>]*>/, ""), origin, published), /twitter:image missing/);
assert.throws(() => inspectHtmlUrls(fixture().replace(/<meta name="twitter:card"[^>]*>/, ""), origin, published), /twitter:card/);
assert.throws(() => inspectHtmlUrls(fixture().replace("summary_large_image", "summary"), origin, published), /twitter:card/);
assert.throws(() => inspectHtmlUrls(fixture().replace('property="og:image"', 'property="og:image:url"'), origin, published), /og:image missing/);
assert.throws(() => inspectHtmlUrls(fixture().replace(/(<meta name="twitter:image" content=")[^"]+/, '$1https://example.com/image.png'), origin, published));
assert.equal(inspectHtmlUrls(fixture(published, data, `${human}/opengraph-image.png`), origin, published).ogImages.length, 1);
assert.equal(xmlText("?a=1&amp;b=2&#x23;entry"), "?a=1&b=2#entry");
console.log("[site URLs] 한글/퓨니코드 동치·origin/경로 불일치·중첩 JSON-LD·페이지별 OG/Twitter 이미지·큰 이미지 카드 필수 검증 통과");
