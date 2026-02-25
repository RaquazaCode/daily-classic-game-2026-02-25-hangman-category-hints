# 2026-02-25 Hangman Category Hints Implementation Plan

## Scope
Ship an unattended-safe MVP of Hangman (digital) with the "category hints" twist and deterministic automation hooks.

## Plan
1. Scaffold pnpm + Vite project with canonical folder layout.
2. Add failing self-check for deterministic word pick and state transitions.
3. Implement pure game state module (`src/game.js`) with start, guess, pause, reset, score rules.
4. Implement canvas UI and input handling in `src/main.js`.
5. Expose `window.advanceTime(ms)` and `window.render_game_to_text()`.
6. Verify with `pnpm test`, `pnpm build`, and Playwright captures.
7. Produce README/design/progress artifacts and commit in micro slices.
8. Publish using feature branch PR + merge commit, then deploy preview.
