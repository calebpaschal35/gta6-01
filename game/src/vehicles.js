// Harborlight — cars: arcade physics, traffic AI, parked cars to steal.
function makeCar(modelIdx, x, y, angle) {
  const m = CFG.CARS[modelIdx];
  return {
    model: modelIdx, x, y, angle: angle || 0, speed: 0,
    len: m.len, wid: m.wid, color: m.color, hp: 100,
    traffic: false, parked: false, police: false, gang: false,
    dir: 0, // traffic: 0 = east, 1 = south, 2 = west, 3 = north
    targetSpeed: 0, wrecked: false, smoke: 0,
  };
}
function carPhysics(car, dt, throttle, steer) {
  const m = CFG.CARS[car.model];
  car.speed += throttle * m.accel * dt;
  car.speed = clamp(car.speed, -m.top * 0.4, m.top);
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const spd = Math.abs(car.speed) / m.top;
  car.angle += steer * m.turn * (0.5 + spd) * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, CFG.WORLD - 30);
  car.y = clamp(car.y, 30, CFG.WORLD - 30);
}
function spawnTraffic(state) {
  const rng = makeRng(41);
  state.traffic = [];
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
    const vertical = rng.chance(0.5);
    const gx = rng.int(0, CFG.WORLD / CFG.BLOCK) * CFG.BLOCK;
    const gy = rng.int(0, CFG.WORLD / CFG.BLOCK) * CFG.BLOCK;
    const lane = (rng.chance(0.5) ? 1 : -1) * 12;
    const car = makeCar(rng.int(0, 5), vertical ? gx + lane : gx, vertical ? gy : gy + lane, vertical ? Math.PI / 2 : 0);
    car.traffic = true;
    car.dir = vertical ? (lane > 0 ? 1 : 3) : (lane > 0 ? 0 : 2);
    car.speed = rng.range(90, 150);
    state.traffic.push(car);
  }
  // Parked cars near roads (stealable).
  state.parked = [];
  for (let i = 0; i < 16; i++) {
    const gx = rng.int(0, CFG.WORLD / CFG.BLOCK) * CFG.BLOCK;
    const gy = rng.int(0, CFG.WORLD / CFG.BLOCK) * CFG.BLOCK;
    const side = rng.chance(0.5) ? 1 : -1;
    const car = makeCar(rng.int(0, 5), gx + side * (CFG.ROAD_W / 2 + 16), gy + rng.range(-140, 140), rng.chance(0.5) ? 0 : Math.PI);
    car.parked = true;
    state.parked.push(car);
  }
}
function updateTraffic(state, dt) {
  for (const car of state.traffic) {
    if (car.wrecked) continue;
    // Drive along the road; at an intersection, sometimes turn.
    const m = CFG.BLOCK;
    const nearX = Math.abs((car.x % m) - m / 2) < 6 || (car.x % m) < 6 || (car.x % m) > m - 6;
    const nearY = Math.abs((car.y % m) - m / 2) < 6 || (car.y % m) < 6 || (car.y % m) > m - 6;
    const onGridX = (car.x % m) < CFG.ROAD_W || (car.x % m) > m - CFG.ROAD_W;
    const onGridY = (car.y % m) < CFG.ROAD_W || (car.y % m) > m - CFG.ROAD_W;
    if ((onGridX && onGridY) && state.rng.chance(dt * 0.5)) {
      // Pick a new direction at the intersection.
      car.dir = state.rng.int(0, 3);
    }
    const target = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
    car.angle += angleDiff(car.angle, target) * Math.min(1, dt * 3);
    // Slow if a car is close ahead.
    let slow = false;
    for (const o of state.traffic) {
      if (o === car || o.wrecked) continue;
      const d = dist2(car.x, car.y, o.x, o.y);
      if (d < 70 * 70) {
        const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.y - car.y);
        if (ahead > 0) { slow = true; break; }
      }
    }
    if (state.playerCar && !state.playerCar.wrecked) {
      const d = dist2(car.x, car.y, state.playerCar.x, state.playerCar.y);
      if (d < 80 * 80) {
        const ahead = Math.cos(car.angle) * (state.playerCar.x - car.x) + Math.sin(car.angle) * (state.playerCar.y - car.y);
        if (ahead > 0) slow = true;
      }
    }
    car.speed = lerp(car.speed, slow ? 0 : 130, Math.min(1, dt * 2));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the world edge onto the next road.
    if (car.x < 20) { car.x = CFG.WORLD - 40; }
    if (car.x > CFG.WORLD - 20) { car.x = 40; }
    if (car.y < 20) { car.y = CFG.WORLD - 40; }
    if (car.y > CFG.WORLD - 20) { car.y = 40; }
    if (car.hp <= 0 && !car.wrecked) { car.wrecked = true; car.smoke = 1; }
    if (car.wrecked) car.smoke = Math.max(0, car.smoke - dt * 0.1);
  }
}
function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const m = CFG.CARS[car.model];
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-m.len / 2 + 4, -m.wid / 2 + 4, m.len, m.wid);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 7);
  ctx.fill();
  // Windows + roof.
  ctx.fillStyle = car.wrecked ? '#222' : '#bfe0f0';
  ctx.fillRect(-m.len / 2 + 8, -m.wid / 2 + 4, m.len * 0.32, m.wid - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(m.len * 0.05, -m.wid / 2 + 3, m.len * 0.2, m.wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(m.len / 2 - 3, -m.wid / 2 + 3, 3, 5);
  ctx.fillRect(m.len / 2 - 3, m.wid / 2 - 8, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-m.len / 2 + 4, -m.wid / 2 + 2, m.len - 8, 5);
    ctx.fillStyle = '#202840';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HPD', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.gang) {
    ctx.fillStyle = '#c02020';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('REDLINE', 0, 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,' + (0.5 * car.smoke) + ')';
    ctx.beginPath();
    ctx.arc(car.x + Math.sin(performance.now() / 300) * 6, car.y - 10, 8 + 6 * car.smoke, 0, Math.PI * 2);
    ctx.fill();
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
