// Tuning numbers for the journey. Balance changes belong here, not in run.js or events.js.
import { TRIP_DISTANCE_KM } from './data.js';

// Leg n runs from WAYPOINTS[n - 1] to WAYPOINTS[n]. `shop` is the price multiplier on outfitting prices.
export const WAYPOINTS = [
  { km: 0, name: 'Jezero Base' },
  {
    km: 450,
    name: 'Hesperia Outpost',
    blurb: 'A trading post dug into a crater wall. Prices are still fair this close to base.',
    shop: 1.5,
    repair: { cost: 250, amount: 40 },
  },
  {
    km: 950,
    name: 'Syrtis Relay',
    blurb: 'An automated relay mast with a vending depot bolted to its base. Everything costs extra out here.',
    shop: 2.2,
    repair: { cost: 400, amount: 40 },
  },
  {
    km: 1400,
    name: 'Isidis Beacon',
    blurb: 'A lonely beacon with an unstaffed workshop. Nothing to buy, but the tools are free.',
    repair: { cost: 0, amount: 100 },
  },
  { km: TRIP_DISTANCE_KM, name: 'Sanctuary' },
];

export const LEG_NAMES = ['', 'the crater rim', 'the Hesperia flats', 'the Syrtis badlands', 'the Isidis basin'];

export const PACES = {
  crawl: { label: 'Crawl', hint: 'Slow, gentle on the rover.', speed: 0.7, fuel: 0.7, wear: 0.5 },
  steady: { label: 'Steady', hint: 'Normal speed and wear.', speed: 1, fuel: 1, wear: 1 },
  push: { label: 'Push', hint: 'Fast, thirsty and rough.', speed: 1.35, fuel: 1.6, wear: 2.2 },
};

// food: share of a full ration eaten. health and morale: change per crew member per sol.
export const RATIONS = {
  full: { label: 'Full', hint: 'Everyone eats well.', food: 1, health: 1, morale: 1 },
  lean: { label: 'Lean', hint: 'A third less food, grumbling.', food: 0.65, health: -0.5, morale: -1.5 },
  minimal: { label: 'Bare', hint: 'Hunger sets in fast.', food: 0.35, health: -3, morale: -4 },
};

export const ROLES = {
  pilot: { name: 'Pilot', perk: 'Less damage in storms and rough ground.' },
  engineer: { name: 'Engineer', perk: 'Repairs are easier and sometimes save a part.' },
  medic: { name: 'Medic', perk: 'Sick crew recover faster.' },
  botanist: { name: 'Botanist', perk: 'The cabin greenhouse adds food each sol.' },
  geologist: { name: 'Geologist', perk: 'Finds more ice when drilling.' },
  tourist: { name: 'Tourist', perk: 'Terrible jokes keep morale up.' },
};

export const NAMES = [
  'Dr. Okafor', 'Reyes', 'Lindqvist', 'Tanaka', 'Mbeki', 'Kowalski', 'Haddad', 'Oyelaran',
  'Fischer', 'Novak', 'Achebe', 'Sato', 'Moreau', 'Quispe', 'Ivanova', 'Duarte', 'Dr. Banerjee', 'Ferro',
];

export const TUNING = {
  startMorale: 75,
  eventChance: 0.3,
  lowMoraleEventBonus: 0.12, // added to eventChance below 30 morale
  roverWear: 1.6, // condition lost per sol at steady pace, before a little randomness
  restHeal: 6,
  restMorale: 8,
  greenhouseFood: 0.3,
  starveDamage: 10,
  thirstDamage: 16,
  airDamage: 34,
  sickDamage: 7,
  sickRecovery: 0.15, // daily chance; doubled with a medic
  lowMoraleDamage: 2,
  touristMorale: 1,
  fuelDrop: { cells: 6, cost: 900 },
  tow: { cost: 1500, condition: 60 },
  scorePerSurvivor: 500,
  scorePerSolSaved: 20,
};
