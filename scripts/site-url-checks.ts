import assert from "node:assert/strict";

type UrlReference = { value: string; field: string };

export function normalizedSiteUrl(value: string, origin: string, field: string): URL {
  const url = new URL(value);
  assert.equal(url.origin, origin, `${field}: 기준 origin과 일치하지 않습니다: ${value}`);
  assert(!url.username && !url.password, `${field}: 사용자 인증 정보가 포함된 URL은 허용하지 않습니다`);
  return url;
}

export function jsonLdUrls(value: unknown, path = "$", field?: string): UrlReference[] {
  if (typeof value === "string") {
    return field === "url" || field === "@id" ? [{ value, field: path }] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => jsonLdUrls(item, `${path}[${index}]`, field));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => jsonLdUrls(item, `${path}.${key}`, key));
  }
  return [];
}

export function xmlText(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_match, code: string) => {
    if (code.startsWith("#")) {
      return String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    }
    return entities[code.toLowerCase()];
  });
}

function attribute(tag: string, name: string): string | undefined {
  const value = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, "i"))?.[2];
  return value === undefined ? undefined : xmlText(value);
}

export function inspectHtmlUrls(html: string, origin: string, expectedCanonical?: string) {
  const canonical: string[] = [];
  const openGraph: string[] = [];
  const images: string[] = [];
  const ogImages: string[] = [];
  const twitterImages: string[] = [];
  const twitterCards: string[] = [];
  const refs: UrlReference[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (attribute(tag, "rel")?.split(/\s+/).includes("canonical")) {
      const value = attribute(tag, "href");
      assert(value, "canonical URL missing");
      canonical.push(value);
      refs.push({ value, field: "canonical" });
    }
  }
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    if (key === "twitter:card") {
      const value = attribute(tag, "content");
      assert(value, "twitter:card missing");
      twitterCards.push(value);
      continue;
    }
    if (key !== "og:url" && key !== "og:image" && key !== "og:image:url"
        && key !== "og:image:secure_url" && key !== "twitter:image") continue;
    const value = attribute(tag, "content");
    assert(value, `${key} URL missing`);
    refs.push({ value, field: key });
    if (key === "og:url") openGraph.push(value);
    else images.push(value);
    if (key === "og:image") ogImages.push(value);
    if (key === "twitter:image") twitterImages.push(value);
  }
  let jsonLdBlocks = 0;
  let jsonLdUrlCount = 0;
  for (const [tag, , body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attribute(tag, "type") !== "application/ld+json") continue;
    const urls = jsonLdUrls(JSON.parse(body));
    refs.push(...urls);
    jsonLdBlocks++;
    jsonLdUrlCount += urls.length;
  }
  for (const { value, field } of refs) normalizedSiteUrl(value, origin, field);
  if (expectedCanonical) {
    assert.equal(canonical.length, 1, `${expectedCanonical}: canonical count`);
    assert.equal(new URL(canonical[0]).href, new URL(expectedCanonical).href, `${expectedCanonical}: canonical path`);
    assert.equal(openGraph.length, 1, `${expectedCanonical}: og:url count`);
    // 개수만 보면 홈 주소를 상속한 og:url 이 통과한다. 전체 경로가 canonical 과 같아야 한다.
    assert.equal(new URL(openGraph[0]).href, new URL(expectedCanonical).href, `${expectedCanonical}: og:url path`);
    assert(ogImages.length > 0, `${expectedCanonical}: og:image missing`);
    assert(twitterImages.length > 0, `${expectedCanonical}: twitter:image missing`);
    assert.deepEqual(twitterCards, ["summary_large_image"], `${expectedCanonical}: twitter:card`);
    assert(jsonLdBlocks > 0, `${expectedCanonical}: JSON-LD missing`);
  }
  return { canonical, openGraph, images, ogImages, twitterImages, twitterCards, jsonLdBlocks, jsonLdUrlCount };
}
