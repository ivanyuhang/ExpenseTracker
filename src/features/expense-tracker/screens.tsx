import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseList, SummaryCards } from './components';
import { categoryName, mealName } from './i18n';
import { animateLayout, usePreferences } from './preferences';
import { SpendingDonut } from './spending-donut';
import { RecurringRulesSection } from './recurring-ui';
import {
  calendarCells,
  type Budgets,
  CATEGORIES,
  categoryIcons,
  type Category,
  type Expense,
  expensesForMonth,
  formatFullDate,
  formatMoney,
  formatMonth,
  MEAL_TYPES,
  type MealType,
  type RecurrenceUnit,
  type RecurringRule,
  type RepeatOption,
  monthKey,
  moveMonth,
  parseCurrencyInput,
  parseDateKey,
  sortExpenses,
  toDateKey,
  totalExpenses,
  totalsByCategory,
  totalsByDate,
} from './model';

export function DashboardScreen({
  budgets,
  expenses,
  monthSpent,
  onAdd,
  onDelete,
  onEdit,
  onSaveBudgets,
}: {
  budgets: Budgets;
  expenses: Expense[];
  monthSpent: number;
  onAdd: () => void;
  onDelete: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onSaveBudgets: (budgets: Budgets) => void;
}) {
  const { language, locale, styles, t } = usePreferences();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Category | null>(null);
  const monthExpenses = expensesForMonth(expenses, new Date());
  const categorySpent = totalsByCategory(monthExpenses);
  const progress = budgets.total > 0 ? Math.min(monthSpent / budgets.total, 1) : 0;
  const remaining = budgets.total - monthSpent;
  const recent = sortExpenses(expenses).slice(0, 5);
  return (
    <>
      <Text style={styles.screenTitle}>{t('dashboard')}</Text>
      <Text style={styles.screenSubtitle}>{formatMonth(new Date(), locale)}</Text>

      <View style={styles.budgetCard}>
        <View style={styles.budgetTopRow}>
          <View>
            <Text style={styles.darkLabel}>{t('totalRemaining')}</Text>
            <Text style={[styles.budgetAmount, remaining < 0 && styles.budgetAmountOver]}>
              {budgets.total ? formatMoney(remaining) : t('setYourBudgets')}
            </Text>
          </View>
          <Pressable onPress={() => setEditorOpen(true)} style={styles.editButton}>
            <Text style={styles.editButtonText}>{t('editBudgets')}</Text>
          </Pressable>
        </View>
        <BudgetProgress value={progress} />
        <View style={styles.budgetCaptionRow}>
          <Text style={styles.progressCaption}>{budgets.total ? t('used', { value: Math.round((monthSpent / budgets.total) * 100) }) : t('noOverallLimit')}</Text>
          <Text style={styles.progressCaption}>{t('ofBudget', { spent: formatMoney(monthSpent), budget: formatMoney(budgets.total) })}</Text>
        </View>
      </View>

      <SummaryCards budget={budgets.total} spent={monthSpent} />

      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionTitle}>{t('categoryBudgets')}</Text><Text style={styles.sectionHelper}>{t('thisMonth')}</Text></View>
        <Pressable onPress={() => setEditorOpen(true)} style={styles.sectionEditButton}><Text style={styles.sectionEditText}>{t('edit')}</Text></Pressable>
      </View>
      <View style={styles.categoryBudgetCard}>
        {CATEGORIES.map((category, index) => {
          const limit = budgets.categories[category];
          const spent = categorySpent[category];
          const categoryProgress = limit > 0 ? Math.min(spent / limit, 1) : 0;
          const categoryRemaining = limit - spent;
          return (
            <Pressable key={category} onPress={() => { animateLayout(); setSelectedBudget((current) => current === category ? null : category); }} style={[styles.categoryBudgetRow, index < CATEGORIES.length - 1 && styles.categoryBudgetDivider]}>
              <View style={styles.categoryBudgetHeader}>
                <View style={styles.categoryBudgetNameWrap}>
                  <Text style={styles.categoryBudgetIcon}>{categoryIcons[category]}</Text>
                  <Text style={styles.categoryBudgetName}>{categoryName(language, category)}</Text>
                </View>
                <Text style={styles.categoryBudgetAmounts}>{formatMoney(spent)} / {formatMoney(limit)}</Text>
              </View>
              <BudgetProgress category over={spent > limit && limit > 0} value={categoryProgress} />
              <Text style={[styles.categoryRemaining, categoryRemaining < 0 && styles.negative]}>
                {limit ? (categoryRemaining < 0 ? t('over', { value: formatMoney(Math.abs(categoryRemaining)) }) : t('remainingLower', { value: formatMoney(categoryRemaining) })) : t('spentNoLimit', { value: formatMoney(spent) })}
              </Text>
              {selectedBudget === category && <View style={styles.categoryBudgetDetail}><Text style={styles.categoryBudgetDetailText}>{limit ? `${t('categoryDetail', { spent: formatMoney(spent), budget: formatMoney(limit) })}\n${t('percentUsed', { value: Math.round((spent / limit) * 100) })}` : `${formatMoney(spent)} · ${t('noCategoryBudget')}`}</Text></View>}
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onAdd} style={styles.primaryButton}>
        <Text style={styles.primaryButtonIcon}>＋</Text><Text style={styles.primaryButtonText}>{t('addExpense')}</Text>
      </Pressable>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{t('recentExpenses')}</Text>
        <Text style={styles.sectionCount}>{t('totalCount', { count: expenses.length })}</Text>
      </View>
      <ExpenseList emptyText={t('firstExpense')} expenses={recent} onDelete={onDelete} onEdit={onEdit} />
      {editorOpen && (
        <BudgetEditorModal
          budgets={budgets}
          onClose={() => setEditorOpen(false)}
          onSave={(next) => { onSaveBudgets(next); setEditorOpen(false); }}
        />
      )}
    </>
  );
}

function BudgetProgress({ category = false, over = false, value }: { category?: boolean; over?: boolean; value: number }) {
  const { reduceMotion, styles } = usePreferences();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { duration: reduceMotion ? 0 : 360, toValue: Math.max(0, Math.min(value, 1)), useNativeDriver: false }).start();
  }, [progress, reduceMotion, value]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return <View style={category ? styles.categoryProgressTrack : styles.progressTrack}><Animated.View style={[category ? styles.categoryProgressFill : styles.progressFill, over && styles.progressOver, { width }]} /></View>;
}

function BudgetEditorModal({ budgets, onClose, onSave }: { budgets: Budgets; onClose: () => void; onSave: (value: Budgets) => void }) {
  const { language, styles, t } = usePreferences();
  const [totalInput, setTotalInput] = useState(budgets.total ? String(budgets.total) : '');
  const [categoryInputs, setCategoryInputs] = useState<Record<Category, string>>(() => (
    Object.fromEntries(CATEGORIES.map((category) => [category, budgets.categories[category] ? String(budgets.categories[category]) : ''])) as Record<Category, string>
  ));
  const [error, setError] = useState('');

  function parseBudget(value: string) {
    if (!value.trim()) return 0;
    const amount = parseCurrencyInput(value);
    return amount !== null && amount >= 0 ? amount : null;
  }

  function save() {
    const total = parseBudget(totalInput);
    const categories = Object.fromEntries(CATEGORIES.map((category) => [category, parseBudget(categoryInputs[category])])) as Record<Category, number | null>;
    if (total === null || CATEGORIES.some((category) => categories[category] === null)) {
      setError(`${t('checkBudgets')}: ${t('budgetError')}`);
      return;
    }
    setError('');
    onSave({ total, categories: categories as Budgets['categories'] });
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.budgetModalScreen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.pickerTopBar}>
            <Pressable onPress={onClose} style={styles.pickerTopButton}><Text style={styles.budgetCancelText}>{t('cancel')}</Text></Pressable>
            <Text style={styles.pickerTitle}>{t('editBudgetTitle')}</Text>
            <Pressable onPress={save} style={styles.pickerTopButton}><Text style={styles.pickerDoneText}>{t('save')}</Text></Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.budgetModalContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.budgetModalIntro}>{t('budgetIntro')}</Text>
            {!!error && <View style={styles.warning}><Text style={styles.warningText}>{error}</Text></View>}
            <BudgetInputRow
              emphasized
              icon="◎"
              label={t('totalMonthlyBudget')}
              onChange={setTotalInput}
              value={totalInput}
            />
            <Text style={styles.budgetGroupLabel}>{t('categoryBudgetsUpper')}</Text>
            {CATEGORIES.map((category) => (
              <BudgetInputRow
                icon={categoryIcons[category]}
                key={category}
                label={t('categoryBudget', { category: categoryName(language, category) })}
                onChange={(value) => setCategoryInputs((current) => ({ ...current, [category]: value }))}
                value={categoryInputs[category]}
              />
            ))}
            <Text style={styles.budgetMealHint}>{t('mealBudgetHint')}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function BudgetInputRow({ emphasized = false, icon, label, onChange, value }: { emphasized?: boolean; icon: string; label: string; onChange: (value: string) => void; value: string }) {
  const { colors, styles } = usePreferences();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.budgetInputRow, emphasized && styles.totalBudgetInputRow]}>
      <View style={styles.budgetInputLabelWrap}><Text style={styles.budgetInputIcon}>{icon}</Text><Text style={[styles.budgetInputLabel, emphasized && styles.totalBudgetInputLabel]}>{label}</Text></View>
      <View style={[styles.budgetInputControl, focused && styles.budgetInputControlFocused]}>
        <Text style={styles.budgetInputCurrency}>¥</Text>
        <TextInput
          accessibilityLabel={`${label} in yuan`}
          keyboardType="decimal-pad"
          onBlur={() => setFocused(false)}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          style={styles.budgetInputField}
          value={value}
        />
      </View>
    </View>
  );
}

export function CalendarScreen({
  budgets,
  expenses,
  onChooseMonth,
  onDelete,
  onEdit,
  onSelectDate,
  selectedDate,
  todayKey,
  viewMonth,
}: {
  budgets: Budgets;
  expenses: Expense[];
  onChooseMonth: (offset: number) => void;
  onDelete: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onSelectDate: (value: string) => void;
  selectedDate: string;
  todayKey: string;
  viewMonth: Date;
}) {
  const { locale, styles, t } = usePreferences();
  const visibleExpenses = expensesForMonth(expenses, viewMonth);
  const monthSpent = totalExpenses(visibleExpenses);
  const dailyTotals = totalsByDate(visibleExpenses);
  const selectedExpenses = sortExpenses(expenses.filter((expense) => expense.date === selectedDate));
  const selectedTotal = totalExpenses(selectedExpenses);
  const visibleMonthKey = monthKey(viewMonth);

  return (
    <>
      <Text style={styles.screenTitle}>{t('calendar')}</Text>
      <Text style={styles.screenSubtitle}>{t('calendarSubtitle')}</Text>
      <SummaryCards budget={budgets.total} spent={monthSpent} />
      <SpendingDonut budgets={budgets} expenses={visibleExpenses} />

      <View style={styles.calendarCard}>
        <View style={styles.monthSwitcher}>
          <Pressable accessibilityLabel={t('previousMonth')} onPress={() => onChooseMonth(-1)} style={styles.arrowButton}><Text style={styles.arrow}>‹</Text></Pressable>
          <Text style={styles.monthTitle}>{formatMonth(viewMonth, locale)}</Text>
          <Pressable accessibilityLabel={t('nextMonth')} onPress={() => onChooseMonth(1)} style={styles.arrowButton}><Text style={styles.arrow}>›</Text></Pressable>
        </View>
        <CalendarWeekHeader />
        <View style={styles.calendarGrid}>
          {calendarCells(viewMonth).map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const key = `${visibleMonthKey}-${String(day).padStart(2, '0')}`;
            const total = dailyTotals[key] ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            return (
              <Pressable
                accessibilityLabel={`${key}, spent ${formatMoney(total)}`}
                accessibilityState={{ selected: isSelected }}
                key={key}
                onPress={() => { animateLayout(); onSelectDate(key); }}
                style={({ pressed }) => [styles.dayCell, isSelected && styles.selectedDay, pressed && styles.buttonPressed]}>
                {total > 0 && <View style={styles.expenseDayDot} />}
                <View style={[styles.dayNumberWrap, isToday && styles.todayCircle]}>
                  <Text style={[styles.dayNumber, isToday && styles.todayNumber, isSelected && !isToday && styles.selectedDayNumber]}>{day}</Text>
                </View>
                {total > 0 && <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.dayTotal, isSelected && styles.selectedDayTotal]}>{formatMoney(total)}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.selectedHeader}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.selectedDateTitle}>{formatFullDate(selectedDate, locale)}</Text>
          <Text style={styles.selectedCount}>{t(selectedExpenses.length === 1 ? 'expenseCount' : 'expensesCount', { count: selectedExpenses.length })}</Text>
        </View>
        <Text style={styles.selectedTotal}>{formatMoney(selectedTotal)}</Text>
      </View>
      <ExpenseList emptyText={t('nothingSpent')} expenses={selectedExpenses} onDelete={onDelete} onEdit={onEdit} />
    </>
  );
}

export function AddExpenseScreen({
  amount,
  category,
  date,
  mealType,
  saving,
  title,
  note,
  repeat,
  repeatEndDate,
  repeatInterval,
  repeatUnit,
  recurrenceLocked,
  onAdd,
  onCancelEdit,
  onAmount,
  onCategory,
  onDate,
  onMealType,
  onTitle,
  onNote,
  onRepeat,
  onRepeatEndDate,
  onRepeatInterval,
  onRepeatUnit,
  editing,
}: {
  amount: string;
  category: Category;
  date: string;
  mealType: MealType;
  saving: boolean;
  title: string;
  note: string;
  editing: boolean;
  repeat: RepeatOption;
  repeatEndDate: string;
  repeatInterval: string;
  repeatUnit: RecurrenceUnit;
  recurrenceLocked: boolean;
  onAdd: () => void;
  onCancelEdit: () => void;
  onAmount: (value: string) => void;
  onCategory: (value: Category) => void;
  onDate: (value: string) => void;
  onMealType: (value: MealType) => void;
  onTitle: (value: string) => void;
  onNote: (value: string) => void;
  onRepeat: (value: RepeatOption) => void;
  onRepeatEndDate: (value: string) => void;
  onRepeatInterval: (value: string) => void;
  onRepeatUnit: (value: RecurrenceUnit) => void;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const { colors, locale, styles, t } = usePreferences();
  return (
    <>
      <Text style={styles.screenTitle}>{editing ? t('editExpense') : t('addExpense')}</Text>
      <Text style={styles.screenSubtitle}>{t(editing ? 'editSubtitle' : 'addSubtitle')}</Text>
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>{t('amount')}</Text>
        <View testID="pocket-plan-amount-wrap" style={styles.amountInputWrap}>
          <Text style={styles.amountPrefix}>¥</Text>
          <TextInput
            accessibilityLabel="Expense amount in yuan"
            autoFocus
            keyboardType="decimal-pad"
            onChangeText={onAmount}
            placeholder="0.00"
            placeholderTextColor={colors.placeholder}
            style={styles.amountInput}
            testID="pocket-plan-amount-input"
            value={amount}
          />
        </View>

        <Text style={styles.inputLabel}>{t('category')}</Text>
        <CategorySelector category={category} onChange={onCategory} />

        {category === 'Meal' && (
          <>
            <Text style={styles.inputLabel}>{t('mealType')}</Text>
            <MealTypeSelector mealType={mealType} onChange={onMealType} />
          </>
        )}

        <Text style={styles.inputLabel}>{t('date')}</Text>
        <Pressable accessibilityLabel={`${t('date')}, ${formatFullDate(date, locale)}`} onPress={() => setDatePickerOpen(true)} style={({ pressed }) => [styles.dateField, pressed && styles.buttonPressed]}>
          <View style={styles.dateIcon}><Text style={styles.dateIconText}>▦</Text></View>
          <View style={styles.dateFieldText}>
            <Text numberOfLines={1} style={styles.dateValue}>{formatFullDate(date, locale)}</Text>
            <Text numberOfLines={1} style={styles.dateHint}>{t('tapAnotherDate')}</Text>
          </View>
          <Text style={styles.dateChevron}>›</Text>
        </Pressable>

        <Text style={styles.titleInputLabel}>{t('title')} <Text style={styles.required}>{t('required')}</Text></Text>
        <TextInput
          accessibilityLabel="Expense title"
          maxLength={60}
          onChangeText={onTitle}
          placeholder={t('titlePlaceholder')}
          placeholderTextColor={colors.placeholder}
          style={styles.titleInput}
          value={title}
        />

        <Text style={styles.inputLabel}>{t('note')} <Text style={styles.optional}>{t('optional')}</Text></Text>
        <TextInput
          accessibilityLabel="Expense note"
          maxLength={160}
          multiline
          onChangeText={onNote}
          placeholder={t('notePlaceholder')}
          placeholderTextColor={colors.placeholder}
          style={styles.noteInput}
          textAlignVertical="top"
          value={note}
        />

        <Text style={styles.inputLabel}>{t('repeat')}</Text>
        {recurrenceLocked ? <View style={styles.recurrenceLocked}><Text style={styles.recurrenceLockedText}>{t('singleOccurrenceHint')}</Text></View> : <RepeatSelector value={repeat} onChange={onRepeat} />}
        {!recurrenceLocked && repeat === 'custom' && <CustomRecurrence interval={repeatInterval} onInterval={onRepeatInterval} onUnit={onRepeatUnit} unit={repeatUnit} />}
        {!recurrenceLocked && repeat !== 'never' && <><Text style={styles.inputLabel}>{t('endDate')} <Text style={styles.optional}>{t('optional')}</Text></Text><Pressable onPress={() => setEndDatePickerOpen(true)} style={styles.dateField}><View style={styles.dateIcon}><Text style={styles.dateIconText}>▦</Text></View><View style={styles.dateFieldText}><Text numberOfLines={1} style={styles.dateValue}>{repeatEndDate ? formatFullDate(repeatEndDate, locale) : t('noEndDate')}</Text><Text numberOfLines={1} style={styles.dateHint}>{t('tapEndDate')}</Text></View></Pressable>{!!repeatEndDate && <Pressable onPress={() => onRepeatEndDate('')} style={styles.clearEndButton}><Text style={styles.clearEndText}>{t('clearEndDate')}</Text></Pressable>}</>}
        <Pressable disabled={saving} onPress={onAdd} style={({ pressed }) => [styles.saveButton, saving && styles.saveButtonDisabled, pressed && styles.buttonPressed]}>
          <Text style={styles.saveButtonText}>{saving ? t('saving') : editing ? t('saveChanges') : t('saveExpense')}</Text>
        </Pressable>
        {editing && <Pressable onPress={onCancelEdit} style={({ pressed }) => [styles.cancelEditButton, pressed && styles.buttonPressed]}><Text style={styles.cancelEditText}>{t('cancelEditing')}</Text></Pressable>}
        <Text style={styles.saveHint}>{t(editing ? 'editCalendarHint' : 'calendarHint')}</Text>
      </View>

      <DatePickerModal onChange={onDate} onClose={() => setDatePickerOpen(false)} value={date} visible={datePickerOpen} />
      <DatePickerModal onChange={onRepeatEndDate} onClose={() => setEndDatePickerOpen(false)} value={repeatEndDate || date} visible={endDatePickerOpen} />
    </>
  );
}

function RepeatSelector({ onChange, value }: { onChange: (value: RepeatOption) => void; value: RepeatOption }) {
  const { styles, t } = usePreferences();
  const options: RepeatOption[] = ['never', 'daily', 'weekly', 'monthly', 'custom'];
  return <View style={styles.repeatGrid}>{options.map((option) => <Pressable accessibilityState={{ selected: value === option }} key={option} onPress={() => { animateLayout(); onChange(option); }} style={({ pressed }) => [styles.repeatButton, value === option && styles.repeatButtonSelected, pressed && styles.buttonPressed]}><Text style={[styles.repeatButtonText, value === option && styles.repeatButtonTextSelected]}>{t(option)}</Text>{value === option && <Text style={styles.selectedCheck}>✓</Text>}</Pressable>)}</View>;
}

function CustomRecurrence({ interval, onInterval, onUnit, unit }: { interval: string; onInterval: (value: string) => void; onUnit: (value: RecurrenceUnit) => void; unit: RecurrenceUnit }) {
  const { colors, styles, t } = usePreferences();
  const units: RecurrenceUnit[] = ['day', 'week', 'month'];
  return <View style={styles.customRecurrence}><Text style={styles.customRecurrenceLabel}>{t('every')}</Text><TextInput keyboardType="number-pad" maxLength={3} onChangeText={onInterval} placeholder="1" placeholderTextColor={colors.placeholder} style={styles.intervalInput} value={interval} /><View style={styles.unitRow}>{units.map((item) => <Pressable key={item} onPress={() => onUnit(item)} style={[styles.unitButton, unit === item && styles.unitButtonSelected]}><Text style={[styles.unitButtonText, unit === item && styles.unitButtonTextSelected]}>{t(item)}</Text></Pressable>)}</View></View>;
}

function CategorySelector({ category, onChange }: { category: Category; onChange: (value: Category) => void }) {
  const { language, styles } = usePreferences();
  return (
    <View style={styles.categoryGrid}>
      {CATEGORIES.map((item) => {
        const selected = category === item;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={item}
            onPress={() => { animateLayout(); onChange(item); }}
            style={({ pressed }) => [styles.categoryCard, selected && styles.categoryCardSelected, pressed && { transform: [{ scale: 0.98 }] }]}> 
            <View style={[styles.categoryIconWrap, selected && styles.categoryIconWrapSelected]}>
              <Text style={styles.categoryEmoji}>{categoryIcons[item]}</Text>
            </View>
            <View style={styles.categoryCardFooter}>
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{categoryName(language, item)}</Text>
              {selected && <Text style={styles.selectedCheck}>✓</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MealTypeSelector({ mealType, onChange }: { mealType: MealType; onChange: (value: MealType) => void }) {
  const { language, styles } = usePreferences();
  const icons: Record<MealType, string> = { Breakfast: '☀️', Lunch: '🥗', Dinner: '🌙' };
  return (
    <View style={styles.mealTypeRow}>
      {MEAL_TYPES.map((item) => {
        const selected = mealType === item;
        return (
          <Pressable
            accessibilityState={{ selected }}
            key={item}
            onPress={() => { animateLayout(); onChange(item); }}
            style={({ pressed }) => [styles.mealTypeButton, selected && styles.mealTypeButtonSelected, pressed && { transform: [{ scale: 0.985 }] }]}> 
            <Text style={styles.mealTypeIcon}>{icons[item]}</Text>
            <Text style={[styles.mealTypeText, selected && styles.mealTypeTextSelected]}>{mealName(language, item)}</Text>
            {selected && <Text style={styles.mealTypeCheck}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function DatePickerModal({ onChange, onClose, value, visible }: { onChange: (value: string) => void; onClose: () => void; value: string; visible: boolean }) {
  const { locale, styles, t } = usePreferences();
  const selected = parseDateKey(value);
  const [pickerMonth, setPickerMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const visibleMonthKey = monthKey(pickerMonth);

  function selectToday() {
    const today = new Date();
    onChange(toDateKey(today));
    setPickerMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.pickerScreen}>
        <View style={styles.pickerTopBar}>
          <Pressable onPress={selectToday} style={styles.pickerTopButton}><Text style={styles.pickerTodayText}>{t('today')}</Text></Pressable>
          <Text style={styles.pickerTitle}>{t('chooseDate')}</Text>
          <Pressable onPress={onClose} style={styles.pickerTopButton}><Text style={styles.pickerDoneText}>{t('done')}</Text></Pressable>
        </View>
        <View style={styles.pickerSelectionCard}>
          <Text style={styles.pickerSelectionLabel}>{t('selectedDate')}</Text>
          <Text style={styles.pickerSelectionValue}>{formatFullDate(value, locale)}</Text>
        </View>
        <View style={styles.pickerCalendar}>
          <View style={styles.monthSwitcher}>
            <Pressable accessibilityLabel={t('previousMonth')} onPress={() => { animateLayout(); setPickerMonth((month) => moveMonth(month, -1)); }} style={styles.arrowButton}><Text style={styles.arrow}>‹</Text></Pressable>
            <Text style={styles.monthTitle}>{formatMonth(pickerMonth, locale)}</Text>
            <Pressable accessibilityLabel={t('nextMonth')} onPress={() => { animateLayout(); setPickerMonth((month) => moveMonth(month, 1)); }} style={styles.arrowButton}><Text style={styles.arrow}>›</Text></Pressable>
          </View>
          <CalendarWeekHeader />
          <View style={styles.pickerGrid}>
            {calendarCells(pickerMonth).map((day, index) => {
              if (!day) return <View key={`picker-blank-${index}`} style={styles.pickerDay} />;
              const key = `${visibleMonthKey}-${String(day).padStart(2, '0')}`;
              const isSelected = key === value;
              const isToday = key === toDateKey();
              return (
                <Pressable
                  accessibilityLabel={key}
                  accessibilityState={{ selected: isSelected }}
                  key={key}
                  onPress={() => { animateLayout(); onChange(key); }}
                  style={[styles.pickerDay, isSelected && styles.pickerDaySelected]}>
                  <Text style={[styles.pickerDayText, isSelected && styles.pickerDayTextSelected]}>{day}</Text>
                  {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.pickerConfirmButton}>
          <Text style={styles.pickerConfirmText}>{t('useDate', { date: formatFullDate(value, locale) })}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function CalendarWeekHeader() {
  const { locale, styles } = usePreferences();
  const weekdays = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, day + 1)));
  return <View style={styles.weekRow}>{weekdays.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>;
}

export function SettingsScreen({ recurringRules, onDeleteRule, onEditRule, onToggleRule }: { recurringRules: RecurringRule[]; onDeleteRule: (rule: RecurringRule) => void; onEditRule: (rule: RecurringRule) => void; onToggleRule: (rule: RecurringRule) => void }) {
  const { language, setLanguage, setTheme, styles, t, theme } = usePreferences();
  return <>
    <Text style={styles.screenTitle}>{t('settings')}</Text><Text style={styles.screenSubtitle}>{t('settingsSubtitle')}</Text>
    <Text style={styles.settingsSectionLabel}>{t('language').toUpperCase()}</Text>
    <View style={styles.settingsGroup}>
      <SettingsOption label={t('english')} onPress={() => setLanguage('en')} selected={language === 'en'} />
      <SettingsOption divider label={t('chinese')} onPress={() => setLanguage('zh-CN')} selected={language === 'zh-CN'} />
    </View>
    <Text style={styles.settingsSectionLabel}>{t('appearance').toUpperCase()}</Text>
    <View style={styles.settingsGroup}>
      <SettingsOption label={t('light')} onPress={() => setTheme('light')} selected={theme === 'light'} />
      <SettingsOption divider label={t('dark')} onPress={() => setTheme('dark')} selected={theme === 'dark'} />
      <SettingsOption divider label={t('system')} onPress={() => setTheme('system')} selected={theme === 'system'} />
    </View>
    <Text style={styles.settingsHint}>{t('followsDevice')}</Text>
    <RecurringRulesSection rules={recurringRules} onDelete={onDeleteRule} onEdit={onEditRule} onToggle={onToggleRule} />
    <Text style={styles.settingsVersion}>{t('versionLabel')}</Text>
  </>;
}

function SettingsOption({ divider = false, label, onPress, selected }: { divider?: boolean; label: string; onPress: () => void; selected: boolean }) {
  const { styles } = usePreferences();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.settingsRow, divider && styles.settingsDivider, pressed && styles.buttonPressed]}><Text style={styles.settingsRowText}>{label}</Text>{selected && <Text style={styles.settingsCheck}>✓</Text>}</Pressable>;
}
