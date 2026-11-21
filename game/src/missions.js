// The story: five jobs for fixer Marta Solis, played in order from her
// garage. Each job is a small state machine of steps with a world marker,
// an objective line, and a cash reward. Finishing all five completes the
// story; jobs can be replayed from the garage afterwards.
export const JOBS = [
  {
    id: 1, name: 'First Wheels', reward: 400,
    brief: "Marta: A coupe is parked at the docks, keys in it. Bring it to my garage and we are in business.",
    steps: [
      { id: 'go', text: 'Go to the docks and steal the coupe', at: { x: 1120, y: 2720 }, radius: 90 },
      { id: 'drive', text: "Drive the coupe to Marta's Garage", at: { x: 480, y: 2720 }, radius: 90 },
    ],
  },
  {
    id: 2, name: 'The Handoff', reward: 700,
    brief: 'Marta: Pick up the package at Palm Beach, deliver it to Riverside Market. Keep your head down — the heat counts double on this one.',
    steps: [
      { id: 'pickup', text: 'Pick up the package at Palm Beach', at: { x: 2720, y: 2720 }, radius: 80 },
      { id: 'deliver', text: 'Deliver the package to Riverside Market', at: { x: 2240, y: 1120 }, radius: 80 },
    ],
  },
  {
    id: 3, name: 'Shake the Tail', reward: 900,
    brief: 'Marta: The PD is on you. Lose them and get to the safehouse in Riverside. You have ninety seconds.',
    steps: [
      { id: 'escape', text: 'Reach the safehouse with the law off your tail', at: { x: 2560, y: 800 }, radius: 90, timer: 90 },
    ],
  },
  {
    id: 4, name: 'Redline Trouble', reward: 1200,
    brief: 'Marta: The Redline crew is muscling in. Wreck three of their cars — ram them or shoot them, your call.',
    steps: [
      { id: 'wreck', text: 'Wreck 3 Redline cars (0/3)', at: null, radius: 0, count: 3 },
    ],
  },
  {
    id: 5, name: 'The Harborlight Job', reward: 3000,
    brief: 'Marta: The big one. Hit Harborlight Trust, grab the cash, and get to the boat at Pier 9. The whole city will be looking for you.',
    steps: [
      { id: 'rob', text: 'Hold up Harborlight Trust — stand in the bank', at: { x: 1600, y: 1440 }, radius: 110, hold: 5 },
      { id: 'boat', text: 'Escape to the boat at Pier 9', at: { x: 1600, y: 2920 }, radius: 90 },
    ],
  },
];

export class Story {
  constructor() {
    this.done = 0;            // jobs completed in order
    this.active = null;       // { job, step, progress, holdT, timer }
    this.briefing = null;     // job awaiting accept
    this.complete = false;
  }

  offerNext() {
    if (this.done >= JOBS.length) { this.complete = true; return null; }
    this.briefing = JOBS[this.done];
    return this.briefing;
  }

  accept() {
    if (!this.briefing) return null;
    this.active = { job: this.briefing, step: 0, holdT: 0, timer: this.briefing.steps[0].timer || 0, count: 0 };
    const j = this.briefing;
    this.briefing = null;
    return j;
  }

  decline() { this.briefing = null; }

  step() { return this.active ? this.active.job.steps[this.active.step] : null; }

  objectiveText() {
    if (this.briefing) return `New job: ${this.briefing.name} — press E to take it`;
    if (!this.active) return this.complete ? 'Story complete — free roam. Visit the garage to replay a job.' : 'Go to Marta\'s Garage for work';
    const s = this.step();
    if (!s) return '';
    let t = s.text;
    if (s.count) t = t.replace('0/3', `${this.active.count}/3`);
    if (s.timer) t += ` — ${Math.max(0, Math.ceil(this.active.timer))}s`;
    if (s.hold) t += ` — hold ${Math.max(0, (s.hold - this.active.holdT)).toFixed(0)}s`;
    return `JOB ${this.active.job.id} — ${this.active.job.name}: ${t}`;
  }

  marker() {
    if (!this.active) return null;
    const s = this.step();
    return s && s.at ? s.at : null;
  }

  // Advance the active job. ctx carries the player position, car, and events.
  // Returns 'done' | 'failed' | null.
  update(dt, ctx) {
    if (!this.active) return null;
    const a = this.active;
    const s = a.job.steps[a.step];
    if (s.timer) {
      a.timer -= dt;
      if (a.timer <= 0) { this.active = null; return 'failed'; }
    }
    const reach = (at, radius) => at && Math.hypot(ctx.x - at.x, ctx.y - at.y) < radius;
    if (s.id === 'go') {
      if (ctx.inCar && ctx.carIsJobCar) { a.step = 1; return null; }
    } else if (s.id === 'drive') {
      if (ctx.inCar && ctx.carIsJobCar && reach(s.at, s.radius)) { return this.finish(); }
    } else if (s.id === 'pickup') {
      if (!ctx.inCar && reach(s.at, s.radius)) { a.step = 1; return null; }
    } else if (s.id === 'deliver') {
      if (reach(s.at, s.radius)) { return this.finish(); }
    } else if (s.id === 'escape') {
      if (ctx.wanted === 0 && reach(s.at, s.radius)) { return this.finish(); }
    } else if (s.id === 'wreck') {
      if (ctx.wrecked >= a.count + 1) {
        a.count += 1;
        if (a.count >= s.count) return this.finish();
      }
    } else if (s.id === 'rob') {
      if (reach(s.at, s.radius)) {
        a.holdT += dt;
        if (a.holdT >= s.hold) { a.step = 1; return null; }
      } else a.holdT = 0;
    } else if (s.id === 'boat') {
      if (reach(s.at, s.radius)) { return this.finish(); }
    }
    return null;
  }

  finish() {
    const reward = this.active.job.reward;
    this.done += 1;
    this.active = null;
    if (this.done >= JOBS.length) this.complete = true;
    return { done: true, reward };
  }

  replay(jobId) {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job) return null;
    this.briefing = job;
    return job;
  }
}
