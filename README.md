<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Studio 앱 실행 및 배포

로컬에서 앱을 실행하는 데 필요한 모든 것이 이 저장소에 담겨 있습니다.

AI Studio에서 앱 확인하기: https://ai.studio/apps/drive/11FTb4HIc_zZNUN-Vq72zPi1Ufi5mb7x_

## 로컬 실행

**사전 조건:** Node.js

1. 종속성 설치:
   `npm install`
2. `CHATGPT_API_KEY`를 `.env.local`에 설정 (기본 `MODEL_PROVIDER=chatgpt`)
3. 앱 실행:
   `npm run dev`

## QA 분류 튜닝

내장 QA 도구로 키워드 기반 분류와 AI 튜닝을 검증하려면:

1. 샘플 데이터 `qa/qa-sample.csv`를 배치하거나 갱신
2. `npm run qa:evaluate` 실행 → 분포 요약과 미분류 행을 확인
3. `npm run model:log` (requires `qa/ground-truth.json`) → `logs/model-performance.log`에 모델 정확도 기록 (원본 Claim ID를 그대로 사용하므로, CSV의 `Claim ID` 헤더를 유지하세요)
4. 대시보드 UI의 **분류 QA 검토** 테이블에서 수동 검토가 필요한 레코드를 확인하고 CSV로 다운로드

## 테스트 & CI

다음 명령어를 실행하여 lint, 테스트, 빌드를 수행한 뒤 푸시하세요:

```
npm run lint
npm run test
npm run build
```

CI 워크플로우(`.github/workflows/ci.yml`)는 Push/Pull Request마다 종속성 설치, lint/test 실행, 앱 빌드를 자동으로 수행합니다.

## 환경 및 운영

- `.env.sample`을 `.env.local`로 복사하고 `CHATGPT_API_KEY`, `API_BASE_URL`, `API_TOKEN` 등을 입력하세요.
- `docs/operations.md` 체크리스트에 따라 자격 증명을 금고에 보관하고 주기적으로 갱신합니다.
- `.env.local`은 로컬 개발용이며 실제 키는 커밋하지 마세요.

## 서버 동기화 및 모의 API

대시보드는 중앙 API와 클레임을 동기화합니다(`docs/api-spec.md` 참조). `.env.local`에 다음 변수를 설정하세요:

```
API_BASE_URL=http://localhost:4000
API_TOKEN=mock-token
```

실제 백엔드 없이 개발하려면 모의 서버를 실행하세요:

```
npm run mock:server
```

다음 엔드포인트를 제공합니다:
- `POST /api/claims/upload` – 정제된 클레임 업로드 (각 claim 객체는 `updatedAt`을 포함해야 하며, 미지정 시 서버가 업로드 타임스탬프로 채워 넣습니다.)
- `GET /api/claims` – 최신 데이터 목록 조회 (옵션 `since`는 `updatedAt` 기준 증분 데이터를 반환합니다.)
- `GET /api/notifications/stream` – 실시간 새로고침을 위한 SSE (`claims.updated` 이벤트에 최신 버전/타임스탬프 포함)

UI는 현재 동기화 상태(연결됨 / 동기화 중 / 오류)를 표시하며 자동 폴링 및 푸시 알림을 처리합니다. 프리뷰 단계에서는 파싱 누락(날짜/차종/설명 부족) 카운트를 표시하므로 CSV 헤더(`Claim ID`, `Incident Date`, `Vehicle Model`, `Issue Description`, etc.)를 반드시 유지하세요.
