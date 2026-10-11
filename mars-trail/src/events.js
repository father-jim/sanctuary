// Random events. Each has a weight and the legs it can happen on; `setup` picks who it happens to,
// and each choice's `run` applies the outcome and returns the line shown to the player.
// A choice with `minigame` is played first and `run` gets its { score, hits }.
import {
  addMorale, between, chance, damageRover, hasRole, heal, hurt, living, pick, randomLiving,
  cargoRoom, waitSols, clamp, vehicle,
} from './run.js';
import { TUNING } from './journey-data.js';

const ALL = [1, 2, 3, 4];
const member = (s, ctx) => s.crew[ctx.who];
const whoIndex = (s, m) => s.crew.indexOf(m);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function useParts(s, n) {
  const saved = hasRole(s, 'engineer') && chance(s, 0.5);
  if (!saved) s.supplies.parts -= n;
  return saved ? ' Your engineer reuses the old part, so no kit is spent.' : '';
}

function drillReward(s, hits) {
  const boost = hasRole(s, 'geologist') ? 1.5 : 1;
  let water = Math.round(hits * 0.6 * boost);
  let oxygen = Math.round(hits * 0.5 * boost);
  // Ice only fits if there's cargo room for the tanks and canisters it fills.
  const room = cargoRoom(s);
  const fit = Math.min(1, room / (water * 20 + oxygen * 8 || 1));
  water = Math.floor(water * fit);
  oxygen = Math.floor(oxygen * fit);
  s.supplies.water += water;
  s.supplies.oxygen += oxygen;
  const full = fit < 1 ? ' The hold is full, so the rest stays in the ground.' : '';
  if (!water && !oxygen) return hits ? `There's no room aboard for the ice.${full}` : 'The drill comes up dry.';
  return `You melt and crack ${plural(hits, 'chunk')} of ice into ${plural(water, 'tank')} of water and ${plural(oxygen, 'canister')} of oxygen.${full}`;
}

const repairGame = (difficulty = 0) => ({
  id: 'repair',
  band: (s) => (hasRole(s, 'engineer') ? 0.3 : 0.2) - difficulty * 0.05,
  speed: (s) => (s.morale < 30 ? 1.3 : 1) + difficulty * 0.2,
});

export const EVENTS = [
  {
    id: 'dust-storm', weight: 10, legs: ALL, title: 'Dust storm',
    text: () => 'A wall of dust rolls over the horizon. Within minutes you can barely see the bonnet.',
    choices: [
      {
        label: 'Hunker down for 2 sols',
        run: (s) => { waitSols(s, 2); return 'You seal the vents and wait. Two long sols later the sky turns butterscotch again.'; },
      },
      {
        label: 'Drive through it',
        run: (s) => {
          const pilot = hasRole(s, 'pilot');
          const dmg = between(s, 12, 26) * (pilot ? 0.5 : 1);
          damageRover(s, dmg);
          let msg = `You crawl on blind. The rover loses ${Math.round(dmg)}% condition.`;
          if (chance(s, pilot ? 0.15 : 0.4)) {
            const m = randomLiving(s);
            hurt(s, m, between(s, 15, 30), 'injury');
            msg += ` A hidden boulder throws ${m.name} against a bulkhead.`;
          }
          return msg;
        },
      },
    ],
  },
  {
    id: 'breakdown', weight: 12, legs: ALL, title: 'Breakdown',
    setup: (s) => ({ part: pick(s, ['front left wheel motor', 'steering actuator', 'battery coupling', 'rear suspension strut']) }),
    text: (s, ctx) => `The ${ctx.part} seizes with a horrible grinding noise.`,
    choices: [
      {
        label: 'Tighten it by hand',
        minigame: repairGame(),
        run: (s, ctx, { hits }) => {
          if (hits === 3) return 'Every bolt bites. Good as new, and no parts spent.';
          if (hits === 2) { damageRover(s, 8); return 'It holds, mostly. The rover loses 8% condition.'; }
          damageRover(s, 18);
          const m = randomLiving(s);
          hurt(s, m, 12, 'injury');
          return `The wrench slips and ${m.name} skins a knuckle through their glove. The rover loses 18% condition.`;
        },
      },
      {
        label: 'Swap in a spare part',
        need: (s) => (s.supplies.parts >= 1 ? null : 'No spare parts'),
        run: (s, ctx) => `You fit a new ${ctx.part}.${useParts(s, 1)}`,
      },
      {
        label: 'Ignore it and limp on',
        run: (s) => { damageRover(s, 25); return 'The grinding gets worse. The rover loses 25% condition.'; },
      },
    ],
  },
  {
    id: 'illness', weight: 12, legs: [2, 3, 4], title: 'Illness',
    when: (s) => living(s).some((m) => !m.sick),
    setup: (s) => ({ who: whoIndex(s, pick(s, living(s).filter((m) => !m.sick))) }),
    text: (s, ctx) => `${member(s, ctx).name} is coughing up red dust. Fine perchlorate has got past the airlock filters.`,
    choices: [
      {
        label: 'Use a med kit',
        need: (s) => (s.supplies.medkit >= 1 ? null : 'No med kits'),
        run: (s, ctx) => { s.supplies.medkit -= 1; heal(member(s, ctx), 10); return `${member(s, ctx).name} is patched up and breathing easier.`; },
      },
      {
        label: 'Let them rest it off',
        run: (s, ctx) => { member(s, ctx).sick = true; return `${member(s, ctx).name} is sick and will lose health each sol until they recover.`; },
      },
    ],
  },
  {
    id: 'leak', weight: 8, legs: ALL, title: 'Cabin leak',
    text: () => 'A seal by the airlock starts to hiss. Oxygen is venting into the thin Martian air.',
    choices: [
      {
        label: 'Replace the seal (1 spare part)',
        need: (s) => (s.supplies.parts >= 1 ? null : 'No spare parts'),
        run: (s) => { s.supplies.oxygen = Math.max(0, s.supplies.oxygen - 1); return `Fixed after losing a canister of oxygen.${useParts(s, 1)}`; },
      },
      {
        label: 'Tape it and hope',
        run: (s) => {
          const lost = chance(s, 0.5) ? between(s, 3, 6) : 1;
          s.supplies.oxygen = Math.max(0, s.supplies.oxygen - lost);
          return lost > 1 ? `The tape peels off overnight. You lose ${plural(lost, 'canister')} of oxygen.` : 'The tape holds. You lose one canister of oxygen.';
        },
      },
    ],
  },
  {
    id: 'ice', weight: 7, legs: [2, 3, 4], title: 'Ice deposit',
    text: () => 'Ground radar pings a shallow pocket of ice right under the track.',
    choices: [
      { label: 'Drill for it', minigame: { id: 'drill' }, run: (s, ctx, { hits }) => drillReward(s, hits) },
      { label: 'Keep driving', run: () => 'You leave the ice for someone thirstier.' },
    ],
  },
  {
    // Not random: the "Drill for ice" button raises it, once per leg.
    id: 'prospect', weight: 0, legs: [], title: 'Prospecting',
    text: () => 'You stop for the sol and sink the drill wherever the radar looks promising.',
    choices: [
      { label: 'Start drilling', minigame: { id: 'drill' }, run: (s, ctx, { hits }) => { waitSols(s, 1); return drillReward(s, hits); } },
      { label: 'Never mind', run: () => 'You pack the drill away.' },
    ],
  },
  {
    id: 'argument', weight: 7, legs: ALL, title: 'Crew argument',
    when: (s) => living(s).length >= 2,
    setup: (s) => {
      const [a, b] = living(s).slice().sort(() => (chance(s, 0.5) ? 1 : -1));
      return { a: whoIndex(s, a), b: whoIndex(s, b), topic: pick(s, ['whose turn it is to scrub the CO2 filters', 'the playlist', 'who ate the last chocolate ration', 'whether the dust storm was a "big one"']) };
    },
    text: (s, ctx) => `${s.crew[ctx.a].name} and ${s.crew[ctx.b].name} are shouting about ${ctx.topic}.`,
    choices: [
      {
        label: 'Sit them down and mediate',
        run: (s, ctx) => {
          if (chance(s, 0.6)) { addMorale(s, 6); return 'After an awkward hour they shake hands. Morale lifts.'; }
          addMorale(s, -6);
          return `${s.crew[ctx.a].name} storms off to the back of the rover. It did not go well.`;
        },
      },
      { label: 'Stay out of it', run: (s) => { addMorale(s, -10); return 'The sulking lasts for sols. Morale drops.'; } },
    ],
  },
  {
    id: 'wreck', weight: 4, legs: [2, 3], title: 'Crashed supply drone',
    text: () => 'A crashed supply drone glints at the bottom of a steep crater.',
    choices: [
      {
        label: 'Climb down and salvage it',
        run: (s) => {
          if (chance(s, 0.65)) {
            const parts = between(s, 1, 2);
            const fuel = between(s, 2, 4);
            s.supplies.parts += parts;
            s.supplies.fuel += fuel;
            return `Jackpot: ${plural(parts, 'spare part')} and ${plural(fuel, 'fuel cell')}.`;
          }
          const m = randomLiving(s);
          hurt(s, m, between(s, 20, 35), 'injury');
          return `The crater wall gives way under ${m.name}. They come back empty-handed and limping.`;
        },
      },
      { label: 'Not worth the climb', run: () => 'You drive on. It was probably empty anyway.' },
    ],
  },
  {
    id: 'solar-storm', weight: 5, legs: [3, 4], title: 'Radiation alert',
    text: () => 'Base radios a warning: a solar particle event will hit within the hour.',
    choices: [
      { label: 'Shelter for 2 sols', run: (s) => { waitSols(s, 2); return 'You pile water tanks around the bunks and wait. Everyone comes out fine.'; } },
      {
        label: 'Keep driving',
        run: (s) => {
          for (const m of living(s)) hurt(s, m, between(s, 10, 25), 'radiation');
          return 'The dosimeters click all afternoon. Everyone takes radiation damage.';
        },
      },
    ],
  },
  {
    id: 'dead-end', weight: 5, legs: [2, 3, 4], title: 'Dead end',
    text: () => 'The map was out of date. The canyon ahead ends in a sheer cliff.',
    choices: [
      { label: 'Backtrack', run: (s) => { const km = between(s, 40, 80); s.km = Math.max(0, s.km - km); return `You lose ${km} km finding another way round.`; } },
      {
        label: 'Bounce over the scree',
        run: (s) => { const dmg = hasRole(s, 'pilot') ? 10 : 22; damageRover(s, dmg); return `It works, at a cost of ${dmg}% rover condition.`; },
      },
    ],
  },
  {
    id: 'radio', weight: 8, legs: ALL, title: 'Messages from home',
    text: () => 'The relay passes over and drops a bundle of messages from Earth.',
    choices: [{ label: 'Read them aloud', tone: 'good', run: (s) => { addMorale(s, 12); return 'Somebody\'s nephew has learned the trumpet. Morale rises.'; } }],
  },
  {
    id: 'dust-devil', weight: 4, legs: ALL, title: 'Dust devil',
    text: () => 'A dust devil whirls straight over the rover and away.',
    choices: [{
      label: 'Check the solar panels', tone: 'good',
      run: (s) => { const fuel = between(s, 1, 3); s.supplies.fuel += fuel; return `It scoured the panels clean. The charge is worth ${plural(fuel, 'fuel cell')}.`; },
    }],
  },
  {
    id: 'quiet', weight: 20, legs: ALL,
    text: (s) => pick(s, [
      'A quiet sol. Phobos crosses the sky twice.',
      'Someone spots a blue sunset. Nobody admits to crying.',
      `${randomLiving(s).name} finds a rock that looks exactly like a potato.`,
      'The radio picks up nothing but static and, briefly, polka.',
      'Nothing happens, beautifully.',
    ]),
  },

  // Raised by travel() when the rover can't go on.
  {
    id: 'out-of-fuel', weight: 0, legs: [], title: 'Out of fuel',
    text: () => 'The last fuel cell is flat. The rover will not move another metre.',
    choices: [
      {
        label: `Pay base for a fuel drop (${TUNING.fuelDrop.cost} cr)`,
        need: (s) => (s.credits >= TUNING.fuelDrop.cost ? null : 'Not enough credits'),
        run: (s) => {
          s.credits -= TUNING.fuelDrop.cost;
          s.supplies.fuel += TUNING.fuelDrop.cells;
          waitSols(s, 1);
          return `A parachute drifts down a sol later with ${plural(TUNING.fuelDrop.cells, 'fuel cell')}.`;
        },
      },
      {
        label: 'Wait 3 sols for a passing convoy',
        run: (s) => {
          waitSols(s, 3);
          if (s.over) return 'Nobody came.';
          if (chance(s, 0.4)) { s.supplies.fuel += 4; return 'A mining convoy stops and spares you 4 fuel cells.'; }
          return 'Three sols of empty horizon. Nobody comes.';
        },
      },
    ],
  },
  {
    id: 'rover-dead', weight: 0, legs: [], title: 'The rover is dead',
    text: () => 'With a final clunk the drivetrain gives out. The rover won\'t move until it\'s fixed.',
    choices: (s) => {
      const kits = hasRole(s, 'engineer') ? 1 : 2;
      return [
        {
          label: `Rebuild the drivetrain (${plural(kits, 'spare part')})`,
          need: () => (s.supplies.parts >= kits ? null : 'Not enough spare parts'),
          run: () => { s.supplies.parts -= kits; s.rover = 50; return 'Hours of swearing later, it runs. 50% condition.'; },
        },
        {
          label: 'Jury-rig it',
          minigame: repairGame(1),
          run: (_, ctx, { hits }) => {
            if (hits >= 2) { s.rover = clamp(10 + hits * 8); return `It splutters back to life at ${Math.round(s.rover)}% condition.`; }
            waitSols(s, 1);
            return 'It doesn\'t hold. You lose a sol and the rover still won\'t move.';
          },
        },
        {
          label: `Pay for a tow (${TUNING.tow.cost} cr)`,
          need: () => (s.credits >= TUNING.tow.cost ? null : 'Not enough credits'),
          run: () => {
            s.credits -= TUNING.tow.cost;
            waitSols(s, 2);
            s.rover = TUNING.tow.condition;
            return `A tow crawler arrives after two sols and patches the ${vehicle(s).name} up.`;
          },
        },
      ];
    },
  },
];
