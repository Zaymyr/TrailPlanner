import type {
  DateTimePickerEvent,
  AndroidNativeProps,
  IOSNativeProps,
  WindowsNativeProps,
} from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useState,
} from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

type DatePickerFieldProps = {
  accessibilityLabel: string;
  clearLabel?: string;
  locale: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  onClear?: () => void;
  placeholder: string;
  unavailableMessage: string;
  value: Date | null;
};

type NativeDateTimePickerProps = IOSNativeProps | AndroidNativeProps | WindowsNativeProps;

let cachedDateTimePicker: ComponentType<NativeDateTimePickerProps> | null | undefined;

function loadDateTimePicker(): ComponentType<NativeDateTimePickerProps> | null {
  if (cachedDateTimePicker !== undefined) return cachedDateTimePicker;

  try {
    // Kept lazy so an OTA remains usable on binaries built before this native module existed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedDateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.warn('Native date picker unavailable in this build:', error);
    cachedDateTimePicker = null;
  }
  return cachedDateTimePicker ?? null;
}

class NativePickerBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    console.warn('Native date picker failed to render in this build:', error);
    this.props.onUnavailable();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function DatePickerField({
  accessibilityLabel,
  clearLabel,
  locale,
  maximumDate,
  minimumDate,
  onChange,
  onClear,
  placeholder,
  unavailableMessage,
  value,
}: DatePickerFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerUnavailable, setPickerUnavailable] = useState(false);
  const formattedValue = value
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(value)
    : '';
  const now = new Date();
  const defaultPickerValue = minimumDate && minimumDate > now
    ? minimumDate
    : maximumDate && maximumDate < now
      ? maximumDate
      : now;

  const handleChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setPickerVisible(false);
      if (event.type === 'set' && selectedDate) onChange(selectedDate);
    },
    [onChange],
  );
  const handleOpen = useCallback(() => {
    if (!loadDateTimePicker()) {
      setPickerUnavailable(true);
      return;
    }
    setPickerUnavailable(false);
    setPickerVisible(true);
  }, []);
  const handleUnavailable = useCallback(() => {
    setPickerVisible(false);
    setPickerUnavailable(true);
  }, []);
  const DateTimePicker = pickerVisible ? loadDateTimePicker() : null;

  return (
    <View>
      <View style={styles.fieldRow}>
        <TouchableOpacity
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityValue={{ text: formattedValue || placeholder }}
          onPress={handleOpen}
          style={styles.field}
        >
          <Text style={formattedValue ? styles.value : styles.placeholder}>
            {formattedValue || placeholder}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={Colors.brandPrimary} />
        </TouchableOpacity>
        {value && clearLabel && onClear ? (
          <TouchableOpacity
            accessibilityLabel={clearLabel}
            accessibilityRole="button"
            onPress={onClear}
            style={styles.clearButton}
          >
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {pickerUnavailable ? <Text style={styles.error}>{unavailableMessage}</Text> : null}

      {pickerVisible && DateTimePicker ? (
        <NativePickerBoundary onUnavailable={handleUnavailable}>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            locale={locale === 'fr' ? 'fr-FR' : 'en-US'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onChange={handleChange}
            value={value ?? defaultPickerValue}
          />
        </NativePickerBoundary>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  field: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  value: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  placeholder: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 16,
  },
  error: {
    color: Colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});
