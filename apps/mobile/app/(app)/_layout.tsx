import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeaderTitle } from '../../components/navigation/AppHeaderTitle';
import { NumericKeyboardAccessory } from '../../components/inputs/NumericKeyboardAccessory';
import { FeedbackHeaderButton } from '../../components/feedback/FeedbackHeaderButton';
import { NativeBuildUpdatePrompt } from '../../components/updates/NativeBuildUpdatePrompt';
import { TrailBlaze } from '../../components/themed/TrailBlaze';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { getActivePlanEditHref } from '../../lib/planEditSession';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';
import {
  addOnboardingStatusListener,
  DEFAULT_ONBOARDING_STATUSES,
  hasPendingOnboarding,
  loadOnboardingStatuses,
} from '../../lib/onboardingStatus';
import { supabase } from '../../lib/supabase';
import { shouldShowProfileAttentionDot } from '../../lib/userNotifications';

export const unstable_settings = {
  initialRouteName: 'catalog',
};

const ROOT_TAB_ROUTES = new Set(['profile', 'catalog', 'plans', 'nutrition']);
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_BAR_MIN_BOTTOM_PADDING = 8;

export default function AppLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const catalogLabel = locale === 'fr' ? 'Courses' : 'Races';
  const plansTabLabel = t.plans.title;
  const nutritionLabel = 'Nutrition';
  const renderTabLabel = (label: string, color: string) => (
    <Text
      maxFontSizeMultiplier={1.3}
      numberOfLines={1}
      style={[styles.tabBarLabel, { color }]}
    >
      {label}
    </Text>
  );
  const [showProfileOnboardingDot, setShowProfileOnboardingDot] = useState(false);
  const unreadNotifications = useUnreadNotificationCount();
  const showProfileAttentionDot = shouldShowProfileAttentionDot({
    hasPendingOnboarding: showProfileOnboardingDot,
    hasUnreadNotifications: unreadNotifications.hasUnread,
  });

  useEffect(() => {
    let cancelled = false;
    const applyStatuses = (statuses = DEFAULT_ONBOARDING_STATUSES) => {
      if (!cancelled) setShowProfileOnboardingDot(hasPendingOnboarding(statuses));
    };
    const refresh = () => {
      void loadOnboardingStatuses().then(applyStatuses).catch(() => undefined);
    };
    refresh();
    const removeStatusListener = addOnboardingStatusListener(applyStatuses);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      cancelled = true;
      removeStatusListener();
      authListener.subscription.unsubscribe();
    };
  }, []);
  const getHeaderTitle = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return t.profile.title;
      case 'catalog':
        return catalogLabel;
      case 'plans':
        return t.plans.title;
      case 'nutrition':
        return nutritionLabel;
      case 'plan/new':
        return t.plans.newPlan;
      case 'plan/[id]/edit':
        return locale === 'fr' ? 'Modifier le plan' : 'Edit plan';
      case 'plan/[id]/summary':
        return t.planSummary.title;
      case 'training-live':
        return t.trainingLive.title;
      case 'race/[id]/racebook':
        return t.catalog.racebookTitle;
      default:
        return 'Pace Yourself';
    }
  };
  const getFeedbackContext = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return t.profile.title;
      case 'catalog':
        return catalogLabel;
      case 'plans':
      case 'plan':
        return t.plans.title;
      case 'nutrition':
        return nutritionLabel;
      case 'plan/new':
        return t.plans.newPlan;
      case 'plan/[id]/edit':
        return locale === 'fr' ? 'Edition du plan' : 'Edit plan';
      case 'plan/[id]/summary':
        return t.planSummary.title;
      case 'training-live':
        return t.trainingLive.title;
      default:
        return routeName;
    }
  };
  const getHeaderTitleRightInset = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return 116;
      case 'catalog':
        return 160;
      case 'plan/[id]/edit':
        return 120;
      default:
        return 72;
    }
  };

  return (
    <>
      <Tabs
        backBehavior="history"
        initialRouteName="catalog"
        screenOptions={({ route }) => {
        const isRootTab = ROOT_TAB_ROUTES.has(route.name);

        return {
          headerShown: !isRootTab,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'left',
          headerTitle: () => <AppHeaderTitle title={getHeaderTitle(route.name)} />,
          headerTitleContainerStyle: {
            left: 16,
            right: getHeaderTitleRightInset(route.name),
          },
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            shadowColor: '#1A1A1A',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 8,
            height:
              TAB_BAR_CONTENT_HEIGHT +
              Math.max(TAB_BAR_MIN_BOTTOM_PADDING, insets.bottom),
            paddingBottom: Math.max(TAB_BAR_MIN_BOTTOM_PADDING, insets.bottom),
          },
          tabBarActiveTintColor: Colors.brandPrimary,
          tabBarInactiveTintColor: Colors.textMuted,
          headerRight: () => (
            <FeedbackHeaderButton contextLabel={getFeedbackContext(route.name)} />
          ),
        };
        }}
      >
      {/* Far left: Courses catalog */}
      <Tabs.Screen
        name="catalog"
        options={{
          title: catalogLabel,
          tabBarLabel: ({ color }) => renderTabLabel(catalogLabel, color),
          tabBarButtonTestID: 'nav-tab-catalog',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIconWithBlaze focused={focused}>
              <Ionicons name="trail-sign" size={size} color={color} />
            </TabIconWithBlaze>
          ),
        }}
      />

      {/* Center: My races (followed races + optional plans). Route kept as `plans`. */}
      <Tabs.Screen
        name="plans"
        listeners={() => ({
          tabPress: (event) => {
            const activePlanEditHref = getActivePlanEditHref();
            if (!activePlanEditHref) return;

            event.preventDefault();
            router.push(activePlanEditHref as any);
          },
        })}
        options={{
          title: t.plans.title,
          tabBarLabel: ({ color }) => renderTabLabel(plansTabLabel, color),
          tabBarButtonTestID: 'nav-tab-plans',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIconWithBlaze focused={focused}>
              <Ionicons name="flag" size={size} color={color} />
            </TabIconWithBlaze>
          ),
        }}
      />

      {/* Far right: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile.title,
          tabBarLabel: ({ color }) => renderTabLabel(t.profile.title, color),
          tabBarButtonTestID: 'nav-tab-profile',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIconWithBlaze focused={focused}>
              <View style={styles.profileIconWrap}>
                <Ionicons name="person" size={size} color={color} />
                {showProfileAttentionDot ? (
                  <View
                    accessibilityLabel={
                      unreadNotifications.hasUnread && showProfileOnboardingDot
                        ? `${t.profile.notificationsProfileDotLabel}. ${t.onboarding.tours.profileDotLabel}`
                        : unreadNotifications.hasUnread
                        ? t.profile.notificationsProfileDotLabel
                        : t.onboarding.tours.profileDotLabel
                    }
                    style={styles.attentionDot}
                  />
                ) : null}
              </View>
            </TabIconWithBlaze>
          ),
        }}
      />

      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen
        name="race"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="race/[id]/racebook"
        options={{
          href: null,
          headerLeft: () => (
            <TouchableOpacity
              accessibilityLabel={t.common.back}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.replace('/(app)/catalog')}
              style={styles.headerBackButton}
              testID="racebook-back-to-catalog"
            >
              <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="plan/new"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="plan/[id]/edit"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="plan/[id]/summary"
        options={{ href: null, headerRight: () => null, tabBarStyle: { display: 'none' } }}
      />
      {/* Product catalog: no longer a root tab, reached from Profil and the plan workspace. */}
      <Tabs.Screen
        name="nutrition"
        options={{ href: null, title: nutritionLabel }}
      />
      <Tabs.Screen
        name="training-live"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, headerShown: false, tabBarStyle: { display: 'none' } }}
      />
      </Tabs>
      <NumericKeyboardAccessory />
      <NativeBuildUpdatePrompt
        bottom={TAB_BAR_CONTENT_HEIGHT + Math.max(TAB_BAR_MIN_BOTTOM_PADDING, insets.bottom) + 12}
      />
    </>
  );
}

/** Active root tab carries a vertical trail blaze to the left of its icon. */
function TabIconWithBlaze({ focused, children }: { focused: boolean; children: ReactNode }) {
  return (
    <View style={styles.tabIconWrap}>
      {focused ? <TrailBlaze orientation="vertical" size="sm" style={styles.tabBlaze} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: { alignItems: 'center', justifyContent: 'center' },
  tabBlaze: { position: 'absolute', right: '100%', marginRight: 5 },
  tabBarLabel: {
    width: '100%',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileIconWrap: { position: 'relative' },
  attentionDot: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.background,
    backgroundColor: Colors.danger,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

