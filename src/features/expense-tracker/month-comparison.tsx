import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { ExpenseList } from './components';
import { previousMonthComparison, type CategoryComparison } from './comparison';
import { categoryName } from './i18n';
import { type Budgets, categoryIcons, type Expense, formatMoney, formatMonth } from './model';
import { animateLayout, usePreferences } from './preferences';

export function MonthComparison({ budgets, expenses, onDelete, onEdit, selectedMonth }: { budgets: Budgets; expenses: Expense[]; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void; selectedMonth: Date }) {
  const { language, locale, styles, t } = usePreferences();
  const comparison = useMemo(() => previousMonthComparison(expenses, selectedMonth), [expenses, selectedMonth]);
  const [selected, setSelected] = useState<CategoryComparison | null>(null);
  const previousName = formatMonth(comparison.previousMonth, locale);
  const currentName = formatMonth(selectedMonth, locale);
  const direction = comparison.difference > 0 ? '↑' : comparison.difference < 0 ? '↓' : '–';
  const percentText = comparison.percentChange === null ? t('newSpending') : comparison.percentChange === 0 ? t('noChange') : t(comparison.percentChange > 0 ? 'percentMore' : 'percentLess', { value: Math.abs(comparison.percentChange).toFixed(1), month: previousName });
  return <View style={styles.insightCard}><Text style={styles.insightCardTitle}>{t('comparedLastMonth')}</Text><Text style={styles.insightCardHint}>{currentName} · {previousName}</Text>
    <View style={styles.comparisonSummary}><Text style={[styles.comparisonDifference, comparison.difference > 0 && styles.negative]}>{direction} {formatMoney(Math.abs(comparison.difference))}</Text><Text style={styles.comparisonSummaryText}>{percentText}</Text></View>
    <View style={styles.comparisonList}>{comparison.categories.map((item) => <ComparisonRow currentName={currentName} item={item} key={item.category} onPress={() => { animateLayout(); setSelected(item); }} previousName={previousName} />)}</View>
    <View style={styles.comparisonFacts}>
      <Text style={styles.comparisonFact}>{t(comparison.difference > 0 ? 'totalIncreased' : comparison.difference < 0 ? 'totalDecreased' : 'totalUnchanged', { value: formatMoney(Math.abs(comparison.difference)) })}</Text>
      {comparison.largestIncrease && <Text style={styles.comparisonFact}>{t('largestIncrease', { category: categoryName(language, comparison.largestIncrease.category), value: formatMoney(comparison.largestIncrease.difference) })}</Text>}
      {comparison.largestDecrease && <Text style={styles.comparisonFact}>{t('largestDecrease', { category: categoryName(language, comparison.largestDecrease.category), value: formatMoney(Math.abs(comparison.largestDecrease.difference)) })}</Text>}
    </View>
    <ComparisonDetails budgets={budgets} currentExpenses={comparison.currentExpenses} currentName={currentName} item={selected} onClose={() => setSelected(null)} onDelete={onDelete} onEdit={onEdit} previousExpenses={comparison.previousExpenses} previousName={previousName} />
  </View>;
}

function ComparisonRow({ currentName, item, onPress, previousName }: { currentName: string; item: CategoryComparison; onPress: () => void; previousName: string }) {
  const { language, styles, t } = usePreferences();
  const maximum = Math.max(item.current, item.previous, 1);
  const change = item.previous === 0 && item.current > 0 ? t('newSpending') : item.difference === 0 ? t('noChange') : `${item.difference > 0 ? '↑' : '↓'} ${formatMoney(Math.abs(item.difference))} · ${Math.abs(item.percentChange ?? 0).toFixed(1)}%`;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.comparisonRow, pressed && styles.buttonPressed]}><View style={styles.comparisonRowHeader}><Text style={styles.comparisonCategory}>{categoryIcons[item.category]} {categoryName(language, item.category)}</Text><Text style={[styles.comparisonChange, item.difference > 0 && styles.negative]}>{change}</Text></View>
    <View style={styles.compareBarLine}><Text numberOfLines={1} style={styles.compareMonthLabel}>{previousName}</Text><View style={styles.compareBarTrack}><View style={[styles.compareBar, styles.comparePreviousBar, { width: `${(item.previous / maximum) * 100}%` }]} /></View><Text style={styles.compareAmount}>{formatMoney(item.previous)}</Text></View>
    <View style={styles.compareBarLine}><Text numberOfLines={1} style={styles.compareMonthLabel}>{currentName}</Text><View style={styles.compareBarTrack}><View style={[styles.compareBar, { width: `${(item.current / maximum) * 100}%` }]} /></View><Text style={styles.compareAmount}>{formatMoney(item.current)}</Text></View>
  </Pressable>;
}

function ComparisonDetails({ budgets, currentExpenses, currentName, item, onClose, onDelete, onEdit, previousExpenses, previousName }: { budgets: Budgets; currentExpenses: Expense[]; currentName: string; item: CategoryComparison | null; onClose: () => void; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void; previousExpenses: Expense[]; previousName: string }) {
  const { language, styles, t } = usePreferences();
  if (!item) return null;
  const limit = budgets.categories[item.category];
  const currentCategoryExpenses = currentExpenses.filter((expense) => expense.category === item.category);
  const previousCategoryExpenses = previousExpenses.filter((expense) => expense.category === item.category);
  const budgetText = (spent: number) => limit <= 0 ? t('noCategoryBudget') : spent <= limit ? t('withinBudget') : t('categoryOver', { value: formatMoney(spent - limit) });
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible><View style={styles.confirmOverlay}><View style={styles.detailsModalContent}><View style={styles.detailsModalHeader}><Text style={styles.detailsModalTitle}>{categoryName(language, item.category)}</Text><Pressable onPress={onClose} style={styles.detailsClose}><Text style={styles.detailsCloseText}>{t('close')}</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.comparisonDetailSummary}><Text style={styles.comparisonFact}>{previousName}: {formatMoney(item.previous)} · {budgetText(item.previous)}</Text><Text style={styles.comparisonFact}>{currentName}: {formatMoney(item.current)} · {budgetText(item.current)}</Text><Text style={styles.comparisonFact}>{t('difference')}: {item.difference >= 0 ? '+' : '−'}{formatMoney(Math.abs(item.difference))}</Text><Text style={styles.comparisonFact}>{item.percentChange === null ? t('newSpending') : t('percentChange', { value: item.percentChange.toFixed(1) })}</Text></View>
    <Text style={styles.sectionTitle}>{currentName}</Text><ExpenseList emptyText={t('nothingSpent')} expenses={currentCategoryExpenses} onDelete={(expense) => { onClose(); onDelete(expense); }} onEdit={(expense) => { onClose(); onEdit(expense); }} />
    <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{previousName}</Text><ExpenseList emptyText={t('nothingSpent')} expenses={previousCategoryExpenses} onDelete={(expense) => { onClose(); onDelete(expense); }} onEdit={(expense) => { onClose(); onEdit(expense); }} />
  </ScrollView></View></View></Modal>;
}
