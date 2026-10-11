# Mars trail

## Outfitting screen prototype

The opening screen where the player picks a vehicle, crew size and supplies for the trip to Sanctuary.
It's plain HTML, CSS and ES modules with no build step. Serve this folder and open it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

- `src/data.js` holds the tuning numbers: starting credits, trip distance, vehicles and supplies.
- `src/loadout.js` does the budget, cargo and how-long-supplies-last maths, with no DOM code.
- `src/outfitting.js` renders the screen. "Depart" saves the loadout to `localStorage` as `sanctuary.loadout` for the next screen to pick up.
