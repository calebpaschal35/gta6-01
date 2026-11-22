// Harborlight — configuration: city, cars, tuning.
// All original. City of Harborlight, driver Jesse Kane, fixer Marta Solis.
const CFG = {
  WORLD: 3200,
  BLOCK: 400,
  ROAD_W: 56,
  // Districts: name, rect, palette, building style
  DISTRICTS: [
    { name: 'Downtown',  x: 1200, y: 1200, w: 800, h: 800, ground: '#b8a888', bldg: ['#7a6a58', '#8a7a66', '#6a5a48', '#9a8a72'], tall: true },
    { name: 'Riverside', x: 0,    y: 800,  w: 1200, h: 1600, ground: '#a8b878', bldg: ['#8a7a5a', '#7a6a4a', '#9a8a6a'], tall: false },
    { name: 'The Docks', x: 0,    y: 2400, w: 3200, h: 800, ground: '#8a8a7a', bldg: ['#6a6a5a', '#7a6a4a', '#5a5a4a'], tall: false },
    { name: 'Old Town',  x: 2000, y: 0,    w: 1200, h: 1200, ground: '#c0a878', bldg: ['#a88868', '#b89878', '#987858'], tall: false },
    { name: 'Palm Beach',x: 2400, y: 1200, w: 800, h: 1200, ground: '#e8d8a8', bldg: ['#f0e0b0', '#e8d098', '#d8c088'], tall: false },
  ],
  // 7 car models: name, accel, topSpeed, turn, length, width, color
  CARS: [
    { name: 'Coupe',   accel: 260, top: 340, turn: 3.4, len: 46, wid: 22, color: '#c04030' },
    { name: 'Sedan',   accel: 210, top: 290, turn: 3.0, len: 48, wid: 22, color: '#4060a0' },
    { name: 'Taxi',    accel: 200, top: 280, turn: 3.0, len: 48, wid: 22, color: '#e8c020' },
    { name: 'Truck',   accel: 150, top: 230, turn: 2.2, len: 62, wid: 26, color: '#708090' },
    { name: 'Van',     accel: 170, top: 250, turn: 2.5, len: 56, wid: 26, color: '#a0a0a0' },
    { name: 'Sport',   accel: 320, top: 400, turn: 3.8, len: 44, wid: 22, color: '#d060d0' },
    { name: 'Cruiser', accel: 280, top: 360, turn: 3.5, len: 50, wid: 24, color: '#202840' },
  ],
  PLAYER: { walkSpeed: 170, runSpeed: 260, hp: 100, radius: 12 },
  WANTED_DECAY: 18,        // seconds out of sight before a star drops
  COP_MAX: 6,              // max police cars at once
  PED_COUNT: 70,
  TRAFFIC_COUNT: 26,
  SMG_PRICE: 800,
  AMMO_PRICE: 120,
  SAVE_KEY: 'harborlight-save-v1',
};
