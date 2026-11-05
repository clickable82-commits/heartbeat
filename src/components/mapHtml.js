import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';

// 안드로이드 지도(WebView) 안에서 도는 페이지. RN 쪽에서 window.__hb.update(state)로 상태를 내려보낸다.
const PAGE_JS = `
(function () {
  var post = function (m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
  };
  var map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.25 });
  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap contributors').addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var shapes = L.layerGroup().addTo(map);
  var markers = {};
  var inited = false;
  map.on('click', function () { post({ type: 'press' }); });
  map.on('dragstart', function () { post({ type: 'drag' }); });
  map.on('moveend', function () {
    if (!inited) return;
    var c = map.getCenter(), b = map.getBounds();
    post({ type: 'region', region: {
      latitude: c.lat, longitude: c.lng,
      latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest(),
    } });
  });

  function boundsOf(r) {
    return [
      [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
      [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
    ];
  }
  function flyTo(r, ms) {
    if (!inited) return;
    map.flyToBounds(boundsOf(r), { duration: Math.max(0.01, (ms || 0) / 1000) });
  }

  function setEnabled(handler, on) {
    if (on) handler.enable(); else handler.disable();
  }

  function update(s) {
    if (!inited) {
      if (map.getSize().y === 0) { setTimeout(function () { update(s); }, 50); return; }
      map.fitBounds(boundsOf(s.region), { animate: false });
      inited = true;
      map.fire('moveend');
    }
    setEnabled(map.dragging, s.scroll);
    setEnabled(map.touchZoom, s.zoom);
    setEnabled(map.doubleClickZoom, s.zoom);
    setEnabled(map.scrollWheelZoom, s.zoom);

    var seen = {};
    s.markers.forEach(function (m, i) {
      seen[m.id] = true;
      var sig = m.html + '|' + m.w + '|' + (m.title || '') + '|' + m.press;
      var cur = markers[m.id];
      if (cur && cur.sig === sig) {
        cur.mk.setLatLng([m.lat, m.lng]);
        cur.mk.setZIndexOffset(i * 1000);
        return;
      }
      if (cur) map.removeLayer(cur.mk);
      var mk = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: 'hb', html: m.html, iconSize: [m.w, m.h], iconAnchor: [m.ax, m.ay] }),
        zIndexOffset: i * 1000,
        interactive: !!(m.press || m.title),
        keyboard: false,
      }).addTo(map);
      if (m.press) mk.on('click', function () { post({ type: 'marker', id: m.id }); });
      else if (m.title) mk.bindPopup(m.title, { closeButton: false, offset: [m.w / 2 - m.ax, 6 - m.ay] });
      markers[m.id] = { mk: mk, sig: sig };
    });
    Object.keys(markers).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(markers[id].mk); delete markers[id]; }
    });

    shapes.clearLayers();
    s.circles.forEach(function (c) {
      L.circle([c.lat, c.lng], {
        radius: c.radius, color: c.stroke, weight: c.weight, opacity: 1,
        fillColor: c.fill, fillOpacity: 1, interactive: false,
      }).addTo(shapes);
    });
    s.polylines.forEach(function (p) {
      L.polyline(p.coords, { color: p.color, weight: p.weight, dashArray: p.dash, interactive: false }).addTo(shapes);
    });
  }

  window.__hb = { update: update, flyTo: flyTo };
  post({ type: 'ready' });
})();
`;

export const MAP_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
${LEAFLET_CSS}
html, body, #map { height: 100%; margin: 0; padding: 0; background: #E8EAED; }
.hb { background: none; border: none; }
.hb-pin { box-sizing: border-box; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,.35); }
.hb-pin svg { display: block; }
.leaflet-control-attribution { font-size: 9px; }
.leaflet-popup-content { margin: 8px 12px; font: 600 13px sans-serif; }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>${PAGE_JS}</script>
</body>
</html>`;
