import { colors, spacing } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from './Button';
import { Heading } from './Heading';
import { CourseRidge } from './Ridge';
import { Text } from './Text';
import { TrailEmptyIllustration } from './trail/TrailEmptyIllustration';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: ReactNode;
  /**
   * Localised start-sign text ("Départ"). Without `icon`, it draws the blank
   * trail illustration (dotted path, cairn, start sign); without either, the
   * brand ridge is shown.
   */
  signLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** "Sentier vierge": nothing here yet, the trail is waiting to be drawn. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onActionPress,
  icon,
  signLabel,
  style,
  testID,
}: Props) {
  const visual = icon
    ? <View style={styles.icon}>{icon}</View>
    : signLabel
      ? <TrailEmptyIllustration signLabel={signLabel} style={styles.illustration} />
      : <CourseRidge height={34} style={styles.ridge} />;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {visual}
      <Heading style={styles.centered} variant="h3">{title}</Heading>
      {description ? <Text tone="secondary" style={styles.description}>{description}</Text> : null}
      {onActionPress && actionLabel ? (
        <Button onPress={onActionPress} style={styles.action}>{actionLabel}</Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[6],
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.cream,
  },
  icon: {
    marginBottom: spacing[3],
  },
  illustration: {
    marginBottom: spacing[2],
  },
  ridge: {
    width: 132,
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  centered: {
    textAlign: 'center',
  },
  description: {
    marginTop: spacing[2],
    maxWidth: 320,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[4],
  },
});
