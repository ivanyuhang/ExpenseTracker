import {
  type Expense,
  type ExpenseInput,
  isValidDate,
  parseDateKey,
  type RecurrenceUnit,
  type RecurringRule,
  type RepeatOption,
  toDateKey,
} from './model.ts';

export type RecurrenceSettings = {
  repeat: RepeatOption;
  interval: number;
  unit: RecurrenceUnit;
  endDate?: string;
};

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function addAnchoredMonths(startDate: string, months: number) {
  const start = parseDateKey(startDate);
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return toDateKey(target);
}

export function nextOccurrenceAfter(rule: RecurringRule, occurrence: string) {
  if (rule.unit === 'day') return addDays(occurrence, rule.interval);
  if (rule.unit === 'week') return addDays(occurrence, rule.interval * 7);
  const start = parseDateKey(rule.startDate);
  const current = parseDateKey(occurrence);
  const elapsedMonths = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
  return addAnchoredMonths(rule.startDate, elapsedMonths + rule.interval);
}

export function createRecurringRule(input: ExpenseInput, settings: RecurrenceSettings, now = new Date(), id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`): RecurringRule {
  if (settings.repeat === 'never') throw new Error('A recurring rule requires a repeat frequency.');
  const frequency = settings.repeat;
  const unit = frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : frequency === 'monthly' ? 'month' : settings.unit;
  const interval = frequency === 'custom' ? Math.max(1, Math.floor(settings.interval)) : 1;
  const base: RecurringRule = {
    ...input,
    id,
    active: true,
    startDate: input.date,
    frequency,
    unit,
    interval,
    endDate: settings.endDate && isValidDate(settings.endDate) ? settings.endDate : undefined,
    excludedDates: [],
    nextOccurrence: input.date,
    createdAt: now.toISOString(),
  };
  return { ...base, nextOccurrence: nextOccurrenceAfter(base, input.date) };
}

export function materializeRecurringExpenses(expenses: Expense[], rules: RecurringRule[], throughDate = toDateKey()) {
  const result = [...expenses];
  const occurrenceKeys = new Set(result.flatMap((expense) => expense.recurringRuleId ? [`${expense.recurringRuleId}:${expense.date}`] : []));
  let created = 0;
  const updatedRules = rules.map((rule) => {
    if (!rule.active) return rule;
    let next = rule.nextOccurrence;
    let iterations = 0;
    while (next <= throughDate && (!rule.endDate || next <= rule.endDate) && iterations < 5000) {
      const occurrenceKey = `${rule.id}:${next}`;
      if (!occurrenceKeys.has(occurrenceKey) && !rule.excludedDates.includes(next)) {
        result.push({
          id: `rec-${rule.id}-${next}`,
          amount: rule.amount,
          category: rule.category,
          mealType: rule.category === 'Meal' ? rule.mealType : undefined,
          title: rule.title,
          note: rule.note,
          date: next,
          recurringRuleId: rule.id,
          recurrenceKey: occurrenceKey,
          createdAt: `${next}T12:00:00.000Z`,
        });
        occurrenceKeys.add(occurrenceKey);
        created += 1;
      }
      next = nextOccurrenceAfter(rule, next);
      iterations += 1;
    }
    return { ...rule, nextOccurrence: next };
  });
  return { expenses: result, rules: updatedRules, created };
}

export function resumeRecurringRule(rule: RecurringRule, today = toDateKey()) {
  let next = rule.nextOccurrence;
  while (next < today && (!rule.endDate || next <= rule.endDate)) next = nextOccurrenceAfter(rule, next);
  return { ...rule, active: !rule.endDate || next <= rule.endDate, nextOccurrence: next };
}

export function updateRecurringRule(rule: RecurringRule, input: ExpenseInput, settings: RecurrenceSettings) {
  const frequency = settings.repeat === 'never' ? rule.frequency : settings.repeat;
  const unit = frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : frequency === 'monthly' ? 'month' : settings.unit;
  const interval = frequency === 'custom' ? Math.max(1, Math.floor(settings.interval)) : 1;
  const updated: RecurringRule = { ...rule, ...input, startDate: input.date, frequency, unit, interval, endDate: settings.endDate || undefined, nextOccurrence: input.date };
  return updated;
}

export function scheduleRuleAfter(rule: RecurringRule, date: string) {
  let next = rule.startDate;
  while (next <= date && (!rule.endDate || next <= rule.endDate)) next = nextOccurrenceAfter(rule, next);
  return { ...rule, nextOccurrence: next, active: rule.active && (!rule.endDate || next <= rule.endDate) };
}

export function recurringOccurrenceExists(expenses: Expense[], ruleId: string, date: string) {
  return expenses.some((expense) => expense.recurringRuleId === ruleId && expense.date === date);
}
