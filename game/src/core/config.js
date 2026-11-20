// NEON PALMS — every tuning number, colour and name in one place.
// Palma Sol is a 768 m island grid: eight blocks each way, 20 m roads between them,
// ocean west and south, docks east, hills north. One metre is one world unit.

export const WORLD = {
  half: 470,          // playable half-extent, metres
  ground: 0,          // road surface height
  sidewalk: 0.18,     // kerb height
  water: -1.4,        // sea surface
  seaStart: -452,     // west of this x is open water
  beachWidth: 52,
  marinaStart: 392,   // south of this z the boardwalk and moorings begin
};

export const GRID = {
  blocks: 8,
  pitch: 96,
  road: 20,
  block: 76,
  origin: -384,       // centre line of the first road
};

// Block centres, indexed [ix][iz].
export const blockCentre = (i) => GRID.origin + i * GRID.pitch;
export const blockSpan = GRID.block;

export const DISTRICTS = [
  { id: 'ocean', name: 'OCEAN DRIVE', test: (x) => x < -190 },
  { id: 'puerto', name: 'PUERTO', test: (x) => x > 235 },
  { id: 'playa', name: 'PLAYA', test: (x, z) => z > 235 },
  { id: 'colinas', name: 'COLINAS', test: (x, z) => z < -235 },
  { id: 'centro', name: 'CENTRO', test: () => true },
];

export const TIME = {
  start: 18.55,       // 18:33, golden hour
  minutesPerSecond: 0.55,
  dusk: 20.4,
};

export const PALETTE = {
  ink: '#f6f1e7',
  gold: '#ffc24a',
  coral: '#ff7a59',
  magenta: '#ff3fd0',
  cyan: '#43e8ff',
  green: '#86ff9b',
  red: '#ff4a5a',
  violet: '#b06bff',

  skyTop: '#1b2450',
  skyMid: '#7a4a86',
  skyHorizon: '#ff9d6b',
  sun: '#ffe0b0',
  fog: '#d98d72',
  nightTop: '#080a20',
  nightMid: '#181a3a',
  nightHorizon: '#3b2b52',

  asphalt: '#33323c',
  asphaltDark: '#26252e',
  line: '#e9e2c9',
  sidewalk: '#8d8794',
  kerb: '#b6afb8',
  sand: '#e5c79c',
  sea: '#1d5a76',
  seaDeep: '#0d2f45',
  grass: '#4e7a52',
};

export const FACADES = {
  deco: ['#f2a7b8', '#9fe0c8', '#ffc69a', '#c9aaf0', '#f6d6a8', '#a8d8e8'],
  tower: ['#3f7d9c', '#5aa6b8', '#2f4a66', '#7d8fa8', '#39566f', '#6f8f9e'],
  dock: ['#b5583a', '#3d7f86', '#c99a3e', '#7b6a5a', '#8c4b3a'],
  villa: ['#f0e0c8', '#e8c8b0', '#d8e0d0', '#f4d8c0'],
  neon: ['#ff3fd0', '#35e6ff', '#ffb02e', '#7dff6a', '#ff4a5a', '#b06bff'],
};

export const SIGN_NAMES = [
  'HOTEL AURORA', 'CASA LUNA', 'CLUB MEDUSA', 'NOCHE ROSA', 'PINK PALMS',
  'DISCO MARINA', 'BAR SOL', 'MOTEL VENUS', 'CAFÉ ORO', 'EL FARO',
  'PALMA GRANDE', 'SIRENA', 'LUNA AZUL', 'THE NEON ROOM', 'TIKI TIDE',
];

export const STREETS = [
  'AV. SOL', 'CALLE OCHO', 'BOULEVARD CORAL', 'CALLE LUNA', 'AV. DEL MAR',
  'CALLE VERDE', 'PASEO ROSA', 'CALLE HIERRO', 'AV. PUERTO',
];

export const PLAYER = {
  radius: 0.55,
  height: 1.82,
  walk: 4.6,
  run: 8.2,
  swim: 2.4,
  turnRate: 12,
  maxHealth: 100,
  maxArmor: 100,
  regenDelay: 14,
  respawn: 6,
};

export const WEAPONS = {
  fists: { name: 'FISTS', damage: 12, rate: 0.42, range: 2.2, spread: 0, ammo: Infinity, muzzle: 0 },
  pistol: { name: '9MM PISTOL', damage: 26, rate: 0.28, range: 90, spread: 0.018, ammo: 120, muzzle: 0.6 },
  smg: { name: 'SMG', damage: 18, rate: 0.09, range: 70, spread: 0.05, ammo: 240, muzzle: 0.5 },
  shotgun: { name: 'SHOTGUN', damage: 15, rate: 0.8, range: 26, spread: 0.12, ammo: 32, muzzle: 0.9, pellets: 6 },
};

export const VEHICLES = {
  sedan: {
    name: 'SOLARIS 4', body: '#d8d2c4', length: 4.5, width: 1.9, height: 1.45,
    top: 42, accel: 12, grip: 8.5, mass: 1, seats: 4,
  },
  coupe: {
    name: 'PELICANO GT', body: '#d4241a', length: 4.4, width: 2.0, height: 1.18,
    top: 58, accel: 17, grip: 9.6, mass: 0.9, seats: 2,
  },
  taxi: {
    name: 'TAXI SOL', body: '#f4b31e', length: 4.6, width: 1.95, height: 1.5,
    top: 40, accel: 11.5, grip: 8, mass: 1.05, seats: 4,
  },
  van: {
    name: 'CARGO VAN', body: '#e8e4da', length: 5.6, width: 2.2, height: 2.3,
    top: 32, accel: 8.5, grip: 7, mass: 1.6, seats: 3,
  },
  police: {
    name: 'PSD CRUISER', body: '#f2f0ea', length: 4.7, width: 1.95, height: 1.5,
    top: 52, accel: 16, grip: 9.2, mass: 1.15, seats: 2, siren: true,
  },
  muscle: {
    name: 'MANTARRAYA', body: '#2f8f7a', length: 4.7, width: 2.0, height: 1.3,
    top: 54, accel: 15.5, grip: 8.8, mass: 1.05, seats: 2,
  },
};

export const TRAFFIC = {
  count: 26,
  speed: 11,
  speedSpread: 4,
  spawnRadius: 320,
  despawnRadius: 420,
};

export const PEDS = {
  count: 46,
  walk: 1.5,
  spawnRadius: 220,
  despawnRadius: 300,
};

export const POLICE = {
  stars: 5,
  unitsPerStar: 2,
  maxUnits: 8,
  spawnRadius: 260,
  sight: 70,
  shootRange: 34,
  heliAt: 3,
  roadblockAt: 4,
  escapeSeconds: 18,
  bustRange: 2.6,
  bustSeconds: 2.2,
};

export const CAMERA = {
  fov: 62,
  carDistance: 8.6,
  carHeight: 3.5,
  footDistance: 5.2,
  footHeight: 2.2,
  lookAhead: 0.42,
  lag: 6.5,
  shakeDecay: 6,
};

export const ECONOMY = {
  startCash: 250,
  startRespect: 0,
  missionReward: 1200,
  starValue: 120,
  sprayCost: 150,
};

export const RADIO = [
  { station: 'WAVE 103.5', track: 'Midnight Marina', mood: 'sunset synthwave' },
  { station: 'SOL FM 88.1', track: 'Coral Static', mood: 'slow disco' },
  { station: 'PUERTO 92.9', track: 'Dockside Dub', mood: 'dub techno' },
  { station: 'RADIO LUNA', track: 'Boulevard of Palms', mood: 'dream pop' },
];

export const SAVE_KEY = 'neonpalms.save.v1';

export const UI = {
  speedScale: 3.1,   // world m/s -> displayed km/h for arcade feel
  minimapRange: 150,
};
