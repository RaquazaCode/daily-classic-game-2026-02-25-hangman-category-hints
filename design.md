# Design: Hangman with Category Hints

## Concept
A deterministic single-player Hangman adaptation where each round reveals a category hint and the player guesses letters via keyboard or on-screen key grid.

## Twist
Category hints are always visible from round start, reducing randomness and shifting challenge toward efficient letter choice for higher score.

## Core Loop
1. Start round (`Enter`) to select deterministic word from rotating bank.
2. Guess letters with A-Z keys or mouse clicks.
3. Correct letters reveal slots and add score.
4. Wrong letters draw hangman segments and reduce score.
5. Round ends on solve or 6 misses.
6. `Enter` starts next round; `P` pauses; `R` resets run while preserving best score.

## Presentation and Effects
- Full-screen neon/synthwave scene with animated parallax background and kinetic rope sway.
- Split layout keeps stage and keyboard visible without overlap on desktop and mobile breakpoints.
- Lottie micro/macro animations: loading idle, correct guess pulse, win celebration, and lose feedback.
- WebAudio synth soundtrack plus hit/miss/win/lose SFX with explicit audio-unlock handling.

## Determinism
- Word order uses cursor-based modulo indexing into a fixed in-source bank.
- `window.advanceTime(ms)` advances elapsed time in fixed 60 FPS steps.
- `window.render_game_to_text()` emits concise JSON state plus audio status for automation checks.

## Failure/Recovery
- Duplicate or invalid guesses are ignored safely.
- Pause blocks time progression.
- Reset returns to ready mode with persistent best score.
