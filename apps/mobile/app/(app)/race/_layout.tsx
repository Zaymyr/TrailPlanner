import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function RaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
