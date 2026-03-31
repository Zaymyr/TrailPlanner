import { TextInput } from 'react-native';
import { Colors } from '../../constants/colors';
import { inputStyles } from './styles';

export type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  style?: object;
};

export function NumberInput({ value, onChange, placeholder, style }: NumberInputProps) {
  return (
    <TextInput
      style={[inputStyles.input, style]}
      value={value === 0 ? '' : String(value)}
      onChangeText={(text) => {
        const parsed = parseFloat(text.replace(',', '.'));
        onChange(Number.isNaN(parsed) ? 0 : parsed);
      }}
      keyboardType="numeric"
      placeholder={placeholder ?? '0'}
      placeholderTextColor={Colors.textMuted}
    />
  );
}
