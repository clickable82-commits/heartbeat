import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { CAMPUS, distanceM } from '../data/aeds';

const LocationContext = createContext(null);

// 현재 위치를 앱이 켜져 있는 동안 계속 따라간다 (포그라운드 추적).
// 권한이 없거나 휴대폰 위치(GPS)가 꺼져 있으면 시연 위치(중앙대)를 쓰고 fallback 으로 표시한다.
//   → 화면에 «위치 켜기» 를 띄워 fixLocation() 으로 바로 고칠 수 있게 한다.
// anchor · 가상 이웃 AED 를 둘 기준점. 처음 잡은 위치에 두고, 1.5km 넘게 움직이면 옮긴다.
export function LocationProvider({ children }) {
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | granted | denied | blocked | off | error
  const [anchor, setAnchor] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let sub = null;
    let alive = true;
    const take = (loc) => {
      if (!alive) return;
      const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy };
      setMe(pos);
      setStatus('granted');
      setAnchor((a) => (!a || distanceM(a, pos) > 1500 ? pos : a));
    };
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          // 다시 묻지 못하는 상태면 설정 앱에서 켜야 한다
          if (alive) setStatus(perm.canAskAgain === false ? 'blocked' : 'denied');
          return;
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          if (alive) setStatus('off');
          return;
        }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 }).catch(() => null);
        if (last) take(last);
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 }, take);
        if (!alive) sub.remove();
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [attempt]);

  // «위치 켜기» · 권한을 다시 묻거나, 설정 앱 / 위치 켜기 창을 연다
  const fixLocation = async () => {
    if (status === 'blocked') {
      Linking.openSettings();
      return;
    }
    if (status === 'off' || status === 'error') {
      // 안드로이드는 위치 켜기 창을 띄울 수 있다 (거절하면 그대로)
      await Location.enableNetworkProviderAsync().catch(() => {});
    }
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  const fallback = !me && status !== 'loading';
  const value = {
    me: me ?? (fallback ? CAMPUS : null),
    anchor: anchor ?? (fallback ? CAMPUS : null),
    status,
    fallback,
    fixLocation,
  };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useMyLocation() {
  return useContext(LocationContext);
}

// 위치를 못 쓰는 이유 한 줄
export function fallbackReason(status) {
  return status === 'off'
    ? '휴대폰 위치(GPS)가 꺼져 있어요'
    : status === 'blocked'
      ? '위치 권한이 꺼져 있어요 · 설정에서 켜 주세요'
      : status === 'denied'
        ? '위치 권한을 허용하지 않았어요'
        : '현재 위치를 가져오지 못했어요';
}

// 주소 한 줄 (구 · 동 · 도로명). 실패하면 null
export async function addressOf(pos) {
  try {
    const [a] = await Location.reverseGeocodeAsync(pos);
    if (!a) return null;
    return [a.region, a.city, a.district, a.street, a.streetNumber].filter((x, i, arr) => x && arr.indexOf(x) === i).join(' ') || a.formattedAddress || null;
  } catch {
    return null;
  }
}
