import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { ActionButton } from '../themed/ActionButton';
import { Card } from '../themed/Card';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type ProfileAccountSectionProps = {
  body?: string;
  dangerLabel?: string;
  dangerLoading?: boolean;
  onDangerPress?: () => void;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
  primaryLabel: string;
  primaryTone?: 'brand' | 'neutral';
  secondaryLabel?: string;
  title: string;
};

function ProfileAccountSectionComponent({
  body,
  dangerLabel,
  dangerLoading = false,
  onDangerPress,
  onPrimaryPress,
  onSecondaryPress,
  primaryLabel,
  primaryTone = 'neutral',
  secondaryLabel,
  title,
}: ProfileAccountSectionProps) {
  return (
    <Card style={styles.card} variationKey="profile-account">
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      <ActionButton
        fullWidth
        onPress={onPrimaryPress}
        variant={primaryTone === 'brand' ? 'primary' : 'secondary'}
      >
        {primaryLabel}
      </ActionButton>

      {secondaryLabel && onSecondaryPress ? (
        <ActionButton fullWidth onPress={onSecondaryPress} variant="secondary">
          {secondaryLabel}
        </ActionButton>
      ) : null}

      {dangerLabel && onDangerPress ? (
        <ActionButton fullWidth isLoading={dangerLoading} onPress={onDangerPress} variant="destructive">
          {dangerLabel}
        </ActionButton>
      ) : null}
    </Card>
  );
}

export const ProfileAccountSection = memo(ProfileAccountSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
