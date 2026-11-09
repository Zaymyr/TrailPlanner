import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { ActionButton } from '../themed/ActionButton';

type ProfileSaveButtonProps = {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
};

function ProfileSaveButtonComponent({
  disabled = false,
  label,
  loading = false,
  onPress,
}: ProfileSaveButtonProps) {
  return (
    <ActionButton
      fullWidth
      isLoading={loading}
      size="lg"
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {label}
    </ActionButton>
  );
}

export const ProfileSaveButton = memo(ProfileSaveButtonComponent);

const styles = StyleSheet.create({
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
});
