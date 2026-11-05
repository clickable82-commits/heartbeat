import { Children, Fragment, forwardRef, isValidElement, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';
import AedPin, { kindColor } from './AedPin';
import { MAP_HTML } from './mapHtml';

// 안드로이드용 지도: 구글 지도 API 키 없이 쓰려고 WebView + Leaflet(OpenStreetMap 타일)으로 그린다.
// 화면 코드는 react-native-maps와 같은 JSX(MapView / Marker / Circle / Polyline)를 그대로 쓴다.

// 핀 안에 들어가는 아이콘 (24x24, 흰색)
const HEART = 'M12 20.5 4.2 12.6a4.9 4.9 0 0 1 7-6.9l.8.8.8-.8a4.9 4.9 0 0 1 7 6.9z';
const ICONS = {
  public: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  home: '<path d="M12 3 2.5 11.5H5V20h5v-5.5h4V20h5v-8.5h2.5z"/>',
  car: '<path fill-rule="evenodd" d="M5.5 6.5h13l2 5.5v6.5h-3V17h-11v1.5h-3V12zM7.2 8.5l-1 3h11.6l-1-3zM6.6 13.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm10.8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>',
  mine: `<path d="${HEART}"/>`,
  'heart-dislike': (bg) =>
    `<path d="${HEART}"/><path d="M4.5 3.5l15 17" stroke="${bg}" stroke-width="3.2" stroke-linecap="round"/><path d="M4.5 3.5l15 17" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
};

function pinHtml({ color, icon, size, dim = false, border = 2 }) {
  const glyph = typeof ICONS[icon] === 'function' ? ICONS[icon](color) : (ICONS[icon] ?? '');
  const s = Math.round(size * 0.55);
  return (
    `<div class="hb-pin" style="width:${size}px;height:${size}px;background:${color};border-width:${border}px;opacity:${dim ? 0.45 : 1}">` +
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="#fff">${glyph}</svg></div>`
  );
}

function defaultPinHtml(color) {
  return (
    `<svg width="26" height="36" viewBox="0 0 26 36"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.5 13 23 13 23s13-13.5 13-23C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
    `<circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>`
  );
}

function describeMarker(props, id) {
  const child = Children.toArray(props.children).find(isValidElement);
  let html, w, h;
  let anchor = props.anchor;
  if (props.androidPin) {
    w = h = props.androidPin.size ?? 30;
    html = pinHtml({ ...props.androidPin, size: w });
  } else if (child?.type === AedPin) {
    w = h = child.props.size ?? 30;
    html = pinHtml({ color: kindColor[child.props.kind], icon: child.props.kind, size: w, dim: child.props.dim });
  } else if (child) {
    w = h = 30;
    html = pinHtml({ color: colors.red, size: w });
  } else {
    w = 26;
    h = 36;
    html = defaultPinHtml(props.pinColor ?? colors.red);
    anchor = anchor ?? { x: 0.5, y: 1 };
  }
  anchor = anchor ?? { x: 0.5, y: 0.5 };
  return {
    id,
    lat: props.coordinate.latitude,
    lng: props.coordinate.longitude,
    html,
    w,
    h,
    ax: w * anchor.x,
    ay: h * anchor.y,
    title: props.title ?? null,
    press: !!props.onPress,
  };
}

// MapView의 자식(Marker / Circle / Polyline)을 WebView로 보낼 데이터로 바꾼다
function collect(children, out) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) {
      collect(c.props.children, out);
      return;
    }
    const p = c.props;
    if (c.type === Marker) {
      const id = c.key != null ? `k:${c.key}` : `i:${out.markers.length}`;
      out.markers.push(describeMarker(p, id));
      if (p.onPress) out.handlers[id] = p.onPress;
    } else if (c.type === Circle) {
      out.circles.push({
        lat: p.center.latitude,
        lng: p.center.longitude,
        radius: p.radius,
        stroke: p.strokeColor ?? colors.ink,
        fill: p.fillColor ?? 'rgba(0,0,0,0)',
        weight: p.strokeWidth ?? 1,
      });
    } else if (c.type === Polyline) {
      out.polylines.push({
        coords: p.coordinates.map((x) => [x.latitude, x.longitude]),
        color: p.strokeColor ?? colors.ink,
        weight: p.strokeWidth ?? 1,
        dash: p.lineDashPattern ? p.lineDashPattern.join(' ') : null,
      });
    }
  });
  return out;
}

export function Marker() {
  return null;
}
export function Circle() {
  return null;
}
export function Polyline() {
  return null;
}

// react-native-maps 와 같은 이름으로 · ref.animateToRegion(region, ms) · onRegionChangeComplete(region) · onPanDrag()
const MapView = forwardRef(function MapView(
  { style, initialRegion, onPress, onRegionChangeComplete, onPanDrag, scrollEnabled = true, zoomEnabled = true, children },
  ref,
) {
  const web = useRef(null);
  const ready = useRef(false);
  const { handlers, ...shapes } = collect(children, { markers: [], circles: [], polylines: [], handlers: {} });
  const state = JSON.stringify({ region: initialRegion, scroll: scrollEnabled, zoom: zoomEnabled, ...shapes });
  const latest = useRef({});
  latest.current = { state, handlers, onPress, onRegionChangeComplete, onPanDrag };

  const send = () => web.current?.injectJavaScript(`window.__hb && window.__hb.update(${latest.current.state});true;`);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r, ms = 500) =>
      web.current?.injectJavaScript(`window.__hb && window.__hb.flyTo(${JSON.stringify(r)}, ${ms});true;`),
  }));

  useEffect(() => {
    if (ready.current) send();
  }, [state]);

  const onMessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      ready.current = true;
      send();
    } else if (msg.type === 'marker') {
      latest.current.handlers[msg.id]?.();
    } else if (msg.type === 'press') {
      latest.current.onPress?.();
    } else if (msg.type === 'region') {
      latest.current.onRegionChangeComplete?.(msg.region);
    } else if (msg.type === 'drag') {
      latest.current.onPanDrag?.();
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={web}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        onMessage={onMessage}
        applicationNameForUserAgent="HeartBeatDemo/1.0"
        overScrollMode="never"
        setSupportMultipleWindows={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

export default MapView;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#E8EAED' },
  web: { flex: 1, backgroundColor: '#E8EAED' },
});
