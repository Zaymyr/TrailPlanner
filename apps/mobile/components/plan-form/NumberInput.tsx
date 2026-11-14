import { Field } from '../themed/Field';

export type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  style?: object;
  /** Notebook tab label (kept outside when omitted). */
  label?: string;
  /** Unit typeset as a map cote ("km", "g/h"). */
  unit?: string;
  accessibilityLabel?: string;
};

export function NumberInput({ value, onChange, placeholder, style, label, unit, accessibilityLabel }: NumberInputProps) {
  return (
    <Field
      accessibilityLabel={accessibilityLabel ?? (label && unit ? `${label} (${unit})` : label)}
      containerStyle={[{ marginTop: label ? 4 : 0, marginBottom: 4 }, style]}
      inputAccessoryViewID="pace-yourself-numeric-keyboard"
      keyboardType="numeric"
      label={label}
      onChangeText={(text) => {
        const parsed = parseFloat(text.replace(',', '.'));
        onChange(Number.isNaN(parsed) ? 0 : parsed);
      }}
      placeholder={placeholder ?? '0'}
      unit={unit}
      value={String(value)}
    />
  );
}
