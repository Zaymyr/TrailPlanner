import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { formatCoteUnit } from '../../lib/trailSignature';
import { DataText } from './DataText';
import { Text } from './Text';
import { TrailBlaze } from './TrailBlaze';
import { NOTEBOOK_TAPE_WIDTH, NotebookCompassBadge, NotebookGrid, NotebookTape } from './trail/NotebookParts';

export type FieldVariant = 'notebook' | 'search';

type Props = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Unit typeset as a map cote on the right ("h:min", "kg"). */
  unit?: string;
  /** `search` = rounded field led by a compass, label above in plain text. */
  variant?: FieldVariant;
};

/** Notebook edge and search ring colors (mockup values; token candidates). */
const NOTEBOOK_EDGE = colors.trail.braceletMuted;
const NOTEBOOK_TAB = colors.border.subtle;
const NUMERIC_KEYBOARDS = new Set<TextInputProps['keyboardType']>(['number-pad', 'decimal-pad', 'numeric', 'phone-pad']);
const SEARCH_MIN_HEIGHT = 56;

/**
 * Text field drawn as a road notebook: the label is a cardboard tab above
 * the page, the page carries a faint IGN kilometre grid and the unit is set
 * as a map cote on the right. Focus turns the tab forest green with a small
 * trail blaze; an error adds a strip of closed-trail tape on the left (with
 * the message below, never color alone).
 */
export const Field = forwardRef<TextInput, Props>(function Field(
  {
    label,
    helper,
    error,
    leading,
    trailing,
    containerStyle,
    unit,
    variant = 'notebook',
    editable = true,
    placeholderTextColor = colors.text.tertiary,
    style,
    onFocus,
    onBlur,
    accessibilityLabel,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const isSearch = variant === 'search';
  const hasError = Boolean(error);
  const hasTab = Boolean(label) && !isSearch;
  const numeric = Boolean(unit) || NUMERIC_KEYBOARDS.has(props.keyboardType);

  const tab = hasTab ? (
    <View
      style={[
        styles.tab,
        focused && !hasError && styles.tabFocused,
        hasError && styles.tabError,
      ]}
    >
      {focused && !hasError ? <TrailBlaze size="sm" tone="inverse" /> : null}
      <Text
        numberOfLines={1}
        size="sm"
        weight="bold"
        style={{ color: hasError ? colors.semantic.danger : focused ? colors.text.inverse : colors.text.primary }}
      >
        {label}
      </Text>
    </View>
  ) : label ? (
    <Text size="sm" weight="bold" style={styles.plainLabel}>{label}</Text>
  ) : null;

  return (
    <View style={containerStyle}>
      {tab}
      <View style={styles.page}>
        {focused && !hasError && !isSearch ? (
          <View accessible={false} pointerEvents="none" style={[styles.plinth, hasTab && styles.tabbedCorner]} />
        ) : null}
        <View
          style={[
            styles.shell,
            hasTab && styles.tabbedCorner,
            isSearch && styles.searchShell,
            focused && styles.shellFocused,
            hasError && styles.shellError,
            hasError && !isSearch && styles.shellWithTape,
            !editable && styles.disabled,
          ]}
        >
          {isSearch ? null : <NotebookGrid focused={focused && !hasError} />}
          {hasError && !isSearch ? <NotebookTape /> : null}
          {leading ?? (isSearch ? <NotebookCompassBadge /> : null)}
          <TextInput
            {...props}
            accessibilityLabel={accessibilityLabel ?? label}
            ref={ref}
            editable={editable}
            placeholderTextColor={placeholderTextColor}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            style={[styles.input, numeric && !isSearch && styles.inputNumeric, style]}
          />
          {unit ? (
            <DataText accessible={false} weight="semibold" style={styles.unit}>
              {formatCoteUnit(unit)}
            </DataText>
          ) : null}
          {trailing}
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" size="xs" weight="semibold" style={styles.error}>
          {error}
        </Text>
      ) : helper ? (
        <Text tone="secondary" size="xs" style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  plainLabel: { marginBottom: spacing[1.5] },
  tab: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: spacing[3],
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: NOTEBOOK_TAB,
  },
  tabFocused: { backgroundColor: colors.brand.forest },
  tabError: { backgroundColor: colors.semantic.dangerSurface },
  page: { position: 'relative' },
  plinth: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 3,
    bottom: -3,
    borderRadius: mobileComponents.input.borderRadius,
    backgroundColor: colors.brand.border,
  },
  shell: {
    minHeight: mobileComponents.input.minHeight,
    borderRadius: mobileComponents.input.borderRadius,
    borderWidth: 1,
    borderColor: NOTEBOOK_EDGE,
    backgroundColor: colors.surface.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: mobileComponents.input.paddingHorizontal,
    overflow: 'hidden',
  },
  tabbedCorner: { borderTopLeftRadius: 0 },
  searchShell: {
    minHeight: SEARCH_MIN_HEIGHT,
    borderRadius: SEARCH_MIN_HEIGHT / 2,
    paddingLeft: 6,
    paddingRight: spacing[4],
    gap: spacing[3],
  },
  shellFocused: { borderColor: colors.brand.forest, borderWidth: 2 },
  shellError: { borderColor: colors.semantic.danger, borderWidth: 1.5 },
  shellWithTape: { paddingLeft: NOTEBOOK_TAPE_WIDTH + spacing[3] + 2 },
  disabled: { opacity: 0.55 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: mobileComponents.input.minHeight,
    paddingVertical: spacing[2],
    color: colors.text.primary,
    fontFamily: 'Bricolage Grotesque',
    fontSize: 16,
  },
  inputNumeric: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: colors.text.secondary,
  },
  error: { marginTop: spacing[1.5], color: colors.semantic.danger },
  helper: { marginTop: spacing[1.5] },
});
