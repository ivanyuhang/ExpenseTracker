import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { ExpenseList } from './components';
import { categoryName } from './i18n';
import {
  type Budgets,
  CATEGORIES,
  categoryIcons,
  type Category,
  type Expense,
  expensesForMonth,
  formatFullDate,
  formatMoney,
  formatMonth,
  monthKey,
  monthlyInsights,
  moveMonth,
  safePercentage,
} from './model';
import { animateLayout, usePreferences } from './preferences';
import { MonthComparison } from './month-comparison';

type DetailState = { title: string; expenses: Expense[] } | null;

export function InsightsScreen({ budgets, expenses, onDelete, onEdit }: { budgets: Budgets; expenses: Expense[]; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void }) {
  const { language, locale, styles, t } = usePreferences();
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [details, setDetails] = useState<DetailState>(null);
  const insights = useMemo(() => monthlyInsights(expenses, viewMonth), [expenses, viewMonth]);
  const monthExpenses = useMemo(() => expensesForMonth(expenses, viewMonth), [expenses, viewMonth]);

  function changeMonth(offset: number) { animateLayout(); setViewMonth((month) => moveMonth(month, offset)); }
  function showDay(date: string) { setDetails({ title: formatFullDate(date, locale), expenses: monthExpenses.filter((expense) => expense.date === date) }); }
  function openCategory(category: Category) { setDetails({ title: categoryName(language, category), expenses: monthExpenses.filter((expense) => expense.category === category) }); }

  return <>
    <Text style={styles.screenTitle}>{t('insights')}</Text><Text style={styles.screenSubtitle}>{t('insightsSubtitle')}</Text>
    <View style={styles.insightsHero}>
      <View style={styles.insightsMonthRow}><Pressable accessibilityLabel={t('previousMonth')} onPress={() => changeMonth(-1)} style={styles.insightsArrow}><Text style={styles.insightsArrowText}>‹</Text></Pressable><Text style={styles.insightsMonth}>{formatMonth(viewMonth, locale)}</Text><Pressable accessibilityLabel={t('nextMonth')} onPress={() => changeMonth(1)} style={styles.insightsArrow}><Text style={styles.insightsArrowText}>›</Text></Pressable></View>
      <Text style={styles.insightsTotal}>{formatMoney(insights.totalSpent)}</Text><Text style={styles.insightsTotalLabel}>{t('spentThisMonth')}</Text>
    </View>
    <MonthComparison budgets={budgets} expenses={expenses} onDelete={onDelete} onEdit={onEdit} selectedMonth={viewMonth} />
    {insights.expenseCount === 0 ? <View style={styles.insightCard}><InsightEmpty /></View> : <>
      <SpendingTrendChart dailyTotals={insights.dailyTotals} onSelectDay={showDay} trendDayCount={insights.trendDayCount} viewMonth={viewMonth} />
      <CategoryBreakdown budgets={budgets} categorySpent={insights.categorySpent} onSelect={openCategory} totalSpent={insights.totalSpent} />
      <MonthlyHighlights insights={insights} onCategory={openCategory} onDay={showDay} onLargest={(expense) => setDetails({ title: expense.title, expenses: [expense] })} />
    </>}
    <DetailsModal details={details} onClose={() => setDetails(null)} onDelete={onDelete} onEdit={onEdit} />
  </>;
}

// Kept as focused components so chart and statistics remain easy to modify independently.
function SpendingTrendChart({ dailyTotals, onSelectDay, trendDayCount, viewMonth }: { dailyTotals: Record<string, number>; onSelectDay: (date: string) => void; trendDayCount: number; viewMonth: Date }) {
  const { locale, reduceMotion, styles, t } = usePreferences();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [animation] = useState(() => new Animated.Value(0));
  const days = Array.from({ length: trendDayCount }, (_, index) => {
    const day = index + 1;
    const key = `${monthKey(viewMonth)}-${String(day).padStart(2, '0')}`;
    return { day, key, value: dailyTotals[key] ?? 0 };
  });
  const maximum = Math.max(...days.map((day) => day.value), 0);
  const highThreshold = maximum > 0 ? maximum * 0.8 : Number.MAX_SAFE_INTEGER;
  const signature = days.map((day) => day.value).join(',');
  useEffect(() => { animation.setValue(reduceMotion ? 1 : 0); Animated.timing(animation, { duration: reduceMotion ? 0 : 380, toValue: 1, useNativeDriver: true }).start(); }, [animation, reduceMotion, signature]);
  return <View style={styles.insightCard}><Text style={styles.insightCardTitle}>{t('spendingTrend')}</Text><Text style={styles.insightCardHint}>{t('tapBar')}</Text>
    <Animated.View style={[styles.trendChart, { opacity: animation }]}>{days.map(({ day, key, value }) => {
      const height = maximum > 0 ? Math.max((value / maximum) * 100, value > 0 ? 5 : 1) : 1;
      const selected = selectedDay === key;
      return <Pressable accessibilityLabel={t('daySpending', { date: formatFullDate(key, locale), amount: formatMoney(value) })} key={key} onPress={() => { animateLayout(); setSelectedDay(key); }} style={styles.trendColumn}>
        <View style={styles.trendBarTrack}><View style={[styles.trendBar, value >= highThreshold && styles.trendBarHigh, selected && styles.trendBarSelected, { height: `${height}%` }]} /></View>
        {(day === 1 || day % 5 === 0 || day === trendDayCount) && <Text style={styles.trendDay}>{day}</Text>}
      </Pressable>;
    })}</Animated.View>
    {selectedDay && <Pressable onPress={() => onSelectDay(selectedDay)} style={styles.trendSelected}><Text style={styles.trendSelectedText}>{t('daySpending', { date: formatFullDate(selectedDay, locale), amount: formatMoney(dailyTotals[selectedDay] ?? 0) })}</Text></Pressable>}
  </View>;
}

function CategoryBreakdown({ budgets, categorySpent, onSelect, totalSpent }: { budgets: Budgets; categorySpent: Record<Category, number>; onSelect: (category: Category) => void; totalSpent: number }) {
  const { language, styles, t } = usePreferences();
  return <View style={styles.insightCard}><Text style={styles.insightCardTitle}>{t('categoryBreakdown')}</Text>{CATEGORIES.map((category, index) => {
    const spent = categorySpent[category]; const budget = budgets.categories[category]; const share = safePercentage(spent, totalSpent); const usage = safePercentage(spent, budget); const over = budget > 0 && spent > budget;
    return <Pressable disabled={spent <= 0} key={category} onPress={() => onSelect(category)} style={[styles.insightCategoryRow, index < CATEGORIES.length - 1 && styles.categoryBudgetDivider, spent <= 0 && styles.legendRowDisabled]}>
      <View style={styles.insightCategoryHeader}><Text style={styles.categoryBudgetIcon}>{categoryIcons[category]}</Text><Text style={styles.insightCategoryName}>{categoryName(language, category)}</Text><Text style={[styles.insightCategoryAmount, over && styles.negative]}>{formatMoney(spent)}</Text></View>
      <Text style={styles.insightCategoryMeta}>{t('ofSpending', { value: Math.round(share) })} · {budget > 0 ? `${t('budgetUsage', { spent: formatMoney(spent), budget: formatMoney(budget) })} · ${t('percentUsed', { value: Math.round(usage) })}` : t('noCategoryBudget')}</Text>
      <View style={styles.categoryProgressTrack}><View style={[styles.categoryProgressFill, over && styles.progressOver, { width: `${Math.min(usage, 100)}%` }]} /></View>
    </Pressable>;
  })}</View>;
}

function MonthlyHighlights({ insights, onCategory, onDay, onLargest }: { insights: ReturnType<typeof monthlyInsights>; onCategory: (category: Category) => void; onDay: (date: string) => void; onLargest: (expense: Expense) => void }) {
  const { language, locale, styles, t } = usePreferences();
  return <View style={styles.insightCard}><Text style={styles.insightCardTitle}>{t('monthlyHighlights')}</Text><View style={styles.highlightsGrid}>
    <Highlight label={t('averageDaily')} value={t('perDay', { value: formatMoney(insights.averageDailySpending) })} />
    <Highlight label={t('highestDay')} onPress={insights.highestSpendingDay ? () => onDay(insights.highestSpendingDay!.date) : undefined} value={insights.highestSpendingDay ? formatFullDate(insights.highestSpendingDay.date, locale) : t('noData')} detail={insights.highestSpendingDay ? formatMoney(insights.highestSpendingDay.amount) : undefined} />
    <Highlight label={t('largestExpense')} onPress={insights.largestExpense ? () => onLargest(insights.largestExpense!) : undefined} value={insights.largestExpense?.title ?? t('noData')} detail={insights.largestExpense ? formatMoney(insights.largestExpense.amount) : undefined} />
    <Highlight label={t('mostSpentCategory')} onPress={insights.mostSpentCategory ? () => onCategory(insights.mostSpentCategory!.category) : undefined} value={insights.mostSpentCategory ? categoryName(language, insights.mostSpentCategory.category) : t('noData')} detail={insights.mostSpentCategory ? formatMoney(insights.mostSpentCategory.amount) : undefined} />
    <Highlight label={t('expensesRecorded')} value={String(insights.expenseCount)} />
  </View></View>;
}

function Highlight({ detail, label, onPress, value }: { detail?: string; label: string; onPress?: () => void; value: string }) {
  const { styles } = usePreferences();
  return <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.highlightCard, pressed && styles.buttonPressed]}><Text style={styles.highlightLabel}>{label}</Text><Text numberOfLines={2} style={styles.highlightValue}>{value}</Text>{detail && <Text style={styles.highlightDetail}>{detail}</Text>}</Pressable>;
}

function InsightEmpty() { const { styles, t } = usePreferences(); return <View style={styles.insightEmpty}><Text style={styles.insightEmptyIcon}>↗</Text><Text style={styles.insightEmptyTitle}>{t('noExpensesYet')}</Text><Text style={styles.insightEmptyText}>{t('insightsEmpty')}</Text></View>; }

function DetailsModal({ details, onClose, onDelete, onEdit }: { details: DetailState; onClose: () => void; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void }) {
  const { styles, t } = usePreferences();
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={details !== null}><View style={styles.confirmOverlay}><View style={styles.detailsModalContent}><View style={styles.detailsModalHeader}><Text numberOfLines={2} style={styles.detailsModalTitle}>{details?.title ?? t('insightDetails')}</Text><Pressable onPress={onClose} style={styles.detailsClose}><Text style={styles.detailsCloseText}>{t('close')}</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>{details && <ExpenseList emptyText={t('nothingSpent')} expenses={details.expenses} onDelete={(expense) => { onClose(); onDelete(expense); }} onEdit={(expense) => { onClose(); onEdit(expense); }} />}</ScrollView></View></View></Modal>;
}
