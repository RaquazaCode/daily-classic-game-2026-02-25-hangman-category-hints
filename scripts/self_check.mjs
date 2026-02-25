import assert from 'node:assert/strict';
import {
  applyGuess,
  buildTextSnapshot,
  chooseWord,
  createInitialState,
  startRound,
  stepState,
  togglePause
} from '../src/game.js';

const bank = [
  { category: 'Animals', answer: 'OTTER' },
  { category: 'Space', answer: 'NEBULA' }
];

const picked = chooseWord(bank, 1);
assert.equal(picked.answer, 'NEBULA', 'deterministic index should pick second word');

let state = createInitialState(bank);
assert.equal(state.mode, 'ready', 'state should boot in ready mode');

state = startRound(state);
assert.equal(state.mode, 'playing', 'enter should start round');
assert.equal(state.category, 'Animals', 'first round should pull first category');

state = applyGuess(state, 'O');
assert.equal(state.score, 40, 'correct guess should add points');
assert.equal(state.wrongGuesses.length, 0, 'correct guess should not add misses');
assert.equal(state.lastGuessResult, 'hit', 'correct guess should flag hit result');

state = applyGuess(state, 'Z');
assert.equal(state.wrongGuesses.length, 1, 'wrong guess should increase misses');
assert.equal(state.score, 30, 'wrong guess should reduce points with floor at 0');
assert.equal(state.lastGuessResult, 'miss', 'wrong guess should flag miss result');

state = stepState(state, 1000);
assert.equal(state.elapsedMs, 1000, 'step should advance elapsed time while playing');

state = togglePause(state);
assert.equal(state.mode, 'paused', 'pause toggles from playing');
const pausedTime = state.elapsedMs;
state = stepState(state, 1000);
assert.equal(state.elapsedMs, pausedTime, 'time does not advance while paused');
state = togglePause(state);
assert.equal(state.mode, 'playing', 'pause toggle resumes');

for (const letter of ['T', 'E', 'R']) {
  state = applyGuess(state, letter);
}
assert.equal(state.mode, 'won', 'all letters guessed should win round');
assert.ok(state.score >= 230, 'round completion should include bonus');

const snapshot = buildTextSnapshot(state);
assert.equal(snapshot.mode, 'won', 'text snapshot reflects mode');
assert.equal(snapshot.category, 'Animals', 'text snapshot includes category hint');
assert.equal(snapshot.masked_word, 'O T T E R', 'text snapshot includes masked word view');
assert.equal(snapshot.last_guess_result, 'hit', 'text snapshot includes last guess result');

console.log('self_check complete');
