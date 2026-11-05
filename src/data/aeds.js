// 개인 AED(집·차량)는 모두 가상 사용자다. 중앙대(흑석동) 기준으로 배치해 두고,
// placeDemo() 가 지금 내 위치 근처로 같은 모양 그대로 옮긴다.
// 공공 AED 는 실제 데이터(lib/publicAeds.js)를 쓴다.

export const CAMPUS = { latitude: 37.5048, longitude: 126.9572 };

export const INITIAL_REGION = {
  latitude: 37.5052,
  longitude: 126.9585,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};


export const AEDS = [
  // 개인 AED — 집 (가상 사용자)
  { id: 'h1', kind: 'home', name: '김민준 님 댁', note: '개인 · 응급 알림 ON', owner: '김민준', latitude: 37.5067, longitude: 126.9596 },
  { id: 'h2', kind: 'home', name: '이서연 님 댁', note: '개인 · 응급 알림 ON', owner: '이서연', latitude: 37.5046, longitude: 126.9610 },
  { id: 'h3', kind: 'home', name: '박지호 님 댁', note: '개인 · 응급 알림 ON', owner: '박지호', latitude: 37.5083, longitude: 126.9560 },
  { id: 'h4', kind: 'home', name: '최유나 님 댁', note: '개인 · 응급 알림 OFF', owner: '최유나', latitude: 37.5021, longitude: 126.9601, alertsOff: true },
  { id: 'h5', kind: 'home', name: '정도윤 님 댁', note: '개인 · 응급 알림 ON', owner: '정도윤', latitude: 37.5098, longitude: 126.9605 },

  // 개인 AED — 차량 (가상 사용자, 현재 주차 위치)
  { id: 'c1', kind: 'car', name: '한지우 님 차량', note: '개인 · 주차 중', owner: '한지우', latitude: 37.5053, longitude: 126.9572 },
  { id: 'c2', kind: 'car', name: '윤하은 님 차량', note: '개인 · 주차 중', owner: '윤하은', latitude: 37.5034, longitude: 126.9631 },
  { id: 'c3', kind: 'car', name: '오태현 님 차량', note: '개인 · 운행 중', owner: '오태현', latitude: 37.5101, longitude: 126.9572, moving: true },
];

// 가상 이웃을 base(내 위치) 근처로 옮긴다. 서로의 거리 · 방향은 그대로다.
export function placeDemo(base) {
  if (!base) return [];
  const dLat = base.latitude - CAMPUS.latitude;
  const dLng = base.longitude - CAMPUS.longitude;
  return AEDS.map((a) => ({ ...a, latitude: a.latitude + dLat, longitude: a.longitude + dLng }));
}

export const regionAround = (p, delta = 0.012) => ({ latitude: p.latitude, longitude: p.longitude, latitudeDelta: delta, longitudeDelta: delta });

export const KIND = {
  public: { label: '공공 AED', short: '공공' },
  home: { label: '개인 AED (집)', short: '집' },
  car: { label: '개인 AED (차량)', short: '차량' },
  mine: { label: '내 AED', short: '내 AED' },
};

// 두 좌표 사이 거리(m) — 하버사인 공식
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

// AED를 들고 빠르게 걷는 속도 약 100m/분 (시연용 가정)
export function etaText(m) {
  const sec = Math.round((m / 100) * 60);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min > 0 ? `${min}분 ${s}초` : `${s}초`;
}
