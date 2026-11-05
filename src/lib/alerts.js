import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 심정지 긴급 알림 · 휴대폰 알림창에 실제로 뜨는 로컬 알림 (서버 없이 이 기기 안에서만)
// 앱이 켜져 있을 때도 화면 위에 배너로 보이게 한다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

const CHANNEL = 'emergency';
let ready = null;

// 채널을 만들고 알림 권한을 묻는다 (한 번만). 허용되면 true
export function prepareAlerts() {
  if (!ready) {
    ready = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: '심정지 긴급 알림',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#E5484D',
        });
      }
      const p = await Notifications.requestPermissionsAsync();
      return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    })().catch(() => false);
  }
  return ready;
}

// 지금 바로 알림 한 건. 보내졌으면 true
export async function sendCardiacAlert({ title, body, data }) {
  if (!(await prepareAlerts())) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    return true;
  } catch {
    return false;
  }
}

// 알림을 눌렀을 때
export function onAlertTap(fn) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => fn(r.notification.request.content.data ?? {}));
  return () => sub.remove();
}
