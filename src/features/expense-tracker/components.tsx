import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';

import { categoryName, mealName } from './i18n';
import { categoryIcons, type Expense, expenseTime, formatMoney, formatShortDate, type Tab } from './model';
import { animateLayout, usePreferences } from './preferences';

export function AnimatedScreen({ children }: PropsWithChildren) {
  const { reduceMotion, styles } = usePreferences();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => { if (reduceMotion) progress.setValue(1); else Animated.spring(progress, { damping: 18, mass: 0.7, stiffness: 180, toValue: 1, useNativeDriver: true }).start(); }, [progress, reduceMotion]);
  return <Animated.View style={[styles.animatedScreen, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

export function SummaryCards({ budget, spent }: { budget: number; spent: number }) {
  const { styles, t } = usePreferences();
  const remaining = budget - spent;
  return <View style={styles.summaryRow}>
    <SummaryItem label={t('budget')} value={formatMoney(budget)} />
    <SummaryItem middle label={t('spent')} value={formatMoney(spent)} />
    <SummaryItem danger={remaining < 0} label={t('remaining')} value={formatMoney(remaining)} />
  </View>;
}

function SummaryItem({ danger, label, middle, value }: { danger?: boolean; label: string; middle?: boolean; value: string }) {
  const { styles } = usePreferences();
  return <View style={[styles.summaryItem, middle && styles.summaryMiddle]}><Text style={styles.summaryLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.summaryValue, danger && styles.negative]}>{value}</Text></View>;
}

export function ExpenseList({ emptyText, expenses, onDelete, onEdit }: { emptyText: string; expenses: Expense[]; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void }) {
  const { styles } = usePreferences();
  return <View style={styles.listCard}>{expenses.length ? expenses.map((expense, index) => <View key={expense.id} style={index < expenses.length - 1 && styles.divider}><SwipeableExpenseCard expense={expense} onDelete={onDelete} onEdit={onEdit} /></View>) : <EmptyState text={emptyText} />}</View>;
}

export function DeleteExpenseDialog({ expense, onCancel, onConfirm }: { expense: Expense | null; onCancel: () => void; onConfirm: () => void }) {
  const { styles, t } = usePreferences();
  return <Modal animationType="fade" onRequestClose={onCancel} transparent visible={expense !== null}>
    <View accessibilityViewIsModal style={styles.confirmOverlay}><View style={styles.confirmCard}>
      <View style={styles.confirmIcon}><Text style={styles.confirmIconText}>🗑️</Text></View><Text style={styles.confirmTitle}>{t('deleteExpense')}</Text>
      <Text style={styles.confirmMessage}>{t('deleteConfirm', { title: expense?.title ?? '' })}</Text>
      <View style={styles.confirmActions}><Pressable onPress={onCancel} style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.buttonPressed]}><Text style={styles.confirmCancelText}>{t('cancel')}</Text></Pressable><Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.buttonPressed]}><Text style={styles.confirmDeleteText}>{t('delete')}</Text></Pressable></View>
    </View></View>
  </Modal>;
}

function SwipeableExpenseCard({ expense, onDelete, onEdit }: { expense: Expense; onDelete: (expense: Expense) => void; onEdit: (expense: Expense) => void }) {
  const { reduceMotion, styles, t } = usePreferences();
  const [translation] = useState(() => new Animated.Value(0));
  const [menuOpen, setMenuOpen] = useState(false);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 9 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => translation.setValue(Math.max(-84, Math.min(84, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      const destination = gesture.dx > 44 ? 76 : gesture.dx < -44 ? -76 : 0;
      if (reduceMotion) translation.setValue(destination); else Animated.spring(translation, { damping: 20, stiffness: 220, toValue: destination, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => reduceMotion ? translation.setValue(0) : Animated.spring(translation, { toValue: 0, useNativeDriver: true }).start(),
  }), [reduceMotion, translation]);
  function selectAction(action: 'edit' | 'delete') {
    setMenuOpen(false);
    Animated.timing(translation, { duration: reduceMotion ? 0 : 150, toValue: 0, useNativeDriver: true }).start();
    if (action === 'edit') onEdit(expense); else onDelete(expense);
  }
  return <View style={styles.swipeRow}>
    <Pressable accessibilityLabel={`${t('edit')} ${expense.title}`} onPress={() => selectAction('edit')} style={[styles.swipeAction, styles.swipeEditAction]}><Text style={styles.swipeActionIcon}>✎</Text><Text style={styles.swipeActionText}>{t('edit')}</Text></Pressable>
    <Pressable accessibilityLabel={`${t('delete')} ${expense.title}`} onPress={() => selectAction('delete')} style={[styles.swipeAction, styles.swipeDeleteAction]}><Text style={styles.swipeActionIcon}>🗑️</Text><Text style={styles.swipeActionText}>{t('delete')}</Text></Pressable>
    <Animated.View {...panResponder.panHandlers} style={[styles.swipeContent, { transform: [{ translateX: translation }] }]}><ExpenseRow expense={expense} menuOpen={menuOpen} onDelete={() => selectAction('delete')} onEdit={() => selectAction('edit')} onToggleMenu={() => { animateLayout(); setMenuOpen((current) => !current); }} /></Animated.View>
  </View>;
}

function ExpenseRow({ expense, menuOpen, onDelete, onEdit, onToggleMenu }: { expense: Expense; menuOpen: boolean; onDelete: () => void; onEdit: () => void; onToggleMenu: () => void }) {
  const { language, locale, styles, t } = usePreferences();
  const time = expenseTime(expense, locale);
  const dateText = time ? `${formatShortDate(expense.date, locale)} · ${time}` : formatShortDate(expense.date, locale);
  const category = expense.mealType ? `${categoryName(language, expense.category)} · ${mealName(language, expense.mealType)}` : categoryName(language, expense.category);
  return <View><View style={styles.expenseRow}><View style={styles.expenseIcon}><Text style={styles.expenseEmoji}>{categoryIcons[expense.category]}</Text></View><View style={styles.expenseDetails}>
    <Text numberOfLines={2} style={styles.expenseName}>{expense.title}</Text>{!!expense.note && <Text numberOfLines={2} style={styles.expenseNote}>{expense.note}</Text>}<Text numberOfLines={1} style={styles.expenseCategory}>{category}</Text><Text numberOfLines={1} style={styles.expenseDate}>{dateText}</Text>
  </View><View style={styles.expenseActions}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.expenseAmount}>−{formatMoney(expense.amount)}</Text><Pressable accessibilityLabel={t('moreActions')} hitSlop={6} onPress={onToggleMenu} style={({ pressed }) => [styles.moreButton, pressed && styles.buttonPressed]}><Text style={styles.moreButtonText}>•••</Text></Pressable></View></View>
  {menuOpen && <View style={styles.expenseMenu}><Pressable onPress={onEdit} style={styles.expenseMenuButton}><Text style={styles.expenseMenuEdit}>✎ {t('edit')}</Text></Pressable><Pressable onPress={onDelete} style={styles.expenseMenuButton}><Text style={styles.expenseMenuDelete}>⌫ {t('delete')}</Text></Pressable></View>}
  </View>;
}

function EmptyState({ text }: { text: string }) { const { styles } = usePreferences(); return <View style={styles.emptyState}><Text style={styles.emptyEmoji}>🧾</Text><Text style={styles.emptyText}>{text}</Text></View>; }

export function BottomNavigation({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const { styles, t } = usePreferences();
  const tabs: { key: Tab; icon: string; label: string }[] = [{ key: 'dashboard', icon: '⌂', label: t('dashboard') }, { key: 'calendar', icon: '▦', label: t('calendar') }, { key: 'add', icon: '＋', label: t('addExpense') }, { key: 'insights', icon: '↗', label: t('insights') }, { key: 'settings', icon: '⚙', label: t('settings') }];
  return <View testID="pocket-plan-bottom-nav" style={styles.navBar}>{tabs.map((tab) => { const active = activeTab === tab.key; return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={tab.key} onPress={() => { animateLayout(); onChange(tab.key); }} style={({ pressed }) => [styles.navItem, pressed && styles.buttonPressed]}><View style={[styles.navIconWrap, active && styles.navIconActive]}><Text style={[styles.navIcon, active && styles.navTextActive]}>{tab.icon}</Text></View><Text numberOfLines={1} style={[styles.navLabel, active && styles.navTextActive]}>{tab.label}</Text></Pressable>; })}</View>;
}
