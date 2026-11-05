// 전국 공공 AED(자동심장충격기 표준데이터)를 앱에 넣을 작은 JSON 으로 줄인다.
// 쓰는 법 · node scripts/build-public-aeds.js <aed_data.json 경로>
//   입력 · 바탕화면 하트비트 폴더의 aed_data.json (fields: lat, lon, addr, place, org, tel, wd, sat, sun, sido)
//   출력 · src/data/publicAeds.json  { generated, count, items: [[위도×1e5, 경도×1e5, 기관, 설치 위치, 평일 운영]] }
// 구급차처럼 실려 다니는 AED 는 위치가 바뀌어 지도에서 뺀다.
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) {
  console.error('aed_data.json 경로를 주세요');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
const MOVING = /구급차|구급대|차량 ?내/;
// 운영 시간 · 00:00-24:00 → 24시간, 09:00-18:00 → 09–18시, 08:30-16:30 → 08:30–16:30
const hours = (h) => {
  if (!h) return '';
  if (/^0?0:00-24:00$/.test(h) || h === '00:00-23:59') return '24시간';
  return /:(?!00)\d\d/.test(h) ? h.replace('-', '–') : h.replace(/:00/g, '').replace('-', '–') + '시';
};

const items = raw.items
  .filter((x) => !MOVING.test(x[3] || ''))
  .map((x) => [Math.round(x[0] * 1e5), Math.round(x[1] * 1e5), (x[4] || '').trim(), (x[3] || '').trim().slice(0, 30), hours(x[6])]);

const out = { generated: raw.generated, count: items.length, items };
const dest = path.join(__dirname, '..', 'src', 'data', 'publicAeds.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${items.length}곳 (뺀 이동형 ${raw.items.length - items.length}곳) → ${dest} · ${(fs.statSync(dest).size / 1e6).toFixed(1)}MB`);
