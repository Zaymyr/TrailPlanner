import { memo } from 'react';
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
      onPress={onPress}
      disabled={disabled || loading}
    >
      {label}
    </ActionButton>
  );
}

export const ProfileSaveButton = memo(ProfileSaveButtonComponent);
