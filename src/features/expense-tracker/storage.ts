import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { type SavedData, STORAGE_KEY, normalizeSavedData } from './model';

export const WEB_STORAGE_KEYS = {
  budgets: 'pocket-plan-budgets',
  expenses: 'pocket-plan-expenses',
  preferences: 'pocket-plan-preferences',
  recurringRules: 'pocket-plan-recurring-expenses',
} as const;

export const LEGACY_PREFERENCES_KEY = '@pocket-plan/preferences-v1';

export type StoredPreferences = {
  language: 'en' | 'zh-CN';
  theme: 'light' | 'dark' | 'system';
};

function browserStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Safari can deny localStorage access in some privacy modes.
    return null;
  }
}

export function safelyParseJson(value: string | null): unknown {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function normalizePreferences(value: unknown): StoredPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StoredPreferences>;
  if (
    (candidate.language !== 'en' && candidate.language !== 'zh-CN') ||
    (candidate.theme !== 'light' && candidate.theme !== 'dark' && candidate.theme !== 'system')
  ) return null;
  return { language: candidate.language, theme: candidate.theme };
}

export async function loadTrackerData(): Promise<SavedData | null> {
  const localStorage = browserStorage();
  if (localStorage) {
    const expenseJson = localStorage.getItem(WEB_STORAGE_KEYS.expenses);
    const budgetJson = localStorage.getItem(WEB_STORAGE_KEYS.budgets);
    const recurringJson = localStorage.getItem(WEB_STORAGE_KEYS.recurringRules);
    const hasSplitData = expenseJson !== null || budgetJson !== null || recurringJson !== null;

    if (hasSplitData) {
      const normalized = normalizeSavedData({
        budgets: safelyParseJson(budgetJson),
        expenses: safelyParseJson(expenseJson) ?? [],
        recurringRules: safelyParseJson(recurringJson) ?? [],
      });
      if (normalized) return normalized;
    }
  }

  const legacyJson = await AsyncStorage.getItem(STORAGE_KEY);
  const normalized = normalizeSavedData(safelyParseJson(legacyJson));
  if (normalized && localStorage) await saveTrackerData(normalized);
  return normalized;
}

export async function saveTrackerData(data: SavedData) {
  const localStorage = browserStorage();
  if (localStorage) {
    localStorage.setItem(WEB_STORAGE_KEYS.expenses, JSON.stringify(data.expenses));
    localStorage.setItem(WEB_STORAGE_KEYS.budgets, JSON.stringify(data.budgets));
    localStorage.setItem(WEB_STORAGE_KEYS.recurringRules, JSON.stringify(data.recurringRules));
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ budget: data.budgets.total, ...data }));
}

export async function loadPreferences(): Promise<StoredPreferences | null> {
  const localStorage = browserStorage();
  if (localStorage) {
    const current = normalizePreferences(safelyParseJson(localStorage.getItem(WEB_STORAGE_KEYS.preferences)));
    if (current) return current;
  }

  const legacy = normalizePreferences(safelyParseJson(await AsyncStorage.getItem(LEGACY_PREFERENCES_KEY)));
  if (legacy && localStorage) await savePreferences(legacy);
  return legacy;
}

export async function savePreferences(preferences: StoredPreferences) {
  const localStorage = browserStorage();
  if (localStorage) {
    localStorage.setItem(WEB_STORAGE_KEYS.preferences, JSON.stringify(preferences));
    return;
  }
  await AsyncStorage.setItem(LEGACY_PREFERENCES_KEY, JSON.stringify(preferences));
}
