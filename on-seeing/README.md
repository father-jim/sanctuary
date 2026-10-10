# On Seeing

A perpetual, generative reading about what a designed image does to the person who looks at it.

Open `index.html` (or serve the folder statically). Text prints onto a white sheet one or two lines at a time, for as long as the page is open. Click anywhere, or the **listen** button, to have it read aloud (`m` toggles the voice).

## How it is generated

- **Deck**: `corpus.js` holds 150 hand-written cards in eleven themes (seeing, space, simplicity, type, color, order, honesty, thinking, play, beauty, symbol). Each visit shuffles every theme with its own seed. Each paragraph is one hand: two to four cards from one theme.
- **Grammar**: up to two freshly assembled sentences are shuffled into each hand, built from sentence templates and word lists (many thousands of combinations). Recent sentences aren't repeated.
- **Edition**: the seed appears bottom right. `?seed=1234` replays an edition exactly.

The writing is original and paraphrases the ideas of Sagmeister, Munari, de Bono, Tanaka, Rams, Rand, Vignelli, Kenya Hara, Müller-Brockmann, Glaser, Bass, Warde, Albers, Gerstner, Maeda, Scher and Frutiger. Nothing is quoted directly.

## Voice

The voice comes from the browser's speech synthesis, which picks the best female English voice it can find (Aria/Jenny on Edge, Samantha/Ava on Apple, Google UK English Female on Chrome). Quality depends on the device. Browsers only allow speech after someone has clicked the page.

- `?voice=Ava` prefers a voice whose name contains that text
- `?rate=0.85` sets the speaking pace (default 0.9)

## Type

[Doto](https://fonts.google.com/specimen/Doto), a dot-matrix variable font, with its roundness axis at 100 so every dot is round.
