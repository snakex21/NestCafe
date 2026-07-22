[← Retour au README](../README.md)

# NestCafe

Assistant IA natif Windows — moteur SuperCli + interface WebView2.  
Pas de Node.js, pas d'Electron, pas de npm, pas de Vite.

---

## Démarrage rapide

Double-cliquez sur **`NestCafe.exe`**. C'est tout.

Au premier lancement, NestCafe détecte la langue du système Windows et configure l'interface. Modifiable dans **Paramètres → Général → Langue**.

---

## Version

| Où | Comment |
|---|---|
| Fichier sur disque | Fichier `VERSION` à la racine (ex. `1.0.5`) |
| Dans l'app | **Paramètres → À propos** — version produit, version moteur, langue |
| Après build | `native-ui/version.json` — synchronisé depuis `VERSION` |

---

## Langues supportées (20)

Interface entièrement traduite. Langue système détectée automatiquement.

| Code | Langue | Code | Langue |
|------|--------|------|--------|
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

## Structure du projet

```
NestCafe.exe                  lanceur (Go + WebView2)
runtime/NestCafe.exe          moteur SuperCli
native-ui/                    interface web
  css/app.css                 une seule feuille de style
  js/                         logique UI
  assets/                     icônes, logos
  modules/                    modules (ex. OCR)
  version.json                version (synchronisée)
VERSION                       fichier version racine
scripts/                      build, tests
supercli-data/                données portables
readme/                       READMEs multilingues (20 langues)
```

---

## Fonctionnalités

### Chat
Tapez un message, appuyez sur Entrée. Supporte texte et images avec aperçu inline. Visionneuse galerie avec flèches.

### Fournisseurs et modèles
Ajoutez des fournisseurs compatibles OpenAI dans **Paramètres → Fournisseurs**. Chacun nécessite un nom, une URL de base, une clé API optionnelle et un modèle par défaut.

### Visionneuse OCR
Module **OCR Viewer** (`modules/ocr-viewer/`) traite images et PDF :
- Aperçu style Word
- Limite de pages PDF (1–100)
- Sauvegarde dans `supercli-data\exports\ocr\` ou dossier personnalisé
- Option d'ouverture auto dans **Paramètres → OCR**

### Paramètres
- **Général** — langue, thème, détails diagnostiques
- **Fournisseurs** — gérer les fournisseurs, tester la connexion
- **Modèles & contexte** — chercher des modèles, définir les limites
- **À propos** — version, moteur, détails système

### DevTools
Visible uniquement quand **Paramètres → Général → Szczegóły diagnostyczne** est activé. Clic droit → « Zbadaj element ».

---

## Build

```bat
cd NestCafe
build.bat
```

Remplacer uniquement le moteur :

```bat
build.bat C:\chemin\vers\supercli-web.exe
```

---

## Vérification

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Données

Toutes les données dans `supercli-data/` :
- `sessions/` — sessions de chat
- `config/` — clés fournisseurs, préférences
- `exports/ocr/` — sorties OCR

---

## Licence

Voir `LICENSE` à la racine du projet.
