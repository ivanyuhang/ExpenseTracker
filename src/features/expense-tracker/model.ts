export const STORAGE_KEY = '@pocket-plan/data-v1';
export const CATEGORIES = ['Meal', 'Snacks', 'Entertainment', 'Daily Necessities', 'Others', 'Big Purchases'] as const;
export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'] as const;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type Category = (typeof CATEGORIES)[number];
export type MealType = (typeof MEAL_TYPES)[number];
export type Tab = 'dashboard' | 'calendar' | 'add' | 'insights' | 'settings';
export type RepeatOption = 'never' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type RecurrenceUnit = 'day' | 'week' | 'month';

export type Expense = {
  id: string;
  amount: number;
  category: Category;
  date: string;
  title: string;
  note: string;
  mealType?: MealType;
  createdAt?: string;
  recurringRuleId?: string;
  recurrenceKey?: string;
};

export type RecurringRule = ExpenseInput & {
  id: string;
  active: boolean;
  startDate: string;
  frequency: Exclude<RepeatOption, 'never'>;
  interval: number;
  unit: RecurrenceUnit;
  endDate?: string;
  excludedDates: string[];
  nextOccurrence: string;
  createdAt: string;
};

export type CategoryBudgets = Record<Category, number>;
export type Budgets = { total: number; categories: CategoryBudgets };
export type SavedData = { budgets: Budgets; expenses: Expense[]; recurringRules: RecurringRule[] };
export type BudgetChartKey = Category | 'Remaining Budget';
export type BudgetChartSlice = {
  key: BudgetChartKey;
  label: string;
  value: number;
  color: string;
  overCategoryBudget: boolean;
};
export type MonthlyBudgetBreakdown = {
  categorySpent: CategoryBudgets;
  totalSpent: number;
  remainingBudget: number;
  overBudgetBy: number;
  slices: BudgetChartSlice[];
};

export type MonthlyInsights = {
  averageDailySpending: number;
  categorySpent: CategoryBudgets;
  dailyTotals: Record<string, number>;
  expenseCount: number;
  highestSpendingDay: { date: string; amount: number } | null;
  largestExpense: Expense | null;
  mostSpentCategory: { category: Category; amount: number } | null;
  totalSpent: number;
  trendDayCount: number;
};

export type ExpenseInput = Pick<Expense, 'amount' | 'category' | 'date' | 'title' | 'note' | 'mealType'>;

export function emptyCategoryBudgets(): CategoryBudgets {
  return Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as CategoryBudgets;
}

export function emptyBudgets(): Budgets {
  return { total: 0, categories: emptyCategoryBudgets() };
}

export const categoryIcons: Record<Category, string> = {
  Meal: '🍜',
  Snacks: '🍪',
  Entertainment: '🎬',
  'Daily Necessities': '🧴',
  Others: '✨',
  'Big Purchases': '🛍️',
};

export const categoryColors: Record<Category, string> = {
  Meal: '#635BFF',
  Snacks: '#F0A43B',
  Entertainment: '#31A7A1',
  'Daily Necessities': '#4D82D8',
  Others: '#A069D5',
  'Big Purchases': '#D56C9A',
};

const legacyCategoryMap: Record<string, Category> = {
  Food: 'Meal',
  Transport: 'Daily Necessities',
  Shopping: 'Big Purchases',
  Bills: 'Daily Necessities',
  Health: 'Daily Necessities',
  Other: 'Others',
};

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(parseDateKey(value)) === value;
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && CATEGORIES.includes(value as Category);
}

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && MEAL_TYPES.includes(value as MealType);
}

function normalizeCategory(value: unknown): Category | null {
  if (isCategory(value)) return value;
  if (typeof value === 'string') return legacyCategoryMap[value] ?? null;
  return null;
}

export function normalizeSavedData(value: unknown): SavedData | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as { budget?: unknown; budgets?: unknown; expenses?: unknown; recurringRules?: unknown };
  if (!Array.isArray(saved.expenses)) {
    return null;
  }

  const budgets = normalizeBudgets(saved.budgets, saved.budget);

  const expenses = saved.expenses.flatMap((item): Expense[] => {
    if (!item || typeof item !== 'object') return [];
    const expense = item as Partial<Expense>;
    const category = normalizeCategory(expense.category);
    if (
      typeof expense.id !== 'string' ||
      typeof expense.amount !== 'number' ||
      !Number.isFinite(expense.amount) ||
      expense.amount <= 0 ||
      !category ||
      typeof expense.date !== 'string' ||
      !isValidDate(expense.date)
    ) {
      return [];
    }

    const legacyNote = typeof expense.note === 'string' ? expense.note : '';
    const savedTitle = 'title' in expense && typeof expense.title === 'string' ? expense.title.trim() : '';
    return [{
      id: expense.id,
      amount: expense.amount,
      category,
      date: expense.date,
      title: savedTitle || legacyNote.trim() || category,
      note: savedTitle ? legacyNote : '',
      mealType: category === 'Meal' && isMealType(expense.mealType) ? expense.mealType : undefined,
      createdAt: typeof expense.createdAt === 'string' ? expense.createdAt : undefined,
      recurringRuleId: typeof expense.recurringRuleId === 'string' ? expense.recurringRuleId : undefined,
      recurrenceKey: typeof expense.recurrenceKey === 'string' ? expense.recurrenceKey : undefined,
    }];
  });

  const recurringRules = Array.isArray(saved.recurringRules) ? saved.recurringRules.flatMap(normalizeRecurringRule) : [];
  return { budgets, expenses, recurringRules };
}

function normalizeRecurringRule(value: unknown): RecurringRule[] {
  if (!value || typeof value !== 'object') return [];
  const rule = value as Partial<RecurringRule>;
  const category = normalizeCategory(rule.category);
  const frequencies: RepeatOption[] = ['daily', 'weekly', 'monthly', 'custom'];
  const units: RecurrenceUnit[] = ['day', 'week', 'month'];
  if (typeof rule.id !== 'string' || typeof rule.amount !== 'number' || rule.amount <= 0 || !category || typeof rule.title !== 'string' || typeof rule.startDate !== 'string' || !isValidDate(rule.startDate) || typeof rule.frequency !== 'string' || !frequencies.includes(rule.frequency as RepeatOption) || typeof rule.unit !== 'string' || !units.includes(rule.unit as RecurrenceUnit)) return [];
  const nextOccurrence = typeof rule.nextOccurrence === 'string' && isValidDate(rule.nextOccurrence) && rule.nextOccurrence >= rule.startDate ? rule.nextOccurrence : rule.startDate;
  const endDate = typeof rule.endDate === 'string' && isValidDate(rule.endDate) && rule.endDate >= rule.startDate ? rule.endDate : undefined;
  return [{
    id: rule.id, amount: rule.amount, category, title: rule.title.trim() || category, note: typeof rule.note === 'string' ? rule.note : '',
    date: rule.startDate, startDate: rule.startDate, frequency: rule.frequency as RecurringRule['frequency'], unit: rule.unit as RecurrenceUnit,
    interval: typeof rule.interval === 'number' && Number.isInteger(rule.interval) && rule.interval > 0 ? rule.interval : 1,
    active: rule.active !== false, nextOccurrence, endDate, mealType: category === 'Meal' && isMealType(rule.mealType) ? rule.mealType : undefined,
    excludedDates: Array.isArray(rule.excludedDates) ? rule.excludedDates.filter((date): date is string => typeof date === 'string' && isValidDate(date)) : [],
    createdAt: typeof rule.createdAt === 'string' ? rule.createdAt : new Date().toISOString(),
  }];
}

function normalizeBudgets(value: unknown, legacyBudget: unknown): Budgets {
  const fallbackTotal = typeof legacyBudget === 'number' && Number.isFinite(legacyBudget) ? Math.max(0, legacyBudget) : 0;
  if (!value || typeof value !== 'object') return { total: fallbackTotal, categories: emptyCategoryBudgets() };

  const candidate = value as { total?: unknown; categories?: unknown };
  const total = typeof candidate.total === 'number' && Number.isFinite(candidate.total) ? Math.max(0, candidate.total) : fallbackTotal;
  const savedCategories = candidate.categories && typeof candidate.categories === 'object'
    ? candidate.categories as Partial<Record<Category, unknown>>
    : {};
  const categories = emptyCategoryBudgets();
  for (const category of CATEGORIES) {
    const amount = savedCategories[category];
    categories[category] = typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }
  return { total, categories };
}

export function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  const absoluteValue = Math.abs(value);
  const hasCents = Math.round(absoluteValue * 100) % 100 !== 0;
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(absoluteValue);
  return `${sign}¥${amount}`;
}

// Accepts common decimal formats (128.50 or 128,50) and grouped values (2,000).
export function parseCurrencyInput(value: string) {
  let normalized = value.trim().replace(/[¥\s]/g, '');
  if (!normalized) return null;

  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    const parts = normalized.split(',');
    const looksLikeDecimalComma = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2;
    normalized = looksLikeDecimalComma ? `${parts[0]}.${parts[1]}` : normalized.replace(/,/g, '');
  }

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  if (Math.abs(amount - rounded) > Number.EPSILON * 100) return null;
  return rounded;
}

export function formatMonth(date: Date, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

export function formatFullDate(dateKey: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDateKey(dateKey));
}

export function formatShortDate(dateKey: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(parseDateKey(dateKey));
}

export function expenseTime(expense: Expense, locale = 'en-US') {
  if (!expense.createdAt) return null;
  const created = new Date(expense.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(created);
}

export function monthKey(date: Date) {
  return toDateKey(date).slice(0, 7);
}

export function moveMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function expensesForMonth(expenses: Expense[], date: Date) {
  const key = monthKey(date);
  return expenses.filter((expense) => expense.date.startsWith(key));
}

export function totalExpenses(expenses: Expense[]) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function defaultExpenseTitle(category: Category, mealType: MealType) {
  return category === 'Meal' ? mealType : category;
}

export function totalsByDate(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.date] = (totals[expense.date] ?? 0) + expense.amount;
    return totals;
  }, {});
}

export function totalsByCategory(expenses: Expense[]) {
  const totals = emptyCategoryBudgets();
  for (const expense of expenses) totals[expense.category] += expense.amount;
  return totals;
}

export function validChartCategory(selected: Category, categorySpent: CategoryBudgets): Category {
  if (categorySpent[selected] > 0) return selected;
  return CATEGORIES.find((category) => categorySpent[category] > 0) ?? 'Meal';
}

export function monthlyBudgetBreakdown(expenses: Expense[], budgets: Budgets): MonthlyBudgetBreakdown {
  const categorySpent = totalsByCategory(expenses);
  const totalSpent = totalExpenses(expenses);
  const hasTotalBudget = budgets.total > 0;
  const remainingBudget = hasTotalBudget ? Math.max(budgets.total - totalSpent, 0) : 0;
  const overBudgetBy = hasTotalBudget ? Math.max(totalSpent - budgets.total, 0) : 0;
  const slices: BudgetChartSlice[] = CATEGORIES.flatMap((category) => {
    const value = categorySpent[category];
    if (value <= 0) return [];
    const categoryBudget = budgets.categories[category];
    const overCategoryBudget = categoryBudget > 0 && value > categoryBudget;
    return [{
      key: category,
      label: category,
      value,
      color: overCategoryBudget ? '#D94F45' : categoryColors[category],
      overCategoryBudget,
    }];
  });
  if (remainingBudget > 0) {
    slices.push({
      key: 'Remaining Budget',
      label: 'Remaining Budget',
      value: remainingBudget,
      color: '#DDD9E5',
      overCategoryBudget: false,
    });
  }
  return { categorySpent, totalSpent, remainingBudget, overBudgetBy, slices };
}

export function sortExpenses(expenses: Expense[]) {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id));
}

export function removeExpense(expenses: Expense[], id: string) {
  return expenses.filter((expense) => expense.id !== id);
}

export function updateExpense(expenses: Expense[], id: string, input: ExpenseInput) {
  return expenses.map((expense) => expense.id === id ? {
    ...expense,
    ...input,
    title: input.title.trim(),
    note: input.note.trim(),
    mealType: input.category === 'Meal' ? input.mealType : undefined,
  } : expense);
}

export function createExpense(input: ExpenseInput, createdAt = new Date(), id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`): Expense {
  return {
    ...input,
    id,
    title: input.title.trim(),
    note: input.note.trim(),
    mealType: input.category === 'Meal' ? input.mealType : undefined,
    createdAt: createdAt.toISOString(),
  };
}

export function calendarCells(date: Date) {
  const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const numberOfDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = Array.from(
    { length: firstWeekday + numberOfDays },
    (_, index) => index < firstWeekday ? null : index - firstWeekday + 1,
  );
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function insightDayCount(month: Date, now = new Date()) {
  const targetMonth = monthKey(month);
  const currentMonth = monthKey(now);
  if (targetMonth > currentMonth) return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  if (targetMonth === currentMonth) return now.getDate();
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

export function monthlyInsights(expenses: Expense[], month: Date, now = new Date()): MonthlyInsights {
  const monthExpenses = expensesForMonth(expenses, month);
  const dailyTotals = totalsByDate(monthExpenses);
  const categorySpent = totalsByCategory(monthExpenses);
  const totalSpent = totalExpenses(monthExpenses);
  const trendDayCount = insightDayCount(month, now);
  const highestEntry = Object.entries(dailyTotals).reduce<[string, number] | null>((highest, entry) => (
    !highest || entry[1] > highest[1] ? entry : highest
  ), null);
  const largestExpense = monthExpenses.reduce<Expense | null>((largest, expense) => (
    !largest || expense.amount > largest.amount ? expense : largest
  ), null);
  const topCategory = CATEGORIES.reduce<Category | null>((highest, category) => (
    categorySpent[category] > 0 && (!highest || categorySpent[category] > categorySpent[highest]) ? category : highest
  ), null);
  return {
    averageDailySpending: trendDayCount > 0 ? totalSpent / trendDayCount : 0,
    categorySpent,
    dailyTotals,
    expenseCount: monthExpenses.length,
    highestSpendingDay: highestEntry ? { date: highestEntry[0], amount: highestEntry[1] } : null,
    largestExpense,
    mostSpentCategory: topCategory ? { category: topCategory, amount: categorySpent[topCategory] } : null,
    totalSpent,
    trendDayCount,
  };
}

export function safePercentage(value: number, total: number) {
  return total > 0 && Number.isFinite(value) && Number.isFinite(total) ? Math.max(0, (value / total) * 100) : 0;
}

export function categoryLabel(expense: Expense) {
  return expense.mealType ? `Meal · ${expense.mealType}` : expense.category;
}
