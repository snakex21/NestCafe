[← README'ye Dön](../README.md)

# NestCafe

Yerel Windows AI asistanı — SuperCli motor + WebView2 arayüzü.
Node.js yok, Electron yok, npm yok, Vite yok.

---

## Hızlı başlangıç

**`NestCafe.exe`** dosyasına çift tıklayın. Hepsi bu kadar.

İlk açılışta NestCafe Windows sistem dilini okur ve arayüzü yapılandırır. İstediğiniz zaman **Ayarlar → Genel → Dil** bölümünden değiştirin.

---

## Sürüm

| Nerede | Nasıl |
|---|---|
| Diskteki dosya | Kök `VERSION` dosyası (ör. `1.0.5`) |
Uygulamada | **Ayarlar → Hakkında** — ürün sürümü, motor sürümü, arayüz dili |
| Derleme sonrası | `native-ui/version.json` — `VERSION` dosyasından `build.bat` ile senkronize |

---

## Desteklenen diller (20)

Tam arayüz çevirisi. Sistem dili ilk açılışta otomatik olarak algılanır.

| Kod | Dil | Kod | Dil |
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

## Proje yapısı

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

## Özellikler

### Sohbet
Bir mesaj yazın ve Enter tuşuna basın. Metin ve resim eklerini satır içi önizleme ile destekler. Ok tuşları ile resimlerde gezinmek için galeri görüntüleyici.

### Sağlayıcılar ve modeller
**Ayarlar → Sağlayıcılar** bölümünde OpenAI uyumlu sağlayıcılar ekleyin. Her biri bir ad, temel URL, isteğe API anahtarı ve varsayılan model gerektirir. Tekil modelleri açın/kapatın.

### OCR Viewer
**OCR Viewer** modülü (`modules/ocr-viewer/`) resimleri ve PDF belgelerini işler:
- Word benzeri önizleme paneli
- PDF sayfa limiti (1–100)
- `supercli-data\exports\ocr\` veya özel klasöre kaydet
- **Ayarlar → OCR** bölümünde otomatik klasör açma seçeneği

### Ayarlar
- **Genel** — dil, tema, tanı detayları açma/kapama
- **Sağlayıcılar** — AI sağlayıcıları ekle/düzenle/sil, bağlantıyı test et
- **Modeller ve bağlam** — modellerde ara, bağlam limitlerini ayarla
- **Hakkında** — sürüm bilgisi, motor sürümü, sistem detayları

### DevTools
Yalnızca **Ayarlar → Genel → Szczegóły diagnostyczne** etkin olduğunda görünür. Sağ tıklayın → "Zbadaj element" WebView2 DevTools'u açar.

---

## Derleme

```bat
cd NestCafe
build.bat
```

Yalnızca SuperCli motorunu değiştirin:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Doğrula

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Veri

Tüm veriler çalıştırılabilir dosyanın yanında `supercli-data/` klasöründe saklanır:
- `sessions/` — sohbet oturumları
- `config/` — sağlayıcı anahtarı, tercihler
- `exports/ocr/` — OCR çıktısı

Uygulama klasörünün dışında hiçbir veri yazılmaz.

---

## Lisans

Proje kökündeki `LICENSE` dosyasına bakın.