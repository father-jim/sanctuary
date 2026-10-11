// Tuning numbers for the outfitting screen. Everything the player can buy lives here.

export const STARTING_CREDITS = 15000;
export const TRIP_DISTANCE_KM = 1800;

export const VEHICLES = [
  {
    id: 'rover',
    name: 'Pathfinder Rover',
    blurb: 'Light and cheap. Not much room for anything.',
    price: 3000,
    seats: 3,
    cargoKg: 900,
    speedKmPerSol: 90,
    fuelPerSol: 1,
  },
  {
    id: 'hauler',
    name: 'Ares Hauler',
    blurb: 'Slow, sturdy, and carries everything.',
    price: 6500,
    seats: 6,
    cargoKg: 2600,
    speedKmPerSol: 60,
    fuelPerSol: 2,
  },
  {
    id: 'skimmer',
    name: 'Dust Skimmer',
    blurb: 'Fast over flat ground. Drinks fuel.',
    price: 8000,
    seats: 4,
    cargoKg: 1400,
    speedKmPerSol: 150,
    fuelPerSol: 3,
  },
];

// perCrewPerSol: units one crew member uses each sol. perVehiclePerSol: units the vehicle uses.
// Items with neither are spares that don't run down on their own.
export const SUPPLIES = [
  { id: 'food', name: 'Food rations', unit: 'crate', price: 40, massKg: 10, perCrewPerSol: 0.5 },
  { id: 'water', name: 'Water', unit: 'tank', price: 25, massKg: 20, perCrewPerSol: 0.25 },
  { id: 'oxygen', name: 'Oxygen', unit: 'canister', price: 60, massKg: 8, perCrewPerSol: 0.5 },
  { id: 'fuel', name: 'Fuel cells', unit: 'cell', price: 80, massKg: 15, perVehiclePerSol: true },
  { id: 'parts', name: 'Spare parts', unit: 'kit', price: 150, massKg: 25 },
  { id: 'medkit', name: 'Med kits', unit: 'kit', price: 120, massKg: 5 },
];
