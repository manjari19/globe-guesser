import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Globe from 'react-globe.gl';

// ─── GeoJSON source ────────────────────────────────────────────────────────
const GEOJSON_URL =
  'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

const HIGHLIGHT_COLOR = 'rgba(0, 255, 150, 1.0)';
const HIGHLIGHT_BORDER = 'rgba(100, 255, 200, 1.0)';

function GlobeComponent({ isSpinning, targetCountry, onLanded, lightMode = false }, forwardedRef) {
  const globeRef = useRef(null);
  const containerRef = useRef(null);

  const gsRef = useRef({
    phase: 'idle',
    spinSpeed: 0,
    currentLat: 0,
    currentLng: 20,
    targetLat: 0,
    targetLng: 0,
    targetAlt: 1.5,
    flyStartLat: 0,
    flyStartLng: 0,
    flyStartAlt: 0,
    flyProgress: 0,
    onLandedFired: false,
    animId: null,
  });

  const [countries, setCountries] = useState({ features: [] });
  const [highlightFeature, setHighlight] = useState(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Load GeoJSON once
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => setCountries(data))
      .catch(err => console.warn('GeoJSON fetch failed:', err));
  }, []);

  // Keep globe responsive to viewport/container changes
  useEffect(() => {
    const updateSize = () => {
      const el = containerRef.current;
      if (!el) {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
        return;
      }

      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  const getCountrySizeAltitude = useCallback((feature) => {
    if (!feature?.geometry) return 1.5;

    const coords = [];

    const collectCoords = (geom) => {
      if (geom.type === 'Point') {
        coords.push(geom.coordinates);
      } else if (geom.type === 'LineString') {
        coords.push(...geom.coordinates);
      } else if (geom.type === 'Polygon') {
        coords.push(...geom.coordinates[0]);
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

    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    const diagonal = Math.sqrt(lngSpan * lngSpan + latSpan * latSpan);

    // More aggressive zoom for tiny countries
    if (diagonal < 1.5) return 0.12;
    if (diagonal < 3) return 0.18;
    if (diagonal < 5) return 0.28;
    if (diagonal < 15) return 0.6;
    if (diagonal < 30) return 0.95;
    return 1.3;
  }, []);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    if (!controls) return;

    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.zoomSpeed = 0.9;
    controls.rotateSpeed = 0.7;
    controls.panSpeed = 0.8;
    controls.minDistance = 100;
    controls.maxDistance = 800;

    globe.pointOfView({ lat: 0, lng: 20, altitude: 2.0 }, 0);
    setGlobeReady(true);
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    recenter: () => {
      if (globeRef.current && targetCountry) {
        const altitude = getCountrySizeAltitude(highlightFeature);
        globeRef.current.pointOfView(
          { lat: targetCountry.lat, lng: targetCountry.lng, altitude },
          1200
        );
      }
    },
  }), [targetCountry, highlightFeature, getCountrySizeAltitude]);

  useEffect(() => {
    if (!globeReady) return;
    const globe = globeRef.current;
    if (!globe) return;

    const g = gsRef.current;
    const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

    const tick = () => {
      g.animId = requestAnimationFrame(tick);
      const pov = globe.pointOfView();

      if (g.phase === 'spinning') {
        g.spinSpeed = Math.min(g.spinSpeed + 0.03, 1.3);
        g.currentLng = (g.currentLng + g.spinSpeed) % 360;
        globe.pointOfView({ lat: g.currentLat, lng: g.currentLng, altitude: 2.0 }, 0);
      }

      if (g.phase === 'decel') {
        g.spinSpeed *= 0.972;
        g.currentLng = (g.currentLng + g.spinSpeed) % 360;
        globe.pointOfView({ lat: g.currentLat, lng: g.currentLng, altitude: 2.0 }, 0);

        if (g.spinSpeed < 0.018) {
          g.phase = 'fly';
          g.flyProgress = 0;
          g.flyStartLat = g.currentLat;
          g.flyStartLng = g.currentLng;
          g.flyStartAlt = pov.altitude;
        }
      }

      if (g.phase === 'fly') {
        g.flyProgress = Math.min(g.flyProgress + 0.008, 1);
        const t = eio(g.flyProgress);

        let dLng = g.targetLng - g.flyStartLng;
        if (dLng > 180) dLng -= 360;
        if (dLng < -180) dLng += 360;

        const lat = g.flyStartLat + (g.targetLat - g.flyStartLat) * t;
        const lng = g.flyStartLng + dLng * t;
        const alt = g.flyStartAlt + (g.targetAlt - g.flyStartAlt) * t;

        globe.pointOfView({ lat, lng, altitude: alt }, 0);
        g.currentLat = lat;
        g.currentLng = lng;

        if (g.flyProgress >= 1 && !g.onLandedFired) {
          g.phase = 'landed';
          g.onLandedFired = true;
          setTimeout(() => {
            if (window.__globeOnLanded) window.__globeOnLanded();
          }, 100);
        }
      }
    };

    tick();
    return () => {
      if (g.animId) cancelAnimationFrame(g.animId);
    };
  }, [globeReady]);

  useEffect(() => {
    window.__globeOnLanded = onLanded;
  }, [onLanded]);

  useEffect(() => {
    if (!isSpinning) return;
    const g = gsRef.current;
    g.phase = 'spinning';
    g.spinSpeed = 0;
    g.onLandedFired = false;
    setHighlight(null);
  }, [isSpinning]);

  useEffect(() => {
    if (!targetCountry || countries.features.length === 0) return;

    const g = gsRef.current;

    g.targetLat = targetCountry.lat;
    g.targetLng = targetCountry.lng;

    if (g.phase === 'spinning' || g.phase === 'idle') {
      g.phase = 'decel';
    }

    const name = targetCountry.name.trim().toLowerCase();
    
    // Improved matching with better accuracy
    const match = countries.features.find(f => {
      if (!f?.properties) return false;
      const p = f.properties;

      // Collect all possible name fields
      const candidates = [
        p.ADMIN,
        p.admin,
        p.NAME,
        p.name,
        p.NAME_LONG,
        p.name_long,
        p.FORMAL_EN,
        p.SOVEREIGNT,
        p.sovereignt,
        p.NAME_EN,
        p.name_en
      ]
        .filter(Boolean)
        .map(n => {
          if (typeof n !== 'string') return '';
          return n.trim().toLowerCase();
        });

      // Exact match first (best match)
      if (candidates.includes(name)) return true;
      
      // Then try substring matching
      return candidates.some(n =>
        n === name ||
        n.includes(name) ||
        name.includes(n)
      );
    });

    console.log("Target:", targetCountry.name, "Candidates found:", countries.features.length);
    if (match) {
      console.log("Matched feature:", match.properties.ADMIN || match.properties.NAME || match.properties.name);
    } else {
      console.log("No match found - checking first few entries...");
      console.log(countries.features.slice(0, 2).map(f => ({ admin: f.properties.ADMIN, name: f.properties.NAME })));
    }

    setHighlight(match ?? null);

    g.targetAlt = match
      ? getCountrySizeAltitude(match)
      : 1.35;

  }, [targetCountry, countries, getCountrySizeAltitude]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        background: lightMode ? 'linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 50%, #dbeafe 100%)' : 'transparent',
      }}
    >
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        globeImageUrl={lightMode ? "https://unpkg.com/three-globe/example/img/earth-day.jpg" : "https://unpkg.com/three-globe/example/img/earth-night.jpg"}
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl={lightMode ? "//unpkg.com/three-globe/example/img/blue-marble.png" : "//unpkg.com/three-globe/example/img/night-sky.png"}
        atmosphereColor={lightMode ? "#87ceeb" : "#4fa3ff"}
        atmosphereAltitude={0.15}
        polygonsData={highlightFeature ? [highlightFeature] : []}
        polygonCapColor={() => HIGHLIGHT_COLOR}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => HIGHLIGHT_BORDER}
        polygonAltitude={0.08}
        onGlobeReady={handleGlobeReady}
        animateIn={false}
        rendererConfig={{ antialias: true, alpha: true }}
      />
    </div>
  );
}

export default forwardRef(GlobeComponent);