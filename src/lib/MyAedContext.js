import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'heartbeat.myAed.v1';
const MyAedContext = createContext(null);

// 내 AED 등록 정보를 기기에 저장하고 모든 탭에서 같이 쓴다.
export function MyAedProvider({ children }) {
  const [myAed, setMyAedState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setMyAedState(JSON.parse(v)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // fresh · 방금 새로 등록했다는 표시. 지도 탭이 받아서 새 핀으로 이동하고 지운다.
  const [fresh, setFresh] = useState(false);

  const setMyAed = (value) => {
    setMyAedState(value);
    const op = value ? AsyncStorage.setItem(KEY, JSON.stringify(value)) : AsyncStorage.removeItem(KEY);
    op.catch(() => {});
  };
  const registerAed = (value) => {
    setMyAed({ ...value, registeredAt: new Date().toISOString() });
    setFresh(true);
  };
  const consumeFresh = () => setFresh(false);

  return (
    <MyAedContext.Provider value={{ myAed, setMyAed, registerAed, fresh, consumeFresh, loaded }}>{children}</MyAedContext.Provider>
  );
}

export function useMyAed() {
  return useContext(MyAedContext);
}
