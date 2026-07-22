[← 返回 README](../README.md)

# NestCafe

原生 Windows AI 助手 — SuperCli 引擎 + WebView2 UI。
无需 Node.js，无需 Electron，无需 npm，无需 Vite。

---

## 快速开始

双击 **`NestCafe.exe`**。就这么简单。

首次启动时，NestCafe 会读取 Windows 系统语言并配置 UI。可随时在 **设置 → 常规 → 语言** 中更改。

---

## 版本

| 位置 | 方法 |
|---|---|
| 磁盘文件 | 根目录 `VERSION` 文件（例如 `1.0.5`） |
应用内 | **设置 → 关于** — 产品版本、引擎版本、UI 语言 |
| 构建后 | `native-ui/version.json` — 由 `build.bat` 从 `VERSION` 同步 |

---

## 支持的语言（20）

完整 UI 翻译。首次启动时自动检测系统语言。

| 代码 | 语言 | 代码 | 语言 |
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

## 项目结构

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

## 功能

### 聊天
输入消息并按 Enter。支持文本和图像附件的内联预览。使用方向键浏览图像的图库查看器。

### 提供商和模型
在 **设置 → 提供商** 中添加 OpenAI 兼容的提供商。每个需要名称、基础 URL、可选 API 密钥和默认模型。可单独启用/禁用模型。

### OCR Viewer
**OCR Viewer** 模块（`modules/ocr-viewer/`）处理图像和 PDF 文档：
- 类似 Word 的预览面板
- PDF 页面限制（1–100）
- 保存到 `supercli-data\exports\ocr\` 或自定义文件夹
- **设置 → OCR** 中的自动打开文件夹选项

### 设置
- **常规** — 语言、主题、诊断详情切换
- **提供商** — 添加/编辑/删除 AI 提供商，测试连接
- **模型和上下文** — 搜索模型，设置上下文限制
- **关于** — 版本信息、引擎版本、系统详情

### DevTools
仅在 **设置 → 常规 → Szczegóły diagnostyczne** 启用时可见。然后右键单击 → "Zbadaj element" 打开 WebView2 DevTools。

---

## 构建

```bat
cd NestCafe
build.bat
```

仅替换 SuperCli 引擎：

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## 验证

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## 数据

所有数据存储在可执行文件旁边的 `supercli-data/` 中：
- `sessions/` — 聊天会话
- `config/` — 提供商密钥、偏好设置
- `exports/ocr/` — OCR 输出

不会在应用文件夹外写入任何数据。

---

## 许可证

请参阅项目根目录中的 `LICENSE`。