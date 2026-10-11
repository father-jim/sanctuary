// Pure loadout maths, kept apart from the DOM so later screens (and tests) can reuse it.
import { STARTING_CREDITS, TRIP_DISTANCE_KM, VEHICLES, SUPPLIES } from './data.js';

export function vehicleById(id) {
  return VEHICLES.find((v) => v.id === id);
}

export function usePerSol(item, vehicle, crew) {
  if (item.perCrewPerSol) return item.perCrewPerSol * crew;
  if (item.perVehiclePerSol) return vehicle.fuelPerSol;
  return 0;
}

export function tripSols(vehicle) {
  return Math.ceil(TRIP_DISTANCE_KM / vehicle.speedKmPerSol);
}

// How many sols a quantity of an item lasts, or null if it isn't consumed over time.
export function solsOfSupply(item, qty, vehicle, crew) {
  const use = usePerSol(item, vehicle, crew);
  return use ? Math.floor(qty / use) : null;
}

export function evaluate(state) {
  const vehicle = vehicleById(state.vehicleId);
  let spent = vehicle.price;
  let cargo = 0;
  for (const item of SUPPLIES) {
    const qty = state.supplies[item.id] || 0;
    spent += qty * item.price;
    cargo += qty * item.massKg;
  }

  const sols = tripSols(vehicle);
  const errors = [];
  const warnings = [];
  const credits = STARTING_CREDITS - spent;

  if (credits < 0) errors.push(`Over budget by ${-credits} credits.`);
  if (cargo > vehicle.cargoKg) errors.push(`Overloaded by ${cargo - vehicle.cargoKg} kg.`);
  if (state.crew > vehicle.seats) errors.push(`The ${vehicle.name} only seats ${vehicle.seats}.`);

  for (const item of SUPPLIES) {
    const lasts = solsOfSupply(item, state.supplies[item.id] || 0, vehicle, state.crew);
    if (lasts !== null && lasts < sols) {
      warnings.push(`${item.name}: enough for ${lasts} of ${sols} sols.`);
    }
  }
  if (!state.supplies.parts) warnings.push('No spare parts. One breakdown could strand you.');
  if (!state.supplies.medkit) warnings.push('No med kits on board.');

  return { vehicle, spent, credits, cargo, sols, errors, warnings, ok: errors.length === 0 };
}
