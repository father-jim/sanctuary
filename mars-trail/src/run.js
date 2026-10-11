// The journey's rules: one plain state object, advanced a sol at a time. No DOM code here,
// so the same functions drive the screen and any balance simulation.
import { SUPPLIES } from './data.js';
import { evaluate, tripSols, vehicleById } from './loadout.js';
import { WAYPOINTS, LEG_NAMES, PACES, RATIONS, ROLES, NAMES, TUNING } from './journey-data.js';

export const SAVE_KEY = 'sanctuary.run';
const CONSUMABLES = SUPPLIES.filter((item) => item.perCrewPerSol);

// mulberry32: a tiny seeded generator. Its state lives in the run, so a reload carries on the same sequence.
export function random(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const between = (s, lo, hi) => lo + Math.floor(random(s) * (hi - lo + 1));
export const chance = (s, p) => random(s) < p;
export const pick = (s, list) => list[Math.floor(random(s) * list.length)];

function shuffle(s, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createRun(loadout, seed = Math.floor(Math.random() * 2 ** 31)) {
  const s = {
    seed,
    rng: seed,
    vehicleId: loadout.vehicleId,
    supplies: { ...loadout.supplies },
    credits: evaluate(loadout).credits,
    sol: 1,
    km: 0,
    waypoint: 0, // index of the last waypoint reached
    docked: false, // true while the waypoint screen is open
    pace: 'steady',
    rations: 'full',
    morale: TUNING.startMorale,
    rover: 100,
    drilledLegs: [],
    pending: null, // { id, ctx } of an event waiting on the player
    over: null, // { won, reason } once the run ends
    log: [],
  };
  const names = shuffle(s, NAMES.slice());
  const roles = shuffle(s, Object.keys(ROLES));
  s.crew = Array.from({ length: loadout.crew }, (_, i) => ({
    name: names[i], role: roles[i % roles.length], health: 100, sick: false, alive: true, death: null,
  }));
  addLog(s, `The ${vehicle(s).name} rolls out of Jezero Base with ${listNames(s.crew)} aboard.`);
  return s;
}

export const vehicle = (s) => vehicleById(s.vehicleId);
export const living = (s) => s.crew.filter((m) => m.alive);
export const hasRole = (s, role) => living(s).some((m) => m.role === role);
export const leg = (s) => s.waypoint + 1;
export const nextWaypoint = (s) => WAYPOINTS[s.waypoint + 1];
export const here = (s) => WAYPOINTS[s.waypoint];
export const plannedSols = (s) => tripSols(vehicle(s));

export function listNames(people) {
  const names = people.map((m) => m.name);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function addLog(s, text, tone = '') {
  s.log.push({ sol: s.sol, text, tone });
  if (s.log.length > 200) s.log.shift();
}

export function randomLiving(s) {
  return pick(s, living(s));
}

export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export function addMorale(s, n) { s.morale = clamp(s.morale + n); }
export function damageRover(s, n) { s.rover = clamp(s.rover - n); }

// A few ways to go for each cause, so a wiped-out crew doesn't read like a form letter.
const DEATHS = {
  starvation: [
    (m, where) => `${m.name} starved to death ${where}, dreaming of Jezero's canteen.`,
    (m, where) => `${m.name} starved ${where}. Their last words were about cheese.`,
  ],
  thirst: [
    (m, where) => `${m.name} died of thirst ${where}. The recycler was full of nothing.`,
    (m, where) => `${m.name} died of thirst ${where}, a planet's worth of ice somewhere beneath them.`,
  ],
  air: [
    (m, where) => `${m.name} suffocated ${where} when the last oxygen canister hissed empty.`,
    (m, where) => `${m.name} ran out of air ${where}, mid-sentence.`,
    (m, where) => `${m.name} quietly stopped breathing ${where}. The O2 alarm had been ignored for sols.`,
  ],
  illness: [
    (m, where) => `${m.name} died of dust lung ${where}.`,
    (m, where) => `${m.name} coughed their last ${where}. Perchlorates: 1, ${m.name}: 0.`,
  ],
  injury: [
    (m, where) => `${m.name} died of their injuries ${where}.`,
    (m, where) => `${m.name} never recovered from that boulder ${where}.`,
  ],
  radiation: [
    (m, where) => `${m.name} died of radiation sickness ${where}, faintly glowing.`,
  ],
};

export function hurt(s, m, amount, cause) {
  if (!m.alive) return;
  m.health = clamp(m.health - amount);
  if (m.health > 0) return;
  m.alive = false;
  const where = s.km > 0 ? `at km ${Math.round(s.km)}` : 'before leaving base';
  m.death = DEATHS[cause] ? pick(s, DEATHS[cause])(m, where) : `${m.name} died ${where}.`;
  if (m.role === 'tourist') m.death += ' Their souvenir rock was buried with them.';
  addLog(s, m.death, 'bad');
  addMorale(s, -15);
}

export function heal(m, amount) {
  if (m.alive) m.health = clamp(m.health + amount);
}

// One sol passes: the crew eats, breathes and drinks, health and morale move, and the rover drives if `moving`.
export function passSol(s, { moving = false, resting = false } = {}) {
  const crew = living(s);
  const ration = RATIONS[s.rations];
  const short = [];
  for (const item of CONSUMABLES) {
    const need = item.perCrewPerSol * crew.length * (item.id === 'food' ? ration.food : 1);
    if (s.supplies[item.id] + 1e-9 >= need) s.supplies[item.id] -= need;
    else { s.supplies[item.id] = 0; short.push(item.id); }
  }
  if (hasRole(s, 'botanist')) s.supplies.food += TUNING.greenhouseFood;

  if (short.length) {
    const words = { food: 'food', water: 'water', oxygen: 'oxygen' };
    addLog(s, `Out of ${short.map((id) => words[id]).join(' and ')}.`, 'bad');
  }

  const recovery = TUNING.sickRecovery * (hasRole(s, 'medic') ? 2 : 1);
  for (const m of crew) {
    heal(m, ration.health + (resting ? TUNING.restHeal : 0));
    if (s.morale < 20) hurt(s, m, TUNING.lowMoraleDamage, 'illness');
    if (m.sick) {
      hurt(s, m, TUNING.sickDamage * (hasRole(s, 'medic') ? 0.5 : 1), 'illness');
      if (m.alive && chance(s, recovery)) { m.sick = false; addLog(s, `${m.name} is feeling better.`, 'good'); }
    }
    if (short.includes('food')) hurt(s, m, TUNING.starveDamage, 'starvation');
    if (short.includes('water')) hurt(s, m, TUNING.thirstDamage, 'thirst');
    if (short.includes('oxygen')) hurt(s, m, TUNING.airDamage, 'air');
  }

  addMorale(s, ration.morale + (resting ? TUNING.restMorale : 0) - short.length * 6
    + (hasRole(s, 'tourist') ? TUNING.touristMorale : 0));

  if (moving) drive(s);
  s.sol += 1;
  checkEnd(s);
}

function drive(s) {
  const v = vehicle(s);
  const pace = PACES[s.pace];
  const fuelNeed = v.fuelPerSol * pace.fuel;
  const share = Math.min(1, s.supplies.fuel / fuelNeed);
  s.supplies.fuel = Math.max(0, s.supplies.fuel - fuelNeed * share);
  const limp = s.rover < 25 ? 0.7 : 1;
  const target = nextWaypoint(s);
  s.km = Math.min(target.km, s.km + v.speedKmPerSol * pace.speed * share * limp);
  damageRover(s, TUNING.roverWear * pace.wear * (0.6 + random(s) * 0.8));
  if (s.km >= target.km) arrive(s);
}

function arrive(s) {
  s.waypoint += 1;
  const wp = here(s);
  if (s.waypoint === WAYPOINTS.length - 1) {
    addLog(s, `The domes of Sanctuary rise over the ridge on sol ${s.sol}.`, 'good');
    return;
  }
  s.docked = true;
  addLog(s, `You reach ${wp.name}.`, 'good');
}

export function checkEnd(s) {
  if (s.over) return;
  if (!living(s).length) s.over = { won: false, reason: 'Nobody is left to drive the rover.' };
  else if (s.waypoint === WAYPOINTS.length - 1) {
    const n = living(s).length;
    s.over = { won: true, reason: `${n} of ${s.crew.length} crew made it to Sanctuary.` };
  }
}

// Waits out sols without driving or resting (sheltering from a storm, waiting for help).
export function waitSols(s, n) {
  for (let i = 0; i < n && !s.over; i++) passSol(s);
}

// The player's "drive on" action. Returns what to show next: an event, the waypoint, the ending, or nothing.
export function travel(s, events) {
  if (s.over || s.pending) return;
  if (s.rover <= 0) return raise(s, events, 'rover-dead');
  if (s.supplies.fuel <= 1e-6) return raise(s, events, 'out-of-fuel');
  passSol(s, { moving: true });
  if (s.over || s.docked) return;
  const odds = TUNING.eventChance + (s.morale < 30 ? TUNING.lowMoraleEventBonus : 0);
  if (!chance(s, odds)) return;
  const pool = events.filter((e) => e.weight && e.legs.includes(leg(s)) && (!e.when || e.when(s)));
  let roll = random(s) * pool.reduce((sum, e) => sum + e.weight, 0);
  const event = pool.find((e) => (roll -= e.weight) < 0) ?? pool.at(-1);
  raise(s, events, event.id);
}

export function rest(s) {
  if (s.over || s.pending) return;
  passSol(s, { resting: true });
  addLog(s, 'The crew rests for a sol.');
}

export function raise(s, events, id) {
  const event = events.find((e) => e.id === id);
  const ctx = event.setup ? event.setup(s) : {};
  if (!event.choices) {
    addLog(s, event.text(s, ctx));
    return;
  }
  s.pending = { id, ctx };
}

export function choicesFor(s, event, ctx) {
  const list = typeof event.choices === 'function' ? event.choices(s, ctx) : event.choices;
  return list.map((c) => ({ ...c, blocked: c.need ? c.need(s, ctx) : null }));
}

// Applies the player's answer to the pending event. `result` is a mini-game's { score, hits } when it had one.
export function resolve(s, events, index, result) {
  const { id, ctx } = s.pending;
  const event = events.find((e) => e.id === id);
  const choice = choicesFor(s, event, ctx)[index];
  s.pending = null;
  const outcome = choice.run(s, ctx, result);
  addLog(s, outcome, choice.tone ?? '');
  checkEnd(s);
  return outcome;
}

export function cargoMass(s) {
  return SUPPLIES.reduce((kg, item) => kg + (s.supplies[item.id] || 0) * item.massKg, 0);
}
export const cargoRoom = (s) => Math.max(0, vehicle(s).cargoKg - cargoMass(s));

export function priceAt(item, wp) {
  return Math.ceil(item.price * wp.shop);
}

export function buy(s, itemId, qty) {
  const wp = here(s);
  if (!wp.shop) return 0;
  const item = SUPPLIES.find((i) => i.id === itemId);
  const n = Math.min(qty, Math.floor(s.credits / priceAt(item, wp)), Math.floor(cargoRoom(s) / item.massKg));
  if (n <= 0) return 0;
  s.supplies[itemId] += n;
  s.credits -= n * priceAt(item, wp);
  return n;
}

export function repairAt(s) {
  const { cost, amount } = here(s).repair;
  if (s.credits < cost || s.rover >= 100) return false;
  s.credits -= cost;
  s.rover = clamp(s.rover + amount);
  addLog(s, `The rover is patched up to ${Math.round(s.rover)}% condition.`, 'good');
  return true;
}

export function leaveWaypoint(s) {
  s.docked = false;
  addLog(s, `You set off across ${LEG_NAMES[leg(s)]} toward ${nextWaypoint(s).name}.`);
}

// How many sols an item will last at the current pace and rations, or null for spares.
export function solsLeft(s, itemId) {
  const n = living(s).length;
  if (itemId === 'fuel') return Math.floor(s.supplies.fuel / (vehicle(s).fuelPerSol * PACES[s.pace].fuel));
  const item = CONSUMABLES.find((i) => i.id === itemId);
  if (!item || !n) return null;
  const use = item.perCrewPerSol * n * (itemId === 'food' ? RATIONS[s.rations].food : 1)
    - (itemId === 'food' && hasRole(s, 'botanist') ? TUNING.greenhouseFood : 0);
  return use > 0 ? Math.floor(s.supplies[itemId] / use) : Infinity;
}

export function score(s) {
  const survivors = living(s).length * TUNING.scorePerSurvivor;
  const supplies = Math.round(SUPPLIES.reduce((sum, i) => sum + Math.floor(s.supplies[i.id] || 0) * i.price, 0) / 10);
  const saved = Math.max(0, plannedSols(s) - (s.sol - 1)) * TUNING.scorePerSolSaved;
  const multiplier = vehicle(s).scoreMultiplier;
  const total = s.over?.won ? (survivors + supplies + saved) * multiplier : 0;
  return { survivors, supplies, saved, multiplier, total };
}

export function save(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}

export function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
