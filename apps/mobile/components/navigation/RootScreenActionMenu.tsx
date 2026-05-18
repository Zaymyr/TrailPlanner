import { Alert } from 'react-native';

import { FeedbackHeaderButton } from '../feedback/FeedbackHeaderButton';
import { RaceRequestHeaderButton } from '../race/RaceRequestHeaderButton';
import { useI18n } from '../../lib/i18n';
import {
  emitHelpTutorialRequest,
  type HelpTutorialScreenKey,
} from '../../lib/helpTutorial';
import {
  FloatingActionMenu,
  type FloatingActionMenuItem,
} from './FloatingActionMenu';

type RootScreenHelp =
  | {
      type: 'tutorial';
      screenKey: HelpTutorialScreenKey;
    }
  | {
      type: 'message';
      title: string;
      body: string;
    };

type RootScreenActionMenuProps = {
  actions?: FloatingActionMenuItem[];
  contextLabel: string;
  help: RootScreenHelp;
  includeRaceRequest?: boolean;
};

export function RootScreenActionMenu({
  actions = [],
  contextLabel,
  help,
  includeRaceRequest = false,
}: RootScreenActionMenuProps) {
  const { locale } = useI18n();
  const helpLabel = locale === 'fr' ? 'Aide' : 'Help';
  const feedbackLabel = locale === 'fr' ? 'Bug / feedback' : 'Bug / feedback';
  const openLabel = locale === 'fr' ? 'Ouvrir les actions' : 'Open actions';
  const closeLabel = locale === 'fr' ? 'Fermer les actions' : 'Close actions';
  const raceRequestLabel = locale === 'fr' ? 'Demander une course' : 'Request a race';

  const handleHelpPress = () => {
    if (help.type === 'tutorial') {
      emitHelpTutorialRequest(help.screenKey);
      return;
    }

    Alert.alert(help.title, help.body);
  };

  const buildActions = (
    openFeedback: () => void,
    openRaceRequest?: () => void,
  ): FloatingActionMenuItem[] => [
    {
      key: 'help',
      label: helpLabel,
      icon: 'help-circle-outline',
      onPress: handleHelpPress,
    },
    ...actions,
    ...(includeRaceRequest && openRaceRequest
      ? [
          {
            key: 'race-request',
            label: raceRequestLabel,
            icon: 'paper-plane-outline' as const,
            onPress: openRaceRequest,
          },
        ]
      : []),
    {
      key: 'feedback',
      label: feedbackLabel,
      icon: 'bug-outline',
      onPress: openFeedback,
    },
  ];

  if (includeRaceRequest) {
    return (
      <RaceRequestHeaderButton>
        {(openRaceRequest) => (
          <FeedbackHeaderButton contextLabel={contextLabel}>
            {(openFeedback) => (
              <FloatingActionMenu
                accessibilityLabel={openLabel}
                actions={buildActions(openFeedback, openRaceRequest)}
                dismissAccessibilityLabel={closeLabel}
              />
            )}
          </FeedbackHeaderButton>
        )}
      </RaceRequestHeaderButton>
    );
  }

  return (
    <FeedbackHeaderButton contextLabel={contextLabel}>
      {(openFeedback) => (
        <FloatingActionMenu
          accessibilityLabel={openLabel}
          actions={buildActions(openFeedback)}
          dismissAccessibilityLabel={closeLabel}
        />
      )}
    </FeedbackHeaderButton>
  );
}
