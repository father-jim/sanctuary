import { STARTING_CREDITS, TRIP_DISTANCE_KM, VEHICLES, SUPPLIES } from './data.js';
import { evaluate, solsOfSupply, tripSols } from './loadout.js';

const state = {
  vehicleId: 'rover',
  crew: 2,
  supplies: { food: 20, water: 10, oxygen: 20, fuel: 20, parts: 1, medkit: 1 },
};

const $ = (id) => document.getElementById(id);

function renderVehicles() {
  $('vehicles').innerHTML = VEHICLES.map((v) => `
    <label class="vehicle">
      <input type="radio" name="vehicle" value="${v.id}" ${v.id === state.vehicleId ? 'checked' : ''}>
      <span class="vehicle__card">
        <strong>${v.name}</strong>
        <span class="vehicle__blurb">${v.blurb}</span>
        <span class="vehicle__stats">
          <span>${v.price.toLocaleString()} cr</span>
          <span>${v.seats} seats</span>
          <span>${v.cargoKg.toLocaleString()} kg</span>
          <span>${tripSols(v)} sols</span>
        </span>
      </span>
    </label>`).join('');
}

function renderSupplies() {
  $('supplies').innerHTML = SUPPLIES.map((item) => `
    <tr>
      <th scope="row">${item.name}<span class="unit">per ${item.unit}</span></th>
      <td>${item.price} cr</td>
      <td>${item.massKg} kg</td>
      <td><input type="number" min="0" max="999" step="1" data-item="${item.id}"
        value="${state.supplies[item.id] || 0}" aria-label="${item.name} quantity"></td>
      <td data-lasts="${item.id}"></td>
    </tr>`).join('');
}

function update() {
  const r = evaluate(state);

  $('crew-count').textContent = state.crew;
  $('crew-hint').textContent = `The ${r.vehicle.name} seats up to ${r.vehicle.seats}. More crew means more hands for repairs and more mouths to feed.`;
  $('crew-minus').disabled = state.crew <= 1;
  $('crew-plus').disabled = state.crew >= r.vehicle.seats;

  for (const item of SUPPLIES) {
    const lasts = solsOfSupply(item, state.supplies[item.id] || 0, r.vehicle, state.crew);
    const cell = document.querySelector(`[data-lasts="${item.id}"]`);
    cell.textContent = lasts === null ? 'spare' : `${lasts} sols`;
    cell.classList.toggle('short', lasts !== null && lasts < r.sols);
  }

  $('credits').textContent = `${r.credits.toLocaleString()} / ${STARTING_CREDITS.toLocaleString()}`;
  $('credits').classList.toggle('bad', r.credits < 0);
  $('cargo').textContent = `${r.cargo.toLocaleString()} / ${r.vehicle.cargoKg.toLocaleString()} kg`;
  $('cargo').classList.toggle('bad', r.cargo > r.vehicle.cargoKg);
  $('trip-days').textContent = `${r.sols} sols`;

  const bar = $('cargo-bar');
  bar.style.width = `${Math.min(100, (r.cargo / r.vehicle.cargoKg) * 100)}%`;
  bar.classList.toggle('bad', r.cargo > r.vehicle.cargoKg);

  $('warnings').innerHTML = [
    ...r.errors.map((m) => `<li class="error">${m}</li>`),
    ...r.warnings.map((m) => `<li>${m}</li>`),
  ].join('');
  $('launch').disabled = !r.ok;
}

$('trip-distance').textContent = TRIP_DISTANCE_KM.toLocaleString();
renderVehicles();
renderSupplies();

$('vehicles').addEventListener('change', (e) => {
  state.vehicleId = e.target.value;
  const seats = VEHICLES.find((v) => v.id === state.vehicleId).seats;
  state.crew = Math.min(state.crew, seats);
  update();
});
$('crew-minus').addEventListener('click', () => { state.crew -= 1; update(); });
$('crew-plus').addEventListener('click', () => { state.crew += 1; update(); });
$('supplies').addEventListener('input', (e) => {
  const qty = Math.max(0, Math.floor(Number(e.target.value) || 0));
  state.supplies[e.target.dataset.item] = qty;
  update();
});
$('launch').addEventListener('click', () => {
  const loadout = { ...state, supplies: { ...state.supplies } };
  try {
    localStorage.setItem('sanctuary.loadout', JSON.stringify(loadout));
    localStorage.removeItem('sanctuary.run'); // a new loadout starts a new journey
  } catch {}
  const r = evaluate(state);
  $('loadout').textContent = `The ${r.vehicle.name} is loaded with ${state.crew} crew and ${r.cargo.toLocaleString()} kg of cargo, with ${r.credits.toLocaleString()} credits to spend on the way.`;
  $('depart-dialog').showModal();
});

try {
  const saved = JSON.parse(localStorage.getItem('sanctuary.run'));
  $('resume').hidden = !saved || Boolean(saved.over);
} catch {}

update();
