import assert from 'node:assert/strict';
import { createInitialState, chooseWord } from '../src/game.js';

const bank = [
  { category: 'Animals', answer: 'OTTER' },
  { category: 'Space', answer: 'NEBULA' }
];

const state = createInitialState(bank);
assert.equal(state.mode, 'ready', 'state should boot in ready mode');

const picked = chooseWord(bank, 1);
assert.equal(picked.answer, 'NEBULA', 'deterministic index should pick second word');

console.log('self_check complete');
