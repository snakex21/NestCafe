import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, Palette, TextAa } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  applyColorTheme,
  applyFontPreference,
  COLOR_THEME_KEY,
  FONT_KEY,
  type ColorThemePreference,
  type FontPreference,
} from '@/lib/theme-core';

const COLOR_THEMES: Array<{ value: ColorThemePreference; label: string }> = [
  { value: 'default', label: 'appearance.colorDefault' },
  { value: 'coffee', label: 'appearance.colorCoffee' },
  { value: 'midnight', label: 'appearance.colorMidnight' },
  { value: 'nord', label: 'appearance.colorNord' },
  { value: 'dracula', label: 'appearance.colorDracula' },
];

const FONTS: Array<{ value: FontPreference; label: string }> = [
  { value: 'geist', label: 'appearance.fontGeist' },
  { value: 'apparat', label: 'appearance.fontApparat' },
  { value: 'system', label: 'appearance.fontSystem' },
  { value: 'serif', label: 'appearance.fontSerif' },
  { value: 'mono', label: 'appearance.fontMono' },
];

function isColorTheme(value: string): value is ColorThemePreference {
  return COLOR_THEMES.some((theme) => theme.value === value);
}

function isFont(value: string): value is FontPreference {
  return FONTS.some((font) => font.value === value);
}

function getStoredColorTheme(): ColorThemePreference {
  const stored = localStorage.getItem(COLOR_THEME_KEY) ?? 'default';
  return isColorTheme(stored) ? stored : 'default';
}

function getStoredFont(): FontPreference {
  const stored = localStorage.getItem(FONT_KEY) ?? 'geist';
  return isFont(stored) ? stored : 'geist';
}

export function AppearanceCustomization() {
  const { t } = useTranslation('settings');
  const [colorTheme, setColorTheme] = useState<ColorThemePreference>(getStoredColorTheme);
  const [font, setFont] = useState<FontPreference>(getStoredFont);
  const [colorOpen, setColorOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);

  useEffect(() => {
    applyColorTheme(colorTheme);
    applyFontPreference(font);
  }, [colorTheme, font]);

  const colorLabel =
    COLOR_THEMES.find((item) => item.value === colorTheme)?.label ?? COLOR_THEMES[0].label;
  const fontLabel = FONTS.find((item) => item.value === font)?.label ?? FONTS[0].label;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Palette className="h-4 w-4 text-muted-foreground" />
              {t('appearance.colorTitle')}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('appearance.colorDescription')}
            </p>
          </div>
          <DropdownMenu open={colorOpen} onOpenChange={setColorOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-all duration-150',
                  'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-ring',
                )}
              >
                {t(colorLabel)}
                <CaretDown
                  className={cn('h-3.5 w-3.5 text-muted-foreground', colorOpen && 'rotate-180')}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={colorTheme}
                onValueChange={(value) => isColorTheme(value) && setColorTheme(value)}
              >
                {COLOR_THEMES.map((theme) => (
                  <DropdownMenuRadioItem key={theme.value} value={theme.value}>
                    {t(theme.label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <TextAa className="h-4 w-4 text-muted-foreground" />
              {t('appearance.fontTitle')}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('appearance.fontDescription')}
            </p>
          </div>
          <DropdownMenu open={fontOpen} onOpenChange={setFontOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-all duration-150',
                  'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-ring',
                )}
              >
                {t(fontLabel)}
                <CaretDown
                  className={cn('h-3.5 w-3.5 text-muted-foreground', fontOpen && 'rotate-180')}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={font}
                onValueChange={(value) => isFont(value) && setFont(value)}
              >
                {FONTS.map((fontOption) => (
                  <DropdownMenuRadioItem key={fontOption.value} value={fontOption.value}>
                    {t(fontOption.label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
