import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import * as THREE from 'three';
import Nav from '@/components/Nav';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import PremiumLockOverlay from '@/components/PremiumLockOverlay';
import { isPremiumUser } from '@/lib/isPremiumUser';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobeMarket {
  city: string; state: string; lat: number; lng: number;
  score: number; price: number; yoy: number; dom: number;
  rentalYield: number; cap: number; inventory: number;
  flood: string; crime: string; walk: number; school: number;
  noise: string; air: string; trend: 'up' | 'down' | 'flat';
}

interface ThreeState {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  globeMesh: THREE.Mesh | null;
  markers: Array<{ market: GlobeMarket; ring: THREE.Mesh; dot: THREE.Mesh; spike: THREE.Mesh; ringMat: THREE.MeshBasicMaterial; phase: number }>;
  animFrame: number;
  isDragging: boolean;
  prevMouse: { x: number; y: number };
  targetRotX: number; targetRotY: number;
  currentRotX: number; currentRotY: number;
  cameraZ: number; targetCameraZ: number;
  flyTarget: { lat: number; lng: number } | null;
}

type ModalTab = 'signin' | 'pricing';

// ─── Base market data (fallback, overridden by Supabase) ──────────────────────

const BASE_MARKETS: GlobeMarket[] = [
  { city: 'Palm Springs', state: 'CA', lat: 33.83, lng: -116.54, score: 88, price: 980000,  yoy: 12.4, dom: 22, rentalYield: 5.1, cap: 4.8, inventory: 342,   flood: 'LOW',  crime: 'LOW', walk: 71, school: 8.2, noise: 'LOW',  air: 'GOOD', trend: 'up'   },
  { city: 'Los Angeles',  state: 'CA', lat: 34.05, lng: -118.24, score: 82, price: 1240000, yoy: 8.2,  dom: 31, rentalYield: 3.8, cap: 3.2, inventory: 8420,  flood: 'MED',  crime: 'MED', walk: 89, school: 7.4, noise: 'HIGH', air: 'MOD',  trend: 'up'   },
  { city: 'Miami',        state: 'FL', lat: 25.77, lng: -80.19,  score: 79, price: 890000,  yoy: 15.1, dom: 28, rentalYield: 6.2, cap: 5.4, inventory: 5210,  flood: 'HIGH', crime: 'MED', walk: 78, school: 6.8, noise: 'MED',  air: 'GOOD', trend: 'up'   },
  { city: 'New York',     state: 'NY', lat: 40.71, lng: -74.01,  score: 76, price: 1680000, yoy: 3.4,  dom: 45, rentalYield: 3.1, cap: 2.8, inventory: 18200, flood: 'MED',  crime: 'MED', walk: 98, school: 7.9, noise: 'HIGH', air: 'MOD',  trend: 'flat' },
  { city: 'Austin',       state: 'TX', lat: 30.27, lng: -97.74,  score: 85, price: 620000,  yoy: 6.8,  dom: 35, rentalYield: 5.8, cap: 5.2, inventory: 4100,  flood: 'LOW',  crime: 'LOW', walk: 52, school: 8.6, noise: 'LOW',  air: 'GOOD', trend: 'up'   },
  { city: 'Seattle',      state: 'WA', lat: 47.61, lng: -122.33, score: 83, price: 940000,  yoy: 9.1,  dom: 19, rentalYield: 4.2, cap: 3.9, inventory: 2890,  flood: 'LOW',  crime: 'MED', walk: 93, school: 8.1, noise: 'MED',  air: 'GOOD', trend: 'up'   },
  { city: 'Nashville',    state: 'TN', lat: 36.17, lng: -86.78,  score: 87, price: 540000,  yoy: 11.2, dom: 24, rentalYield: 6.4, cap: 5.8, inventory: 2100,  flood: 'LOW',  crime: 'LOW', walk: 28, school: 7.2, noise: 'LOW',  air: 'GOOD', trend: 'up'   },
  { city: 'Denver',       state: 'CO', lat: 39.74, lng: -104.99, score: 81, price: 710000,  yoy: 7.4,  dom: 28, rentalYield: 4.9, cap: 4.4, inventory: 3200,  flood: 'LOW',  crime: 'LOW', walk: 61, school: 7.8, noise: 'LOW',  air: 'MOD',  trend: 'flat' },
  { city: 'Phoenix',      state: 'AZ', lat: 33.45, lng: -112.07, score: 78, price: 480000,  yoy: 5.2,  dom: 38, rentalYield: 5.5, cap: 5.1, inventory: 6800,  flood: 'LOW',  crime: 'MED', walk: 41, school: 6.9, noise: 'LOW',  air: 'MOD',  trend: 'down' },
  { city: 'Chicago',      state: 'IL', lat: 41.88, lng: -87.63,  score: 71, price: 390000,  yoy: 2.1,  dom: 52, rentalYield: 6.8, cap: 6.2, inventory: 9400,  flood: 'MED',  crime: 'HIGH',walk: 87, school: 6.4, noise: 'HIGH', air: 'MOD',  trend: 'flat' },
  { city: 'Boston',       state: 'MA', lat: 42.36, lng: -71.06,  score: 80, price: 820000,  yoy: 6.1,  dom: 22, rentalYield: 3.9, cap: 3.5, inventory: 2100,  flood: 'MED',  crime: 'LOW', walk: 92, school: 8.8, noise: 'MED',  air: 'GOOD', trend: 'up'   },
  { city: 'Scottsdale',   state: 'AZ', lat: 33.49, lng: -111.92, score: 89, price: 1100000, yoy: 13.8, dom: 19, rentalYield: 5.6, cap: 4.9, inventory: 1850,  flood: 'LOW',  crime: 'LOW', walk: 44, school: 8.4, noise: 'LOW',  air: 'GOOD', trend: 'up'   },
  { city: 'San Francisco',state: 'CA', lat: 37.77, lng: -122.42, score: 74, price: 1450000, yoy: -2.4, dom: 48, rentalYield: 2.8, cap: 2.4, inventory: 3100,  flood: 'MED',  crime: 'HIGH',walk: 96, school: 7.6, noise: 'HIGH', air: 'GOOD', trend: 'down' },
  { city: 'Las Vegas',    state: 'NV', lat: 36.17, lng: -115.14, score: 76, price: 420000,  yoy: 8.9,  dom: 32, rentalYield: 7.1, cap: 6.4, inventory: 5600,  flood: 'LOW',  crime: 'MED', walk: 42, school: 6.1, noise: 'MED',  air: 'MOD',  trend: 'up'   },
  { city: 'London',       state: 'UK', lat: 51.51, lng: -0.13,   score: 77, price: 1820000, yoy: 4.2,  dom: 55, rentalYield: 3.1, cap: 2.7, inventory: 24000, flood: 'MED',  crime: 'MED', walk: 94, school: 7.8, noise: 'HIGH', air: 'MOD',  trend: 'flat' },
  { city: 'Dubai',        state: 'UAE',lat: 25.20, lng: 55.27,   score: 84, price: 980000,  yoy: 18.2, dom: 21, rentalYield: 6.8, cap: 6.1, inventory: 8900,  flood: 'LOW',  crime: 'LOW', walk: 55, school: 7.2, noise: 'MED',  air: 'MOD',  trend: 'up'   },
  { city: 'Sydney',       state: 'AU', lat: -33.87,lng: 151.21,  score: 81, price: 1340000, yoy: 7.9,  dom: 34, rentalYield: 3.6, cap: 3.1, inventory: 6200,  flood: 'MED',  crime: 'LOW', walk: 71, school: 8.1, noise: 'MED',  air: 'GOOD', trend: 'up'   },
  { city: 'Singapore',    state: 'SG', lat: 1.35,  lng: 103.82,  score: 91, price: 2100000, yoy: 9.4,  dom: 18, rentalYield: 2.9, cap: 2.5, inventory: 3400,  flood: 'LOW',  crime: 'LOW', walk: 88, school: 9.4, noise: 'MED',  air: 'GOOD', trend: 'up'   },
  { city: 'Toronto',      state: 'CA', lat: 43.65, lng: -79.38,  score: 78, price: 1080000, yoy: 5.6,  dom: 29, rentalYield: 3.4, cap: 3.0, inventory: 7800,  flood: 'LOW',  crime: 'LOW', walk: 72, school: 8.0, noise: 'MED',  air: 'GOOD', trend: 'flat' },
  { city: 'Tokyo',        state: 'JP', lat: 35.69, lng: 139.69,  score: 86, price: 1620000, yoy: 6.8,  dom: 38, rentalYield: 3.2, cap: 2.9, inventory: 42000, flood: 'MED',  crime: 'LOW', walk: 95, school: 8.9, noise: 'HIGH', air: 'MOD',  trend: 'up'   },
];

// Supabase geo_key → city name mapping
const GEO_KEY_MAP: Record<string, string> = {
  'palm-springs-ca': 'Palm Springs',
  'los-angeles-ca':  'Los Angeles',
  'miami-fl':        'Miami',
  'austin-tx':       'Austin',
  'seattle-wa':      'Seattle',
  'nashville-tn':    'Nashville',
  'denver-co':       'Denver',
  'phoenix-az':      'Phoenix',
  'chicago-il':      'Chicago',
  'scottsdale-az':   'Scottsdale',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 85) return '#00ff88';
  if (s >= 75) return '#88ffcc';
  if (s >= 65) return '#ffb700';
  if (s >= 50) return '#ff8844';
  return '#ff3355';
}

function scoreGrade(s: number) {
  if (s >= 90) return 'A+';
  if (s >= 85) return 'A';
  if (s >= 80) return 'B+';
  if (s >= 75) return 'B';
  if (s >= 70) return 'C+';
  if (s >= 65) return 'C';
  return 'D';
}

function fmt(n: number) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'K';
  return '$' + n;
}

function latLngToVec3(lat: number, lng: number, r: number) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const NAV_H   = 64;
const MONO    = "'Share Tech Mono', monospace";
const UI      = "'Rajdhani', sans-serif";
const G       = '#00ff88';
const R       = '#ff3355';
const GOLD    = '#ffb700';
const BG      = 'rgba(4,12,20,0.92)';
const BORDER  = 'rgba(0,255,136,0.2)';
const T_M     = 'rgba(180,220,200,0.5)';
const T_P     = '#e8f4f0';

const GRADIENT_ALPHA: Record<string, string> = {
  '#00ff88': 'rgba(0,255,136,0.15)',
  '#88ffcc': 'rgba(136,255,204,0.15)',
  '#ffb700': 'rgba(255,183,0,0.15)',
  '#ff8844': 'rgba(255,136,68,0.15)',
  '#ff3355': 'rgba(255,51,85,0.15)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TerraGraph() {
  const { tier } = useAuth();
  const [modalOpen,   setModalOpen]   = useState(false);
  const [modalTab,    setModalTab]    = useState<ModalTab>('signin');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [premium,     setPremium]     = useState(false);
  const [markets,     setMarkets]     = useState<GlobeMarket[]>(BASE_MARKETS);
  const [selected,    setSelected]    = useState<GlobeMarket | null>(null);
  const [showLoading, setShowLoading] = useState(true);
  const [clock,       setClock]       = useState('');
  const [mode,        setMode]        = useState<'global' | 'national' | 'regional'>('global');
  const [timeframe,   setTimeframe]   = useState<'1Y' | '3Y' | '5Y' | '10Y'>('1Y');

  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const scoreCanvasRef  = useRef<HTMLCanvasElement>(null);
  const sparkCanvasRef  = useRef<HTMLCanvasElement>(null);
  const searchInputRef  = useRef<HTMLInputElement>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const marketsRef      = useRef<GlobeMarket[]>(BASE_MARKETS);
  const selectedRef     = useRef<GlobeMarket | null>(null);
  const timeframeRef    = useRef<'1Y' | '3Y' | '5Y' | '10Y'>('1Y');

  const three = useRef<ThreeState>({
    renderer: null, scene: null, camera: null, globeMesh: null, markers: [],
    animFrame: 0, isDragging: false, prevMouse: { x: 0, y: 0 },
    targetRotX: 0, targetRotY: -2.0, currentRotX: 0, currentRotY: -2.0,
    cameraZ: 2.8, targetCameraZ: 2.8, flyTarget: null,
  });

  // ── Side effects ────────────────────────────────────────────────────────────

  useEffect(() => { marketsRef.current = markets; }, [markets]);
  // Use live auth tier — covers direct navigation where sessionStorage isn't populated yet
  useEffect(() => { setPremium(isPremiumUser() || tier !== 'free'); }, [tier]);

  // Load TerraGraph fonts into document head
  useEffect(() => {
    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Prevent body scroll while globe is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Clock tick
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch live market data from Supabase
  useEffect(() => {
    supabase
      .from('market_snapshots')
      .select('geo_key,median_price,appreciation_rate_yoy,demand_score,days_on_market,active_listings')
      .eq('geo_type', 'city')
      .order('snapshot_date', { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const seen = new Set<string>();
        const updates: Record<string, Partial<GlobeMarket>> = {};
        for (const r of data) {
          if (seen.has(r.geo_key)) continue;
          seen.add(r.geo_key);
          const city = GEO_KEY_MAP[r.geo_key];
          if (!city) continue;
          const price = Number(r.median_price) || 0;
          if (!price) continue;
          updates[city] = {
            price,
            yoy:       Number(r.appreciation_rate_yoy) || undefined,
            score:     Math.min(100, Math.max(0, Number(r.demand_score) || 0)) || undefined,
            dom:       Number(r.days_on_market)   || undefined,
            inventory: Number(r.active_listings)  || undefined,
          };
        }
        if (!Object.keys(updates).length) return;
        const merged = BASE_MARKETS.map(m => {
          const u = updates[m.city];
          if (!u) return m;
          const patch = Object.fromEntries(Object.entries(u).filter(([, v]) => v != null && v !== 0));
          return { ...m, ...patch };
        });
        marketsRef.current = merged;
        setMarkets(merged);
      });
  }, []);

  // Loading timer — hide after 2.6s
  useEffect(() => {
    const t = setTimeout(() => setShowLoading(false), 2600);
    return () => clearTimeout(t);
  }, []);

  // Init Three.js globe after loading screen fades
  useEffect(() => {
    if (showLoading || !canvasRef.current || !globeContainerRef.current) return;
    const canvas    = canvasRef.current;
    const container = globeContainerRef.current;
    const W = window.innerWidth;
    const H = window.innerHeight - NAV_H;
    canvas.width  = W;
    canvas.height = H;

    const t = three.current;
    if (t.renderer) t.renderer.dispose();
    cancelAnimationFrame(t.animFrame);

    // Renderer
    t.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    t.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    t.renderer.setSize(W, H);
    t.renderer.setClearColor(0x000000, 0);

    // Scene & Camera
    t.scene  = new THREE.Scene();
    t.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    t.camera.position.z = 2.8;

    // Star field
    const starPos = new Float32Array(9000);
    for (let i = 0; i < 9000; i++) starPos[i] = (Math.random() - 0.5) * 100;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    t.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x334433, size: 0.08 })));

    // Earth texture (canvas-drawn)
    const texEl = document.createElement('canvas');
    texEl.width = 2048; texEl.height = 1024;
    const tc = texEl.getContext('2d')!;
    tc.fillStyle = '#020d18';
    tc.fillRect(0, 0, 2048, 1024);
    tc.strokeStyle = 'rgba(0,255,136,0.08)';
    tc.lineWidth = 1;
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = (90 - lat) / 180 * 1024;
      tc.beginPath(); tc.moveTo(0, y); tc.lineTo(2048, y); tc.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 20) {
      const x = (lng + 180) / 360 * 2048;
      tc.beginPath(); tc.moveTo(x, 0); tc.lineTo(x, 1024); tc.stroke();
    }
    const drawCont = (pts: [number, number][]) => {
      tc.fillStyle = 'rgba(10,30,20,0.95)';
      tc.beginPath();
      pts.forEach(([lo, la], i) => {
        const x = (lo + 180) / 360 * 2048, y = (90 - la) / 180 * 1024;
        i === 0 ? tc.moveTo(x, y) : tc.lineTo(x, y);
      });
      tc.closePath(); tc.fill();
      tc.strokeStyle = 'rgba(0,255,136,0.15)'; tc.lineWidth = 1.5; tc.stroke();
    };
    drawCont([[-168,72],[-140,70],[-130,55],[-124,49],[-120,32],[-117,32],[-97,26],[-88,16],[-83,10],[-77,8],[-80,15],[-88,16],[-90,20],[-85,30],[-80,35],[-75,45],[-65,44],[-52,47],[-55,52],[-64,60],[-90,68],[-110,72],[-130,72],[-145,70],[-168,72]]);
    drawCont([[-80,12],[-62,12],[-50,5],[-35,-5],[-35,-15],[-42,-22],[-48,-28],[-52,-33],[-65,-55],[-68,-52],[-73,-45],[-75,-30],[-78,-2],[-80,12]]);
    drawCont([[-10,36],[5,36],[15,37],[28,40],[32,45],[30,50],[22,55],[10,55],[5,60],[-2,58],[-8,52],[-10,44],[-10,36]]);
    drawCont([[-18,15],[0,15],[10,5],[15,-5],[32,-28],[28,-35],[18,-35],[12,-18],[8,5],[2,5],[-2,6],[-18,15]]);
    drawCont([[25,42],[35,35],[45,25],[55,22],[80,10],[100,5],[120,20],[140,35],[145,42],[135,52],[120,55],[95,60],[75,55],[50,55],[30,52],[25,42]]);
    drawCont([[115,-20],[120,-20],[130,-15],[140,-18],[148,-38],[145,-40],[138,-37],[134,-32],[115,-32],[115,-20]]);

    // Globe mesh
    t.globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: new THREE.CanvasTexture(texEl),
        specular: new THREE.Color(0x002200),
        shininess: 15,
        emissive: new THREE.Color(0x001a00),
        emissiveIntensity: 0.3,
      }),
    );
    t.scene.add(t.globeMesh);

    // Atmosphere layers
    t.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 64), new THREE.MeshPhongMaterial({ color: 0x00ff88, side: THREE.BackSide, transparent: true, opacity: 0.06 })));
    t.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 32), new THREE.MeshPhongMaterial({ color: 0x00ff88, side: THREE.BackSide, transparent: true, opacity: 0.02 })));

    // Lights
    t.scene.add(new THREE.AmbientLight(0x223322, 0.4));
    const sun = new THREE.DirectionalLight(0x88ffaa, 1.2);
    sun.position.set(5, 3, 5);
    t.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x004422, 0.5);
    rim.position.set(-5, -2, -5);
    t.scene.add(rim);

    // Market markers
    t.markers = [];
    marketsRef.current.forEach(m => {
      const pos   = latLngToVec3(m.lat, m.lng, 1.015);
      const color = new THREE.Color(scoreColor(m.score));

      const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const ring    = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 32), ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      t.scene!.add(ring);

      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      dot.position.copy(pos);
      dot.lookAt(new THREE.Vector3(0, 0, 0));
      t.scene!.add(dot);

      const norm  = pos.clone().normalize();
      const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }));
      spike.position.copy(pos.clone().add(norm.clone().multiplyScalar(0.02)));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
      t.scene!.add(spike);

      t.markers.push({ market: m, ring, dot, spike, ringMat, phase: Math.random() * Math.PI * 2 });
    });

    // Animation loop
    const animate = () => {
      t.animFrame = requestAnimationFrame(animate);

      if (t.flyTarget) {
        const phi   = (90 - t.flyTarget.lat) * Math.PI / 180;
        const theta = -(t.flyTarget.lng + 180) * Math.PI / 180;
        t.targetRotX  = -(phi - Math.PI / 2);
        t.targetRotY  = theta;
        t.currentRotX += (t.targetRotX - t.currentRotX) * 0.04;
        t.currentRotY += (t.targetRotY - t.currentRotY) * 0.04;
        if (Math.abs(t.targetRotX - t.currentRotX) < 0.001 && Math.abs(t.targetRotY - t.currentRotY) < 0.001) {
          t.flyTarget = null;
        }
      } else if (!t.isDragging) {
        t.targetRotY  += 0.0008;
        t.currentRotX += (t.targetRotX - t.currentRotX) * 0.05;
        t.currentRotY += (t.targetRotY - t.currentRotY) * 0.05;
      } else {
        t.currentRotX += (t.targetRotX - t.currentRotX) * 0.15;
        t.currentRotY += (t.targetRotY - t.currentRotY) * 0.15;
      }

      if (t.globeMesh) {
        t.globeMesh.rotation.x = t.currentRotX;
        t.globeMesh.rotation.y = t.currentRotY;
      }

      t.cameraZ += (t.targetCameraZ - t.cameraZ) * 0.05;
      if (t.camera) t.camera.position.z = t.cameraZ;

      const now = Date.now() * 0.001;
      t.markers.forEach(mk => {
        const pulse = 0.5 + 0.5 * Math.sin(now * 2 + mk.phase);
        mk.ringMat.opacity = 0.2 + 0.5 * pulse;
        const s = 1 + 0.4 * pulse;
        mk.ring.scale.set(s, s, 1);
        if (t.globeMesh) {
          mk.ring.rotation.copy(t.globeMesh.rotation);
          mk.dot.rotation.copy(t.globeMesh.rotation);
          mk.spike.rotation.copy(t.globeMesh.rotation);
        }
      });

      if (t.renderer && t.scene && t.camera) t.renderer.render(t.scene, t.camera);
    };
    animate();

    // Globe drag/zoom — attached to the container so panels always win via z-index,
    // and we guard against clicks that originate inside a UI panel element.
    const isUIPanel = (el: EventTarget | null) => {
      if (!el || !(el instanceof Element)) return false;
      return el.closest('[data-globe-ui]') !== null;
    };

    const onDown  = (e: MouseEvent) => {
      if (isUIPanel(e.target)) return;
      t.isDragging = true;
      t.prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMove  = (e: MouseEvent) => {
      if (!t.isDragging) return;
      t.targetRotY  += (e.clientX - t.prevMouse.x) * 0.005;
      t.targetRotX  += (e.clientY - t.prevMouse.y) * 0.005;
      t.prevMouse    = { x: e.clientX, y: e.clientY };
    };
    const onUp    = () => { t.isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      if (isUIPanel(e.target)) return;
      t.targetCameraZ = Math.max(1.4, Math.min(5, t.targetCameraZ + e.deltaY * 0.003));
    };
    const onResize = () => {
      if (!t.camera || !t.renderer) return;
      const nW = window.innerWidth, nH = window.innerHeight - NAV_H;
      t.camera.aspect = nW / nH;
      t.camera.updateProjectionMatrix();
      t.renderer.setSize(nW, nH);
    };

    container.addEventListener('mousedown', onDown);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseup',   onUp);
    container.addEventListener('mouseleave',onUp);
    container.addEventListener('wheel',     onWheel, { passive: true });
    window.addEventListener('resize',       onResize);

    return () => {
      cancelAnimationFrame(t.animFrame);
      container.removeEventListener('mousedown', onDown);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseup',   onUp);
      container.removeEventListener('mouseleave',onUp);
      container.removeEventListener('wheel',     onWheel);
      window.removeEventListener('resize',       onResize);
      if (t.renderer) { t.renderer.dispose(); t.renderer = null; }
      t.markers.forEach(mk => {
        mk.ring.geometry.dispose();
        mk.dot.geometry.dispose();
        mk.spike.geometry.dispose();
        (mk.ring.material  as THREE.Material).dispose();
        (mk.dot.material   as THREE.Material).dispose();
        (mk.spike.material as THREE.Material).dispose();
      });
      t.markers = [];
    };
  }, [showLoading]);

  // Keep refs in sync for canvas drawing callbacks
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);

  // Draw (or redraw) the score ring — called imperatively
  const drawScoreRing = useCallback((m: GlobeMarket) => {
    const c = scoreCanvasRef.current;
    if (!c) return;
    const ctx   = c.getContext('2d')!;
    const color = scoreColor(m.score);
    const start = -Math.PI * 0.75;
    const end   = start + Math.PI * 1.5 * (m.score / 100);
    ctx.clearRect(0, 0, 120, 120);
    ctx.beginPath(); ctx.arc(60, 60, 50, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.strokeStyle = 'rgba(0,255,136,0.1)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(60, 60, 50, start, end);
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
  }, []);

  // Draw (or redraw) the sparkline — called imperatively
  const drawSparkline = useCallback((m: GlobeMarket, tf: string) => {
    const canvas = sparkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Use parent bounds for reliable dimensions
    const rect = canvas.parentElement?.getBoundingClientRect();
    const headerH = 32; // chart header height
    const W = rect ? Math.round(rect.width)  : 600;
    const H = rect ? Math.round(rect.height - headerH) : 88;
    canvas.width  = W;
    canvas.height = H;
    if (W <= 0 || H <= 0) return;

    const tfMult = tf === '3Y' ? 3 : tf === '5Y' ? 5 : tf === '10Y' ? 10 : 1;
    const pts = 13;
    const data = Array.from({ length: pts }, (_, i) => {
      const frac = (i - pts + 1) / (pts - 1) * tfMult;
      return m.price * (1 + frac * (m.yoy / 100) + (Math.random() - 0.5) * 0.018);
    });

    const mn  = Math.min(...data) * 0.99, mx = Math.max(...data) * 1.01;
    const pad = { l: 52, r: 16, t: 10, b: 18 };
    const W2  = W - pad.l - pad.r, H2 = H - pad.t - pad.b;
    const px  = (i: number) => pad.l + (i / (pts - 1)) * W2;
    const py  = (v: number) => pad.t + H2 - ((v - mn) / (mx - mn || 1)) * H2;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,255,136,0.06)'; ctx.lineWidth = 0.5;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      ctx.beginPath(); ctx.moveTo(pad.l, pad.t + H2 * (1 - f)); ctx.lineTo(W - pad.r, pad.t + H2 * (1 - f)); ctx.stroke();
    });

    const color = scoreColor(m.score);
    const grad  = ctx.createLinearGradient(0, pad.t, 0, pad.t + H2);
    grad.addColorStop(0, GRADIENT_ALPHA[color] || 'rgba(0,255,136,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(pts - 1), pad.t + H2); ctx.lineTo(pad.l, pad.t + H2);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath(); ctx.arc(px(pts - 1), py(data[pts - 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();

    ctx.fillStyle = T_M; ctx.font = '9px Share Tech Mono, monospace'; ctx.textAlign = 'right';
    [mn, (mn + mx) / 2, mx].forEach(v => ctx.fillText(fmt(v), pad.l - 4, py(v) + 3));
  }, []);

  // Redraw when selection changes
  useEffect(() => {
    if (!selected) return;
    drawScoreRing(selected);
    // defer sparkline one frame so canvas has layout dimensions
    requestAnimationFrame(() => drawSparkline(selected, timeframeRef.current));
  }, [selected, drawScoreRing, drawSparkline]);

  // Redraw sparkline when timeframe changes (selection stays the same)
  useEffect(() => {
    const m = selectedRef.current;
    if (!m) return;
    requestAnimationFrame(() => drawSparkline(m, timeframe));
  }, [timeframe, drawSparkline]);

  // ── Interactions ─────────────────────────────────────────────────────────────

  // Always reads from refs — no stale-closure risk
  const selectMarket = (city: string) => {
    const m = marketsRef.current.find(x => x.city === city);
    if (!m) return;
    setSelected(m);
    three.current.flyTarget     = { lat: m.lat, lng: m.lng };
    three.current.targetCameraZ = 1.6;
  };

  // Reads directly from the uncontrolled input element
  const handleSearch = () => {
    const q = (searchInputRef.current?.value ?? '').trim().toLowerCase();
    if (!q) return;
    const m = marketsRef.current.find(x =>
      x.city.toLowerCase().includes(q) || x.state.toLowerCase().includes(q)
    );
    if (m) selectMarket(m.city);
  };

  const zoomIn    = () => { three.current.targetCameraZ = Math.max(1.4, three.current.targetCameraZ - 0.4); };
  const zoomOut   = () => { three.current.targetCameraZ = Math.min(5,   three.current.targetCameraZ + 0.4); };
  const zoomReset = () => {
    three.current.targetCameraZ = 2.8;
    three.current.targetRotX    = 0;
    three.current.targetRotY    = -2.0;
    three.current.flyTarget     = null;
    setSelected(null);
  };

  const setViewMode = (m: typeof mode) => {
    setMode(m);
    if      (m === 'national') { three.current.flyTarget = { lat: 39, lng: -96 }; three.current.targetCameraZ = 1.8; }
    else if (m === 'global')   { three.current.targetCameraZ = 2.8; three.current.flyTarget = null; }
  };

  const sorted = [...markets].sort((a, b) => b.score - a.score);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => setPricingOpen(true)}
      />
      <AuthModal   isOpen={modalOpen}   initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* ── Loading overlay ── */}
      {showLoading && (
        <div style={{ position: 'fixed', inset: 0, background: '#020408', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: UI }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: G, letterSpacing: 4 }}>PROPERTYDNA</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T_M, letterSpacing: 4 }}>TERRAGRAPH AI — INITIALIZING</div>
          <div style={{ width: 280, height: 2, background: 'rgba(0,255,136,0.1)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: G, boxShadow: `0 0 10px ${G}`, animation: 'tg-load 2.5s ease-out forwards' }} />
          </div>
        </div>
      )}

      {/* ── Globe UI (shown after loading) ── */}
      {!showLoading && (
        <div ref={globeContainerRef} style={{ position: 'fixed', top: NAV_H, left: 0, right: 0, bottom: 0, background: '#020408', overflow: 'hidden', zIndex: 10 }}>

          {/* Three.js canvas */}
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

          {/* ── LEFT PANEL: Market Rankings ── */}
          <div data-globe-ui style={{ position: 'absolute', top: 0, left: 0, bottom: 40, width: 260, background: BG, borderRight: `1px solid ${BORDER}`, zIndex: 90, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: 3, color: G, fontFamily: MONO, textTransform: 'uppercase' }}>
              Market Rankings
            </div>
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>
              {sorted.map((m, i) => {
                const locked = !premium && i >= 3;
                return (
                  <div
                    key={m.city}
                    onClick={() => !locked && selectMarket(m.city)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 16px',
                      borderBottom: '1px solid rgba(0,255,136,0.05)',
                      cursor: locked ? 'default' : 'pointer', gap: 10,
                      background: selected?.city === m.city ? 'rgba(0,255,136,0.08)' : 'transparent',
                      borderLeft: `2px solid ${selected?.city === m.city ? G : 'transparent'}`,
                      filter: locked ? 'blur(4px)' : 'none',
                      userSelect: locked ? 'none' : 'auto',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 10, color: T_M, width: 18, textAlign: 'right' }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, fontFamily: UI, color: T_P }}>{m.city}</div>
                      <div style={{ fontSize: 10, color: T_M }}>{m.state}</div>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: 'right', color: scoreColor(m.score) }}>{m.score}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, minWidth: 48, textAlign: 'right', color: m.yoy > 0 ? G : R }}>
                      {m.yoy > 0 ? '+' : ''}{m.yoy.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
              {!premium && (
                <div style={{ padding: 14 }}>
                  <button
                    onClick={() => setPricingOpen(true)}
                    style={{ width: '100%', fontFamily: UI, fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: G, border: 'none', padding: '11px 20px', cursor: 'pointer' }}
                  >
                    Unlock All Markets →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Property Intelligence ── */}
          <div data-globe-ui style={{ position: 'absolute', top: 0, right: 0, bottom: 40, width: 280, background: BG, borderLeft: `1px solid ${BORDER}`, zIndex: 90, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: 3, color: G, fontFamily: MONO, textTransform: 'uppercase' }}>
              Property Intelligence
            </div>

            {/* DNA Score ring */}
            <div style={{ padding: '20px 16px', borderBottom: `1px solid rgba(0,255,136,0.06)`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <canvas ref={scoreCanvasRef} width={120} height={120} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, lineHeight: 1, color: selected ? scoreColor(selected.score) : G }}>
                    {selected ? selected.score : '—'}
                  </div>
                  <div style={{ fontSize: 12, letterSpacing: 1, color: T_M, fontFamily: MONO }}>
                    {selected ? scoreGrade(selected.score) : 'DNA SCORE'}
                  </div>
                </div>
              </div>
            </div>

            {/* Value & Yield metrics */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: T_M, textTransform: 'uppercase', marginBottom: 6, fontFamily: MONO }}>EST. VALUE</div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: T_P }}>{selected ? fmt(selected.price) : '—'}</div>
              <div style={{ fontSize: 11, color: selected ? (selected.yoy > 0 ? G : R) : T_M, marginTop: 4, fontFamily: MONO }}>
                {selected ? `${selected.yoy > 0 ? '▲' : '▼'} ${Math.abs(selected.yoy)}% YoY` : 'Select a market'}
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: T_M, textTransform: 'uppercase', marginBottom: 6, fontFamily: MONO }}>RENTAL YIELD</div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: G }}>{selected ? selected.rentalYield.toFixed(1) + '%' : '—'}</div>
              <div style={{ fontSize: 11, color: T_M, marginTop: 4, fontFamily: MONO }}>{selected ? `Cap rate: ${selected.cap.toFixed(1)}%` : 'Cap rate'}</div>
            </div>

            {/* Detail rows — premium gated */}
            {!premium ? (
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ filter: 'blur(5px)', padding: '14px 16px', pointerEvents: 'none' }}>
                  {['FLOOD RISK','CRIME INDEX','WALK SCORE','SCHOOL RATING','DOM AVG','INVENTORY','YOY CHANGE'].map(k => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,255,136,0.04)' }}>
                      <span style={{ color: T_M, fontFamily: MONO, fontSize: 10 }}>{k}</span>
                      <span style={{ fontWeight: 600, color: T_P, fontSize: 12 }}>—</span>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <PremiumLockOverlay
                    headline="Unlock Intelligence"
                    body="Risk scores, walk scores, school ratings, full market metrics."
                    ctaLabel="Unlock Premium"
                    onUpgrade={() => setPricingOpen(true)}
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
                {([
                  ['FLOOD RISK',    selected?.flood,    selected?.flood  === 'LOW' ? G : selected?.flood  === 'MED' ? GOLD : R],
                  ['CRIME INDEX',   selected?.crime,    selected?.crime  === 'LOW' ? G : selected?.crime  === 'MED' ? GOLD : R],
                  ['WALK SCORE',    selected ? selected.walk    + '/100' : '—', T_P],
                  ['SCHOOL RATING', selected ? selected.school  + '/10'  : '—', T_P],
                  ['NOISE LEVEL',   selected?.noise,    selected?.noise  === 'LOW' ? G : selected?.noise  === 'MED' ? GOLD : R],
                  ['AIR QUALITY',   selected?.air,      T_P],
                  ['DOM AVG',       selected ? selected.dom     + ' days' : '—', T_P],
                  ['INVENTORY',     selected ? selected.inventory.toLocaleString() : '—', T_P],
                  ['YOY CHANGE',    selected ? (selected.yoy > 0 ? '+' : '') + selected.yoy.toFixed(1) + '%' : '—', selected ? (selected.yoy > 0 ? G : R) : T_P],
                  ['POWERED BY',    'TERRAGRAPH AI', GOLD],
                ] as [string, string | undefined, string][]).map(([key, val, color]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,255,136,0.04)' }}>
                    <span style={{ color: T_M, fontFamily: MONO, fontSize: 10 }}>{key}</span>
                    <span style={{ fontWeight: 600, color, fontSize: key === 'POWERED BY' ? 10 : 12 }}>{val || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CHART PANEL ── */}
          <div data-globe-ui style={{ position: 'absolute', bottom: 40, left: 260, right: 280, height: 140, background: BG, borderTop: `1px solid ${BORDER}`, zIndex: 90, backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: G, fontFamily: MONO }}>
                PRICE TREND — {selected ? `${selected.city.toUpperCase()}, ${selected.state}` : 'SELECT A MARKET'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['1Y','3Y','5Y','10Y'] as const).map(tf => (
                  <span
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    style={{ fontSize: 9, fontFamily: MONO, cursor: 'pointer', padding: '2px 6px', border: `1px solid ${timeframe === tf ? BORDER : 'transparent'}`, color: timeframe === tf ? G : T_M }}
                  >
                    {tf}
                  </span>
                ))}
              </div>
            </div>
            <canvas ref={sparkCanvasRef} style={{ flex: 1, width: '100%' }} />
          </div>

          {/* ── BOTTOM BAR ── */}
          <div data-globe-ui style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: BG, borderTop: `1px solid ${BORDER}`, zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 24, backdropFilter: 'blur(12px)' }}>
            {([
              ['MARKETS',  markets.length.toString()],
              ['AVG SCORE', Math.round(markets.reduce((s, m) => s + m.score, 0) / markets.length).toString()],
              ['AVG YOY',  (markets.reduce((s, m) => s + m.yoy, 0) / markets.length).toFixed(1) + '%'],
              ['DATA',     'REAL-TIME'],
              ['TERRAGRAPH AI', 'v3.1.0'],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: MONO }}>
                <span style={{ color: T_M }}>{label}</span>
                <span style={{ color: val === 'REAL-TIME' ? G : val === 'v3.1.0' ? GOLD : T_P }}>{val}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: MONO }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}`, animation: 'tg-pulse 2s infinite' }} />
              <span style={{ color: T_M }}>LAST REFRESH</span>
              <span style={{ color: T_P }}>{clock}</span>
            </div>
          </div>

          {/* ── ZOOM CONTROLS ── */}
          <div data-globe-ui style={{ position: 'absolute', bottom: 196, left: 270, zIndex: 95, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              ['+',  zoomIn],
              ['−',  zoomOut],
              ['⊙',  zoomReset],
            ] as [string, () => void][]).map(([label, fn]) => (
              <button
                key={label}
                onClick={fn}
                style={{ width: 32, height: 32, background: BG, border: `1px solid ${BORDER}`, color: G, fontSize: label === '⊙' ? 14 : 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, backdropFilter: 'blur(12px)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── SEARCH BAR ── */}
          <div data-globe-ui style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 150, display: 'flex', width: 360 }}>
            <input
              ref={searchInputRef}
              type="text"
              defaultValue=""
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="ENTER CITY OR MARKET..."
              style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRight: 'none', color: T_P, fontFamily: MONO, fontSize: 12, padding: '8px 14px', outline: 'none', backdropFilter: 'blur(12px)' }}
            />
            <button
              onClick={handleSearch}
              style={{ background: G, border: 'none', color: '#000', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '8px 16px', cursor: 'pointer' }}
            >
              SEARCH
            </button>
          </div>

          {/* ── MODE TABS ── */}
          <div data-globe-ui style={{ position: 'absolute', top: 12, right: 'calc(280px + 12px)', zIndex: 150, display: 'flex', gap: 1 }}>
            {(['global','national','regional'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{ padding: '6px 12px', fontSize: 10, letterSpacing: 1.5, fontFamily: MONO, cursor: 'pointer', textTransform: 'uppercase', background: mode === m ? 'rgba(0,255,136,0.1)' : BG, border: `1px solid ${mode === m ? G : BORDER}`, color: mode === m ? G : T_M }}
              >
                {m === 'global' ? 'GLOBAL' : m === 'national' ? 'USA' : 'REGION'}
              </button>
            ))}
          </div>

        </div>
      )}

      <style>{`
        @keyframes tg-load  { 0% { width: 0% } 100% { width: 100% } }
        @keyframes tg-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      `}</style>
    </>
  );
}
