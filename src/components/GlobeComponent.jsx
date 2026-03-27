import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';

// ─── GeoJSON source (same dataset Globle uses) ────────────────────────────
const GEOJSON_URL =
  'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// ─── Highlight colour ─────────────────────────────────────────────────────
// Teal-mint: contrasts with the dark night-earth, harmonises with the
// existing blue (#4fa3ff) accent without clashing.
const HIGHLIGHT_COLOR   = 'rgba(0, 255, 200, 0.75)';
const HIGHLIGHT_BORDER  = 'rgba(0, 255, 200, 1.0)';

// ─── Component ────────────────────────────────────────────────────────────
export default function GlobeComponent({ isSpinning, targetCountry, onLanded }) {
  const globeRef  = useRef(null);
  const gsRef     = useRef({
    phase:          'idle',
    spinSpeed:      0,
    currentLat:     0,
    currentLng:     20,
    targetLat:      0,
    targetLng:      0,
    targetAlt:      1.5,
    flyStartLat:    0,
    flyStartLng:    0,
    flyStartAlt:    0,
    flyProgress:    0,
    onLandedFired:  false,
    animId:         null,
  });

  const [countries, setCountries]         = useState({ features: [] });
  const [highlightFeature, setHighlight]  = useState(null);
  const [globeReady, setGlobeReady]       = useState(false);

  // Load GeoJSON once
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => setCountries(data))
      .catch(err => console.warn('GeoJSON fetch failed:', err));
  }, []);

  // ── Calculate country size from GeoJSON bounds ────────────────────────
  const getCountrySizeAltitude = useCallback((feature) => {
    if (!feature?.geometry) return 1.5; // default zoom level
    
    const coords = [];
    const collectCoords = (geom) => {
      if (geom.type === 'Point') {
        coords.push(geom.coordinates);
      } else if (geom.type === 'LineString') {
        coords.push(...geom.coordinates);
      } else if (geom.type === 'Polygon') {
        coords.push(...geom.coordinates[0]); // outer ring only
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => coords.push(...poly[0]));
      } else if (geom.type === 'MultiPoint' || geom.type === 'MultiLineString') {
        geom.coordinates.forEach(c => {
          if (Array.isArray(c[0])) coords.push(...c);
          else coords.push(c);
        });
      }
    };
    
    collectCoords(feature.geometry);
    
    if (coords.length === 0) return 1.5;
    
    // Calculate bounding box
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    // Calculate diagonal of bounding box in degrees
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const diagonal = Math.sqrt(lngSpan * lngSpan + latSpan * latSpan);
    
    // Map country size to altitude (smaller countries = lower altitude = more zoom)
    // diagonal < 5: very small (0.5 altitude)
    // diagonal 5-15: small (0.8 altitude)
    // diagonal 15-30: medium (1.2 altitude)
    // diagonal 30+: large (1.5 altitude)
    if (diagonal < 5) return 0.5;
    if (diagonal < 15) return 0.8;
    if (diagonal < 30) return 1.2;
    return 1.5;
  }, []);

  // ── Globe-ready callback ──────────────────────────────────────────────
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    // Configure controls: allow zoom only
    controls.enableZoom    = true;
    controls.enableRotate  = false;
    controls.enablePan     = false;
    controls.autoRotate    = false;

    // Start at a pleasing angle
    globe.pointOfView({ lat: 0, lng: 20, altitude: 2.0 }, 0);
    setGlobeReady(true);
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeReady) return;
    const globe = globeRef.current;
    if (!globe) return;

    const g   = gsRef.current;
    const eio = t => t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2;

    const tick = () => {
      g.animId = requestAnimationFrame(tick);
      const pov = globe.pointOfView();

      if (g.phase === 'spinning') {
        g.spinSpeed  = Math.min(g.spinSpeed + 0.03, 1.3);   // deg/frame
        g.currentLng = (g.currentLng + g.spinSpeed) % 360;
        globe.pointOfView({ lat: g.currentLat, lng: g.currentLng, altitude: 2.0 }, 0);
      }

      if (g.phase === 'decel') {
        g.spinSpeed  *= 0.972;
        g.currentLng  = (g.currentLng + g.spinSpeed) % 360;
        globe.pointOfView({ lat: g.currentLat, lng: g.currentLng, altitude: 2.0 }, 0);

        if (g.spinSpeed < 0.018) {
          g.phase       = 'fly';
          g.flyProgress = 0;
          g.flyStartLat = g.currentLat;
          g.flyStartLng = g.currentLng;
          g.flyStartAlt = pov.altitude;
        }
      }

      if (g.phase === 'fly') {
        g.flyProgress = Math.min(g.flyProgress + 0.008, 1);
        const t = eio(g.flyProgress);

        // Shortest-path longitude
        let dLng = g.targetLng - g.flyStartLng;
        if (dLng >  180) dLng -= 360;
        if (dLng < -180) dLng += 360;

        const lat = g.flyStartLat + (g.targetLat - g.flyStartLat) * t;
        const lng = g.flyStartLng + dLng * t;
        const alt = g.flyStartAlt + (g.targetAlt - g.flyStartAlt) * t;

        globe.pointOfView({ lat, lng, altitude: alt }, 0);
        g.currentLat = lat;
        g.currentLng = lng;

        if (g.flyProgress >= 1 && !g.onLandedFired) {
          g.phase         = 'landed';
          g.onLandedFired = true;
          setTimeout(() => { if (window.__globeOnLanded) window.__globeOnLanded(); }, 100);
        }
      }
    };

    tick();
    return () => { if (g.animId) cancelAnimationFrame(g.animId); };
  }, [globeReady]);

  // Stable onLanded reference
  useEffect(() => { window.__globeOnLanded = onLanded; }, [onLanded]);

  // ── Spin start ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSpinning) return;
    const g = gsRef.current;
    g.phase         = 'spinning';
    g.spinSpeed     = 0;
    g.onLandedFired = false;
    setHighlight(null);
  }, [isSpinning]);

  // ── New target country ────────────────────────────────────────────────
  useEffect(() => {
    if (!targetCountry) return;
    const g = gsRef.current;

    g.targetLat = targetCountry.lat;
    g.targetLng = targetCountry.lng;
    if (g.phase === 'spinning' || g.phase === 'idle') g.phase = 'decel';

    // Find the matching GeoJSON feature for highlight
    if (countries.features.length > 0) {
      const name  = targetCountry.name.toLowerCase();
      const match = countries.features.find(f => {
        const p = f.properties;
        return [p.ADMIN, p.NAME, p.NAME_LONG, p.FORMAL_EN]
          .some(n => n?.toLowerCase() === name);
      });
      setHighlight(match ?? null);
      // Calculate appropriate zoom level based on country size
      g.targetAlt = match ? getCountrySizeAltitude(match) : 1.5;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCountry, countries]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Globe
        ref={globeRef}
        width={window.innerWidth}
        height={window.innerHeight}

        // ── Visuals ──────────────────────────────────────────────────
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4fa3ff"
        atmosphereAltitude={0.15}

        // ── Country polygon highlight ─────────────────────────────────
        polygonsData={highlightFeature ? [highlightFeature] : []}
        polygonCapColor={() => HIGHLIGHT_COLOR}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => HIGHLIGHT_BORDER}
        polygonAltitude={0.005}

        // ── Events ────────────────────────────────────────────────────
        onGlobeReady={handleGlobeReady}

        // ── Performance ───────────────────────────────────────────────
        animateIn={false}
        rendererConfig={{ antialias: true, alpha: true }}
      />
    </div>
  );
}