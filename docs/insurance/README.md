# 개발 문서 색인

보험계산기.kr의 계산 근거·감사 이력·스택 변경 기록입니다.
저장소 밖의 파일 없이도 결정 과정을 따라갈 수 있도록 작성되어 있습니다.

| 문서 | 내용 |
|---|---|
| [`audit-status.md`](./audit-status.md) | 계산 엔진 감사 최종 상태 색인, 이 저장소가 지키는 설계 원칙, 남은 HOLD 항목 |
| [`insurance-gen123-engine-design.md`](./insurance-gen123-engine-design.md) | 1~3세대 실손 엔진의 근거 조사(표준약관 원문 직독)와 구현 설계. 1세대를 계산 대상에서 제외한 이유 |
| [`stack-upgrade-log.md`](./stack-upgrade-log.md) | Next.js·TypeScript 등 스택 업그레이드 기록과 보류 항목 |

## 규제 근거는 어디에 있나

계산에 쓰이는 모든 규제 상수는 코드 안에 출처와 함께 등록되어 있습니다.

- `src/lib/insurance/engine/regulatoryRules.ts` — 문서명·발행기관·시행일·URL·조항 위치를 가진 중앙 레지스트리
- `src/lib/insurance/engine/constants.ts` — 위 레지스트리에서 **값을 파생**. 상수를 직접 적지 않습니다
- `tests/regulatoryRules.test.ts` — 출처가 빠진 상수를 거부합니다

새 상수를 추가할 때는 반드시 레지스트리를 먼저 채우고 거기서 파생하세요.
