import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';
import { Colors } from '../../constants/colors';

export const unstable_settings = {
  initialRouteName: 'plans',
};

export default function AppLayout() {
  const router = useRouter();

  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="plans"
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontSize: 22,
          fontWeight: '800',
        },
        headerTitleContainerStyle: {
          paddingHorizontal: 12,
        },
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.brandPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      {/* Far left: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* Left of center: Courses catalog */}
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Courses',
          tabBarLabel: 'Courses',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trail-sign" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/(app)/race/new')}
              style={{ paddingHorizontal: 12, paddingVertical: 4 }}
            >
              <Text style={{ color: Colors.brandPrimary, fontSize: 26, fontWeight: '600' }}>+</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Center: My Plans — big green standout button */}
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Mes plans',
          tabBarLabel: 'Plans',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />

      {/* Right: Nutrition */}
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarLabel: 'Nutrition',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition" size={size} color={color} />
          ),
        }}
      />

      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen
        name="race"
        options={{ href: null, headerShown: false }}
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
        options={{ href: null }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}

