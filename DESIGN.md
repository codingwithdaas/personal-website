# keerat.fyi: design notes

## Concept: dusk to night
One long scroll through an evening. The page opens at golden hour and gets darker as you scroll, until it's night at the contact section. The sky follows the current time where Keerat is (America/Los_Angeles), capped at late twilight so the top always keeps some warmth. Visitors can scrub it with the sky slider.

## Colour
The sky is four live CSS variables (`--sky-0`…`--sky-3`, plus `--glow`), mixed in `main.js` from four keyframes: golden hour, sunset, twilight, night. Everything else is fixed:

| token | value | use |
|---|---|---|
| `--cream` | #fbf1e4 | text |
| `--amber` | #ffc27a | accent, italic headings, the sun |
| `--rose` | #f2898f | Seva card |
| `--violet` | #b9a6ff | Sound card |
| `--ink` | #090b20 | deepest night, page background |

Card "elements": Music #ffc27a · Energy #ffe08a · Bio #8fe0d0 · Seva #f2898f · Sound #b9a6ff.

## Type
- **Fraunces** (variable, self-hosted) for display, with SOFT 100. Italics use WONK 1 for the accent words.
- **Manrope** (variable, self-hosted) for body and UI.

## Motion
Native only: CSS transitions, canvas, and three.js for the tabla. There's no animation library. Everything is stilled under `prefers-reduced-motion`. The tabla, stars and card art only render while they're on screen.

## Interactive pieces
- **Sky slider** (hero): native range input, keyboard accessible.
- **3D tabla** (`build/src/tabla.js` → `assets/tabla.js`, loaded lazily): drag to turn, tap the heads to play. Dayan: rim Na · middle Tin · syahi Tun. Bayan: open Ge · syahi Ke. Keys J K L D F. The Teentaal button plays the 16-beat theka.
- **Tanpura** (nav): a synthesized Pa–Sa–Sa–Sa drone, off by default.
- **Project cards**: flip, collection counter, filters, holo tilt (fine pointers only).
- **Sunset strip**: hovering a photo tints the page with its light; click to open the lightbox.
- **Thoughts**: cycles the quotes and sends a shooting star.

## Sound
All audio is synthesized with the Web Audio API in `assets/audio.js`, so there are no audio files. To use real recorded tabla strokes, replace the `strokes` functions with AudioBuffer playback.

## Editing content
- **Thoughts:** the `THOUGHTS` array in `assets/sections.js`.
- **Projects:** the `<article class="card">` blocks in `index.html`. Set `data-tags` (bio / web / energy / seva) for the filters and `--el` for the colour.
- **Sunset photos:** the `<li>` items in `#strip`. `data-glow` is the colour the page borrows.
- **The PCA star map:** `assets/data/pca.json`, recomputed from the WDBC dataset (StandardScaler → PCA(2)), same as the repo's figure (63.2% variance).

## Rebuilding the tabla bundle
```
cd build && npm i three esbuild
npx esbuild src/tabla.js --bundle --format=esm --minify --outfile=../site/assets/tabla.js
```
