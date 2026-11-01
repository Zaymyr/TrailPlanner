import { useI18n } from '../../lib/i18n';
import type { PlanWorkspaceTab } from '../../lib/planWorkspace';
import { RacebookTabBar } from '../racebook/RacebookTabBar';

type Props = {
  activeTab: PlanWorkspaceTab;
  onSelectTab: (tab: PlanWorkspaceTab) => void;
};

export function PlanWorkspaceTabBar({ activeTab, onSelectTab }: Props) {
  const { t } = useI18n();
  const tabs = [
    { key: 'plan' as const, label: t.planWorkspace.myPlan, icon: 'clipboard-outline' as const },
    { key: 'recap' as const, label: t.planWorkspace.recap, icon: 'reader' as const },
    { key: 'settings' as const, label: t.planWorkspace.settings, icon: 'options' as const },
  ];

  return (
    <RacebookTabBar
      activeTab={activeTab}
      onPress={onSelectTab}
      tabs={tabs}
    />
  );
}
