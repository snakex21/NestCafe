[← Voltar ao README](../README.md)

# NestCafe

Assistente AI nativo do Windows — engine SuperCli + UI WebView2.
Sem Node.js, sem Electron, sem npm, sem Vite.

---

## Início rápido

Clique duas vezes em **`NestCafe.exe`**. Pronto.

Na primeira inicialização, o NestCafe lê o idioma do sistema Windows e configura a UI. Altere a qualquer momento em **Configurações → Geral → Idioma**.

---

## Versão

| Onde | Como |
|---|---|
| Arquivo no disco | Arquivo `VERSION` na raiz (ex: `1.0.5`) |
| No aplicativo | **Configurações → Sobre** — versão do produto, versão do engine, idioma da UI |
| Após build | `native-ui/version.json` — sincronizado a partir de `VERSION` pelo `build.bat` |

---

## Idiomas suportados (20)

Tradução completa da UI. Idioma do sistema detectado automaticamente na primeira inicialização.

| Código | Idioma | Código | Idioma |
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

## Estrutura do projeto

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

## Funcionalidades

### Chat
Digite uma mensagem e pressione Enter. Suporta anexos de texto e imagens com visualização inline. Visualizador de galeria para navegar imagens com as setas do teclado.

### Provedores e modelos
Adicione provedores compatíveis com OpenAI em **Configurações → Provedores**. Cada um precisa de um nome, URL base, chave de API opcional e modelo padrão. Ative/desative modelos individualmente.

### OCR Viewer
O módulo **OCR Viewer** (`modules/ocr-viewer/`) processa imagens e PDFs:
- Painel de visualização semelhante ao Word
- Limite de páginas PDF (1–100)
- Salvar em `supercli-data\exports\ocr\` ou pasta personalizada
- Opção de abrir pasta automaticamente em **Configurações → OCR**

### Configurações
- **Geral** — idioma, tema, alternância de detalhes diagnósticos
- **Provedores** — adicionar/editar/excluir provedores de AI, testar conectividade
- **Modelos e contexto** — pesquisar modelos, definir limites de contexto
- **Sobre** — informações de versão, versão do engine, detalhes do sistema

### DevTools
Visível apenas quando **Configurações → Geral → Szczegóły diagnostyczne** está habilitado. Em seguida, clique com o botão direito → "Zbadaj element" abre o DevTools do WebView2.

---

## Build

```bat
cd NestCafe
build.bat
```

Substituir apenas o engine SuperCli:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verificar

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Dados

Todos os dados são armazenados em `supercli-data/` ao lado do executável:
- `sessions/` — sessões de chat
- `config/` — chaves de provedores, preferências
- `exports/ocr/` — saída do OCR

Nenhum dado é gravado fora da pasta do aplicativo.

---

## Licença

Veja `LICENSE` na raiz do projeto.