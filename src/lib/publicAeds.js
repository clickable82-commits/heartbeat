import RAW from '../data/publicAeds.json';
import { distanceM } from '../data/aeds';

// 전국 공공 AED (공공데이터포털 '전국 자동심장충격기 표준데이터', scripts/build-public-aeds.js 로 생성)
// 6만 곳을 지도에 다 올릴 수 없어서 약 1km 격자로 나눠 두고, 지도 중심 근처만 꺼낸다.
export const PUBLIC_AED_COUNT = RAW.count;
export const PUBLIC_AED_DATE = RAW.generated;

const CELL = 0.01; // 위도·경도 0.01도 ≈ 1.1km
const cellKey = (lat, lng) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
let grid = null;

function buildGrid() {
  grid = new Map();
  RAW.items.forEach((x, i) => {
    const k = cellKey(x[0] / 1e5, x[1] / 1e5);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
}

function toAed(i) {
  const [lat, lng, org, place, hours] = RAW.items[i];
  return {
    id: `p${i}`,
    kind: 'public',
    name: org || '공공 AED',
    place,
    hours,
    note: ['공공', place, hours].filter(Boolean).join(' · '),
    latitude: lat / 1e5,
    longitude: lng / 1e5,
  };
}

// center 에서 radiusM 안의 공공 AED 를 가까운 순서로 limit 개까지
export function publicAedsNear(center, radiusM = 1500, limit = 80) {
  if (!center) return [];
  if (!grid) buildGrid();
  const reach = Math.ceil(radiusM / 1100) + 1;
  const cy = Math.floor(center.latitude / CELL);
  const cx = Math.floor(center.longitude / CELL);
  const found = [];
  for (let y = cy - reach; y <= cy + reach; y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      (grid.get(`${y}:${x}`) || []).forEach((i) => {
        const a = toAed(i);
        const d = distanceM(center, a);
        if (d <= radiusM) found.push({ ...a, d });
      });
    }
  }
  return found.sort((p, q) => p.d - q.d).slice(0, limit);
}

// 가장 가까운 공공 AED 하나 (반경을 넓혀 가며 찾는다)
export function nearestPublicAed(center) {
  for (const r of [500, 1500, 5000, 20000]) {
    const [a] = publicAedsNear(center, r, 1);
    if (a) return a;
  }
  return null;
}
