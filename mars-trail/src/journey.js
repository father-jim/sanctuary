// The journey screen: renders the run from run.js and turns clicks into its actions.
import { SUPPLIES, TRIP_DISTANCE_KM } from './data.js';
import { WAYPOINTS, LEG_NAMES, PACES, RATIONS, ROLES } from './journey-data.js';
import { EVENTS } from './events.js';
import * as run from './run.js';
import * as repair from './minigames/repair.js';
import * as drill from './minigames/drill.js';

const MINIGAMES = { repair, drill };
const $ = (id) => document.getElementById(id);
const pct = (n) => `${Math.round(n)}%`;
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let s = run.load();
if (!s) {
  let loadout = null;
  try { loadout = JSON.parse(localStorage.getItem('sanctuary.loadout')); } catch {}
  if (!loadout) location.replace('index.html');
  else { s = run.createRun(loadout); run.save(s); }
}

let autoTimer = null;

function render() {
  const next = run.nextWaypoint(s);
  const wp = run.here(s);
  $('where').textContent = s.over ? `Sol ${s.sol - 1}` : `Sol ${s.sol} · ${s.docked ? wp.name : `Crossing ${LEG_NAMES[run.leg(s)]}`}`;
  $('headline').textContent = s.over?.won
    ? 'You made it to Sanctuary'
    : `${Math.round(TRIP_DISTANCE_KM - s.km).toLocaleString()} km to Sanctuary`;

  $('track').innerHTML = `
    <div class="track__line"><span style="width:${(s.km / TRIP_DISTANCE_KM) * 100}%"></span></div>
    ${WAYPOINTS.map((w, i) => `
      <span class="track__stop ${i <= s.waypoint ? 'passed' : ''}" style="left:${(w.km / TRIP_DISTANCE_KM) * 100}%">
        <span class="track__label">${w.name}</span>
      </span>`).join('')}
    <span class="track__rover" style="left:${(s.km / TRIP_DISTANCE_KM) * 100}%"></span>`;

  $('crew').innerHTML = s.crew.map((m) => `
    <li class="${m.alive ? '' : 'dead'}">
      <div class="crewlist__name"><strong>${m.name}</strong>
        <span class="tag" title="${ROLES[m.role].perk}">${ROLES[m.role].name}</span>
        ${m.sick && m.alive ? '<span class="tag sick">Sick</span>' : ''}
      </div>
      ${m.alive
        ? `<div class="meter health ${m.health < 35 ? 'low' : ''}"><span style="width:${m.health}%"></span></div>`
        : `<p class="death">${m.death}</p>`}
    </li>`).join('');

  $('stock').innerHTML = SUPPLIES.map((item) => {
    const left = run.solsLeft(s, item.id);
    const remaining = run.living(s).length ? Math.ceil((TRIP_DISTANCE_KM - s.km) / run.vehicle(s).speedKmPerSol) : 0;
    const short = left !== null && left < remaining;
    return `<tr>
      <th scope="row">${item.name}</th>
      <td>${Math.floor(s.supplies[item.id] * 10) / 10} <span class="unit">${s.supplies[item.id] === 1 ? item.unit : `${item.unit}s`}</span></td>
      <td class="${short ? 'short' : ''}">${left === null ? 'spare' : left === Infinity ? 'growing' : `${left} sols`}</td>
    </tr>`;
  }).join('');

  $('rover-label').textContent = pct(s.rover);
  $('rover-bar').style.width = pct(s.rover);
  $('rover-bar').classList.toggle('bad', s.rover < 25);
  $('morale-label').textContent = pct(s.morale);
  $('morale-bar').style.width = pct(s.morale);
  $('morale-bar').classList.toggle('bad', s.morale < 30);

  $('log').innerHTML = s.log.slice().reverse().slice(0, 40)
    .map((l) => `<li class="${l.tone}"><span class="log__sol">Sol ${l.sol}</span> ${escape(l.text)}</li>`).join('');

  $('credits').textContent = `${s.credits.toLocaleString()} cr`;
  $('next-stop').textContent = next ? `${next.name}, ${Math.round(next.km - s.km)} km` : 'None';
  for (const name of ['pace', 'rations']) {
    for (const input of document.querySelectorAll(`input[name="${name}"]`)) input.checked = input.value === s[name];
  }
  $('order-hint').textContent = `${PACES[s.pace].hint} ${RATIONS[s.rations].hint}`;

  const busy = Boolean(s.over || s.pending || s.docked);
  $('drive').disabled = busy || Boolean(autoTimer);
  $('rest').disabled = busy || Boolean(autoTimer);
  $('auto').disabled = busy && !autoTimer;
  $('auto').textContent = autoTimer ? 'Stop' : 'Keep driving';
  const drilled = s.drilledLegs.includes(run.leg(s));
  $('drill').disabled = busy || Boolean(autoTimer) || drilled || run.leg(s) === 1;
  $('drill').title = run.leg(s) === 1 ? 'No ice this close to base.' : drilled ? 'Already drilled on this leg.' : 'Spend a sol drilling for water and oxygen.';
}

function renderSegmented(id, name, options) {
  $(id).innerHTML = Object.entries(options).map(([value, o]) => `
    <label><input type="radio" name="${name}" value="${value}"><span>${o.label}</span></label>`).join('');
  $(id).addEventListener('change', (e) => { s[name] = e.target.value; run.save(s); render(); });
}

// After every action: save, redraw, and open whatever needs the player next.
function step() {
  run.save(s);
  render();
  if (s.over) return showEnd();
  if (s.pending) return showEvent();
  if (s.docked) return showWaypoint();
}

function stopAuto() {
  clearTimeout(autoTimer);
  autoTimer = null;
}

function autoDrive() {
  run.travel(s, EVENTS);
  if (s.over || s.pending || s.docked) stopAuto();
  else autoTimer = setTimeout(autoDrive, 350);
  step();
}

// Events

function showEvent() {
  const { id, ctx } = s.pending;
  const event = EVENTS.find((e) => e.id === id);
  const dialog = $('event-dialog');
  $('event-title').textContent = event.title;
  $('event-text').textContent = event.text(s, ctx);
  $('minigame').innerHTML = '';
  $('event-choices').innerHTML = run.choicesFor(s, event, ctx).map((c, i) => `
    <button type="button" data-choice="${i}" ${c.blocked ? 'disabled' : ''}>
      ${c.label}${c.minigame ? ' <span class="badge">mini-game</span>' : ''}
      ${c.blocked ? `<span class="why">${c.blocked}</span>` : ''}
    </button>`).join('');
  if (!dialog.open) dialog.showModal();
}

$('event-choices').addEventListener('click', async (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.dataset.continue !== undefined) {
    $('event-dialog').close();
    return step();
  }
  const index = Number(button.dataset.choice);
  const { id, ctx } = s.pending;
  const event = EVENTS.find((ev) => ev.id === id);
  const choice = run.choicesFor(s, event, ctx)[index];
  let result;
  if (choice.minigame) {
    $('event-choices').innerHTML = '';
    const { id: game, band, speed } = choice.minigame;
    result = await MINIGAMES[game].play($('minigame'), { band: band?.(s), speed: speed?.(s) });
    $('minigame').innerHTML = '';
  }
  if (id === 'prospect' && choice.minigame) s.drilledLegs.push(run.leg(s));
  const outcome = run.resolve(s, EVENTS, index, result);
  run.save(s);
  render();
  $('event-text').textContent = outcome;
  $('event-choices').innerHTML = '<button type="button" class="primary" data-continue>Continue</button>';
  $('event-choices').querySelector('button').focus();
});

// Waypoints

function showWaypoint() {
  const wp = run.here(s);
  const next = run.nextWaypoint(s);
  $('waypoint-title').textContent = wp.name;
  $('waypoint-text').textContent = wp.blurb;

  const v = run.vehicle(s);
  $('shop').innerHTML = `
    ${wp.shop ? `
      <table class="supplies shop">
        <thead><tr><th>Item</th><th>Price</th><th>Have</th><th>Buy</th></tr></thead>
        <tbody>${SUPPLIES.map((item) => `
          <tr>
            <th scope="row">${item.name}</th>
            <td>${run.priceAt(item, wp)} cr</td>
            <td>${Math.floor(s.supplies[item.id] * 10) / 10}</td>
            <td class="buy">
              <button type="button" data-buy="${item.id}" data-qty="1">+1</button>
              <button type="button" data-buy="${item.id}" data-qty="5">+5</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}
    <dl class="shop__totals">
      <div><dt>Credits</dt><dd>${s.credits.toLocaleString()} cr</dd></div>
      <div><dt>Cargo</dt><dd>${Math.round(run.cargoMass(s)).toLocaleString()} / ${v.cargoKg.toLocaleString()} kg</dd></div>
      <div><dt>Rover</dt><dd>${pct(s.rover)}</dd></div>
    </dl>`;

  const { cost, amount } = wp.repair;
  const canRepair = s.rover < 100 && s.credits >= cost;
  $('waypoint-actions').innerHTML = `
    <button type="button" data-action="repair" ${canRepair ? '' : 'disabled'}>
      Repair the rover (+${amount}%, ${cost ? `${cost} cr` : 'free'})
    </button>
    <button type="button" data-action="rest">Rest here a sol</button>
    <button type="button" class="primary" data-action="leave">Set off for ${next.name}</button>`;
  const dialog = $('waypoint-dialog');
  if (!dialog.open) dialog.showModal();
}

$('waypoint-dialog').addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  if (button.dataset.buy) run.buy(s, button.dataset.buy, Number(button.dataset.qty));
  const action = button.dataset.action;
  if (action === 'repair') run.repairAt(s);
  if (action === 'rest') run.rest(s);
  if (action === 'leave') {
    run.leaveWaypoint(s);
    $('waypoint-dialog').close();
  }
  step();
  if (s.docked && !s.over) showWaypoint();
});

// Ending

function showEnd() {
  for (const d of document.querySelectorAll('dialog[open]')) if (d.id !== 'end-dialog') d.close();
  const won = s.over.won;
  const sc = run.score(s);
  // s.sol has already ticked past the sol the run ended on.
  $('end-eyebrow').textContent = won ? `Arrived on sol ${s.sol - 1}` : `Lost on sol ${s.sol - 1}`;
  $('end-title').textContent = won ? 'Welcome to Sanctuary' : 'The expedition is lost';
  $('end-reason').textContent = s.over.reason;
  $('end-crew').innerHTML = s.crew.map((m) => (m.alive
    ? `<li class="good">${m.name} (${ROLES[m.role].name}) walked through the airlock with ${m.health}% health.</li>`
    : `<li class="bad">${m.death}</li>`)).join('');
  $('end-score').innerHTML = won ? `
    <div><dt>Survivors</dt><dd>${sc.survivors}</dd></div>
    <div><dt>Supplies left</dt><dd>${sc.supplies}</dd></div>
    <div><dt>Sols saved</dt><dd>${sc.saved}</dd></div>
    <div><dt>${run.vehicle(s).name} bonus</dt><dd>×${sc.multiplier}</dd></div>
    <div class="total"><dt>Score</dt><dd>${sc.total.toLocaleString()}</dd></div>` : '';
  const dialog = $('end-dialog');
  if (!dialog.open) dialog.showModal();
}

$('new-run').addEventListener('click', () => {
  try { localStorage.removeItem(run.SAVE_KEY); } catch {}
});

// Escape shouldn't dismiss a decision the game is waiting on.
for (const d of document.querySelectorAll('dialog')) d.addEventListener('cancel', (e) => e.preventDefault());

$('drive').addEventListener('click', () => { run.travel(s, EVENTS); step(); });
$('rest').addEventListener('click', () => { run.rest(s); step(); });
$('drill').addEventListener('click', () => { run.raise(s, EVENTS, 'prospect'); step(); });
$('auto').addEventListener('click', () => {
  if (autoTimer) { stopAuto(); render(); } else autoDrive();
});

if (s) {
  renderSegmented('pace', 'pace', PACES);
  renderSegmented('rations', 'rations', RATIONS);
  step();
}
