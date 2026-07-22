[← README に戻る](../README.md)

# NestCafe

ネイティブ Windows AI アシスタント — SuperCli エンジン + WebView2 UI。
Node.js なし、Electron なし、npm なし、Vite なし。

---

## クイックスタート

**`NestCafe.exe`** をダブルクリックするだけ。

初回起動時、NestCafe は Windows のシステム言語を読み取り、UI を設定します。いつでも **設定 → 一般 → 言語** で変更できます。

---

## バージョン

| 場所 | 方法 |
|---|---|
| ディスク上のファイル | ルートの `VERSION` ファイル（例：`1.0.5`） |
アプリ内 | **設定 → 情報** — 製品バージョン、エンジンバージョン、UI 言語 |
| ビルド後 | `native-ui/version.json` — `VERSION` から `build.bat` で同期 |

---

## 対応言語（20）

完全な UI 翻訳。初回起動時にシステム言語を自動検出。

| コード | 言語 | コード | 言語 |
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

## プロジェクト構造

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

## 機能

### チャット
メッセージを入力して Enter キーを押します。テキストと画像の添付ファイルをインラインプレビューでサポート。矢印キーで画像を閲覧するギャラリービューアー。

### プロバイダーとモデル
**設定 → プロバイダー** で OpenAI 互換プロバイダーを追加。各プロバイダーには名前、ベース URL、オプションの API キー、デフォルトモデルが必要。個々のモデルをオン/オフに切替可能。

### OCR Viewer
**OCR Viewer** モジュール（`modules/ocr-viewer/`）は画像と PDF ドキュメントを処理：
- Word ライクなプレビューパネル
- PDF ページ制限（1〜100）
- `supercli-data\exports\ocr\` またはカスタムフォルダに保存
- **設定 → OCR** でフォルダを自動的に開くオプション

### 設定
- **一般** — 言語、テーマ、診断詳細の切り替え
- **プロバイダー** — AI プロバイダーの追加/編集/削除、接続テスト
- **モデルとコンテキスト** — モデル検索、コンテキスト制限の設定
- **情報** — バージョン情報、エンジンバージョン、システム詳細

### DevTools
**設定 → 一般 → Szczegóły diagnostyczne** が有効な場合のみ表示。右クリック → "Zbadaj element" で WebView2 DevTools を開きます。

---

## ビルド

```bat
cd NestCafe
build.bat
```

SuperCli エンジンのみを置換：

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## 検証

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## データ

すべてのデータは実行可能ファイルの横にある `supercli-data/` に保存されます：
- `sessions/` — チャットセッション
- `config/` — プロバイダーキー、設定
- `exports/ocr/` — OCR 出力

アプリフォルダの外部にデータは書き込まれません。

---

## ライセンス

プロジェクトルートの `LICENSE` を参照してください。