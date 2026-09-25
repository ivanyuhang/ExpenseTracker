import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation, useColorScheme } from 'react-native';

import { Language, TranslationKey, localeFor, translate } from './i18n';
import { AppColors, appColors, createStyles } from './styles';
import { loadPreferences, savePreferences } from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';

type PreferencesContextValue = {
  colors: AppColors;
  isDark: boolean;
  language: Language;
  locale: string;
  reduceMotion: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  styles: ReturnType<typeof createStyles>;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  theme: ThemePreference;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const deviceScheme = useColorScheme();
  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    loadPreferences()
      .then((value) => {
        if (!active || !value) return;
        if (value.language === 'en' || value.language === 'zh-CN') setLanguageState(value.language);
        if (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system') setThemeState(value.theme);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    savePreferences({ language, theme }).catch(() => undefined);
  }, [language, loaded, theme]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    animateLayout();
    setLanguageState(nextLanguage);
  }, []);
  const setTheme = useCallback((nextTheme: ThemePreference) => {
    animateLayout();
    setThemeState(nextTheme);
  }, []);
  const isDark = theme === 'dark' || (theme === 'system' && deviceScheme === 'dark');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const background = isDark ? '#121116' : '#F7F6FB';
    const navBackground = isDark ? '#1B1921' : '#FFFFFF';
    const accent = isDark ? '#8C84FF' : '#635BFF';
    document.documentElement.dataset.pocketPlanTheme = isDark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--pocket-plan-background', background);
    document.documentElement.style.setProperty('--pocket-plan-nav-background', navBackground);
    document.documentElement.style.setProperty('--pocket-plan-accent', accent);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = navBackground;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', background);
    });
  }, [isDark]);
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const colors = useMemo(() => appColors(isDark), [isDark]);
  const t = useCallback(
    (key: TranslationKey, values: Record<string, string | number> = {}) => translate(language, key, values),
    [language],
  );
  const value = useMemo(() => ({ colors, isDark, language, locale: localeFor(language), reduceMotion, setLanguage, setTheme, styles, t, theme }), [colors, isDark, language, reduceMotion, setLanguage, setTheme, styles, t, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider');
  return value;
}
