[← Volver al README](../README.md)

# NestCafe

Asistente IA nativo de Windows — motor SuperCli + interfaz WebView2.  
Sin Node.js, sin Electron, sin npm, sin Vite.

---

## Inicio rápido

Haz doble clic en **`NestCafe.exe`**. Eso es todo.

En el primer inicio, NestCafe detecta el idioma del sistema Windows y configura la interfaz. Cambiable en **Ajustes → General → Idioma**.

---

## Versión

| Dónde | Cómo |
|---|---|
| Archivo en disco | Archivo `VERSION` en la raíz (ej. `1.0.5`) |
| En la app | **Ajustes → Acerca de** — versión del producto, motor, idioma |
| Después del build | `native-ui/version.json` — sincronizado desde `VERSION` |

---

## Idiomas soportados (20)

Interfaz completamente traducida. Idioma del sistema detectado automáticamente.

| Código | Idioma | Código | Idioma |
|--------|--------|--------|--------|
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

## Estructura del proyecto

```
NestCafe.exe                  lanzador (Go + WebView2)
runtime/NestCafe.exe          motor SuperCli
native-ui/                    interfaz web
  css/app.css                 una sola hoja de estilo
  js/                         lógica UI
  assets/                     iconos, logos
  modules/                    módulos (ej. OCR)
  version.json                versión (sincronizada)
VERSION                       archivo versión raíz
scripts/                      build, tests
supercli-data/                datos portables
readme/                       READMEs multilingües (20 idiomas)
```

---

## Funcionalidades

### Chat
Escribe un mensaje, presiona Enter. Soporta texto e imágenes con vista previa inline. Visor de galería con flechas.

### Proveedores y modelos
Añade proveedores compatibles con OpenAI en **Ajustes → Proveedores**. Cada uno necesita nombre, URL base, clave API opcional y modelo por defecto.

### Visor OCR
Módulo **OCR Viewer** (`modules/ocr-viewer/`) procesa imágenes y PDFs:
- Vista previa estilo Word
- Límite de páginas PDF (1–100)
- Guardar en `supercli-data\exports\ocr\` o carpeta personalizada
- Opción de abrir carpeta automáticamente en **Ajustes → OCR**

### Ajustes
- **General** — idioma, tema, detalles diagnósticos
- **Proveedores** — gestionar proveedores, probar conexión
- **Modelos y contexto** — buscar modelos, establecer límites
- **Acerca de** — versión, motor, detalles del sistema

### DevTools
Solo visible con **Ajustes → General → Szczegóły diagnostyczne** activado. Clic derecho → « Zbadaj element ».

---

## Build

```bat
cd NestCafe
build.bat
```

Reemplazar solo el motor:

```bat
build.bat C:\ruta\a\supercli-web.exe
```

---

## Verificación

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Datos

Todos los datos en `supercli-data/`:
- `sessions/` — sesiones de chat
- `config/` — claves de proveedores, preferencias
- `exports/ocr/` — salidas OCR

---

## Licencia

Ver `LICENSE` en la raíz del proyecto.
