import './style.css';
import {
  applyGuess,
  buildTextSnapshot,
  createInitialState,
  getAlphabet,
  isLetterAvailable,
  resetGame,
  revealWord,
  startRound,
  stepState,
  togglePause
} from './game.js';

const canvas = document.createElement('canvas');
canvas.width = 960;
canvas.height = 640;
const ctx = canvas.getContext('2d');

const container = document.querySelector('#app');
container.appendChild(canvas);

let state = createInitialState();
let lastTime = performance.now();
let rafId = null;
const keyRects = [];

function getModeLabel() {
  if (state.mode === 'ready') return 'Ready';
  if (state.mode === 'playing') return 'Playing';
  if (state.mode === 'paused') return 'Paused';
  if (state.mode === 'won') return 'Solved';
  if (state.mode === 'lost') return 'Lost';
  return state.mode;
}

function drawPanel() {
  ctx.fillStyle = '#1b2f45';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#89add9';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#f4f7ff';
  ctx.font = '700 34px Trebuchet MS';
  ctx.fillText('Hangman: Category Hints', 40, 70);

  ctx.font = '600 20px Trebuchet MS';
  ctx.fillText(`Mode: ${getModeLabel()}`, 40, 108);
  ctx.fillText(`Round: ${state.round}`, 210, 108);
  ctx.fillText(`Score: ${state.score}`, 320, 108);
  ctx.fillText(`Best: ${state.bestScore}`, 470, 108);
  ctx.fillText(`Lives: ${state.maxWrong - state.wrongGuesses.length}`, 610, 108);

  if (state.category) {
    ctx.font = '600 24px Trebuchet MS';
    ctx.fillStyle = '#ffe48f';
    ctx.fillText(`Category: ${state.category}`, 40, 155);
  }
}

function drawGallows() {
  const baseX = 120;
  const baseY = 470;

  ctx.strokeStyle = '#d6e4f7';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(baseX - 80, baseY);
  ctx.lineTo(baseX + 80, baseY);
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY - 250);
  ctx.lineTo(baseX + 120, baseY - 250);
  ctx.lineTo(baseX + 120, baseY - 210);
  ctx.stroke();

  const misses = state.wrongGuesses.length;
  const headX = baseX + 120;
  const headY = baseY - 180;

  if (misses >= 1) {
    ctx.beginPath();
    ctx.arc(headX, headY, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (misses >= 2) {
    ctx.beginPath();
    ctx.moveTo(headX, headY + 28);
    ctx.lineTo(headX, headY + 106);
    ctx.stroke();
  }
  if (misses >= 3) {
    ctx.beginPath();
    ctx.moveTo(headX, headY + 55);
    ctx.lineTo(headX - 38, headY + 85);
    ctx.stroke();
  }
  if (misses >= 4) {
    ctx.beginPath();
    ctx.moveTo(headX, headY + 55);
    ctx.lineTo(headX + 38, headY + 85);
    ctx.stroke();
  }
  if (misses >= 5) {
    ctx.beginPath();
    ctx.moveTo(headX, headY + 106);
    ctx.lineTo(headX - 34, headY + 154);
    ctx.stroke();
  }
  if (misses >= 6) {
    ctx.beginPath();
    ctx.moveTo(headX, headY + 106);
    ctx.lineTo(headX + 34, headY + 154);
    ctx.stroke();
  }
}

function drawWord() {
  const answer = state.solution || '';
  const masked = answer ? revealWord(answer, state.guessed) : '_ _ _ _ _';
  ctx.fillStyle = '#f4f7ff';
  ctx.font = '700 42px Trebuchet MS';
  ctx.fillText(masked, 360, 250);

  ctx.font = '600 22px Trebuchet MS';
  ctx.fillStyle = '#9dc8f2';
  ctx.fillText('Press Enter to start / next round', 360, 290);
}

function drawKeyboard() {
  keyRects.length = 0;
  let y = 350;
  const keyWidth = 58;
  const keyHeight = 46;
  const gap = 10;

  for (const row of state.keyboardRows) {
    const total = row.length * keyWidth + (row.length - 1) * gap;
    let x = 360 + (340 - total) / 2;

    for (const ch of row) {
      const available = isLetterAvailable(state, ch);
      const rect = { x, y, width: keyWidth, height: keyHeight, letter: ch, available };
      keyRects.push(rect);

      ctx.fillStyle = available ? '#31587d' : '#1f3145';
      if (state.lastGuess === ch) {
        ctx.fillStyle = state.solution && state.solution.includes(ch) ? '#1f7a3d' : '#8b2f2f';
      }
      ctx.fillRect(x, y, keyWidth, keyHeight);

      ctx.strokeStyle = '#9dc8f2';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, keyWidth, keyHeight);

      ctx.fillStyle = '#f4f7ff';
      ctx.font = '700 20px Trebuchet MS';
      ctx.fillText(ch, x + 20, y + 30);

      x += keyWidth + gap;
    }
    y += keyHeight + gap;
  }
}

function drawFooter() {
  ctx.fillStyle = '#dcecff';
  ctx.font = '600 20px Trebuchet MS';
  ctx.fillText(`Wrong guesses: ${state.wrongGuesses.join(', ') || 'none'}`, 40, 545);
  ctx.fillText(state.message, 40, 580);
  ctx.fillText('Controls: A-Z guess, Enter start/next, P pause, R reset', 40, 612);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPanel();
  drawGallows();
  drawWord();
  drawKeyboard();
  drawFooter();
}

function tick(now) {
  const delta = Math.min(50, now - lastTime);
  lastTime = now;
  state = stepState(state, delta);
  render();
  rafId = requestAnimationFrame(tick);
}

function launchRoundIfNeeded() {
  if (state.mode === 'ready' || state.mode === 'won' || state.mode === 'lost') {
    state = startRound(state);
  }
}

function onLetter(letter) {
  state = applyGuess(state, letter);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toUpperCase();
  if (key === 'ENTER') {
    launchRoundIfNeeded();
    return;
  }
  if (key === 'P') {
    state = togglePause(state);
    return;
  }
  if (key === 'R') {
    state = resetGame(state);
    return;
  }
  if (/^[A-Z]$/.test(key)) {
    onLetter(key);
  }
});

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  for (const keyRect of keyRects) {
    if (
      x >= keyRect.x &&
      x <= keyRect.x + keyRect.width &&
      y >= keyRect.y &&
      y <= keyRect.y + keyRect.height
    ) {
      if (keyRect.available) {
        onLetter(keyRect.letter);
      }
      break;
    }
  }
});

window.render_game_to_text = () => JSON.stringify(buildTextSnapshot(state));
window.advanceTime = (ms) => {
  const dt = 1000 / 60;
  const steps = Math.max(1, Math.round(ms / dt));
  for (let i = 0; i < steps; i += 1) {
    state = stepState(state, dt);
  }
  render();
};
window.__hangman_debug = {
  getState: () => state,
  forceGuess: (letter) => {
    state = applyGuess(state, letter);
    render();
  },
  forceStart: () => {
    launchRoundIfNeeded();
    render();
  },
  alphabet: getAlphabet()
};

render();
rafId = requestAnimationFrame(tick);

window.addEventListener('beforeunload', () => {
  if (rafId) cancelAnimationFrame(rafId);
});
