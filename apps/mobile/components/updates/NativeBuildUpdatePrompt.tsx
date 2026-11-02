import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { useI18n } from '../../lib/i18n';
import { resolveIosNativeBuildUpdate } from '../../lib/nativeBuildUpdate';
import { BriefToast } from '../themed/BriefToast';

type Props = {
  bottom: number;
};

export function NativeBuildUpdatePrompt({ bottom }: Props) {
  const { t } = useI18n();
  const [target, setTarget] = useState(() => {
    if (__DEV__ || Platform.OS !== 'ios') return null;

    return resolveIosNativeBuildUpdate({
      currentBuild: Application.nativeBuildVersion,
      extra: Constants.expoConfig?.extra,
    });
  });

  if (!target) return null;

  const openUpdate = async () => {
    const updateUrl = target.updateUrl;
    setTarget(null);

    try {
      await Linking.openURL(updateUrl);
    } catch {
      Alert.alert(t.appUpdate.nativeOpenErrorTitle, t.appUpdate.nativeOpenErrorBody);
    }
  };

  return (
    <BriefToast
      actionLabel={t.appUpdate.nativeUpdateCta}
      bottom={bottom}
      durationMs={15_000}
      message={t.appUpdate.nativeUpdateAvailable.replace('{build}', String(target.latestBuild))}
      onAction={() => void openUpdate()}
      onDismiss={() => setTarget(null)}
    />
  );
}
