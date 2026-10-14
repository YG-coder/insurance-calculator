import ts from "typescript";

// DOM 속성의 id·name·class는 구현 정보다. 텍스트와 사용자에게 읽히는 속성만 검사한다.
export function visibleCopy(markup: string): string {
  const html = markup.replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1>/gi, "");
  const labels = [...html.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map(m => m[1]);
  return [html.replace(/<[^>]*>/g, ""), ...labels].join(" ")
    .replace(/&#x([\da-f]+);|&#(\d+);/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex ?? decimal, hex ? 16 : 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity]!);
}

export function identifierLeaks(markup: string): string[] {
  return [...new Set(visibleCopy(markup).match(/[a-z]+[A-Z]\w+|\w+_\w+/g) ?? [])];
}

// 주석·정적 명사는 제외하고 실제 보간/연결 뒤에 붙은 목적격 조사만 금지한다.
export function hardcodedObjectParticles(source: string, filename = "copy.tsx"): number[] {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const positions: number[] = [];
  const startsParticle = (text: string) => /^\s*[을를]/.test(text);
  const endsExpression = (node: ts.Node): boolean => {
    if (ts.isJsxExpression(node)) return node.expression !== undefined;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children.filter(child => !(ts.isJsxText(child) && child.text.trim() === ""));
      return children.length > 0 && endsExpression(children[children.length - 1]);
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      for (const span of node.templateSpans) if (startsParticle(span.literal.text)) positions.push(span.literal.getStart(file));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken
        && ts.isStringLiteral(node.right) && startsParticle(node.right.text)) positions.push(node.right.getStart(file));
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children.filter(child => !(ts.isJsxText(child) && child.text.trim() === ""));
      children.forEach((child, index) => {
        if (ts.isJsxText(child) && startsParticle(child.text) && index > 0 && endsExpression(children[index - 1])) positions.push(child.getStart(file));
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...new Set(positions.map(pos => file.getLineAndCharacterOfPosition(pos).line + 1))];
}
