import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme';

const BPM = 110; // 가슴압박 속도 분당 100~120회의 가운데

const AED_STEPS = [
  { icon: 'power', title: '전원 연결하고 켜기', body: '하트비트 개인 AED는 배터리가 없어요. 먼저 가까운 콘센트(차량은 차량 전원)에 꽂고 전원 버튼을 누르면 음성 안내가 시작돼요. 공공 AED는 바로 켜면 돼요.' },
  { icon: 'body', title: '패드 붙이기', body: '오른쪽 빗장뼈 아래, 왼쪽 젖꼭지 아래 옆구리에 패드 그림대로 붙여요.' },
  { icon: 'hand-left', title: '분석 중 물러나기', body: '"분석 중" 안내가 나오면 아무도 환자를 만지지 않게 해요.' },
  { icon: 'flash', title: '쇼크 버튼 누르기', body: '쇼크가 필요하다고 하면 모두 떨어진 것을 확인하고 버튼을 눌러요.' },
  { icon: 'refresh', title: '바로 가슴압박 다시 시작', body: '쇼크 후 즉시 가슴압박을 이어 가고, 2분마다 AED가 다시 분석해요.' },
];

export default function Guide() {
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [haptic, setHaptic] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setCount((c) => c + 1);
      if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.82, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 60000 / BPM);
    return () => clearInterval(iv);
  }, [running, haptic, scale]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.h1}>응급 사용법</Text>

        <View style={styles.callout}>
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.calloutText}>가장 먼저 119에 신고하고, 주변에 AED를 가져와 달라고 외치세요.</Text>
        </View>

        <Text style={styles.h2}>AED 사용 5단계</Text>
        {AED_STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.stepHead}>
                <Ionicons name={s.icon} size={18} color={colors.red} />
                <Text style={styles.stepTitle}>{s.title}</Text>
              </View>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.h2}>가슴압박 리듬 도우미</Text>
        <View style={styles.cpr}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="heart" size={110} color={running ? colors.red : '#F3B4B6'} />
          </Animated.View>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.cprSub}>분당 {BPM}회 · 가슴 중앙을 약 5cm 깊이로</Text>
          <View style={styles.cprBtns}>
            <Pressable style={[styles.cprBtn, { backgroundColor: running ? colors.ink : colors.red }]} onPress={() => setRunning((r) => !r)}>
              <Text style={styles.cprBtnText}>{running ? '멈추기' : '리듬 시작'}</Text>
            </Pressable>
            <Pressable style={[styles.cprBtn, { backgroundColor: colors.bg }]} onPress={() => setCount(0)}>
              <Text style={[styles.cprBtnText, { color: colors.ink }]}>초기화</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setHaptic((h) => !h)} style={styles.hapticRow}>
            <Ionicons name={haptic ? 'phone-portrait' : 'phone-portrait-outline'} size={16} color={colors.muted} />
            <Text style={styles.hapticText}>진동 {haptic ? '켜짐' : '꺼짐'}</Text>
          </Pressable>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tip}>• 일반인은 인공호흡 없이 가슴압박만 해도 괜찮아요.</Text>
          <Text style={styles.tip}>• 지치면 2분마다 다른 사람과 교대하세요.</Text>
          <Text style={styles.tip}>• 구급대원이 도착할 때까지 멈추지 마세요.</Text>
        </View>

        <Text style={styles.disclaimer}>
          하트비트는 수업용 시제품입니다. 실제 응급 상황에서는 119 상황요원의 안내를 따르세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 22, marginBottom: 8 },
  callout: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.red, borderRadius: radius.card, padding: 14, marginTop: 12 },
  calloutText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  step: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 8 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.red, fontWeight: '800' },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  stepBody: { fontSize: 14, color: colors.muted, marginTop: 4, lineHeight: 20 },
  cpr: { backgroundColor: '#fff', borderRadius: radius.card, padding: 20, alignItems: 'center' },
  count: { fontSize: 40, fontWeight: '800', color: colors.ink, marginTop: 4 },
  cprSub: { fontSize: 14, color: colors.muted },
  cprBtns: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  cprBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cprBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  hapticRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  hapticText: { color: colors.muted, fontSize: 13 },
  tips: { backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginTop: 10, gap: 6 },
  tip: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  disclaimer: { fontSize: 12, color: colors.muted, marginTop: 16, textAlign: 'center' },
});
