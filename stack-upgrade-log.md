# 보험계산기.kr 스택 업그레이드 로그

저장소: `~/Projects/Insurance-calculator` (Next.js App Router, 44개 라우트)

## 2026-08-20 — Next.js 16.2.5 → 16.3.1

| 패키지 | before | after |
|---|---|---|
| next | 16.2.5 | 16.3.1 |
| react / react-dom | 19.2.6 | 19.2.8 |
| typescript | 5.7.2 | 5.9.3 |
| @types/node | 22.10.2 | 22.20.1 |
| @types/react | 19.0.2 | 19.2.18 |
| @types/react-dom | 19.0.2 | 19.2.4 |
| postcss | 8.4.49 | 8.5.26 |
| autoprefixer | 10.4.20 | 10.5.4 |
| tsx | ^4.19.2 | 4.23.12 |
| tailwindcss | 3.4.17 | 3.4.17 (유지) |

- 소스 코드 수정 없음. breaking change 없이 통과.
- 검증: `tsc --noEmit` 통과 / `next build` 44페이지 정적 생성 / `test:all` 전 테스트 통과 / Playwright로 계산기 10개 페이지 실제 입력→계산 동작 확인 (콘솔 에러는 AdSense 스크립트 차단뿐, 샌드박스 환경 탓)
- 버전은 캐럿(^) 대신 정확한 버전으로 고정 — 사이트 간 버전 드리프트 방지 목적.

## 로컬에서 할 일

```bash
cd ~/Projects/Insurance-calculator
npm install
npm run build
```

## 보류한 항목 (별도 작업 필요)

- **Tailwind CSS 3 → 4**: CSS-first 설정으로 전환되는 메이저 마이그레이션. `tailwind.config.ts`(brand 팔레트)를 `@theme`로 옮기고 `postcss.config.mjs`를 `@tailwindcss/postcss`로 교체해야 함. 전 페이지 시각 회귀 확인 필요.
- **TypeScript 5.9 → 7.0**: 네이티브 포트 버전. Next 플러그인·에디터 통합 안정성 확인 후 진행 권장.
- **ESLint 미설치**: 현재 린트 설정이 없음. `eslint-config-next` 도입 검토 가치 있음.
