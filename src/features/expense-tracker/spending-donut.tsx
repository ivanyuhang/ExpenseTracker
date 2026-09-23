import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  type Budgets,
  CATEGORIES,
  categoryColors,
  categoryIcons,
  type Category,
  type Expense,
  formatMoney,
  monthlyBudgetBreakdown,
  validChartCategory,
} from './model';
import { categoryName } from './i18n';
import { animateLayout, usePreferences } from './preferences';

const CHART_SIZE = 220;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_RADIUS = 76;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

export function SpendingDonut({ budgets, expenses }: { budgets: Budgets; expenses: Expense[] }) {
  const { colors, language, reduceMotion, styles, t } = usePreferences();
  const breakdown = monthlyBudgetBreakdown(expenses, budgets);
  const [chartAnimation] = useState(() => new Animated.Value(1));
  const [selectedCategory, setSelectedCategory] = useState<Category>(() => (
    CATEGORIES.find((category) => breakdown.categorySpent[category] > 0) ?? 'Meal'
  ));
  const displayedCategory = validChartCategory(selectedCategory, breakdown.categorySpent);
  const chartTotal = breakdown.slices.reduce((sum, slice) => sum + slice.value, 0);
  const selectedSpent = breakdown.categorySpent[displayedCategory];
  const selectedBudget = budgets.categories[displayedCategory];
  const selectedDifference = selectedBudget - selectedSpent;
  const selectedPercent = selectedBudget > 0 ? Math.round((selectedSpent / selectedBudget) * 100) : null;
  let usedArc = 0;
  const chartSlices = breakdown.slices.map((slice) => {
    const arcLength = chartTotal > 0 ? (slice.value / chartTotal) * CHART_CIRCUMFERENCE : 0;
    const offset = usedArc;
    usedArc += arcLength;
    const middleAngle = ((offset + arcLength / 2) / CHART_CIRCUMFERENCE) * Math.PI * 2;
    return { ...slice, arcLength, offset, middleAngle };
  });

  const chartSignature = breakdown.slices.map((slice) => `${slice.key}:${slice.value}`).join('|');
  useEffect(() => {
    chartAnimation.setValue(0.94);
    if (reduceMotion) chartAnimation.setValue(1); else Animated.spring(chartAnimation, { damping: 18, stiffness: 170, toValue: 1, useNativeDriver: true }).start();
  }, [chartAnimation, chartSignature, reduceMotion]);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeading}>
        <View><Text style={styles.chartTitle}>{t('monthlyMix')}</Text><Text style={styles.chartSubtitle}>{t('tapCategory')}</Text></View>
        {!!breakdown.overBudgetBy && <View style={styles.overBudgetBadge}><Text style={styles.overBudgetBadgeText}>{t('overBudget')}</Text></View>}
      </View>

      <Animated.View style={[styles.donutWrap, { opacity: chartAnimation, transform: [{ scale: chartAnimation }] }]}>
        <Svg accessibilityLabel="Monthly spending and remaining budget donut chart" height={CHART_SIZE} width={CHART_SIZE}>
          <Circle cx={CHART_CENTER} cy={CHART_CENTER} fill="none" r={CHART_RADIUS} stroke={colors.borderSoft} strokeWidth={28} />
          {chartTotal > 0 && chartSlices.map((slice) => {
            const selected = slice.key === displayedCategory;
            return (
              <Circle
                cx={CHART_CENTER}
                cy={CHART_CENTER}
                fill="none"
                key={slice.key}
                r={CHART_RADIUS}
                stroke={slice.key === 'Remaining Budget' ? colors.border : slice.color}
                strokeDasharray={`${slice.arcLength} ${Math.max(CHART_CIRCUMFERENCE - slice.arcLength, 0)}`}
                strokeDashoffset={-slice.offset}
                strokeWidth={selected ? 33 : 28}
              />
            );
          })}
        </Svg>
        {chartTotal > 0 && chartSlices.map((slice) => {
          if (slice.key === 'Remaining Budget') return null;
          const category: Category = slice.key;
          const hitSize = 44;
          const left = CHART_CENTER + CHART_RADIUS * Math.cos(slice.middleAngle) - hitSize / 2;
          const top = CHART_CENTER + CHART_RADIUS * Math.sin(slice.middleAngle) - hitSize / 2;
          return (
            <Pressable
              accessibilityLabel={`Show ${slice.label} budget details`}
              accessibilityRole="button"
              key={`hit-${slice.key}`}
              onPress={() => { animateLayout(); setSelectedCategory(category); }}
              style={[styles.chartSliceHitTarget, { left, top }]}
            />
          );
        })}
        <View style={styles.donutCenter}>
          <Text style={styles.donutCenterLabel}>{breakdown.totalSpent > 0 ? t('spent') : t('noSpending')}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.donutCenterAmount}>{formatMoney(breakdown.totalSpent)}</Text>
        </View>
      </Animated.View>

      {breakdown.overBudgetBy > 0 ? (
        <View style={styles.totalBudgetWarning}>
          <Text style={styles.totalBudgetWarningTitle}>{t('monthlyExceeded')}</Text>
          <Text style={styles.totalBudgetWarningAmount}>{t('overBudgetBy', { value: formatMoney(breakdown.overBudgetBy) })}</Text>
          <Text style={styles.totalBudgetWarningCaption}>{t('remainingBudget', { value: formatMoney(0) })}</Text>
        </View>
      ) : budgets.total > 0 ? (
        <Text style={styles.remainingBudgetText}>{t('remainingBudget', { value: formatMoney(breakdown.remainingBudget) })}</Text>
      ) : (
        <Text style={styles.remainingBudgetText}>{t('setTotalForSlice')}</Text>
      )}

      {breakdown.totalSpent > 0 ? <View style={styles.chartDetailCard}>
        <View style={styles.chartDetailTitleRow}>
          <View style={[styles.legendDot, { backgroundColor: selectedSpent > selectedBudget && selectedBudget > 0 ? '#D94F45' : categoryColors[displayedCategory] }]} />
          <Text style={styles.chartDetailTitle}>{categoryIcons[displayedCategory]} {categoryName(language, displayedCategory)}</Text>
        </View>
        {selectedBudget > 0 ? (
          <>
            <Text style={styles.chartDetailMain}>{t('categoryDetail', { spent: formatMoney(selectedSpent), budget: formatMoney(selectedBudget) })}</Text>
            <Text style={styles.chartDetailPercent}>{t('percentUsed', { value: selectedPercent ?? 0 })}</Text>
            <Text style={[styles.chartDetailBalance, selectedDifference < 0 && styles.negative]}>
              {selectedDifference < 0 ? t('categoryOver', { value: formatMoney(Math.abs(selectedDifference)) }) : t('remainingLower', { value: formatMoney(selectedDifference) })}
            </Text>
          </>
        ) : (
          <><Text style={styles.chartDetailMain}>{formatMoney(selectedSpent)} {t('spent').toLowerCase()}</Text><Text style={styles.chartDetailBalance}>{t('noCategoryBudget')}</Text></>
        )}
      </View> : <View style={styles.chartEmptyState}><Text style={styles.chartEmptyTitle}>{t('noExpensesMonth')}</Text><Text style={styles.chartEmptyText}>{t('addForBreakdown')}</Text></View>}

      <View style={styles.chartLegend}>
        {CATEGORIES.map((category) => {
          const spent = breakdown.categorySpent[category];
          const limit = budgets.categories[category];
          const isOver = limit > 0 && spent > limit;
          const selected = category === displayedCategory && spent > 0;
          const status = limit <= 0 ? t('noLimit') : isOver ? t('over', { value: formatMoney(spent - limit) }) : t('left', { value: formatMoney(limit - spent) });
          return (
            <Pressable
              accessibilityState={{ disabled: spent <= 0, selected }}
              disabled={spent <= 0}
              key={category}
              onPress={() => { animateLayout(); setSelectedCategory(category); }}
              style={[styles.legendRow, spent <= 0 && styles.legendRowDisabled, selected && styles.legendRowSelected]}>
              <View style={[styles.legendDot, { backgroundColor: isOver ? '#D94F45' : categoryColors[category] }]} />
              <View style={styles.legendNameWrap}><Text numberOfLines={1} style={styles.legendName}>{categoryName(language, category)}</Text><Text style={[styles.legendStatus, isOver && styles.negative]}>{status}</Text></View>
              <Text style={styles.legendAmount}>{formatMoney(spent)}</Text>
            </Pressable>
          );
        })}
        {budgets.total > 0 && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, styles.remainingLegendDot]} />
            <View style={styles.legendNameWrap}><Text style={styles.legendName}>{t('remaining').replace(':', '')}</Text><Text style={styles.legendStatus}>{t('overallLimit')}</Text></View>
            <Text style={styles.legendAmount}>{formatMoney(breakdown.remainingBudget)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
