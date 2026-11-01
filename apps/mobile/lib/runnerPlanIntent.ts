import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'runner.pendingRace';

export async function rememberRunnerRace(raceId: string) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ raceId, createdAt: Date.now() }));
}
export async function clearPendingRunnerRace() { await AsyncStorage.removeItem(KEY); }
export async function getPendingRunnerRace(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { raceId?: string; createdAt?: number };
    if (typeof value.raceId === 'string' && /^[0-9a-f-]{36}$/i.test(value.raceId) && typeof value.createdAt === 'number' && Date.now() - value.createdAt < 86_400_000) return value.raceId;
    await clearPendingRunnerRace();
  } catch { /* Invalid local resume state never authorizes creation. */ }
  return null;
}
