import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { colors } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'AED 지도', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="my"
        options={{ title: '내 AED', tabBarIcon: ({ color, size }) => <Ionicons name="heart-circle" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="guide"
        options={{ title: '사용법', tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
