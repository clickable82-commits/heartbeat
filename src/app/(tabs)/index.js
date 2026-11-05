import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from '../../components/maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import AedPin from '../../components/AedPin';
import DemoBadge from '../../components/DemoBadge';
import { INITIAL_REGION, KIND, distanceM, formatDistance, placeDemo, regionAround } from '../../data/aeds';
import { fallbackReason, useMyLocation } from '../../lib/LocationContext';
import { useMyAed } from '../../lib/MyAedContext';
import { PUBLIC_AED_COUNT, PUBLIC_AED_DATE, nearestPublicAed, publicAedsNear } from '../../lib/publicAeds';
import { colors, radius } from '../../theme';

const FILTERS = ['public', 'home', 'car'];
const ME_COLOR = '#0EA5E9';
const MAX_SPAN_M = 6000; // 지도가 이보다 넓게 보이면 공공 AED 를 그리지 않는다 (너무 많아서)
const round = (p) => (p ? `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}` : '');

export default function MapScreen() {
  const mapRef = useRef(null);
  const { me, anchor, status, fallback, fixLocation } = useMyLocation();
  const { myAed, fresh, consumeFresh } = useMyAed();
  const [visible, setVisible] = useState({ public: true, home: true, car: true });
  const [selected, setSelected] = useState(null);
  const [follow, setFollow] = useState(true); // 내 위치를 따라 지도를 움직이는 중
  const [area, setArea] = useState(null); // 지금 보이는 지도 범위
  const [banner, setBanner] = useState(null);

  // 가상 이웃은 처음 잡은 내 위치 근처에 둔다
  const neighbors = useMemo(() => placeDemo(anchor), [round(anchor)]);
  const mine = myAed ? { ...myAed, id: 'mine', kind: 'mine' } : null;

  // 공공 AED · 지금 보이는 지도 가운데 근처 (실제 데이터)
  const spanM = area ? area.latitudeDelta * 111000 : 1300;
  const tooWide = spanM > MAX_SPAN_M;
  const center = area ?? me;
  const publics = useMemo(
    () => (tooWide || !center ? [] : publicAedsNear(center, Math.min(3000, Math.max(600, spanM * 0.75)), 120)),
    [round(center), Math.round(spanM / 200), tooWide],
  );

  const shown = [...publics, ...neighbors, ...(mine ? [mine] : [])].filter((a) => a.kind === 'mine' || visible[a.kind]);

  // 내 위치 기준 가장 가까운 공공 / 개인 AED
  const nearPublic = useMemo(() => (me ? nearestPublicAed(me) : null), [round(me)]);
  const nearPrivate = me
    ? [...neighbors.filter((a) => !a.moving), ...(mine ? [mine] : [])].map((a) => ({ ...a, d: distanceM(me, a) })).sort((x, y) => x.d - y.d)[0]
    : null;

  // 내 위치를 따라가기 · 지도를 손으로 끌면 멈추고, ◎ 단추로 다시 켠다
  useEffect(() => {
    if (follow && me && !fallback) mapRef.current?.animateToRegion(regionAround(me, area?.latitudeDelta ?? 0.012), 400);
  }, [round(me), follow]);

  // 방금 등록한 AED 로 바로 이동해서 보여 준다
  useEffect(() => {
    if (!fresh || !mine) return;
    consumeFresh();
    setFollow(false);
    setSelected(mine);
    mapRef.current?.animateToRegion(regionAround(mine, 0.006), 600);
    setBanner(`'${mine.name}'이(가) 지도에 나타났어요`);
  }, [fresh]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(t);
  }, [banner]);

  const locate = () => {
    setFollow(true);
    if (fallback) fixLocation();
    else if (me) mapRef.current?.animateToRegion(regionAround(me, 0.01), 500);
  };

  const where = status === 'loading' ? '현재 위치를 찾는 중…' : fallback ? '시연 위치(중앙대)' : '내 위치 주변';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={me ? regionAround(me) : INITIAL_REGION}
        onPress={() => setSelected(null)}
        onPanDrag={() => follow && setFollow(false)}
        onRegionChangeComplete={setArea}>
        {me && !fallback && me.accuracy < 200 && (
          <Circle center={me} radius={me.accuracy} strokeColor="rgba(14,165,233,0.4)" fillColor="rgba(14,165,233,0.12)" strokeWidth={1} />
        )}
        {shown.map((a) => (
          <Marker key={a.id} coordinate={a} onPress={() => setSelected(a)} anchor={{ x: 0.5, y: 0.5 }}>
            <AedPin kind={a.kind} dim={a.alertsOff} size={a.kind === 'public' ? 26 : 30} />
          </Marker>
        ))}
        {me && (
          <Marker key="me" coordinate={me} title={fallback ? '시연 위치' : '내 위치'} anchor={{ x: 0.5, y: 0.5 }} androidPin={{ color: ME_COLOR, size: 20, border: 3 }}>
            <View style={styles.meDot} />
          </Marker>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Ionicons name="pulse" size={22} color={colors.red} />
            <Text style={styles.brand}>하트비트</Text>
            <View style={{ flex: 1 }} />
            <DemoBadge text="이웃 AED는 가상" />
          </View>
          <Text style={styles.sub}>
            {where} · 공공 {publics.length}곳 + 이웃 개인 {neighbors.length + (mine ? 1 : 0)}대
          </Text>
          <View style={styles.filters}>
            {FILTERS.map((k) => (
              <Pressable
                key={k}
                onPress={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}
                style={[styles.chip, !visible[k] && styles.chipOff]}>
                <AedPin kind={k} size={18} dim={!visible[k]} />
                <Text style={[styles.chipText, !visible[k] && { color: colors.muted }]}>{KIND[k].short}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.source}>
            공공 AED 전국 {PUBLIC_AED_COUNT.toLocaleString()}곳 · 공공데이터포털 {PUBLIC_AED_DATE} 기준
          </Text>
        </View>
        {fallback && (
          <Pressable onPress={fixLocation} style={styles.locWarn}>
            <Ionicons name="warning" size={18} color={colors.redDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locWarnTitle}>{fallbackReason(status)}</Text>
              <Text style={styles.locWarnSub}>그래서 시연 위치(동작구 중앙대)로 보여요</Text>
            </View>
            <View style={styles.locWarnBtn}>
              <Text style={styles.locWarnBtnText}>{status === 'blocked' ? '설정 열기' : '위치 켜기'}</Text>
            </View>
          </Pressable>
        )}
        {banner && (
          <View style={styles.banner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        )}
        {tooWide && !banner && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>지도를 확대하면 공공 AED가 보여요</Text>
          </View>
        )}
      </SafeAreaView>

      <View style={styles.bottom} pointerEvents="box-none">
        <Pressable onPress={locate} style={[styles.locate, follow && !fallback && styles.locateOn]}>
          <Ionicons name={follow && !fallback ? 'navigate' : 'locate'} size={22} color={follow && !fallback ? '#fff' : colors.ink} />
        </Pressable>

        {selected ? (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <AedPin kind={selected.kind} size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cardTitle}>{selected.name}</Text>
                <Text style={styles.cardSub}>
                  {KIND[selected.kind].label}
                  {selected.note ? ` · ${selected.note}` : ''}
                  {me ? ` · 내 위치에서 ${formatDistance(distanceM(me, selected))}` : ''}
                </Text>
              </View>
            </View>
            {selected.kind === 'mine' && <Text style={styles.privacy}>이웃 지도에도 바로 표시돼요 (시연 · 이 휴대폰 안에서만)</Text>}
            {(selected.kind === 'home' || selected.kind === 'car') && (
              <Text style={styles.privacy}>개인 AED는 정확한 주소 대신 대략적인 위치만 표시돼요.</Text>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>가장 가까운 AED</Text>
            <View style={styles.nearRow}>
              {nearPrivate && (
                <View style={styles.nearBox}>
                  <AedPin kind={nearPrivate.kind} size={22} />
                  <Text style={styles.nearText}>
                    {nearPrivate.kind === 'mine' ? '내 AED' : '이웃 개인'} {formatDistance(nearPrivate.d)}
                  </Text>
                </View>
              )}
              {nearPublic && (
                <View style={styles.nearBox}>
                  <AedPin kind="public" size={22} />
                  <Text style={styles.nearText}>공공 {formatDistance(nearPublic.d)}</Text>
                </View>
              )}
              {!me && <Text style={styles.cardSub}>위치를 찾는 중이에요</Text>}
            </View>
            {nearPublic && <Text style={styles.cardSub} numberOfLines={1}>공공 · {nearPublic.name} {nearPublic.place}</Text>}
          </View>
        )}

        <Pressable style={({ pressed }) => [styles.sos, pressed && { opacity: 0.85 }]} onPress={() => router.push('/emergency')}>
          <Ionicons name="alert-circle" size={24} color="#fff" />
          <Text style={styles.sosText}>심정지 신고 · 119 자동 신고</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    margin: 12,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { fontSize: 20, fontWeight: '800', color: colors.ink },
  sub: { marginTop: 4, color: colors.muted, fontSize: 13 },
  source: { marginTop: 8, color: colors.muted, fontSize: 11 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOff: { backgroundColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  banner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.homeAed,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 4,
  },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  locWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    padding: 12,
    backgroundColor: colors.redSoft,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#F3C2C4',
  },
  locWarnTitle: { fontSize: 14, fontWeight: '800', color: colors.redDark },
  locWarnSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  locWarnBtn: { backgroundColor: colors.red, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  locWarnBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  hint: { alignSelf: 'center', backgroundColor: 'rgba(26,26,26,0.75)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  hintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: ME_COLOR, borderWidth: 3, borderColor: '#fff', elevation: 3 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 10 },
  locate: {
    alignSelf: 'flex-end',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  locateOn: { backgroundColor: ME_COLOR },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardSub: { marginTop: 2, fontSize: 13, color: colors.muted },
  privacy: { marginTop: 10, fontSize: 12, color: colors.muted },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  nearRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  nearBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nearText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: radius.card,
    paddingVertical: 16,
    shadowColor: colors.red,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  sosText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
