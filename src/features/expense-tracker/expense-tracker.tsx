import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedScreen, BottomNavigation, DeleteExpenseDialog } from './components';
import { categoryName, mealName } from './i18n';
import {
  type Category,
  createExpense,
  type Budgets,
  emptyBudgets,
  type Expense,
  expensesForMonth,
  isValidDate,
  type MealType,
  monthKey,
  moveMonth,
  parseCurrencyInput,
  parseDateKey,
  removeExpense,
  type Tab,
  toDateKey,
  totalExpenses,
  updateExpense,
  type RecurrenceUnit,
  type RecurringRule,
  type RepeatOption,
} from './model';
import { createRecurringRule, materializeRecurringExpenses, resumeRecurringRule, scheduleRuleAfter, updateRecurringRule } from './recurrence';
import { DeleteRecurringRuleDialog, RecurringEditChoiceDialog } from './recurring-ui';
import { animateLayout, usePreferences } from './preferences';
import { InsightsScreen } from './insights';
import { AddExpenseScreen, CalendarScreen, DashboardScreen, SettingsScreen } from './screens';
import { loadTrackerData, saveTrackerData } from './storage';

export default function ExpenseTracker() {
  const { language, styles, t } = usePreferences();
  const todayKey = toDateKey();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [budgets, setBudgets] = useState<Budgets>(emptyBudgets);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Meal');
  const [mealType, setMealType] = useState<MealType>('Breakfast');
  const [date, setDate] = useState(todayKey);
  const [title, setTitle] = useState('Breakfast');
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState<RepeatOption>('never');
  const [repeatInterval, setRepeatInterval] = useState('1');
  const [repeatUnit, setRepeatUnit] = useState<RecurrenceUnit>('month');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState<'single' | 'future'>('single');
  const [recurringEditChoice, setRecurringEditChoice] = useState<Expense | null>(null);
  const [rulePendingDelete, setRulePendingDelete] = useState<RecurringRule | null>(null);
  const [editReturnTab, setEditReturnTab] = useState<Tab>('dashboard');
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [savedFeedback, setSavedFeedback] = useState('');
  const [expensePendingDelete, setExpensePendingDelete] = useState<Expense | null>(null);
  const savingExpenseRef = useRef(false);
  const storageWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const deleteDialogExpenseId = useRef<string | null>(null);
  const deletedExpenseIds = useRef(new Set<string>());
  const expensesRef = useRef<Expense[]>([]);
  const recurringRulesRef = useRef<RecurringRule[]>([]);

  const currentMonthSpent = useMemo(
    () => totalExpenses(expensesForMonth(expenses, new Date())),
    [expenses],
  );

  useEffect(() => {
    async function loadData() {
      try {
        const normalized = await loadTrackerData();
        if (normalized) {
          setBudgets(normalized.budgets);
          const materialized = materializeRecurringExpenses(normalized.expenses, normalized.recurringRules, toDateKey());
          setExpenses(materialized.expenses);
          setRecurringRules(materialized.rules);
        }
      } catch {
        setStorageError(true);
      } finally {
        setReady(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    expensesRef.current = expenses;
    recurringRulesRef.current = recurringRules;
  }, [expenses, recurringRules]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !ready) return;
      const materialized = materializeRecurringExpenses(expensesRef.current, recurringRulesRef.current, toDateKey());
      const advanced = materialized.rules.some((rule, index) => rule.nextOccurrence !== recurringRulesRef.current[index]?.nextOccurrence);
      if (materialized.created > 0) setExpenses(materialized.expenses);
      if (materialized.created > 0 || advanced) setRecurringRules(materialized.rules);
    });
    return () => subscription.remove();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const write = storageWriteQueue.current
      .catch(() => undefined)
      .then(() => saveTrackerData({ budgets, expenses, recurringRules }));
    storageWriteQueue.current = write;
    write
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, [budgets, expenses, ready, recurringRules]);

  function saveExpense() {
    if (savingExpenseRef.current) return;

    const parsedAmount = parseCurrencyInput(amount);
    if (parsedAmount === null) {
      setValidationError(`${t('checkAmount')}: ${t('amountFormatError')}`);
      return;
    }
    if (parsedAmount <= 0) {
      setValidationError(`${t('checkAmount')}: ${t('amountZeroError')}`);
      return;
    }
    const effectiveTitle = titleCustomized ? title : (category === 'Meal' ? mealName(language, mealType) : categoryName(language, category));
    if (!effectiveTitle.trim()) {
      setValidationError(`${t('addTitle')}: ${t('titleError')}`);
      return;
    }
    if (!isValidDate(date)) {
      setValidationError(`${t('checkDate')}: ${t('dateError')}`);
      return;
    }
    if (repeat !== 'never' && repeatEndDate && (!isValidDate(repeatEndDate) || repeatEndDate < date)) {
      setValidationError(`${t('checkDate')}: ${t('invalidEndDate')}`);
      return;
    }

    savingExpenseRef.current = true;
    setValidationError('');
    animateLayout();
    setSavingExpense(true);
    const input = {
      amount: parsedAmount,
      category,
      date,
      title: effectiveTitle,
      note,
      mealType: category === 'Meal' ? mealType : undefined,
    };
    const settings = { repeat, interval: Math.max(1, Number.parseInt(repeatInterval, 10) || 1), unit: repeatUnit, endDate: repeatEndDate || undefined };
    if (editingRuleId) {
      const nextRules = recurringRules.map((rule) => rule.id === editingRuleId ? (repeat === 'never' ? { ...rule, active: false } : scheduleRuleAfter(updateRecurringRule(rule, input, settings), todayKey)) : rule);
      setRecurringRules(nextRules);
    } else if (editingExpenseId) {
      const original = expenses.find((expense) => expense.id === editingExpenseId);
      let nextExpenses = updateExpense(expenses, editingExpenseId, input);
      let nextRules = recurringRules;
      if (original?.recurringRuleId && editingScope === 'future') {
        nextRules = recurringRules.map((rule) => rule.id === original.recurringRuleId ? (repeat === 'never' ? { ...rule, active: false } : scheduleRuleAfter(updateRecurringRule(rule, input, settings), todayKey)) : rule);
      } else if (original?.recurringRuleId && original.date !== input.date) {
        nextRules = recurringRules.map((rule) => rule.id === original.recurringRuleId ? { ...rule, excludedDates: [...new Set([...rule.excludedDates, original.date])] } : rule);
      } else if (!original?.recurringRuleId && repeat !== 'never') {
        const rule = createRecurringRule(input, settings);
        nextRules = [...recurringRules, rule];
        nextExpenses = nextExpenses.map((expense) => expense.id === editingExpenseId ? { ...expense, recurringRuleId: rule.id, recurrenceKey: `${rule.id}:${expense.date}` } : expense);
      }
      setExpenses(nextExpenses);
      setRecurringRules(nextRules);
    } else {
      const expense = createExpense(input);
      if (repeat === 'never') setExpenses((current) => [expense, ...current]);
      else {
        const rule = createRecurringRule(input, settings);
        setRecurringRules((current) => [...current, rule]);
        setExpenses((current) => [{ ...expense, recurringRuleId: rule.id, recurrenceKey: `${rule.id}:${expense.date}` }, ...current]);
      }
    }
    const wasEditing = editingExpenseId !== null || editingRuleId !== null;
    setEditingExpenseId(null);
    setEditingRuleId(null);
    setAmount('');
    setCategory('Meal');
    setMealType('Breakfast');
    setTitle(mealName(language, 'Breakfast'));
    setTitleCustomized(false);
    setNote('');
    setRepeat('never'); setRepeatInterval('1'); setRepeatUnit('month'); setRepeatEndDate('');

    // Show the saved item immediately, even when it belongs to another month.
    setSelectedDate(date);
    const expenseDate = parseDateKey(date);
    setViewMonth(new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1));
    setDate(todayKey);
    setActiveTab(editingRuleId ? 'settings' : 'calendar');
    setSavedFeedback(t(wasEditing ? 'changesSaved' : 'expenseSaved'));
    setTimeout(() => setSavedFeedback(''), 2600);
    requestAnimationFrame(() => {
      savingExpenseRef.current = false;
      setSavingExpense(false);
    });
  }

  function editExpense(expense: Expense) {
    if (expense.recurringRuleId) { setRecurringEditChoice(expense); return; }
    openExpenseEditor(expense, 'single');
  }

  function openExpenseEditor(expense: Expense, scope: 'single' | 'future') {
    animateLayout();
    setEditReturnTab(activeTab);
    setEditingExpenseId(expense.id);
    setEditingRuleId(null);
    setEditingScope(scope);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setMealType(expense.mealType ?? 'Breakfast');
    setDate(expense.date);
    setTitle(expense.title);
    setTitleCustomized(true);
    setNote(expense.note);
    const rule = expense.recurringRuleId ? recurringRules.find((item) => item.id === expense.recurringRuleId) : undefined;
    setRepeat(rule?.frequency ?? 'never'); setRepeatInterval(String(rule?.interval ?? 1)); setRepeatUnit(rule?.unit ?? 'month'); setRepeatEndDate(rule?.endDate ?? '');
    setValidationError('');
    setActiveTab('add');
  }

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setEditingRuleId(null);
    setAmount('');
    setCategory('Meal');
    setMealType('Breakfast');
    setDate(todayKey);
    setTitle(mealName(language, 'Breakfast'));
    setTitleCustomized(false);
    setNote('');
    setRepeat('never'); setRepeatInterval('1'); setRepeatUnit('month'); setRepeatEndDate('');
    setValidationError('');
  }

  function editRecurringRule(rule: RecurringRule) {
    animateLayout(); setEditReturnTab('settings'); setEditingRuleId(rule.id); setEditingExpenseId(null); setEditingScope('future');
    setAmount(String(rule.amount)); setCategory(rule.category); setMealType(rule.mealType ?? 'Breakfast'); setDate(rule.startDate); setTitle(rule.title); setTitleCustomized(true); setNote(rule.note);
    setRepeat(rule.frequency); setRepeatInterval(String(rule.interval)); setRepeatUnit(rule.unit); setRepeatEndDate(rule.endDate ?? ''); setActiveTab('add');
  }

  function toggleRecurringRule(rule: RecurringRule) {
    animateLayout();
    const nextRules = recurringRules.map((item) => item.id === rule.id ? (item.active ? { ...item, active: false } : resumeRecurringRule(item, todayKey)) : item);
    const materialized = materializeRecurringExpenses(expenses, nextRules, todayKey); setRecurringRules(materialized.rules); setExpenses(materialized.expenses);
  }

  function deleteRecurringRule() {
    if (!rulePendingDelete) return; animateLayout(); setRecurringRules((current) => current.filter((rule) => rule.id !== rulePendingDelete.id)); setRulePendingDelete(null);
  }

  function cancelEditing() {
    animateLayout();
    resetExpenseForm();
    setActiveTab(editReturnTab);
  }

  function startNewExpense() {
    animateLayout();
    resetExpenseForm();
    setActiveTab('add');
  }

  function changeTab(tab: Tab) {
    if (tab === 'add' && (editingExpenseId || editingRuleId) && activeTab !== 'add') resetExpenseForm();
    setActiveTab(tab);
  }

  function confirmDelete(expense: Expense) {
    if (deleteDialogExpenseId.current) return;
    deleteDialogExpenseId.current = expense.id;
    setExpensePendingDelete(expense);
  }

  function cancelDelete() {
    deleteDialogExpenseId.current = null;
    setExpensePendingDelete(null);
  }

  function deleteConfirmedExpense() {
    const expense = expensePendingDelete;
    if (!expense || deletedExpenseIds.current.has(expense.id)) return;
    deletedExpenseIds.current.add(expense.id);
    deleteDialogExpenseId.current = null;
    setExpensePendingDelete(null);
    animateLayout();
    setExpenses((current) => removeExpense(current, expense.id));
    if (expense.recurringRuleId) setRecurringRules((current) => current.map((rule) => rule.id === expense.recurringRuleId ? { ...rule, excludedDates: [...new Set([...rule.excludedDates, expense.date])] } : rule));
    if (editingExpenseId === expense.id) cancelEditing();
  }

  function chooseMonth(offset: number) {
    animateLayout();
    const next = moveMonth(viewMonth, offset);
    setViewMonth(next);
    setSelectedDate(monthKey(next) === monthKey(new Date()) ? todayKey : toDateKey(next));
  }

  function chooseCategory(nextCategory: Category) {
    animateLayout();
    setCategory(nextCategory);
    setTitle(nextCategory === 'Meal' ? mealName(language, mealType) : categoryName(language, nextCategory));
    setTitleCustomized(false);
  }

  function chooseMealType(nextMealType: MealType) {
    animateLayout();
    setMealType(nextMealType);
    setTitle(mealName(language, nextMealType));
    setTitleCustomized(false);
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color="#635BFF" size="large" />
        <Text style={styles.loadingText}>{t('opening')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={Platform.OS === 'web' ? [] : ['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View><Text style={styles.eyebrow}>{t('monthlyMoney')}</Text><Text style={styles.title}>{t('appName')}</Text></View>
            <View style={styles.yuanBadge}><Text style={styles.yuanBadgeText}>¥</Text></View>
          </View>

          {storageError && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>{t('storageError')}</Text>
            </View>
          )}

          {!!validationError && <View style={styles.warning}><Text style={styles.warningText}>{validationError}</Text></View>}
          {!!savedFeedback && <View style={styles.savedBanner}><Text style={styles.savedBannerText}>✓ {savedFeedback}</Text></View>}

          {activeTab === 'dashboard' && (
            <AnimatedScreen><DashboardScreen
              budgets={budgets}
              expenses={expenses}
              monthSpent={currentMonthSpent}
              onAdd={startNewExpense}
              onDelete={confirmDelete}
              onEdit={editExpense}
              onSaveBudgets={setBudgets}
            /></AnimatedScreen>
          )}
          {activeTab === 'calendar' && (
            <AnimatedScreen><CalendarScreen
              budgets={budgets}
              expenses={expenses}
              onChooseMonth={chooseMonth}
              onDelete={confirmDelete}
              onEdit={editExpense}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              todayKey={todayKey}
              viewMonth={viewMonth}
            /></AnimatedScreen>
          )}
          {activeTab === 'add' && (
            <AnimatedScreen><AddExpenseScreen
              amount={amount}
              category={category}
              date={date}
              mealType={mealType}
              saving={savingExpense}
              title={titleCustomized ? title : (category === 'Meal' ? mealName(language, mealType) : categoryName(language, category))}
              note={note}
              repeat={repeat}
              repeatEndDate={repeatEndDate}
              repeatInterval={repeatInterval}
              repeatUnit={repeatUnit}
              recurrenceLocked={editingScope === 'single' && !!editingExpenseId && !!expenses.find((expense) => expense.id === editingExpenseId)?.recurringRuleId}
              editing={editingExpenseId !== null || editingRuleId !== null}
              onAdd={saveExpense}
              onCancelEdit={cancelEditing}
              onAmount={setAmount}
              onCategory={chooseCategory}
              onDate={setDate}
              onMealType={chooseMealType}
              onTitle={(value) => { setTitleCustomized(true); setTitle(value); }}
              onNote={setNote}
              onRepeat={setRepeat}
              onRepeatEndDate={setRepeatEndDate}
              onRepeatInterval={setRepeatInterval}
              onRepeatUnit={setRepeatUnit}
            /></AnimatedScreen>
          )}
          {activeTab === 'insights' && <AnimatedScreen><InsightsScreen budgets={budgets} expenses={expenses} onDelete={confirmDelete} onEdit={editExpense} /></AnimatedScreen>}
          {activeTab === 'settings' && <AnimatedScreen><SettingsScreen recurringRules={recurringRules} onDeleteRule={setRulePendingDelete} onEditRule={editRecurringRule} onToggleRule={toggleRecurringRule} /></AnimatedScreen>}
        </ScrollView>
        <BottomNavigation activeTab={activeTab} onChange={changeTab} />
      </KeyboardAvoidingView>
      <DeleteExpenseDialog expense={expensePendingDelete} onCancel={cancelDelete} onConfirm={deleteConfirmedExpense} />
      <RecurringEditChoiceDialog expense={recurringEditChoice} onCancel={() => setRecurringEditChoice(null)} onChoose={(scope) => { const expense = recurringEditChoice; setRecurringEditChoice(null); if (expense) openExpenseEditor(expense, scope); }} />
      <DeleteRecurringRuleDialog rule={rulePendingDelete} onCancel={() => setRulePendingDelete(null)} onConfirm={deleteRecurringRule} />
    </SafeAreaView>
  );
}
