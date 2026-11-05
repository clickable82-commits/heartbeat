import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

// 화면마다 "시연용"임을 밝혀 둔다 — 가짜 데이터를 진짜처럼 보이게 하지 않기 위해.
export default function DemoBadge({ text = '시연용 가상 데이터' }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>DEMO · {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4E5',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { color: '#9A5B00', fontSize: 11, fontWeight: '700' },
});
