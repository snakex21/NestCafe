/**
 * Pure early-boot theme initialisation — no Electron bridge or React dependencies.
 * Safe to run at HTML-parse time, before the app loads.
 *
 * This module is compiled to `public/theme-init.js` by the Vite build plugin
 * (see vite.config.ts) and also imported by `theme.ts` to avoid duplicating logic.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorThemePreference =
  | 'default'
  | 'coffee'
  | 'midnight'
  | 'nord'
  | 'dracula'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'rose';
export type FontPreference =
  | 'geist'
  | 'apparat'
  | 'system'
  | 'serif'
  | 'mono'
  | 'inter'
  | 'jetbrains'
  | 'lora';

export const THEME_KEY = 'theme';
export const COLOR_THEME_KEY = 'nestcafe:color-theme';
export const FONT_KEY = 'nestcafe:font';

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export function applyClass(resolved: 'light' | 'dark'): void {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function applyColorTheme(theme: ColorThemePreference): void {
  document.documentElement.dataset.colorTheme = theme;
  localStorage.setItem(COLOR_THEME_KEY, theme);
}

export function applyFontPreference(font: FontPreference): void {
  document.documentElement.dataset.font = font;
  localStorage.setItem(FONT_KEY, font);
}

/**
 * Read stored theme preference and apply the correct class to <html>.
 * Called once at early-boot time (before React mounts).
 */
export function initEarlyTheme(): void {
  let stored = 'system';
  try {
    stored = localStorage.getItem(THEME_KEY) || 'system';
  } catch (_e) {
    // localStorage may be unavailable in sandboxed environments; fall back to system
  }
  const preference = (
    ['system', 'light', 'dark'].includes(stored) ? stored : 'system'
  ) as ThemePreference;
  applyClass(resolveTheme(preference));

  try {
    const colorTheme = localStorage.getItem(COLOR_THEME_KEY) || 'default';
    if (['default', 'coffee', 'midnight', 'nord', 'dracula', 'ocean', 'sunset', 'forest', 'rose'].includes(colorTheme)) {
      applyColorTheme(colorTheme as ColorThemePreference);
    }
    const font = localStorage.getItem(FONT_KEY) || 'geist';
    if (['geist', 'apparat', 'system', 'serif', 'mono', 'inter', 'jetbrains', 'lora'].includes(font)) {
      applyFontPreference(font as FontPreference);
    }
  } catch (_e) {
    // localStorage may be unavailable; keep CSS defaults.
  }
}
