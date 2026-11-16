import { spacing } from '@pace-yourself/design-system';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { captureAnalyticsEvent } from '../../lib/posthog';
import { openStoreReviewPage } from '../../lib/appReview';
import { useI18n } from '../../lib/i18n';
import {
  FEEDBACK_SURVEY_TEXT_MAX_LENGTH,
  submitFeedbackSurveyResponse,
} from '../../lib/userNotifications';
import { ActionButton } from '../themed/ActionButton';
import { Field } from '../themed/Field';
import { Text } from '../themed/Text';

type Props = {
  notificationId: string;
  userId: string;
  answered: boolean;
  onAnswered: (notificationId: string) => void;
};

type Step = 'form' | 'review' | 'thanks';

const surveyPlatform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
  ? Platform.OS
  : null;

/**
 * Three-question survey shown inside a `feedback_survey` inbox message. A runner who found the app
 * useful is then invited (never forced) to leave a store review.
 */
export function FeedbackSurveyForm({ notificationId, userId, answered, onAnswered }: Props) {
  const { t } = useI18n();
  const copy = t.feedbackSurvey;
  const [foundUseful, setFoundUseful] = useState<boolean | null>(null);
  const [usefulText, setUsefulText] = useState('');
  const [missingText, setMissingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(answered ? 'thanks' : 'form');

  // The answered lookup can resolve after the form is shown.
  useEffect(() => {
    if (answered) setStep((current) => (current === 'form' ? 'thanks' : current));
  }, [answered]);

  const handleSubmit = async () => {
    if (foundUseful === null) {
      setError(copy.missingAnswer);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFeedbackSurveyResponse({
        userId,
        notificationId,
        answer: { foundUseful, usefulText, missingText },
        appVersion: Constants.expoConfig?.version?.trim() || null,
        platform: surveyPlatform,
      });
      if (result === 'already_answered') {
        onAnswered(notificationId);
        setStep('thanks');
        return;
      }
      captureAnalyticsEvent('feedback survey answered', {
        notification_id: notificationId,
        found_useful: foundUseful,
        has_useful_text: Boolean(usefulText.trim()),
        has_missing_text: Boolean(missingText.trim()),
      });
      onAnswered(notificationId);
      setStep(foundUseful ? 'review' : 'thanks');
    } catch (caught) {
      console.warn('Unable to send feedback survey answer.', caught);
      setError(copy.sendFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    captureAnalyticsEvent('feedback survey review clicked', { notification_id: notificationId });
    await openStoreReviewPage();
    setStep('thanks');
  };

  if (step === 'thanks') {
    return (
      <View style={styles.panel} testID={`feedback-survey-thanks-${notificationId}`}>
        <Text weight="bold">{copy.answeredTitle}</Text>
        <Text size="sm" tone="secondary">{copy.answeredBody}</Text>
      </View>
    );
  }

  if (step === 'review') {
    return (
      <View style={styles.panel} testID={`feedback-survey-review-${notificationId}`}>
        <Text weight="bold">{copy.answeredTitle}</Text>
        <Text weight="semibold">{copy.reviewTitle}</Text>
        <Text size="sm" tone="secondary">{copy.reviewBody}</Text>
        <View style={styles.actions}>
          <ActionButton fullWidth onPress={() => void handleReview()}>{copy.reviewCta}</ActionButton>
          <ActionButton fullWidth onPress={() => setStep('thanks')} variant="ghost">{copy.reviewLater}</ActionButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel} testID={`feedback-survey-form-${notificationId}`}>
      <Text weight="bold">{copy.usefulQuestion}</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {([true, false] as const).map((value) => {
          const selected = foundUseful === value;
          return (
            <ActionButton
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={submitting}
              key={String(value)}
              onPress={() => {
                setFoundUseful(value);
                setError(null);
              }}
              style={styles.choice}
              testID={`feedback-survey-useful-${value ? 'yes' : 'no'}`}
              variant={selected ? 'primary' : 'secondary'}
            >
              {value ? copy.yes : copy.no}
            </ActionButton>
          );
        })}
      </View>
      <Field
        editable={!submitting}
        label={copy.usefulTextLabel}
        maxLength={FEEDBACK_SURVEY_TEXT_MAX_LENGTH}
        multiline
        numberOfLines={3}
        onChangeText={setUsefulText}
        placeholder={copy.usefulTextPlaceholder}
        style={styles.textarea}
        textAlignVertical="top"
        value={usefulText}
      />
      <Field
        editable={!submitting}
        label={copy.missingTextLabel}
        maxLength={FEEDBACK_SURVEY_TEXT_MAX_LENGTH}
        multiline
        numberOfLines={3}
        onChangeText={setMissingText}
        placeholder={copy.missingTextPlaceholder}
        style={styles.textarea}
        textAlignVertical="top"
        value={missingText}
      />
      {error ? <Text accessibilityRole="alert" size="sm" style={styles.error}>{error}</Text> : null}
      <ActionButton fullWidth isLoading={submitting} onPress={() => void handleSubmit()} testID="feedback-survey-submit">
        {copy.submit}
      </ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing[3] },
  choices: { flexDirection: 'row', gap: spacing[2] },
  choice: { flex: 1 },
  textarea: { minHeight: 84 },
  actions: { gap: spacing[2] },
  error: { color: Colors.danger },
});
