[← README로 돌아가기](../README.md)

# NestCafe

네이티브 Windows AI 어시스턴트 — SuperCli 엔진 + WebView2 UI.
Node.js 없음, Electron 없음, npm 없음, Vite 없음.

---

## 빠른 시작

**`NestCafe.exe`**를 더블 클릭하세요. 끝입니다.

처음 실행 시 NestCafe는 Windows 시스템 언어를 읽고 UI를 구성합니다. 언제든지 **설정 → 일반 → 언어**에서 변경할 수 있습니다.

---

## 버전

| 위치 | 방법 |
|---|---|
| 디스크 파일 | 루트 `VERSION` 파일 (예: `1.0.5`) |
앱 내 | **설정 → 정보** — 제품 버전, 엔진 버전, UI 언어 |
| 빌드 후 | `native-ui/version.json` — `VERSION`에서 `build.bat`로 동기화 |

---

## 지원 언어 (20)

완전한 UI 번역. 처음 실행 시 시스템 언어 자동 감지.

| 코드 | 언어 | 코드 | 언어 |
|------|----------|------|----------|
| `pl` | Polski | `cs` | Čeština |
| `en` | English | `sk` | Slovenčina |
| `de` | Deutsch | `uk` | Українська |
| `fr` | Français | `ru` | Русский |
| `es` | Español | `tr` | Türkçe |
| `it` | Italiano | `ja` | 日本語 |
| `pt` | Português | `ko` | 한국어 |
| `nl` | Nederlands | `zh` | 中文 |
| `sv` | Svenska | `fi` | Suomi |
| `no` | Norsk | `da` | Dansk |

---

## 프로젝트 구조

```
NestCafe.exe                  launcher (Go + WebView2)
runtime/NestCafe.exe          SuperCli engine
native-ui/                    web UI
  css/app.css                 single stylesheet
  js/                         UI logic
  assets/                     icons, logos
  modules/                    modules (e.g. OCR)
  version.json                version (synced from VERSION)
VERSION                       root version file
scripts/                      build, tests
supercli-data/                portable data (sessions, config, exports)
readme/                       multi-language READMEs (20 languages)
```

---

## 기능

### 채팅
메시지를 입력하고 Enter를 누르세요. 텍스트 및 이미지 첨부 파일을 인라인 미리보기로 지원. 화살표 키로 이미지를 탐색하는 갤러리 뷰어.

### 프로바이더 및 모델
**설정 → 프로바이더**에서 OpenAI 호환 프로바이더를 추가하세요. 각각 이름, 기본 URL, 선택적 API 키, 기본 모델이 필요합니다. 개별 모델을 켜고/끄기 할 수 있습니다.

### OCR Viewer
**OCR Viewer** 모듈 (`modules/ocr-viewer/`)은 이미지와 PDF 문서를 처리:
- Word와 같은 미리보기 패널
- PDF 페이지 제한 (1–100)
- `supercli-data\exports\ocr\` 또는 사용자 지정 폴더에 저장
- **설정 → OCR**에서 폴더 자동 열기 옵션

### 설정
- **일반** — 언어, 테마, 진단 세부 정보 토글
- **프로바이더** — AI 프로바이더 추가/편집/삭제, 연결 테스트
- **모델 및 컨텍스트** — 모델 검색, 컨텍스트 제한 설정
- **정보** — 버전 정보, 엔진 버전, 시스템 세부 정보

### DevTools
**설정 → 일반 → Szczegóły diagnostyczne**가 활성화된 경우에만 표시. 마우스 오른쪽 버튼 클릭 → "Zbadaj element"로 WebView2 DevTools를 엽니다.

---

## 빌드

```bat
cd NestCafe
build.bat
```

SuperCli 엔진만 교체:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## 확인

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## 데이터

모든 데이터는 실행 파일 옆의 `supercli-data/`에 저장됩니다:
- `sessions/` — 채팅 세션
- `config/` — 프로바이더 키, 설정
- `exports/ocr/` — OCR 출력

앱 폴더 외부에 데이터가 기록되지 않습니다.

---

## 라이선스

프로젝트 루트의 `LICENSE`를 참조하세요.