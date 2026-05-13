/**
 * Web i18n Configuration (Platform-Agnostic, Optional Electron IPC)
 *
 * Only English is bundled statically as the fallback. All other languages
 * are loaded on demand via dynamic imports (code-split by Vite).
 * Language preference is persisted in localStorage.
 */

import i18n from 'i18next';
import { createLogger } from '../lib/logger';

const logger = createLogger('i18n');
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Static English fallback — always available, never code-split
import enCommon from '@locales/en/common.json';
import enHome from '@locales/en/home.json';
import enSettings from '@locales/en/settings.json';
import enExecution from '@locales/en/execution.json';
import enHistory from '@locales/en/history.json';
import enErrors from '@locales/en/errors.json';
import enSidebar from '@locales/en/sidebar.json';

// Dynamic locale loader: Vite splits each file into its own chunk.
// Paths are relative to this source file.
const localeModules = import.meta.glob<Record<string, unknown>>(
  '../../../locales/*/*.json',
);

// Build a lookup map: { "zh-CN:settings": loader, ... }
const bundleLoaders: Record<string, () => Promise<Record<string, unknown>>> = {};
for (const [filePath, loader] of Object.entries(localeModules)) {
  const match = filePath.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const lang = match[1];
    const ns = match[2];
    if (lang !== 'en') {
      bundleLoaders[`${lang}:${ns}`] = loader;
    }
  }
}

// Supported languages and namespaces
export const SUPPORTED_LANGUAGES = [
  'en', 'zh-CN', 'ru', 'fr', 'pl',
  'ja', 'ko', 'es', 'ar', 'hi', 'id', 'ta', 'tr',
] as const;
export const NAMESPACES = [
  'common', 'home', 'execution', 'settings',
  'history', 'errors', 'sidebar',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type Namespace = (typeof NAMESPACES)[number];

export const LANGUAGE_STORAGE_KEY = 'openwork-language';

// Track which languages have already been loaded to avoid re-fetching
const loadedLanguages = new Set<string>(['en']);

// Initialization guards
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

function updateDocumentDirection(language: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.lang = language;
}

/**
 * Dynamically load a language bundle (all 7 namespaces) from code-split chunks.
 * Returns immediately if the language is already loaded.
 */
async function loadLanguageBundle(lang: string): Promise<void> {
  if (loadedLanguages.has(lang)) {
    return;
  }

  const namespaces = NAMESPACES as readonly string[];
  const results = await Promise.all(
    namespaces.map(async (ns) => {
      const key = `${lang}:${ns}`;
      const loader = bundleLoaders[key];
      if (!loader) {
        logger.warn(`No bundle found for ${key}`);
        return { ns, data: null };
      }
      try {
        const data = await loader();
        return { ns, data };
      } catch (err) {
        logger.warn(`Failed to load locale bundle ${key}`, err);
        return { ns, data: null };
      }
    }),
  );

  for (const { ns, data } of results) {
    if (data) {
      i18n.addResourceBundle(lang, ns, data, true, true);
    }
  }

  loadedLanguages.add(lang);
  logger.info(`Language bundle loaded: ${lang}`);
}

/**
 * Read the stored language preference from localStorage.
 * Returns the concrete language to use (resolves 'auto' via navigator).
 */
function resolveStoredLanguage(): SupportedLanguage {
  if (typeof localStorage === 'undefined') {
    return 'en';
  }
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }
  return resolveAutoLanguage();
}

/**
 * Initialize i18n with English fallback, then load the user's preferred language.
 */
export async function initI18n(): Promise<void> {
  if (isInitialized) {
    return;
  }
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const initialLanguage = resolveStoredLanguage();

    // Init with English only — instant, no network needed
    await i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources: {
          en: {
            common: enCommon as Record<string, unknown>,
            home: enHome as Record<string, unknown>,
            settings: enSettings as Record<string, unknown>,
            execution: enExecution as Record<string, unknown>,
            history: enHistory as Record<string, unknown>,
            errors: enErrors as Record<string, unknown>,
            sidebar: enSidebar as Record<string, unknown>,
          },
        },
        lng: 'en', // Start with English for instant render
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: NAMESPACES as unknown as string[],

        interpolation: {
          escapeValue: false,
        },

        detection: {
          order: ['localStorage', 'navigator'],
          caches: ['localStorage'],
          lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        },

        debug: false,
        returnEmptyString: false,

        react: {
          useSuspense: false,
        },
      });

    isInitialized = true;
    updateDocumentDirection('en');

    // Load the user's preferred language in the background, then switch
    if (initialLanguage !== 'en') {
      loadLanguageBundle(initialLanguage)
        .then(() => {
          i18n.changeLanguage(initialLanguage);
          updateDocumentDirection(initialLanguage);
          logger.info(`Switched to preferred language: ${initialLanguage}`);
        })
        .catch((error) => {
          logger.warn('Failed to load preferred language, staying on English', error);
        });
    }

    // Sync initial language to main process so the agent reflects the stored preference
    if (typeof window !== 'undefined' && window.nestcafe?.setLanguage) {
      const storedPref = getLanguagePreference();
      window.nestcafe.setLanguage(storedPref).catch((error) => {
        logger.warn('Failed to sync initial language preference to main process', { error });
      });
    }
  })();

  return initializationPromise;
}

/**
 * Change language and persist to localStorage and main-process DB (Electron only).
 * Dynamically loads the language bundle if not already cached.
 */
export async function changeLanguage(
  language: SupportedLanguage | 'auto',
): Promise<void> {
  const resolvedLanguage = language === 'auto' ? resolveAutoLanguage() : language;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

  // Load the bundle first if needed, then switch
  await loadLanguageBundle(resolvedLanguage);
  await i18n.changeLanguage(resolvedLanguage);
  updateDocumentDirection(resolvedLanguage);

  // Persist to main process so the agent reads the correct language
  if (typeof window !== 'undefined' && window.nestcafe?.setLanguage) {
    window.nestcafe.setLanguage(language).catch((error) => {
      logger.warn('Failed to sync language preference to main process', { error });
    });
  }
}

/**
 * Get the current language preference from localStorage
 */
export function getLanguagePreference(): SupportedLanguage | 'auto' {
  if (typeof localStorage === 'undefined') {
    return 'auto';
  }
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage) || stored === 'auto') {
    return stored as SupportedLanguage | 'auto';
  }
  return 'auto';
}

function resolveAutoLanguage(): SupportedLanguage {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('ru')) return 'ru';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('pl')) return 'pl';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('id')) return 'id';
  if (nav.startsWith('ta')) return 'ta';
  if (nav.startsWith('tr')) return 'tr';
  return 'en';
}

export default i18n;
