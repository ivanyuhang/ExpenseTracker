import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation, useColorScheme } from 'react-native';

import { Language, TranslationKey, localeFor, translate } from './i18n';
import { AppColors, appColors, createStyles } from './styles';

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

const STORAGE_KEY = '@pocket-plan/preferences-v1';
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
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const value = JSON.parse(stored) as Partial<{ language: Language; theme: ThemePreference }>;
        if (value.language === 'en' || value.language === 'zh-CN') setLanguageState(value.language);
        if (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system') setThemeState(value.theme);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ language, theme })).catch(() => undefined);
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
