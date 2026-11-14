import { useI18n } from '../../lib/i18n';
import type { PlanWorkspaceTab } from '../../lib/planWorkspace';
import { RacebookTabBar } from '../racebook/RacebookTabBar';

type Props = {
  activeTab: PlanWorkspaceTab;
  onSelectTab: (tab: PlanWorkspaceTab) => void;
  /**
   * Opens the Nutrition screen (product favourites used by the plan). It is a
   * shortcut, not a workspace view: the plan stays on its current tab.
   */
  onOpenNutrition?: () => void;
};

type BarTab = PlanWorkspaceTab | 'nutrition';

export function PlanWorkspaceTabBar({ activeTab, onSelectTab, onOpenNutrition }: Props) {
  const { t } = useI18n();
  const tabs = [
    { key: 'plan' as const, label: t.planWorkspace.myPlan, icon: 'clipboard-outline' as const },
    { key: 'recap' as const, label: t.planWorkspace.recap, icon: 'reader' as const },
    { key: 'settings' as const, label: t.planWorkspace.settings, icon: 'options' as const },
    ...(onOpenNutrition
      ? [{ key: 'nutrition' as const, label: t.planWorkspace.nutrition, icon: 'nutrition' as const }]
      : []),
  ];

  return (
    <RacebookTabBar<BarTab>
      activeTab={activeTab}
      onPress={(tab) => {
        if (tab === 'nutrition') onOpenNutrition?.();
        else onSelectTab(tab);
      }}
      tabs={tabs}
    />
  );
}
