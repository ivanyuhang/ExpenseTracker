import test from 'node:test';
import assert from 'node:assert/strict';

import { categoryName, mealName, translate } from '../src/features/expense-tracker/i18n.ts';
import { percentageChange, previousMonthComparison } from '../src/features/expense-tracker/comparison.ts';
import { createRecurringRule, materializeRecurringExpenses, nextOccurrenceAfter, resumeRecurringRule, updateRecurringRule } from '../src/features/expense-tracker/recurrence.ts';

import {
  calendarCells,
  createExpense,
  defaultExpenseTitle,
  expensesForMonth,
  formatMoney,
  insightDayCount,
  monthlyInsights,
  normalizeSavedData,
  monthlyBudgetBreakdown,
  parseCurrencyInput,
  removeExpense,
  totalExpenses,
  totalsByCategory,
  totalsByDate,
  validChartCategory,
  safePercentage,
  updateExpense,
} from '../src/features/expense-tracker/model.ts';

const breakfast = {
  id: 'breakfast-1',
  amount: 25,
  category: 'Meal',
  mealType: 'Breakfast',
  date: '2026-09-05',
  title: 'Noodles',
  note: 'Near the office',
  createdAt: '2026-09-05T06:30:00.000Z',
};

const movie = {
  id: 'movie-1',
  amount: 82,
  category: 'Entertainment',
  date: '2026-09-06',
  title: 'Cinema',
  note: '',
  createdAt: '2026-09-06T18:00:00.000Z',
};

test('formats whole and decimal yuan values', () => {
  assert.equal(formatMoney(25), '¥25');
  assert.equal(formatMoney(128.5), '¥128.50');
  assert.equal(formatMoney(2000), '¥2,000');
});

test('parses decimal and grouped amount input without accepting malformed values', () => {
  assert.equal(parseCurrencyInput('128.50'), 128.5);
  assert.equal(parseCurrencyInput('128,50'), 128.5);
  assert.equal(parseCurrencyInput('2,000'), 2000);
  assert.equal(parseCurrencyInput('12,345.67'), 12345.67);
  assert.equal(parseCurrencyInput(''), null);
  assert.equal(parseCurrencyInput('abc'), null);
  assert.equal(parseCurrencyInput('10.999'), null);
  assert.equal(parseCurrencyInput('0'), 0);
});

test('uses the category or meal type as the default title', () => {
  assert.equal(defaultExpenseTitle('Snacks', 'Breakfast'), 'Snacks');
  assert.equal(defaultExpenseTitle('Meal', 'Breakfast'), 'Breakfast');
  assert.equal(defaultExpenseTitle('Meal', 'Dinner'), 'Dinner');
});

test('preserves meal type and migrates legacy categories after a restart', () => {
  const serialized = JSON.stringify({
    budget: 3000,
    expenses: [breakfast, { ...movie, id: 'legacy', category: 'Shopping' }],
  });
  const restored = normalizeSavedData(JSON.parse(serialized));
  assert.equal(restored?.expenses[0].mealType, 'Breakfast');
  assert.equal(restored?.expenses[1].category, 'Big Purchases');
  assert.equal(restored?.budgets.total, 3000);
  assert.equal(restored?.budgets.categories.Meal, 0);
});

test('migrates an old note into the required title', () => {
  const { title: _title, ...legacyExpense } = breakfast;
  const restored = normalizeSavedData({ budget: 1000, expenses: [{ ...legacyExpense, note: 'Old expense name' }] });
  assert.equal(restored?.expenses[0].title, 'Old expense name');
  assert.equal(restored?.expenses[0].note, '');
});

test('adds the selected category, meal type, and calendar date', () => {
  const expense = createExpense(
    { amount: 48.5, category: 'Meal', mealType: 'Lunch', date: '2026-09-12', title: '  Bento  ', note: '  With tea  ' },
    new Date('2026-09-12T04:00:00.000Z'),
    'new-expense',
  );
  assert.deepEqual(expense, {
    id: 'new-expense',
    amount: 48.5,
    category: 'Meal',
    mealType: 'Lunch',
    date: '2026-09-12',
    title: 'Bento',
    note: 'With tea',
    createdAt: '2026-09-12T04:00:00.000Z',
  });
  assert.equal(totalsByDate([expense])['2026-09-12'], 48.5);
});

test('combines Breakfast, Lunch, and Dinner in one Meal budget total', () => {
  const meals = [
    breakfast,
    { ...breakfast, id: 'lunch', amount: 35, mealType: 'Lunch' },
    { ...breakfast, id: 'dinner', amount: 42, mealType: 'Dinner' },
    movie,
  ];
  const totals = totalsByCategory(meals);
  assert.equal(totals.Meal, 102);
  assert.equal(totals.Entertainment, 82);
  assert.equal(1000 - totals.Meal, 898);
});

test('builds one monthly chart with category spending and remaining total budget', () => {
  const expenses = [
    { ...breakfast, amount: 800 },
    { ...movie, amount: 420 },
    { ...movie, id: 'snack', category: 'Snacks', amount: 200 },
  ];
  const budgets = {
    total: 3000,
    categories: {
      Meal: 1000,
      Snacks: 300,
      Entertainment: 300,
      'Daily Necessities': 500,
      Others: 200,
      'Big Purchases': 700,
    },
  };
  const breakdown = monthlyBudgetBreakdown(expenses, budgets);
  assert.equal(breakdown.categorySpent.Meal, 800);
  assert.equal(breakdown.totalSpent, 1420);
  assert.equal(breakdown.remainingBudget, 1580);
  assert.equal(breakdown.overBudgetBy, 0);
  assert.equal(breakdown.slices.find((slice) => slice.key === 'Entertainment')?.overCategoryBudget, true);
  assert.equal(breakdown.slices.find((slice) => slice.key === 'Remaining Budget')?.value, 1580);
});

test('never creates a negative remaining slice when total spending is over budget', () => {
  const budgets = {
    total: 100,
    categories: { Meal: 50, Snacks: 0, Entertainment: 0, 'Daily Necessities': 0, Others: 0, 'Big Purchases': 0 },
  };
  const breakdown = monthlyBudgetBreakdown([{ ...breakfast, amount: 350 }], budgets);
  assert.equal(breakdown.remainingBudget, 0);
  assert.equal(breakdown.overBudgetBy, 250);
  assert.equal(breakdown.slices.some((slice) => slice.key === 'Remaining Budget'), false);
});

test('keeps all add, calendar, category, delete, and restart calculations in sync', () => {
  const inputs = [
    { amount: 10.5, category: 'Meal', mealType: 'Breakfast', date: '2026-09-05', title: 'Breakfast', note: 'Coffee' },
    { amount: 20, category: 'Meal', mealType: 'Lunch', date: '2026-09-05', title: 'Lunch', note: '' },
    { amount: 30, category: 'Meal', mealType: 'Dinner', date: '2026-09-06', title: 'Dinner', note: '' },
    { amount: 12, category: 'Snacks', date: '2026-09-06', title: 'Snacks', note: '' },
    { amount: 40, category: 'Entertainment', date: '2026-09-07', title: 'Entertainment', note: '' },
    { amount: 500, category: 'Big Purchases', date: '2026-10-01', title: 'Big Purchases', note: 'Chair' },
  ];
  const expenses = inputs.map((input, index) => createExpense(input, new Date(`2026-09-05T0${index}:00:00.000Z`), `flow-${index}`));
  const september = expensesForMonth(expenses, new Date(2026, 8, 1));
  assert.deepEqual(totalsByDate(september), { '2026-09-05': 30.5, '2026-09-06': 42, '2026-09-07': 40 });
  assert.equal(totalsByCategory(september).Meal, 60.5);
  assert.equal(totalExpenses(september), 112.5);

  const budgets = {
    total: 100,
    categories: { Meal: 50, Snacks: 20, Entertainment: 30, 'Daily Necessities': 10, Others: 10, 'Big Purchases': 200 },
  };
  const chart = monthlyBudgetBreakdown(september, budgets);
  assert.equal(chart.overBudgetBy, 12.5);
  assert.equal(chart.remainingBudget, 0);
  assert.equal(chart.slices.find((slice) => slice.key === 'Meal')?.overCategoryBudget, true);

  const afterDelete = removeExpense(expenses, 'flow-4');
  const restored = normalizeSavedData(JSON.parse(JSON.stringify({ budgets, expenses: afterDelete })));
  assert.equal(restored?.expenses.length, 5);
  assert.equal(totalExpenses(expensesForMonth(restored?.expenses ?? [], new Date(2026, 8, 1))), 72.5);
  assert.equal(restored?.expenses.find((expense) => expense.id === 'flow-0')?.note, 'Coffee');
});

test('deleting the selected or final category leaves safe chart data', () => {
  const budgets = {
    total: 1000,
    categories: { Meal: 300, Snacks: 100, Entertainment: 100, 'Daily Necessities': 100, Others: 100, 'Big Purchases': 300 },
  };
  const expenses = [
    breakfast,
    { ...breakfast, id: 'lunch-delete', mealType: 'Lunch', amount: 35 },
    { ...breakfast, id: 'dinner-delete', mealType: 'Dinner', amount: 45 },
    movie,
  ];

  const withoutEntertainment = removeExpense(expenses, movie.id);
  const afterCategoryDelete = monthlyBudgetBreakdown(withoutEntertainment, budgets);
  assert.equal(afterCategoryDelete.categorySpent.Entertainment, 0);
  assert.equal(afterCategoryDelete.categorySpent.Meal, 105);
  assert.equal(validChartCategory('Entertainment', afterCategoryDelete.categorySpent), 'Meal');
  assert.equal(afterCategoryDelete.slices.some((slice) => slice.key === 'Entertainment'), false);

  const noExpenses = expenses.reduce((current, expense) => removeExpense(current, expense.id), expenses);
  const emptyChart = monthlyBudgetBreakdown(noExpenses, budgets);
  assert.equal(emptyChart.totalSpent, 0);
  assert.equal(emptyChart.slices.length, 1);
  assert.equal(emptyChart.slices[0].key, 'Remaining Budget');
  assert.equal(validChartCategory('Meal', emptyChart.categorySpent), 'Meal');
});

test('updates daily and monthly totals when an expense is deleted', () => {
  const expenses = [breakfast, { ...breakfast, id: 'lunch', amount: 35, mealType: 'Lunch' }, movie];
  assert.deepEqual(totalsByDate(expenses), { '2026-09-05': 60, '2026-09-06': 82 });
  assert.equal(totalExpenses(expensesForMonth(expenses, new Date(2026, 8, 1))), 142);

  const afterDelete = removeExpense(expenses, 'lunch');
  assert.deepEqual(totalsByDate(afterDelete), { '2026-09-05': 25, '2026-09-06': 82 });
  assert.equal(totalExpenses(expensesForMonth(afterDelete, new Date(2026, 8, 1))), 107);

  const restored = normalizeSavedData(JSON.parse(JSON.stringify({ budget: 3000, expenses: afterDelete })));
  assert.equal(restored?.expenses.some((expense) => expense.id === 'lunch'), false);
});

test('builds complete calendar weeks for date picking', () => {
  const cells = calendarCells(new Date(2026, 8, 1));
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(cells[2], 1);
});

test('translates important interface labels without changing saved expense text', () => {
  assert.equal(translate('zh-CN', 'dashboard'), '总览');
  assert.equal(categoryName('zh-CN', 'Daily Necessities'), '日用品');
  assert.equal(mealName('zh-CN', 'Breakfast'), '早餐');
  assert.equal(translate('en', 'deleteConfirm', { title: breakfast.title }), 'Are you sure you want to delete Noodles?');
  assert.equal(breakfast.title, 'Noodles');
  assert.equal(breakfast.note, 'Near the office');
});

test('edits an expense in place while preserving its identity', () => {
  const edited = updateExpense([breakfast, movie], breakfast.id, {
    amount: 32,
    category: 'Meal',
    mealType: 'Lunch',
    date: '2026-08-31',
    title: 'Lunch',
    note: 'Updated',
  });
  assert.equal(edited.length, 2);
  assert.equal(edited[0].id, breakfast.id);
  assert.equal(edited[0].createdAt, breakfast.createdAt);
  assert.equal(edited[0].amount, 32);
  assert.equal(edited[0].mealType, 'Lunch');
  assert.equal(expensesForMonth(edited, new Date(2026, 8, 1)).some((expense) => expense.id === breakfast.id), false);
});

test('calculates monthly insights without invalid percentages or future zero days', () => {
  const expenses = [breakfast, { ...breakfast, id: 'lunch', amount: 35, mealType: 'Lunch' }, movie];
  const insights = monthlyInsights(expenses, new Date(2026, 8, 1), new Date(2026, 8, 10));
  assert.equal(insights.totalSpent, 142);
  assert.equal(insights.expenseCount, 3);
  assert.equal(insights.trendDayCount, 10);
  assert.equal(insights.averageDailySpending, 14.2);
  assert.deepEqual(insights.highestSpendingDay, { date: '2026-09-06', amount: 82 });
  assert.equal(insights.largestExpense?.id, movie.id);
  assert.deepEqual(insights.mostSpentCategory, { category: 'Entertainment', amount: 82 });
  assert.equal(insights.categorySpent.Meal, 60);
  assert.equal(safePercentage(39, 100), 39);
  assert.equal(safePercentage(1, 0), 0);
  assert.equal(Number.isFinite(safePercentage(1, 0)), true);
  assert.equal(insightDayCount(new Date(2026, 7, 1), new Date(2026, 8, 10)), 31);
  assert.equal(insightDayCount(new Date(2026, 9, 1), new Date(2026, 8, 10)), 31);
});

test('returns a complete safe empty Insights state', () => {
  const insights = monthlyInsights([], new Date(2026, 8, 1), new Date(2026, 8, 10));
  assert.equal(insights.totalSpent, 0);
  assert.equal(insights.averageDailySpending, 0);
  assert.equal(insights.highestSpendingDay, null);
  assert.equal(insights.largestExpense, null);
  assert.equal(insights.mostSpentCategory, null);
});

test('anchors monthly recurrence to the original day across short and leap-year months', () => {
  const input = { amount: 50, category: 'Entertainment', date: '2028-01-31', title: 'Phone Plan', note: '' };
  const rule = createRecurringRule(input, { repeat: 'monthly', interval: 1, unit: 'month' }, new Date('2028-01-31T10:00:00Z'), 'phone');
  assert.equal(rule.nextOccurrence, '2028-02-29');
  assert.equal(nextOccurrenceAfter(rule, '2028-02-29'), '2028-03-31');
  assert.equal(nextOccurrenceAfter(rule, '2028-03-31'), '2028-04-30');
});

test('materializes missed recurring occurrences once and remains idempotent', () => {
  const input = { amount: 10, category: 'Daily Necessities', date: '2026-09-05', title: 'Laundry', note: '' };
  const rule = createRecurringRule(input, { repeat: 'weekly', interval: 1, unit: 'week' }, new Date('2026-09-05T10:00:00Z'), 'laundry');
  const first = { ...createExpense(input, new Date('2026-09-05T10:00:00Z'), 'first'), recurringRuleId: rule.id, recurrenceKey: `${rule.id}:${input.date}` };
  const caughtUp = materializeRecurringExpenses([first], [rule], '2026-09-26');
  assert.deepEqual(caughtUp.expenses.map((expense) => expense.date).sort(), ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']);
  const reopened = materializeRecurringExpenses(caughtUp.expenses, caughtUp.rules, '2026-09-26');
  assert.equal(reopened.created, 0);
  assert.equal(reopened.expenses.length, 4);
});

test('supports custom intervals, end dates, exclusions, pause, and resume', () => {
  const input = { amount: 5, category: 'Snacks', date: '2026-09-01', title: 'Snack', note: '' };
  const rule = createRecurringRule(input, { repeat: 'custom', interval: 2, unit: 'day', endDate: '2026-09-07' }, new Date('2026-09-01T10:00:00Z'), 'snack');
  const excluded = { ...rule, excludedDates: ['2026-09-05'] };
  const result = materializeRecurringExpenses([], [excluded], '2026-09-20');
  assert.deepEqual(result.expenses.map((expense) => expense.date), ['2026-09-03', '2026-09-07']);
  const paused = { ...rule, active: false };
  assert.equal(materializeRecurringExpenses([], [paused], '2026-09-20').expenses.length, 0);
  const ended = resumeRecurringRule(paused, '2026-09-10');
  assert.equal(ended.nextOccurrence, '2026-09-09');
  assert.equal(ended.active, false);
});

test('updates recurring rule templates without changing historical expenses', () => {
  const input = { amount: 50, category: 'Entertainment', date: '2026-09-05', title: 'Plan', note: '' };
  const rule = createRecurringRule(input, { repeat: 'monthly', interval: 1, unit: 'month' }, new Date('2026-09-05T10:00:00Z'), 'plan');
  const historical = { ...createExpense(input, new Date('2026-09-05T10:00:00Z'), 'history'), recurringRuleId: rule.id };
  const updated = updateRecurringRule(rule, { ...input, amount: 60, date: '2026-10-05' }, { repeat: 'monthly', interval: 1, unit: 'month' });
  assert.equal(updated.amount, 60);
  assert.equal(historical.amount, 50);
  assert.equal(historical.id, 'history');
});

test('compares selected month with the real previous month and handles zero baselines', () => {
  const december = { ...movie, id: 'dec', date: '2025-12-20', amount: 100 };
  const january = { ...breakfast, id: 'jan', date: '2026-01-10', amount: 150 };
  const comparison = previousMonthComparison([december, january], new Date(2026, 0, 1));
  assert.equal(comparison.previousMonth.getFullYear(), 2025);
  assert.equal(comparison.previousMonth.getMonth(), 11);
  assert.equal(comparison.previousTotal, 100);
  assert.equal(comparison.currentTotal, 150);
  assert.equal(comparison.percentChange, 50);
  assert.equal(percentageChange(150, 0), null);
  assert.equal(percentageChange(0, 0), 0);
});

test('migrates old storage safely and preserves recurring rules on restart', () => {
  const oldData = normalizeSavedData({ budget: 1000, expenses: [breakfast] });
  assert.deepEqual(oldData?.recurringRules, []);
  const input = { amount: 50, category: 'Entertainment', date: '2026-09-05', title: 'Phone Plan', note: '' };
  const rule = createRecurringRule(input, { repeat: 'monthly', interval: 1, unit: 'month' }, new Date('2026-09-05T10:00:00Z'), 'phone-plan');
  const restored = normalizeSavedData(JSON.parse(JSON.stringify({ budgets: { total: 1000, categories: {} }, expenses: [breakfast], recurringRules: [rule] })));
  assert.equal(restored?.recurringRules.length, 1);
  assert.equal(restored?.recurringRules[0].id, 'phone-plan');
  assert.equal(restored?.recurringRules[0].nextOccurrence, '2026-10-05');
});
