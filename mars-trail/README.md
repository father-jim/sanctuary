# Mars trail

A browser game in the spirit of Oregon Trail: outfit a vehicle at Jezero Base, then drive 1,800 km across Mars to Sanctuary.
It's plain HTML, CSS and ES modules with no build step. Serve this folder and open it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Screens

- `index.html` is the outfitting screen: vehicle, crew size and supplies. "Depart" saves the loadout to `localStorage` as `sanctuary.loadout` and starts a fresh journey.
- `journey.html` is the trip itself. Each "Drive on" is one sol: the crew eats, drinks and breathes, the rover burns fuel and wears down, and an event may strike. The run is saved to `localStorage` as `sanctuary.run` after every action, so a reload carries on where you left off.

## How the journey plays

- **Orders.** Pace (crawl, steady, push) trades speed against fuel and rover wear. Rations (full, lean, bare) trade food against health and morale. Resting a sol heals the crew and lifts morale.
- **Waypoints.** Hesperia Outpost and Syrtis Relay sell supplies at a mark-up and do repairs; Isidis Beacon repairs the rover for free.
- **Events.** About one sol in three brings an event drawn from a weighted table for the current leg: dust storms, breakdowns, illness, leaks, ice, arguments, salvage, radiation alerts, dead ends and a few lucky breaks. Most offer a choice.
- **Mini-games.** Breakdowns can be fixed by hand in a timing game (stop the needle in the green, three bolts). Ice deposits, and the "Drill for ice" order once per leg, open a tapping game that turns ice into water and oxygen.
- **Crew.** Each crew member gets a random name and role: Pilot, Engineer, Medic, Botanist, Geologist or Tourist, each with one perk.
- **Ending.** You win by reaching Sanctuary with anyone alive. You lose if the whole crew dies. Running out of fuel or wrecking the rover leaves you paying for help or waiting it out while supplies run down.
- **Score** = survivors × 500 + a tenth of the leftover supplies' value + sols saved against the outfitting estimate × 20, times the vehicle's multiplier (Rover ×3, Skimmer ×2, Hauler ×1).

## Code

- `src/data.js` holds the outfitting numbers: starting credits, trip distance, vehicles and supplies.
- `src/loadout.js` does the budget, cargo and how-long-supplies-last maths, with no DOM code.
- `src/outfitting.js` renders the outfitting screen.
- `src/journey-data.js` holds the journey's tuning: waypoints, paces, rations, roles, names and damage numbers.
- `src/run.js` is the journey's rules as plain functions over one state object, with a seeded random generator. No DOM code, so it can be driven from Node for balance runs.
- `src/events.js` is the event table. Each event's choices apply their own outcome.
- `src/minigames/` holds the canvas mini-games. Each exports `play(host, options)`, which returns a promise of `{ score, hits }`.
- `src/journey.js` renders the journey screen and wires its buttons to `run.js`.
