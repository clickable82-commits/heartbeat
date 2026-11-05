import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const ICON = { public: 'medkit', home: 'home', car: 'car', mine: 'heart' };
const COLOR = { public: colors.publicAed, home: colors.homeAed, car: colors.carAed, mine: colors.mine };

// 지도 위 AED 핀: 종류별 색 + 아이콘
export default function AedPin({ kind, dim = false, size = 30 }) {
  return (
    <View style={[styles.pin, { backgroundColor: COLOR[kind], width: size, height: size, borderRadius: size / 2, opacity: dim ? 0.45 : 1 }]}>
      <Ionicons name={ICON[kind]} size={size * 0.55} color="#fff" />
    </View>
  );
}

export const kindColor = COLOR;

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
