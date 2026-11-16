import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn() }));

vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }));

import {
  FEEDBACK_SURVEY_TEXT_MAX_LENGTH,
  normalizeSurveyText,
  submitFeedbackSurveyResponse,
} from './userNotifications';

const input = {
  userId: 'user-1',
  notificationId: 'notification-1',
  answer: { foundUseful: true, usefulText: '  Le profil des ravitos  ', missingText: '   ' },
  appVersion: '1.1.2',
  platform: 'ios' as const,
};

describe('feedback survey answers', () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.from.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it('trims free text, drops empty answers and caps the length', () => {
    expect(normalizeSurveyText('  ok  ')).toBe('ok');
    expect(normalizeSurveyText('   ')).toBeNull();
    expect(normalizeSurveyText('a'.repeat(FEEDBACK_SURVEY_TEXT_MAX_LENGTH + 50))).toHaveLength(FEEDBACK_SURVEY_TEXT_MAX_LENGTH);
  });

  it('sends only the notification id and answers; the database resolves the campaign', async () => {
    mocks.insert.mockResolvedValue({ error: null });

    await expect(submitFeedbackSurveyResponse(input)).resolves.toBe('sent');
    expect(mocks.from).toHaveBeenCalledWith('feedback_survey_responses');
    expect(mocks.insert).toHaveBeenCalledWith({
      notification_id: 'notification-1',
      user_id: 'user-1',
      found_useful: true,
      useful_text: 'Le profil des ravitos',
      missing_text: null,
      app_version: '1.1.2',
      platform: 'ios',
    });
  });

  it('treats a second answer to the same survey as already answered', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(submitFeedbackSurveyResponse(input)).resolves.toBe('already_answered');
  });

  it('surfaces other errors', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(submitFeedbackSurveyResponse(input)).rejects.toMatchObject({ code: '42501' });
  });
});
