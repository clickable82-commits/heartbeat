import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { prepareAlerts } from '../lib/alerts';
import { LocationProvider } from '../lib/LocationContext';
import { MyAedProvider } from '../lib/MyAedContext';

export default function RootLayout() {
  // 심정지 알림을 받으려면 알림 권한이 필요하다 · 앱을 처음 켤 때 한 번 묻는다
  useEffect(() => {
    prepareAlerts();
  }, []);

  return (
    <LocationProvider>
      <MyAedProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="emergency" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack>
      </MyAedProvider>
    </LocationProvider>
  );
}
