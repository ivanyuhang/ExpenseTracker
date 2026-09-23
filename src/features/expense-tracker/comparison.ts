import { CATEGORIES, type Category, type Expense, expensesForMonth, moveMonth, safePercentage, totalExpenses, totalsByCategory } from './model.ts';

export type CategoryComparison = {
  category: Category;
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
};

export function percentageChange(current: number, previous: number) {
  if (previous <= 0) return current <= 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function previousMonthComparison(expenses: Expense[], selectedMonth: Date) {
  const previousMonth = moveMonth(selectedMonth, -1);
  const currentExpenses = expensesForMonth(expenses, selectedMonth);
  const previousExpenses = expensesForMonth(expenses, previousMonth);
  const currentTotal = totalExpenses(currentExpenses);
  const previousTotal = totalExpenses(previousExpenses);
  const currentCategories = totalsByCategory(currentExpenses);
  const previousCategories = totalsByCategory(previousExpenses);
  const categories: CategoryComparison[] = CATEGORIES.map((category) => ({
    category,
    current: currentCategories[category],
    previous: previousCategories[category],
    difference: currentCategories[category] - previousCategories[category],
    percentChange: percentageChange(currentCategories[category], previousCategories[category]),
  }));
  const increases = categories.filter((item) => item.difference > 0).sort((a, b) => b.difference - a.difference);
  const decreases = categories.filter((item) => item.difference < 0).sort((a, b) => a.difference - b.difference);
  return {
    categories,
    currentExpenses,
    currentTotal,
    difference: currentTotal - previousTotal,
    percentChange: percentageChange(currentTotal, previousTotal),
    previousExpenses,
    previousMonth,
    previousTotal,
    largestIncrease: increases[0] ?? null,
    largestDecrease: decreases[0] ?? null,
    currentShare: (category: Category) => safePercentage(currentCategories[category], currentTotal),
  };
}
