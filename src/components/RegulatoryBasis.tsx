import { regulatoryBasis, type Generation } from "@/lib/regulatory-basis";

const sourceLinkClass = "font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900 break-words";

export default function RegulatoryBasis({ generations }: { generations: readonly Generation[] }) {
  const { documents, held } = regulatoryBasis(generations);
  return (
    <div className="mt-4 text-sm leading-6 text-slate-700">
      <p>
        계산 규칙과 대조한 공식 자료입니다. 발령·시행일은 자료의 기준일이며, 대조일은 해당 조문을
        확인한 날입니다. 페이지 수정일과는 다릅니다. 실제 보장은 가입한 상품의 약관을 확인하세요.
      </p>
      <ul className="mt-4 space-y-4">
        {documents.map(({ source, locations }) => (
          <li key={source.url + source.document} className="rounded-lg border border-slate-200 p-4">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className={sourceLinkClass}>
              {source.document}
            </a>
            <p className="mt-1 text-xs text-slate-500">
              {source.issuer} · 발령·시행일 <time dateTime={source.publishedOrEffective}>{source.publishedOrEffective}</time>
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                대조한 조문·쪽과 대조일 {locations.length}건
              </summary>
              <ul className="mt-2 space-y-2">
                {locations.map((location) => (
                  <li key={location.locator}>
                    <p>{location.locator}</p>
                    <p className="text-xs text-slate-500">
                      대조일 <time dateTime={location.verifiedAt}>{location.verifiedAt}</time>
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      {held.length > 0 && (
        <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <summary className="cursor-pointer rounded font-semibold text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
            근거·입력 확인이 필요한 범위 {held.length}건
          </summary>
          <p className="mt-2">약관 해석의 추가 확인이나 필요한 입력이 없어 계산하지 않거나, 일부 조건에서 계산을 보류하는 항목입니다.</p>
          <ul className="mt-3 space-y-4">
            {held.map((rule) => (
              <li key={rule.ruleId} className="border-t border-amber-200 pt-3">
                <p className="font-semibold">{rule.title}</p>
                <p>{rule.summary}</p>
                <p className="mt-1 text-xs">대조 기록일 <time dateTime={rule.verifiedAt}>{rule.verifiedAt}</time></p>
                <ul className="mt-2 space-y-2">
                  {rule.sources.map((source) => (
                    <li key={source.url + source.document + source.locator}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className={sourceLinkClass}>
                        {source.document}
                      </a>
                      <p className="text-xs">{source.issuer} · 발령·시행일 {source.publishedOrEffective}</p>
                      <p className="text-xs">{source.locator}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
