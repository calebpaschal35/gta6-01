// Harborlight — configuration. All original content; no Rockstar / GTA assets.
export const WORLD = 3200;
export const TILE = 400; // road grid spacing
export const ROAD_W = 84;

export const DISTRICTS = [
  { name: 'Downtown', x: 1100, y: 1100, w: 1000, h: 1000, ground: '#2f3a4e', road: '#232c3d', build: '#46587a', accent: '#6f86b8' },
  { name: 'Riverside', x: 0, y: 900, w: 900, h: 1100, ground: '#274636', road: '#1e352a', build: '#3a6b52', accent: '#57a37a' },
  { name: 'The Docks', x: 900, y: 2300, w: 1300, h: 900, ground: '#4a3d27', road: '#382e1e', build: '#6b5a38', accent: '#a3844f' },
  { name: 'Old Town', x: 1100, y: 0, w: 1000, h: 900, ground: '#4e352e', road: '#3a2822', build: '#7a5648', accent: '#b07a5f' },
  { name: 'Palm Beach', x: 2300, y: 900, w: 900, h: 1400, ground: '#8a6f3a', road: '#6f582c', build: '#c2a05c', accent: '#e8c878' },
];

export const CAR_MODELS = [
  { name: 'Harbor Compact', top: 430, accel: 380, turn: 2.6, color: '#8a9ab0', w: 46, h: 22 },
  { name: 'Downtown Sedan', top: 500, accel: 420, turn: 2.4, color: '#5a6b8a', w: 50, h: 23 },
  { name: 'Riverside Coupe', top: 640, accel: 520, turn: 2.7, color: '#c23b3b', w: 48, h: 22 },
  { name: 'Dockside Van', top: 380, accel: 330, turn: 2.0, color: '#b0a06a', w: 54, h: 26 },
  { name: 'Old Town Taxi', top: 470, accel: 400, turn: 2.5, color: '#e8c832', w: 50, h: 23 },
  { name: 'Palm Cruiser', top: 700, accel: 560, turn: 2.8, color: '#3bc2a8', w: 50, h: 22 },
  { name: 'Street Racer', top: 760, accel: 620, turn: 3.0, color: '#9a3bc2', w: 48, h: 21 },
];
export const POLICE_MODEL = { name: 'HPD Interceptor', top: 620, accel: 540, turn: 2.8, color: '#1a2a4a', w: 50, h: 23 };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 2.5, range: 46, mag: Infinity, auto: false },
  pistol: { name: 'Pistol', damage: 22, rate: 4.0, range: 420, mag: 12, auto: false },
  smg: { name: 'SMG', damage: 14, rate: 11.0, range: 380, mag: 30, auto: true },
};
export const SMG_PRICE = 800;

export const PLAYER = {
  walkSpeed: 230, runSpeed: 350, radius: 14, maxHp: 100,
  startCash: 200, startX: 1400, startY: 1400,
};

export const WANTED = {
  decaySight: 700, // no police within this range counts as unseen
  decayWait: 8, // seconds unseen before wanted starts dropping
  decayStep: 4, // seconds per star lost
  maxPolice: [0, 2, 3, 4, 5, 6],
  ramDamage: 25, // HP per second while a police car rams the player car
  bustedGrace: 2.5, // seconds after a wreck before busted can trigger
  bustedRange: 70, bustedTime: 1.5,
};

export const MISSIONS = [
  { id: 1, name: 'The Coupe', giver: 'Marta Solis', payout: 500, brief: 'Steal the red Riverside Coupe from the Downtown garage and bring it to Marta.',
    steps: ['Reach the Downtown garage', 'Steal the Riverside Coupe', 'Deliver the coupe to Marta'] },
  { id: 2, name: 'The Handoff', giver: 'Marta Solis', payout: 800, time: 120, brief: 'Drive the package from Downtown to the Docks warehouse. Fast and clean.',
    steps: ['Pick up the package', 'Drive to the Docks warehouse', 'Drop the package'] },
  { id: 3, name: 'Shake the Tail', giver: 'Marta Solis', payout: 1200, time: 90, brief: 'HPD is on you at 3 stars. Lose them and stay free for 90 seconds.',
    steps: ['Survive the 3-star pursuit for 90 seconds'] },
  { id: 4, name: 'Redline Wreckers', giver: 'Marta Solis', payout: 1500, brief: 'Wreck 3 Redline gang cars. They drive the streets of Old Town.',
    steps: ['Wreck Redline cars (0/3)'] },
  { id: 5, name: 'The Harborlight Job', giver: 'Marta Solis', payout: 3000, brief: 'Hit the Downtown bank, then reach the boat at Palm Beach and vanish.',
    steps: ['Reach the Downtown bank', 'Grab the cash', 'Reach the boat at Palm Beach'] },
];

export const SAVE_KEY = 'harborlight-save-v1';
export const SEED = 1337;
