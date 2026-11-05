import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from '../components/maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import AedPin from '../components/AedPin';
import { CAMPUS, distanceM, etaText, formatDistance, placeDemo } from '../data/aeds';
import { onAlertTap, sendCardiacAlert } from '../lib/alerts';
import { addressOf, useMyLocation } from '../lib/LocationContext';
import { useMyAed } from '../lib/MyAedContext';
import { nearestPublicAed } from '../lib/publicAeds';
import { colors, radius } from '../theme';

const SEARCH_RADIUS = 500; // m
const AMBULANCE_MIN = 8; // 구급차 도착 가정(분) — 시연용 가정치
const MOVE_MS = 8000; // 보유자 이동 애니메이션 길이(실제 시간을 빠르게 재생)
const COUNTDOWN = 10; // 자동 신고 전 취소할 수 있는 시간(초)

const PHASES = [
  { key: 'countdown', title: '119 자동 신고 대기', desc: '잘못 누르셨다면 지금 취소하세요. 시간이 지나면 자동으로 신고돼요.' },
  { key: 'report', title: '119 자동 신고 완료', desc: '내 위치와 심정지 의심 상황을 119에 자동으로 보냈어요. (시뮬레이션 · 실제로 신고되지 않아요)' },
  { key: 'search', title: `반경 ${SEARCH_RADIUS}m 개인 AED 탐색`, desc: '응급 알림을 켜 둔 이웃의 집·차량 AED를 찾고 있어요.' },
  { key: 'notify', title: 'AED 보유자에게 심정지 알림', desc: '가까운 보유자들의 휴대폰에 긴급 알림을 보냈어요.' },
  { key: 'accept', title: '보유자가 출발했어요', desc: '가장 가까운 보유자가 수락하고 AED를 가지고 이동 중이에요.' },
  { key: 'arrived', title: 'AED 도착', desc: '구급차보다 먼저 AED가 도착했어요. 가까운 콘센트에 꽂고 바로 사용법 안내를 시작하세요.' },
];

const hhmmss = (d) => d.toTimeString().slice(0, 8);

export default function Emergency() {
  const { myAed } = useMyAed();
  const { me, anchor, fallback } = useMyLocation();
  // 신고 위치 · 신고 버튼을 누른 순간의 내 위치로 고정한다 (그때 위치를 아직 못 잡았으면 카운트다운 중에 잡히는 위치)
  const [incident, setIncident] = useState(() => me ?? CAMPUS);
  const hadMe = useRef(!!me);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(COUNTDOWN);
  const [progress, setProgress] = useState(0); // 보유자 이동 진행률 0~1
  const [showNeighbor, setShowNeighbor] = useState(false);
  const [addr, setAddr] = useState(null);
  const [reportedAt, setReportedAt] = useState(null);
  const [pushState, setPushState] = useState(null); // sent | off
  const timers = useRef([]);
  const started = useRef(false);

  const nearPublic = useMemo(() => nearestPublicAed(incident), [incident]);

  // 반경 안에서 알림을 켜 둔 개인 AED (내 AED가 반경 안이면 포함)
  const responders = useMemo(() => {
    const pool = placeDemo(anchor ?? incident).filter((a) => !a.alertsOff && !a.moving);
    if (myAed?.alerts) pool.push({ ...myAed, id: 'mine', kind: 'mine', owner: '나' });
    return pool
      .map((a) => ({ ...a, d: distanceM(incident, a) }))
      .filter((a) => a.d <= SEARCH_RADIUS)
      .sort((x, y) => x.d - y.d);
  }, [myAed, anchor, incident]);
  const hero = responders[0];

  useEffect(() => {
    if (hadMe.current || !me || fallback || phase > 0) return;
    hadMe.current = true;
    setIncident(me);
  }, [me]);

  useEffect(() => {
    if (fallback) return;
    let alive = true;
    addressOf(incident).then((a) => alive && setAddr(a));
    return () => {
      alive = false;
    };
  }, [incident, fallback]);

  useEffect(() => {
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    timers.current.push(tick);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const offTap = onAlertTap((data) => data.screen === 'neighbor' && setShowNeighbor(true));
    return () => {
      offTap();
      timers.current.forEach((t) => (clearTimeout(t), clearInterval(t)));
    };
  }, []);

  useEffect(() => {
    if (left === 0) report();
  }, [left]);

  // 자동 신고 → 탐색 → 알림 → 출발 → 도착
  const report = () => {
    if (started.current) return;
    started.current = true;
    timers.current.forEach((t) => clearInterval(t));
    setReportedAt(new Date());
    setPhase(1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    at(3500, () => setPhase(2));
    at(5100, () => {
      setPhase(3);
      alertNeighbors();
    });
    at(7600, () => {
      setPhase(4);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const start = Date.now();
      const move = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / MOVE_MS);
        setProgress(p);
        if (p >= 1) {
          clearInterval(move);
          setPhase(5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      }, 100);
      timers.current.push(move);
    });
  };

  // 휴대폰 알림창에 실제로 뜨는 심정지 알림 (이 휴대폰을 보유자의 휴대폰이라고 보고 보낸다)
  const alertNeighbors = async () => {
    if (!hero) return;
    const dist = formatDistance(hero.d);
    const ok = await sendCardiacAlert(
      hero.kind === 'mine'
        ? {
            title: `🚨 ${dist} 앞 심정지 발생 · 내 AED가 가장 가까워요`,
            body: `등록하신 '${hero.name}'을(를) 가지고 표시된 위치로 와 주세요. 119도 출동 중입니다.`,
            data: { screen: 'neighbor' },
          }
        : {
            title: `🚨 ${dist} 앞 심정지 발생`,
            body: `${hero.owner} 님, 등록하신 AED(${hero.kind === 'car' ? '차량' : '집'})가 가장 가까워요. AED를 가지고 와 주세요. (시연)`,
            data: { screen: 'neighbor' },
          },
    );
    setPushState(ok ? 'sent' : 'off');
  };

  const heroPos = hero && {
    latitude: hero.latitude + (incident.latitude - hero.latitude) * progress,
    longitude: hero.longitude + (incident.longitude - hero.longitude) * progress,
  };
  const remainingM = hero ? Math.round(hero.d * (1 - progress)) : 0;
  const etaMin = hero ? (hero.d / 100).toFixed(1) : '-';

  const goGuide = () => {
    router.dismiss();
    setTimeout(() => router.navigate('/guide'), 250);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{ ...incident, latitudeDelta: 0.011, longitudeDelta: 0.011 }}
        scrollEnabled={false}
        zoomEnabled={false}>
        {phase >= 2 && (
          <Circle center={incident} radius={SEARCH_RADIUS} strokeColor="rgba(229,72,77,0.6)" fillColor="rgba(229,72,77,0.10)" strokeWidth={2} />
        )}
        {nearPublic && nearPublic.d < 1500 && (
          <Marker key="near-public" coordinate={nearPublic} anchor={{ x: 0.5, y: 0.5 }}>
            <AedPin kind="public" size={24} />
          </Marker>
        )}
        <Marker
          key="incident"
          coordinate={incident}
          anchor={{ x: 0.5, y: 0.5 }}
          androidPin={{ icon: 'heart-dislike', color: colors.red, size: 34, border: 3 }}>
          <View style={styles.incident}>
            <Ionicons name="heart-dislike" size={18} color="#fff" />
          </View>
        </Marker>
        {phase >= 3 &&
          responders.map((r) =>
            r.id === hero?.id && phase >= 4 ? null : (
              <Marker key={r.id} coordinate={r} anchor={{ x: 0.5, y: 0.5 }}>
                <AedPin kind={r.kind} size={26} dim={phase >= 4} />
              </Marker>
            ),
          )}
        {phase >= 4 && hero && (
          <>
            <Polyline coordinates={[heroPos, incident]} strokeColor={colors.homeAed} strokeWidth={4} lineDashPattern={[8, 6]} />
            <Marker key="hero" coordinate={heroPos} anchor={{ x: 0.5, y: 0.5 }}>
              <AedPin kind={hero.kind} size={34} />
            </Marker>
          </>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable style={styles.close} onPress={() => router.dismiss()}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.simBadge}>
            <Text style={styles.simText}>시뮬레이션 · 119에 실제로 신고되지 않아요</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ padding: 18 }}>
          <Text style={styles.phaseTitle}>{PHASES[phase].title}</Text>
          <Text style={styles.phaseDesc}>{PHASES[phase].desc}</Text>

          <View style={styles.steps}>
            {PHASES.map((p, i) => (
              <View key={p.key} style={[styles.stepDot, i <= phase && styles.stepDotOn]} />
            ))}
          </View>

          {phase === 0 && (
            <View style={styles.countBox}>
              <Text style={styles.countNum}>{left}</Text>
              <Text style={styles.countSub}>초 뒤 119에 자동 신고</Text>
              <View style={styles.countBtns}>
                <Pressable style={[styles.countBtn, { backgroundColor: colors.bg }]} onPress={() => router.dismiss()}>
                  <Text style={[styles.countBtnText, { color: colors.ink }]}>취소</Text>
                </Pressable>
                <Pressable style={[styles.countBtn, { backgroundColor: colors.red }]} onPress={report}>
                  <Text style={[styles.countBtnText, { color: '#fff' }]}>지금 신고</Text>
                </Pressable>
              </View>
            </View>
          )}

          {phase >= 1 && (
            <View style={styles.report}>
              <View style={styles.reportHead}>
                <Ionicons name="call" size={16} color={colors.redDark} />
                <Text style={styles.reportTitle}>119 자동 신고 내용</Text>
                <Text style={styles.reportState}>{phase === 1 ? '접수 중…' : '접수 완료 · 출동'}</Text>
              </View>
              <ReportRow label="시각" value={reportedAt ? hhmmss(reportedAt) : '-'} />
              <ReportRow label="위치" value={addr ?? (fallback ? '시연 위치 (중앙대)' : '주소 확인 중…')} />
              <ReportRow label="좌표" value={`${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`} />
              <ReportRow label="상황" value="심정지 의심 · 의식·호흡 없음 (하트비트 앱 자동 신고)" />
              {nearPublic && <ReportRow label="근처 AED" value={`공공 ${nearPublic.name} · ${formatDistance(nearPublic.d)}`} />}
            </View>
          )}

          {phase >= 3 && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>
                알림 받은 보유자 {responders.length}명
                {pushState === 'sent' ? ' · 휴대폰 알림 보냄' : pushState === 'off' ? ' · 알림 권한이 꺼져 있어 화면으로만 보여요' : ''}
              </Text>
              {responders.slice(0, 4).map((r, i) => {
                const accepted = phase >= 4 && i === 0;
                return (
                  <View key={r.id} style={styles.respRow}>
                    <AedPin kind={r.kind} size={24} />
                    <Text style={styles.respName}>{r.owner} 님 · {r.kind === 'car' ? '차량' : r.kind === 'mine' ? '내 AED' : '집'}</Text>
                    <Text style={styles.respDist}>{formatDistance(r.d)}</Text>
                    <Text style={[styles.respState, accepted && { color: colors.homeAed }]}>
                      {accepted ? '출발함' : phase >= 4 ? '대기' : '알림 전송'}
                    </Text>
                  </View>
                );
              })}
              {!responders.length && <Text style={styles.note}>반경 안에 알림을 켠 보유자가 없어요. 가까운 공공 AED를 이용하세요.</Text>}
              {hero && (
                <Pressable onPress={() => setShowNeighbor(true)} style={styles.linkBtn}>
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.red} />
                  <Text style={styles.linkText}>알림 받은 보유자의 화면 보기</Text>
                </Pressable>
              )}
            </View>
          )}

          {phase >= 4 && hero && (
            <View style={styles.compare}>
              <View style={styles.compareBox}>
                <Text style={styles.compareLabel}>이웃 AED 도착</Text>
                <Text style={[styles.compareValue, { color: colors.homeAed }]}>
                  {phase >= 5 ? '도착!' : `약 ${etaText(remainingM)}`}
                </Text>
                <Text style={styles.compareSub}>{formatDistance(hero.d)} · 약 {etaMin}분</Text>
              </View>
              <View style={styles.compareBox}>
                <Text style={styles.compareLabel}>구급차 도착 (가정)</Text>
                <Text style={styles.compareValue}>약 {AMBULANCE_MIN}분</Text>
                <Text style={styles.compareSub}>심정지 골든타임 약 4분</Text>
              </View>
            </View>
          )}
          {phase === 4 && <Text style={styles.note}>시연을 위해 이동 시간을 빠르게 재생하고 있어요.</Text>}

          {phase >= 5 && (
            <Pressable style={styles.primary} onPress={goGuide}>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.primaryText}>AED 사용법 안내 시작</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal visible={showNeighbor} transparent animationType="fade" onRequestClose={() => setShowNeighbor(false)}>
        <View style={styles.backdrop}>
          <View style={styles.push}>
            <View style={styles.pushHead}>
              <Ionicons name="pulse" size={18} color={colors.red} />
              <Text style={styles.pushApp}>하트비트 · 지금</Text>
            </View>
            <Text style={styles.pushTitle}>🚨 {hero ? formatDistance(hero.d) : ''} 앞에서 심정지 발생</Text>
            <Text style={styles.pushBody}>
              {hero?.kind === 'mine'
                ? `등록하신 '${hero?.name}'이(가) 가장 가까워요. AED를 가지고 표시된 위치로 와 주세요. 119도 출동 중입니다.`
                : `${hero?.owner} 님, 등록하신 AED(${hero?.kind === 'car' ? '차량' : '집'})가 가장 가까워요. AED를 가지고 표시된 위치로 와 주세요. 119도 출동 중입니다.`}
            </Text>
            <View style={styles.pushBtns}>
              <Pressable style={[styles.pushBtn, { backgroundColor: colors.bg }]} onPress={() => setShowNeighbor(false)}>
                <Text style={[styles.pushBtnText, { color: colors.muted }]}>지금은 어려워요</Text>
              </Pressable>
              <Pressable style={[styles.pushBtn, { backgroundColor: colors.red }]} onPress={() => setShowNeighbor(false)}>
                <Text style={[styles.pushBtnText, { color: '#fff' }]}>AED 가지고 출발</Text>
              </Pressable>
            </View>
            <Text style={styles.pushFoot}>선의로 응급처치를 한 경우 법적 책임 감면 규정이 있어요 (응급의료법).</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReportRow({ label, value }) {
  return (
    <View style={styles.reportRow}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={styles.reportValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { height: '42%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 },
  simBadge: { backgroundColor: colors.redDark, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  simText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  incident: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  sheet: { flex: 1, marginTop: -16, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  phaseTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  phaseDesc: { marginTop: 6, fontSize: 15, color: colors.muted, lineHeight: 21 },
  steps: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stepDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  stepDotOn: { backgroundColor: colors.red },
  countBox: { marginTop: 18, alignItems: 'center', padding: 18, borderRadius: radius.card, backgroundColor: colors.redSoft },
  countNum: { fontSize: 64, fontWeight: '800', color: colors.red, fontVariant: ['tabular-nums'] },
  countSub: { fontSize: 15, fontWeight: '700', color: colors.redDark },
  countBtns: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  countBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  countBtnText: { fontSize: 16, fontWeight: '800' },
  report: { marginTop: 18, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: '#F3C2C4', backgroundColor: '#FFF8F8' },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reportTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.redDark },
  reportState: { fontSize: 12, fontWeight: '700', color: colors.homeAed },
  reportRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  reportLabel: { width: 56, fontSize: 13, color: colors.muted, fontWeight: '600' },
  reportValue: { flex: 1, fontSize: 13, color: colors.ink },
  block: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.card },
  blockLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 },
  respRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  respName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  respDist: { fontSize: 14, color: colors.muted, width: 52, textAlign: 'right' },
  respState: { fontSize: 13, fontWeight: '700', color: colors.muted, width: 58, textAlign: 'right' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  compare: { flexDirection: 'row', gap: 10, marginTop: 14 },
  compareBox: { flex: 1, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  compareLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  compareValue: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 4 },
  compareSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  note: { marginTop: 10, fontSize: 12, color: colors.muted },
  primary: { marginTop: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, paddingVertical: 16, borderRadius: radius.card },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-start', paddingTop: 80, paddingHorizontal: 14 },
  push: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  pushHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pushApp: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  pushTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 8 },
  pushBody: { fontSize: 14, color: colors.ink, marginTop: 6, lineHeight: 20 },
  pushBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pushBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  pushBtnText: { fontSize: 15, fontWeight: '800' },
  pushFoot: { fontSize: 11, color: colors.muted, marginTop: 10 },
});
