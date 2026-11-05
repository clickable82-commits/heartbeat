import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AedPin from '../../components/AedPin';
import DemoBadge from '../../components/DemoBadge';
import { addressOf, useMyLocation } from '../../lib/LocationContext';
import { useMyAed } from '../../lib/MyAedContext';
import { colors, radius } from '../../theme';

// 등록 위치 · 지금 휴대폰 GPS 위치 (집이면 집에서, 차면 차 옆에서 등록하는 흐름)
const RANGES = [300, 500, 1000];

function daysUntil(iso) {
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

export default function MyAed() {
  const { myAed, setMyAed, registerAed } = useMyAed();
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.headRow}>
          <Text style={styles.h1}>내 AED</Text>
          <DemoBadge text="가상 기기" />
        </View>
        {myAed ? <Device aed={myAed} onUpdate={setMyAed} /> : <Register onSave={registerAed} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Register({ onSave }) {
  const [type, setType] = useState('home');
  const [nickname, setNickname] = useState('');
  const [range, setRange] = useState(500);
  const [hideExact, setHideExact] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const { me, status, fallback } = useMyLocation();
  const [addr, setAddr] = useState(null);

  // 주소는 위치가 100m 넘게 바뀔 때만 다시 찾는다
  const spotKey = me ? `${me.latitude.toFixed(3)},${me.longitude.toFixed(3)}` : '';
  useEffect(() => {
    if (!me || fallback) return;
    let alive = true;
    addressOf(me).then((a) => alive && setAddr(a));
    return () => {
      alive = false;
    };
  }, [spotKey, fallback]);

  const spotLabel = !me
    ? '현재 위치를 찾는 중…'
    : fallback
      ? '위치 권한이 없어 시연 위치(중앙대)로 등록돼요'
      : `${addr ?? '현재 위치'} 근처${me.accuracy ? ` · 오차 약 ${Math.round(me.accuracy)}m` : ''}`;

  const save = () => {
    if (!me) return;
    const pad = new Date();
    pad.setMonth(pad.getMonth() + 14);
    onSave({
      type,
      name: nickname.trim() || (type === 'home' ? '우리 집 AED' : '내 차 AED'),
      note: `${type === 'home' ? '집' : '차량'} · ${addr ?? (fallback ? '시연 위치' : '등록 위치')}`,
      latitude: me.latitude,
      longitude: me.longitude,
      range,
      hideExact,
      alerts,
      model: '하트비트 라이트',
      weightKg: 0.9,
      battery: 92,
      padExpiry: pad.toISOString().slice(0, 10),
      lastCheck: new Date().toISOString().slice(0, 10),
      subscribed: false,
    });
    // 등록하자마자 지도로 가서 새 핀을 보여 준다
    router.navigate('/');
  };

  return (
    <View>
      <View style={styles.hero}>
        <Ionicons name="heart-circle" size={42} color={colors.red} />
        <Text style={styles.heroTitle}>집·차에 둔 AED를 등록해 이웃을 지켜 주세요</Text>
        <Text style={styles.heroSub}>
          공공 AED 지도에는 개인 AED가 없어요. 등록하면 근처에서 심정지가 생겼을 때 내 AED가 가장 빨리 도착할 수 있어요.
        </Text>
      </View>

      <Text style={styles.label}>어디에 두셨나요?</Text>
      <View style={styles.segment}>
        {[
          ['home', '집', 'home'],
          ['car', '차량', 'car'],
        ].map(([k, label, icon]) => (
          <Pressable key={k} onPress={() => setType(k)} style={[styles.segBtn, type === k && styles.segOn]}>
            <Ionicons name={icon} size={18} color={type === k ? '#fff' : colors.ink} />
            <Text style={[styles.segText, type === k && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>이름 (선택)</Text>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder={type === 'home' ? '예: 우리 집 거실 AED' : '예: 아반떼 트렁크 AED'}
        style={styles.input}
        placeholderTextColor="#9CA3AF"
      />

      <Text style={styles.label}>위치 · 지금 있는 곳</Text>
      <View style={styles.locBox}>
        <Ionicons name={status === 'granted' ? 'navigate' : 'location'} size={18} color={colors.red} />
        <Text style={[styles.locText, { flex: 1 }]}>{spotLabel}</Text>
      </View>
      <Text style={styles.locHint}>{type === 'home' ? '집 안에서 등록하면 그 위치로 올라가요' : '차 옆에서 등록하면 지금 주차 위치로 올라가요'}</Text>

      <Text style={styles.label}>응급 알림 받을 반경</Text>
      <View style={styles.segment}>
        {RANGES.map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.segBtn, range === r && styles.segOn]}>
            <Text style={[styles.segText, range === r && { color: '#fff' }]}>{r >= 1000 ? '1km' : `${r}m`}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>정확한 주소 숨기기</Text>
          <Text style={styles.switchSub}>지도에는 대략적인 위치만 보여요</Text>
        </View>
        <Switch value={hideExact} onValueChange={setHideExact} trackColor={{ true: colors.red }} />
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>근처 심정지 알림 받기</Text>
          <Text style={styles.switchSub}>언제든 끌 수 있고, 거절해도 불이익이 없어요</Text>
        </View>
        <Switch value={alerts} onValueChange={setAlerts} trackColor={{ true: colors.red }} />
      </View>

      <Pressable style={[styles.primary, !me && { opacity: 0.5 }]} onPress={save} disabled={!me}>
        <Text style={styles.primaryText}>{me ? '내 AED 등록하고 지도에서 보기' : '위치를 찾는 중…'}</Text>
      </Pressable>
    </View>
  );
}

function Device({ aed, onUpdate }) {
  const padDays = daysUntil(aed.padExpiry);

  const selfCheck = () => {
    onUpdate({ ...aed, lastCheck: new Date().toISOString().slice(0, 10) });
    Alert.alert('자가점검 완료', '전원부·패드·회로 모두 정상입니다. (시연)');
  };
  const subscribe = () =>
    Alert.alert('소모품 정기구독 (시연)', '전극 패드를 유효기간 전에 자동으로 보내 드려요. 배터리가 없어서 배터리 교체는 필요 없어요.\n월 4,900원 (가격은 예시)\n\n실제 결제는 이루어지지 않습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '구독하기', onPress: () => onUpdate({ ...aed, subscribed: true }) },
    ]);
  const remove = () =>
    Alert.alert('등록 해제', '내 AED 등록을 해제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '해제', style: 'destructive', onPress: () => onUpdate(null) },
    ]);

  return (
    <View>
      <View style={styles.deviceCard}>
        <View style={styles.deviceHead}>
          <AedPin kind="mine" size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.deviceName}>{aed.name}</Text>
            <Text style={styles.deviceSub}>
              {aed.model} · 배터리 없는 콘센트형 · {aed.type === 'home' ? '집' : '차량'}
            </Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.homeAed} />
          <Text style={styles.statusText}>사용 가능 · 이웃 지도에 표시 중</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>전원 방식</Text>
          <View style={styles.powerRow}>
            <Ionicons name="flash" size={22} color={colors.homeAed} />
            <Text style={styles.powerValue}>콘센트 연결형</Text>
          </View>
          <Text style={styles.tileSub}>{aed.type === 'car' ? '사용 시 차량 전원(전기차 V2L 등)에 연결' : '사용 시 가까운 콘센트에 연결'}</Text>
          <Text style={styles.tileSub}>배터리 없음 · 교체·충전 필요 없음</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>전극 패드</Text>
          <Text style={[styles.tileValue, padDays < 60 && { color: colors.red }]}>D-{padDays}</Text>
          <Text style={styles.tileSub}>유효기간 {aed.padExpiry}</Text>
        </View>
      </View>

      <View style={styles.rowCard}>
        <Ionicons name="shield-checkmark" size={22} color={colors.publicAed} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>마지막 자가점검</Text>
          <Text style={styles.rowSub}>{aed.lastCheck} · 매주 자동 점검</Text>
        </View>
        <Pressable onPress={selfCheck} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>지금 점검</Text>
        </Pressable>
      </View>

      <View style={styles.rowCard}>
        <Ionicons name="repeat" size={22} color={colors.mine} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>소모품 정기구독</Text>
          <Text style={styles.rowSub}>{aed.subscribed ? '구독 중 · 다음 패드 자동 배송 예정' : '유효기간 전에 전극 패드 자동 교체'}</Text>
        </View>
        {!aed.subscribed && (
          <Pressable onPress={subscribe} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>구독</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.rowCard}>
        <Ionicons name="notifications" size={22} color={colors.red} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>근처 심정지 알림</Text>
          <Text style={styles.rowSub}>반경 {aed.range >= 1000 ? '1km' : `${aed.range}m`} · {aed.hideExact ? '정확한 주소 숨김' : '정확한 위치 공개'}</Text>
        </View>
        <Switch value={aed.alerts} onValueChange={(v) => onUpdate({ ...aed, alerts: v })} trackColor={{ true: colors.red }} />
      </View>

      <View style={styles.impact}>
        <Text style={styles.impactTitle}>내 AED가 지키는 이웃</Text>
        <Text style={styles.impactText}>반경 {aed.range >= 1000 ? '1km' : `${aed.range}m`} 안에서 심정지가 생기면 구급차보다 먼저 도착할 수 있어요.</Text>
      </View>

      <Pressable onPress={remove} style={{ alignSelf: 'center', padding: 12 }}>
        <Text style={{ color: colors.muted, fontWeight: '600' }}>등록 해제</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink },
  hero: { backgroundColor: '#fff', borderRadius: radius.card, padding: 18, alignItems: 'flex-start', gap: 8 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  heroSub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { marginTop: 18, marginBottom: 8, fontSize: 14, fontWeight: '700', color: colors.ink },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  segOn: { backgroundColor: colors.red, borderColor: colors.red },
  segText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
  locBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.line },
  locText: { fontSize: 15, color: colors.ink },
  locHint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 10 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  switchSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  primary: { marginTop: 22, backgroundColor: colors.red, borderRadius: radius.card, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  deviceCard: { backgroundColor: '#fff', borderRadius: radius.card, padding: 16 },
  deviceHead: { flexDirection: 'row', alignItems: 'center' },
  deviceName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  deviceSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  statusText: { fontSize: 14, fontWeight: '600', color: colors.homeAed },
  grid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: radius.card, padding: 14 },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  tileValue: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 4 },
  powerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 },
  powerValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 6 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginTop: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  smallBtn: { backgroundColor: colors.redSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  smallBtnText: { color: colors.red, fontWeight: '800', fontSize: 13 },
  impact: { marginTop: 10, backgroundColor: colors.redSoft, borderRadius: radius.card, padding: 16 },
  impactTitle: { fontSize: 15, fontWeight: '800', color: colors.redDark },
  impactText: { fontSize: 13, color: colors.redDark, marginTop: 4, lineHeight: 19 },
});
