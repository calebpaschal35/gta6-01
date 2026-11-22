// Harborlight — 5 story jobs for Marta Solis. Linear chain; each pays out.
const MISSIONS = [
  {
    id: 1, name: 'The Coupe', brief: 'Marta: "Steal the red coupe from the Downtown garage. Bring it to my spot in Old Town."',
    start: { x: 1600, y: 1600 }, target: { x: 1560, y: 1560, r: 60, label: 'Garage — steal the coupe' },
    payout: 500,
  },
  {
    id: 2, name: 'The Handoff', brief: 'Marta: "Package in the trunk. Drive it to the Docks drop — fast, no cops."',
    start: null, target: { x: 400, y: 2900, r: 70, label: 'Docks drop-off' },
    payout: 800, timer: 120,
  },
  {
    id: 3, name: 'Shake the Tail', brief: 'Marta: "HPD is on you — 3 stars. Lose them for 90 seconds and you are clear."',
    start: null, target: null, payout: 1200, timer: 90, forceWanted: 3,
  },
  {
    id: 4, name: 'Redline Wreckers', brief: 'Marta: "Redline gang is moving on my turf. Wreck 3 of their cars — ram them or shoot them."',
    start: null, target: null, payout: 1500, wrecks: 3,
  },
  {
    id: 5, name: 'The Big One', brief: 'Marta: "Bank job. Grab the cash in Downtown, then run for the boat at Palm Beach marina."',
    start: null, target: { x: 1600, y: 1400, r: 70, label: 'Harborlight Bank — grab the cash' },
    payout: 3000,
  },
];
function startMission(state, idx) {
  const m = MISSIONS[idx];
  state.mission = idx;
  state.missionStarted = true;
  state.missionStage = 0;
  state.missionTimer = m.timer || 0;
  state.missionCarWrecks = 0;
  state.missionHold = 0;
  state.objective = m.name + ': ' + m.brief;
  state.toast('JOB ' + m.id + ' — ' + m.name, '#ffd060');
  if (m.forceWanted) state.wanted = m.forceWanted;
  if (idx === 0) {
    // The red coupe waits in the Downtown garage.
    const coupe = makeCar(0, 1560, 1560, 0);
    coupe.parked = true;
    state.parked.push(coupe);
    state.missionCoupe = coupe;
  }
  if (idx === 3) {
    // Redline cars cruise the Docks.
    for (let i = 0; i < 3; i++) {
      const c = makeCar(state.rng.int(0, 5), 500 + i * 300, 2700, 0);
      c.gang = true; c.traffic = true; c.speed = 120;
      state.traffic.push(c);
    }
    spawnGang(state, 800, 2700, 3);
  }
  if (idx === 4) {
    state.missionHold = 0;
  }
}
function updateMissions(state, dt) {
  if (state.mission < 0 || state.mission >= MISSIONS.length) return;
  const m = MISSIONS[state.mission];
  // The timer only runs once the job is actually started (T pressed).
  // Otherwise the next job's timer would count down from 0 and fail instantly.
  if (m.timer && state.missionStarted) {
    state.missionTimer -= dt;
    if (state.missionTimer <= 0) {
      if (state.mission === 2) {
        // Survived the tail.
        completeMission(state);
        return;
      }
      failMission(state, 'Too slow — the window closed.');
      return;
    }
  }
  const p = state.player;
  const px = state.playerCar ? state.playerCar.x : p.x;
  const py = state.playerCar ? state.playerCar.y : p.y;
  if (state.mission === 0) {
    if (state.missionStage === 0) {
      // Reach the garage, then steal the coupe.
      if (state.missionCoupe && state.playerCar === state.missionCoupe) {
        state.missionStage = 1;
        state.objective = 'The Coupe: drive it to Marta in Old Town.';
        state.toast('Got the coupe. Now get it to Marta.', '#80d0ff');
      }
    } else if (dist2(px, py, 2600, 500) < 90 * 90) {
      completeMission(state);
    }
  }
  if (state.mission === 1) {
    if (m.target && dist2(px, py, m.target.x, m.target.y) < m.target.r * m.target.r) {
      completeMission(state);
    }
  }
  if (state.mission === 3) {
    if ((state.missionCarWrecks || 0) >= 3) completeMission(state);
  }
  if (state.mission === 4) {
    if (state.missionStage === 0) {
      if (m.target && dist2(px, py, m.target.x, m.target.y) < m.target.r * m.target.r) {
        state.missionStage = 1;
        state.missionHold = 5;
        state.objective = 'The Big One: stay in the bank — grabbing the cash…';
        state.toast('Grabbing the cash — hold on!', '#ffd060');
      }
    } else if (state.missionStage === 1) {
      state.missionHold -= dt;
      if (state.missionHold <= 0) {
        state.missionStage = 2;
        state.cash += 1500;
        state.wanted = 4;
        state.objective = 'The Big One: 4 stars! Escape to the boat at Palm Beach marina.';
        state.toast('Cash grabbed — $1,500! Run for the boat!', '#ffd060');
        AudioSys.cash();
      }
    } else if (dist2(px, py, 3050, 1900) < 90 * 90) {
      completeMission(state);
    }
  }
  // Mission target marker.
  state.missionTarget = null;
  if (state.mission === 0 && state.missionStage === 0) state.missionTarget = { x: 1560, y: 1560, label: 'Garage' };
  if (state.mission === 0 && state.missionStage === 1) state.missionTarget = { x: 2600, y: 500, label: "Marta's spot" };
  if (state.mission === 1) state.missionTarget = { x: 400, y: 2900, label: 'Docks drop' };
  if (state.mission === 4 && state.missionStage === 0) state.missionTarget = { x: 1600, y: 1400, label: 'Bank' };
  if (state.mission === 4 && state.missionStage === 2) state.missionTarget = { x: 3050, y: 1900, label: 'Escape boat' };
}
function completeMission(state) {
  const m = MISSIONS[state.mission];
  state.cash += m.payout;
  state.toast('JOB DONE — ' + m.name + ' +$' + m.payout, '#40d040');
  AudioSys.cash();
  state.mission++;
  state.missionStage = 0;
  state.missionTarget = null;
  if (state.mission >= MISSIONS.length) {
    state.objective = 'All jobs done — Harborlight is yours. Free roam, or start a new story.';
    state.toast('STORY COMPLETE — you run Harborlight now.', '#ffd060');
    state.storyDone = true;
  } else {
    const next = MISSIONS[state.mission];
    state.objective = 'Next job: ' + next.name + ' — talk to Marta (press T to start).';
    state.missionStarted = false;
  }
  saveGame(state);
}
function failMission(state, why) {
  state.toast('JOB FAILED — ' + why, '#ff6060');
  state.failedMission = state.mission;
  state.mission = -1;
  state.missionTarget = null;
  state.objective = 'Job failed. Press T to try the story again from the last job.';
}
function currentMissionTarget(state) {
  return state.missionTarget || null;
}
