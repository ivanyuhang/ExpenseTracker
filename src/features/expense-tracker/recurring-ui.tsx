import { Modal, Pressable, Text, View } from 'react-native';

import { categoryName } from './i18n';
import { type Expense, formatMoney, formatShortDate, type RecurringRule } from './model';
import { usePreferences } from './preferences';

export function RecurringRulesSection({ rules, onDelete, onEdit, onToggle }: { rules: RecurringRule[]; onDelete: (rule: RecurringRule) => void; onEdit: (rule: RecurringRule) => void; onToggle: (rule: RecurringRule) => void }) {
  const { language, locale, styles, t } = usePreferences();
  return <><Text style={styles.settingsSectionLabel}>{t('recurringExpenses').toUpperCase()}</Text><View style={styles.settingsGroup}>{rules.length ? rules.map((rule, index) => <View key={rule.id} style={[styles.recurringRuleRow, index < rules.length - 1 && styles.settingsDivider]}>
    <View style={styles.recurringRuleHeader}><View style={styles.flex}><Text style={styles.recurringRuleTitle}>{rule.title}</Text><Text style={styles.recurringRuleMeta}>{formatMoney(rule.amount)} · {t(rule.frequency)} · {categoryName(language, rule.category)}</Text><Text style={styles.recurringRuleNext}>{t('nextOccurrence', { date: formatShortDate(rule.nextOccurrence, locale) })} · {rule.active ? t('active') : t('paused')}</Text></View><View style={[styles.ruleStatusDot, !rule.active && styles.ruleStatusPaused]} /></View>
    <View style={styles.ruleActions}><Pressable onPress={() => onEdit(rule)} style={styles.ruleActionButton}><Text style={styles.ruleActionText}>{t('edit')}</Text></Pressable><Pressable onPress={() => onToggle(rule)} style={styles.ruleActionButton}><Text style={styles.ruleActionText}>{rule.active ? t('pause') : t('resume')}</Text></Pressable><Pressable onPress={() => onDelete(rule)} style={styles.ruleActionButton}><Text style={styles.ruleDeleteText}>{t('delete')}</Text></Pressable></View>
  </View>) : <View style={styles.emptyState}><Text style={styles.emptyEmoji}>↻</Text><Text style={styles.emptyText}>{t('noRecurringExpenses')}</Text></View>}</View><Text style={styles.settingsHint}>{t('monthlyClampHint')}</Text></>;
}

export function RecurringEditChoiceDialog({ expense, onCancel, onChoose }: { expense: Expense | null; onCancel: () => void; onChoose: (scope: 'single' | 'future') => void }) {
  const { styles, t } = usePreferences();
  return <Modal animationType="fade" onRequestClose={onCancel} transparent visible={expense !== null}><View style={styles.confirmOverlay}><View style={styles.confirmCard}><Text style={styles.confirmTitle}>{t('editRecurringExpense')}</Text><Text style={styles.confirmMessage}>{t('editRecurringQuestion')}</Text><View style={styles.recurringChoiceStack}><Pressable onPress={() => onChoose('single')} style={styles.recurringChoiceButton}><Text style={styles.recurringChoiceTitle}>{t('editThisOnly')}</Text><Text style={styles.recurringChoiceHint}>{t('editThisOnlyHint')}</Text></Pressable><Pressable onPress={() => onChoose('future')} style={styles.recurringChoiceButton}><Text style={styles.recurringChoiceTitle}>{t('editFuture')}</Text><Text style={styles.recurringChoiceHint}>{t('editFutureHint')}</Text></Pressable><Pressable onPress={onCancel} style={styles.cancelEditButton}><Text style={styles.cancelEditText}>{t('cancel')}</Text></Pressable></View></View></View></Modal>;
}

export function DeleteRecurringRuleDialog({ rule, onCancel, onConfirm }: { rule: RecurringRule | null; onCancel: () => void; onConfirm: () => void }) {
  const { styles, t } = usePreferences();
  return <Modal animationType="fade" onRequestClose={onCancel} transparent visible={rule !== null}><View style={styles.confirmOverlay}><View style={styles.confirmCard}><View style={styles.confirmIcon}><Text style={styles.confirmIconText}>🗑️</Text></View><Text style={styles.confirmTitle}>{t('deleteRecurringRule')}</Text><Text style={styles.confirmMessage}>{t('deleteRecurringRuleHint', { title: rule?.title ?? '' })}</Text><View style={styles.confirmActions}><Pressable onPress={onCancel} style={styles.confirmCancelButton}><Text style={styles.confirmCancelText}>{t('cancel')}</Text></Pressable><Pressable onPress={onConfirm} style={styles.confirmDeleteButton}><Text style={styles.confirmDeleteText}>{t('delete')}</Text></Pressable></View></View></View></Modal>;
}
