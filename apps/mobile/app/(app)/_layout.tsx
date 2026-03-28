import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

function CenterTabButton({ onPress }: { onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={styles.centerButton}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.centerButtonInner}>
        <Ionicons name="map" size={26} color={Colors.textOnBrand} />
        <Text style={styles.centerButtonLabel}>Plans</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
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
        }}
      />

      {/* Center: My Plans — big green standout button */}
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Mes plans',
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <CenterTabButton onPress={props.onPress as (() => void) | undefined} />
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

const styles = StyleSheet.create({
  centerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonInner: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    shadowColor: Colors.brandPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 80,
  },
  centerButtonLabel: {
    color: Colors.textOnBrand,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
