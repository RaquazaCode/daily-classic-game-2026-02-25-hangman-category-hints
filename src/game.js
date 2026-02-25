export const MAX_WRONG_GUESSES = 6;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const DEFAULT_WORD_BANK = [
  { category: 'Animals', answer: 'OTTER' },
  { category: 'Space', answer: 'NEBULA' },
  { category: 'Foods', answer: 'WAFFLE' },
  { category: 'Geography', answer: 'DESERT' },
  { category: 'Music', answer: 'GUITAR' },
  { category: 'Nature', answer: 'MEADOW' }
];

function normalizeAnswer(answer) {
  return answer.toUpperCase().replace(/[^A-Z ]/g, '');
}

export function chooseWord(wordBank, seedIndex) {
  if (!Array.isArray(wordBank) || wordBank.length === 0) {
    throw new Error('wordBank must contain at least one entry');
  }
  const index = Math.abs(seedIndex) % wordBank.length;
  const item = wordBank[index];
  return {
    category: item.category,
    answer: normalizeAnswer(item.answer)
  };
}

export function createInitialState(wordBank = DEFAULT_WORD_BANK) {
  return {
    mode: 'ready',
    pauseBeforeMode: null,
    wordBank,
    round: 0,
    cursor: 0,
    elapsedMs: 0,
    score: 0,
    bestScore: 0,
    maxWrong: MAX_WRONG_GUESSES,
    message: 'Press Enter to start',
    solution: null,
    category: null,
    guessed: new Set(),
    wrongGuesses: [],
    revealedLetters: 0,
    lastGuess: null,
    keyboardRows: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
  };
}

function countUniqueLetters(answer) {
  return new Set(answer.replace(/ /g, '').split('')).size;
}

function computeDisplayWord(answer, guessed) {
  return answer
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      return guessed.has(ch) ? ch : '_';
    })
    .join(' ');
}

function computeRemainingLetters(answer, guessed) {
  let remaining = 0;
  for (const ch of answer) {
    if (ch !== ' ' && !guessed.has(ch)) remaining += 1;
  }
  return remaining;
}

export function startRound(state) {
  const picked = chooseWord(state.wordBank, state.cursor);
  const guessed = new Set();
  const revealedLetters = 0;
  const nextRound = state.round + 1;
  return {
    ...state,
    mode: 'playing',
    pauseBeforeMode: null,
    round: nextRound,
    cursor: state.cursor + 1,
    elapsedMs: 0,
    solution: picked.answer,
    category: picked.category,
    guessed,
    wrongGuesses: [],
    revealedLetters,
    lastGuess: null,
    message: 'Guess letters with keyboard or mouse'
  };
}

export function togglePause(state) {
  if (state.mode === 'paused') {
    return {
      ...state,
      mode: state.pauseBeforeMode || 'playing',
      pauseBeforeMode: null,
      message: 'Resumed'
    };
  }
  if (state.mode !== 'playing') return state;
  return {
    ...state,
    mode: 'paused',
    pauseBeforeMode: 'playing',
    message: 'Paused'
  };
}

export function resetGame(state) {
  return {
    ...createInitialState(state.wordBank),
    bestScore: Math.max(state.bestScore, state.score),
    cursor: state.cursor,
    message: 'Reset complete. Press Enter to play again.'
  };
}

export function revealWord(answer, guessed) {
  return computeDisplayWord(answer, guessed);
}

export function applyGuess(state, inputLetter) {
  if (state.mode !== 'playing' || !state.solution) return state;
  const letter = String(inputLetter || '').toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return state;
  if (state.guessed.has(letter)) {
    return {
      ...state,
      message: `${letter} was already tried`,
      lastGuess: letter
    };
  }

  const guessed = new Set(state.guessed);
  guessed.add(letter);
  const isHit = state.solution.includes(letter);

  if (isHit) {
    const answerHits = state.solution.split('').filter((ch) => ch === letter).length;
    const updatedRevealed = state.revealedLetters + answerHits;
    const solved = computeRemainingLetters(state.solution, guessed) === 0;
    const gained = answerHits * 40;
    let score = state.score + gained;
    let mode = state.mode;
    let message = `${letter} is in the word`;

    if (solved) {
      const bonus = (state.maxWrong - state.wrongGuesses.length) * 25 + countUniqueLetters(state.solution) * 10;
      score += bonus;
      mode = 'won';
      message = `Solved! Bonus +${bonus}. Press Enter for next round.`;
    }

    return {
      ...state,
      mode,
      guessed,
      score,
      bestScore: Math.max(score, state.bestScore),
      revealedLetters: updatedRevealed,
      message,
      lastGuess: letter
    };
  }

  const wrongGuesses = [...state.wrongGuesses, letter];
  const misses = wrongGuesses.length;
  const score = Math.max(0, state.score - 10);
  if (misses >= state.maxWrong) {
    return {
      ...state,
      mode: 'lost',
      guessed,
      wrongGuesses,
      score,
      bestScore: Math.max(score, state.bestScore),
      message: `Round over. Word was ${state.solution}. Press Enter to retry.`,
      lastGuess: letter
    };
  }

  return {
    ...state,
    guessed,
    wrongGuesses,
    score,
    bestScore: Math.max(score, state.bestScore),
    message: `${letter} is not in the word`,
    lastGuess: letter
  };
}

export function stepState(state, dtMs) {
  if (state.mode === 'playing') {
    return {
      ...state,
      elapsedMs: state.elapsedMs + dtMs
    };
  }
  return state;
}

export function buildTextSnapshot(state) {
  const solution = state.solution || '';
  const masked = solution ? revealWord(solution, state.guessed) : '';
  const lives = state.maxWrong - state.wrongGuesses.length;
  return {
    mode: state.mode,
    coordinate_system: 'canvas origin (0,0) top-left; x increases right, y increases downward',
    category: state.category,
    masked_word: masked,
    wrong_guesses: state.wrongGuesses,
    remaining_lives: lives,
    round: state.round,
    score: state.score,
    best_score: state.bestScore,
    elapsed_ms: Math.round(state.elapsedMs),
    last_guess: state.lastGuess,
    message: state.message
  };
}

export function isLetterAvailable(state, letter) {
  return !state.guessed.has(letter);
}

export function getAlphabet() {
  return ALPHABET;
}
