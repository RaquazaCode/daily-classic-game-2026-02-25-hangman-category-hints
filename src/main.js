import '@lottiefiles/dotlottie-wc';
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

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="game-shell" id="game-shell">
    <div class="ambient-grid" aria-hidden="true"></div>
    <div class="grain-overlay" aria-hidden="true"></div>

    <header class="top-strip">
      <div>
        <p class="eyebrow">Daily Classic Game</p>
        <h1>Hangman: Neon Hint Rift</h1>
        <p class="subtitle">Category clues, kinetic gallows, and synthwave score attack.</p>
      </div>
      <div class="top-meta">
        <span class="meta-chip">Twist: Category Hints</span>
        <button id="fullscreen-btn" class="meta-chip button-chip" type="button">Toggle Fullscreen (F)</button>
      </div>
    </header>

    <main class="game-main">
      <section class="stage-panel">
        <canvas id="scene-canvas" aria-label="Hangman stage"></canvas>
        <div class="stage-overlay">
          <span id="mode-chip" class="mode-chip">Ready</span>
          <div id="lottie-loading" class="lottie-badge is-visible" aria-hidden="true">
            <dotlottie-wc src="/lottie/loading-spinner.lottie" autoplay loop></dotlottie-wc>
          </div>
          <div id="lottie-hit" class="lottie-badge lottie-hit" aria-hidden="true">
            <dotlottie-wc src="/lottie/checkmark-success.lottie" autoplay></dotlottie-wc>
          </div>
          <div id="lottie-win" class="lottie-hero" aria-hidden="true">
            <dotlottie-wc src="/lottie/confetti-burst.lottie" autoplay loop></dotlottie-wc>
          </div>
          <div id="lottie-lose" class="lottie-hero" aria-hidden="true">
            <dotlottie-wc src="/lottie/skull-turnaround.lottie" autoplay loop></dotlottie-wc>
          </div>
        </div>
      </section>

      <aside class="control-panel">
        <div class="stat-grid">
          <article class="stat-card"><span>Round</span><strong id="stat-round">0</strong></article>
          <article class="stat-card"><span>Score</span><strong id="stat-score">0</strong></article>
          <article class="stat-card"><span>Best</span><strong id="stat-best">0</strong></article>
          <article class="stat-card"><span>Lives</span><strong id="stat-lives">6</strong></article>
        </div>

        <section class="word-card">
          <p id="category-text" class="category-text">Category: --</p>
          <p id="masked-word" class="masked-word">_ _ _ _ _</p>
          <p id="wrong-text" class="wrong-text">Wrong guesses: none</p>
        </section>

        <p id="message-text" class="message-text">Press Enter to start.</p>

        <section id="keyboard" class="keyboard" aria-label="Letter keyboard"></section>

        <div class="button-row">
          <button id="start-btn" type="button">Start / Next (Enter)</button>
          <button id="pause-btn" type="button">Pause (P)</button>
          <button id="reset-btn" type="button">Reset (R)</button>
        </div>

        <div class="button-row secondary">
          <button id="mute-btn" type="button">Sound: On (M)</button>
          <button id="music-btn" type="button">Music: On</button>
        </div>

        <p class="control-hint">
          Keyboard: A-Z letters, Enter start/next, P pause, R reset, F fullscreen, M mute.
        </p>
      </aside>
    </main>
  </div>
`;

const shell = document.querySelector('#game-shell');
const canvas = document.querySelector('#scene-canvas');
const ctx = canvas.getContext('2d');

const modeChip = document.querySelector('#mode-chip');
const roundEl = document.querySelector('#stat-round');
const scoreEl = document.querySelector('#stat-score');
const bestEl = document.querySelector('#stat-best');
const livesEl = document.querySelector('#stat-lives');
const categoryEl = document.querySelector('#category-text');
const maskedWordEl = document.querySelector('#masked-word');
const wrongEl = document.querySelector('#wrong-text');
const messageEl = document.querySelector('#message-text');
const keyboardRoot = document.querySelector('#keyboard');

const startBtn = document.querySelector('#start-btn');
const pauseBtn = document.querySelector('#pause-btn');
const resetBtn = document.querySelector('#reset-btn');
const muteBtn = document.querySelector('#mute-btn');
const musicBtn = document.querySelector('#music-btn');
const fullscreenBtn = document.querySelector('#fullscreen-btn');

const lottieLoading = document.querySelector('#lottie-loading');
const lottieHit = document.querySelector('#lottie-hit');
const lottieWin = document.querySelector('#lottie-win');
const lottieLose = document.querySelector('#lottie-lose');

const stars = Array.from({ length: 72 }, (_, idx) => ({
  x: ((idx * 73) % 997) / 997,
  y: ((idx * 191) % 983) / 983,
  depth: 0.2 + (((idx * 47) % 100) / 100) * 0.8,
  twinkleOffset: ((idx * 29) % 100) / 100
}));

let state = createInitialState();
let animationFrame = null;
let lastFrame = performance.now();
let hitPulseTimeout = null;
let musicEnabled = true;
let visualClockMs = 0;

const letterButtons = new Map();

function createAudioEngine() {
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let compressor = null;
  let toneFilter = null;
  let pulseTimer = null;
  let noteIndex = 0;
  let muted = false;
  let unlocked = false;
  let pendingStart = false;

  const scale = [0, 3, 5, 7, 10, 12, 15, 17];
  const pattern = [0, 2, 4, 1, 5, 3, 6, 2];
  const padChords = [
    [0, 7, 12],
    [3, 10, 15],
    [5, 12, 17],
    [2, 9, 14]
  ];
  const STEP_MS = 290;
  const MASTER_ON_GAIN = 1.15;

  function ensureContext() {
    if (context) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    context = new AudioContextCtor({ latencyHint: 'interactive' });

    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.22;

    masterGain = context.createGain();
    masterGain.gain.value = 0.0001;

    musicGain = context.createGain();
    musicGain.gain.value = 0.52;

    sfxGain = context.createGain();
    sfxGain.gain.value = 0.82;

    toneFilter = context.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = 3100;
    toneFilter.Q.value = 0.85;

    musicGain.connect(toneFilter);
    toneFilter.connect(compressor);
    sfxGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(context.destination);
  }

  function freqFrom(root, semitone) {
    return root * Math.pow(2, semitone / 12);
  }

  function playTone({
    freq,
    duration = 0.18,
    type = 'triangle',
    gain = 0.14,
    slideTo = null,
    attack = 0.004,
    release = 0.12,
    when = null,
    bus = 'sfx'
  }) {
    ensureContext();
    if (!context || muted) return;

    const now = when ?? context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    }

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(gain, now + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    oscillator.connect(envelope);
    envelope.connect(bus === 'music' ? musicGain : sfxGain);

    oscillator.start(now);
    oscillator.stop(now + duration + release + 0.02);
  }

  function schedulePulse() {
    if (!context || muted) return;
    const when = context.currentTime + 0.02;
    const octaveLift = noteIndex % 16 === 0 ? 12 : 0;
    const semitone = scale[pattern[noteIndex % pattern.length]] + octaveLift;
    const chord = padChords[Math.floor(noteIndex / 4) % padChords.length];

    playTone({
      freq: freqFrom(146.83, semitone),
      duration: 0.24,
      type: 'triangle',
      gain: 0.3,
      slideTo: freqFrom(146.83, semitone + 1),
      release: 0.12,
      when,
      bus: 'music'
    });

    playTone({
      freq: freqFrom(55, chord[0] - 12),
      duration: 0.26,
      type: 'sine',
      gain: 0.2,
      release: 0.18,
      when,
      bus: 'music'
    });

    if (noteIndex % 2 === 0) {
      playTone({
        freq: freqFrom(220, chord[1]),
        duration: 0.11,
        type: 'square',
        gain: 0.12,
        slideTo: freqFrom(220, chord[1] + 1),
        release: 0.09,
        when,
        bus: 'music'
      });
    }

    noteIndex += 1;
  }

  async function unlock() {
    ensureContext();
    if (!context) return false;

    if (context.state !== 'running') {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    unlocked = context.state === 'running';
    if (unlocked && masterGain) {
      masterGain.gain.setTargetAtTime(muted ? 0.0001 : MASTER_ON_GAIN, context.currentTime, 0.05);
    }
    if (unlocked && pendingStart && !muted) {
      pendingStart = false;
      await startMusic();
    }
    return unlocked;
  }

  async function startMusic() {
    const ready = await unlock();
    if (!ready || !context || muted) {
      pendingStart = true;
      return;
    }
    if (pulseTimer) return;
    schedulePulse();
    pulseTimer = window.setInterval(schedulePulse, STEP_MS);
  }

  function stopMusic() {
    if (pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  function setMuted(nextMuted) {
    muted = nextMuted;
    if (masterGain && context) {
      masterGain.gain.setTargetAtTime(
        nextMuted ? 0.0001 : unlocked ? MASTER_ON_GAIN : 0.0001,
        context.currentTime,
        0.035
      );
    }
    if (nextMuted) {
      stopMusic();
    } else if (pendingStart && unlocked) {
      startMusic();
    }
  }

  function playHit() {
    playTone({ freq: 392, duration: 0.12, type: 'sine', gain: 0.34, slideTo: 523.25, release: 0.08 });
  }

  function playMiss() {
    playTone({ freq: 185, duration: 0.24, type: 'sawtooth', gain: 0.42, slideTo: 88, release: 0.14 });
    setTimeout(() => {
      playTone({ freq: 124, duration: 0.18, type: 'square', gain: 0.32, slideTo: 74, release: 0.1 });
    }, 85);
  }

  function playWin() {
    playTone({ freq: 523.25, duration: 0.1, type: 'triangle', gain: 0.3 });
    setTimeout(() => playTone({ freq: 659.25, duration: 0.12, type: 'triangle', gain: 0.28 }), 100);
    setTimeout(() => playTone({ freq: 783.99, duration: 0.18, type: 'triangle', gain: 0.28 }), 210);
  }

  function playLose() {
    playTone({ freq: 220, duration: 0.22, type: 'square', gain: 0.27, slideTo: 130, release: 0.2 });
    setTimeout(() => playTone({ freq: 165, duration: 0.3, type: 'square', gain: 0.23, slideTo: 82 }), 160);
  }

  return {
    unlock,
    startMusic,
    stopMusic,
    setMuted,
    isUnlocked: () => unlocked,
    isMuted: () => muted,
    isMusicActive: () => Boolean(pulseTimer),
    playHit,
    playMiss,
    playWin,
    playLose
  };
}

const audio = createAudioEngine();

function showElement(element, visible) {
  element.classList.toggle('is-visible', visible);
}

function getModeLabel(mode) {
  if (mode === 'ready') return 'Ready';
  if (mode === 'playing') return 'In Round';
  if (mode === 'paused') return 'Paused';
  if (mode === 'won') return 'Solved';
  if (mode === 'lost') return 'Failed';
  return mode;
}

function pulseHitLottie() {
  clearTimeout(hitPulseTimeout);
  showElement(lottieHit, true);
  const player = lottieHit.querySelector('dotlottie-wc');
  player?.dotLottie?.setFrame?.(0);
  player?.dotLottie?.play?.();
  hitPulseTimeout = setTimeout(() => {
    showElement(lottieHit, false);
  }, 950);
}

function updateLottieByMode() {
  showElement(lottieLoading, state.mode === 'ready' || state.mode === 'paused');
  showElement(lottieWin, state.mode === 'won');
  showElement(lottieLose, state.mode === 'lost');
}

function syncHud() {
  modeChip.textContent = getModeLabel(state.mode);
  roundEl.textContent = String(state.round);
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.bestScore);
  livesEl.textContent = String(Math.max(0, state.maxWrong - state.wrongGuesses.length));
  categoryEl.textContent = `Category: ${state.category || '--'}`;
  maskedWordEl.textContent = state.solution ? revealWord(state.solution, state.guessed) : '_ _ _ _ _';
  wrongEl.textContent = `Wrong guesses: ${state.wrongGuesses.join(', ') || 'none'}`;
  messageEl.textContent = state.message;
  pauseBtn.textContent = state.mode === 'paused' ? 'Resume (P)' : 'Pause (P)';

  for (const [letter, button] of letterButtons.entries()) {
    const available = isLetterAvailable(state, letter);
    button.disabled = !available || state.mode === 'paused' || state.mode === 'ready';
    button.classList.toggle('is-hit', state.lastGuess === letter && state.lastGuessResult === 'hit');
    button.classList.toggle('is-miss', state.lastGuess === letter && state.lastGuessResult === 'miss');
  }

  updateLottieByMode();
}

function commitState(nextState) {
  const prevState = state;
  state = nextState;

  if (state.lastGuess !== prevState.lastGuess || state.mode !== prevState.mode) {
    if (state.lastGuessResult === 'hit' && state.lastGuess !== prevState.lastGuess) {
      audio.playHit();
      pulseHitLottie();
    }
    if (state.lastGuessResult === 'miss' && state.lastGuess !== prevState.lastGuess) {
      audio.playMiss();
    }
    if (state.mode === 'won' && prevState.mode !== 'won') {
      audio.playWin();
    }
    if (state.mode === 'lost' && prevState.mode !== 'lost') {
      audio.playLose();
    }
  }

  syncHud();
}

function buildKeyboard() {
  keyboardRoot.innerHTML = '';
  for (const row of state.keyboardRows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';

    for (const letter of row) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'letter-key';
      button.dataset.letter = letter;
      button.textContent = letter;
      letterButtons.set(letter, button);
      rowEl.appendChild(button);
    }

    keyboardRoot.appendChild(rowEl);
  }
}

async function primeAudio() {
  await audio.unlock();
  if (!audio.isMuted() && musicEnabled) {
    await audio.startMusic();
  }
  updateAudioButtons();
}

function requestStartOrNextRound() {
  if (state.mode === 'ready' || state.mode === 'won' || state.mode === 'lost') {
    commitState(startRound(state));
  }
}

function requestPauseToggle() {
  commitState(togglePause(state));
}

function requestReset() {
  commitState(resetGame(state));
}

function requestLetter(letter) {
  if (!/^[A-Z]$/.test(letter)) return;
  commitState(applyGuess(state, letter));
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await shell.requestFullscreen?.();
    return;
  }
  await document.exitFullscreen?.();
}

function drawParallaxBackground(width, height, timeSec) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#080d1b');
  sky.addColorStop(0.46, '#0f1e38');
  sky.addColorStop(1, '#12273b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * (0.7 + Math.sin(timeSec * 0.16) * 0.06);
  const sunY = height * (0.2 + Math.cos(timeSec * 0.18) * 0.02);
  const sunGradient = ctx.createRadialGradient(sunX, sunY, width * 0.02, sunX, sunY, width * 0.24);
  sunGradient.addColorStop(0, 'rgba(255, 153, 95, 0.86)');
  sunGradient.addColorStop(0.4, 'rgba(255, 104, 54, 0.34)');
  sunGradient.addColorStop(1, 'rgba(255, 104, 54, 0)');
  ctx.fillStyle = sunGradient;
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(timeSec * (0.8 + star.depth) + star.twinkleOffset * 7));
    const sx = ((star.x + timeSec * 0.004 * star.depth) % 1) * width;
    const sy = (star.y * 0.62 + Math.sin(timeSec * 0.07 + star.twinkleOffset * 6) * 0.01) * height;
    const radius = 0.7 + star.depth * 1.2;
    ctx.fillStyle = `rgba(195, 229, 255, ${0.18 + twinkle * 0.42})`;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const horizon = height * 0.58;
  const cityGradient = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 70);
  cityGradient.addColorStop(0, 'rgba(15, 39, 66, 0)');
  cityGradient.addColorStop(1, 'rgba(8, 13, 28, 0.76)');
  ctx.fillStyle = cityGradient;
  ctx.fillRect(0, horizon - 50, width, 120);

  const vanishingX = width * (0.5 + Math.sin(timeSec * 0.2) * 0.05);
  ctx.fillStyle = '#0c1f2f';
  ctx.fillRect(0, horizon, width, height - horizon);

  ctx.strokeStyle = 'rgba(80, 230, 255, 0.22)';
  ctx.lineWidth = 1;
  for (let x = -width; x <= width * 2; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, height + 2);
    ctx.lineTo(vanishingX, horizon);
    ctx.stroke();
  }

  for (let row = 1; row <= 18; row += 1) {
    const t = row / 18;
    const y = horizon + Math.pow(t, 1.75) * (height - horizon);
    const alpha = 0.15 + (1 - t) * 0.35;
    ctx.strokeStyle = `rgba(247, 160, 104, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawHangman(width, height, timeSec) {
  const baseX = width * 0.22;
  const baseY = height * 0.84;
  const postHeight = height * 0.46;
  const beamLength = width * 0.2;
  const ropeDrop = height * 0.08;

  const misses = state.wrongGuesses.length;
  const pressure = misses / state.maxWrong;
  const sway = Math.sin(timeSec * (1.8 + pressure * 1.4)) * (0.03 + pressure * 0.055);

  ctx.save();
  ctx.strokeStyle = '#d8e8ff';
  ctx.shadowColor = 'rgba(104, 223, 255, 0.45)';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.moveTo(baseX - 90, baseY);
  ctx.lineTo(baseX + 120, baseY);
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY - postHeight);
  ctx.lineTo(baseX + beamLength, baseY - postHeight);
  ctx.lineTo(baseX + beamLength, baseY - postHeight + ropeDrop);
  ctx.stroke();

  const anchorX = baseX + beamLength;
  const anchorY = baseY - postHeight + ropeDrop;
  const bodyTop = 36;

  ctx.translate(anchorX, anchorY);
  ctx.rotate(sway);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, bodyTop);
  ctx.stroke();

  if (misses >= 1) {
    ctx.beginPath();
    ctx.arc(0, bodyTop + 28, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (misses >= 2) {
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 56);
    ctx.lineTo(0, bodyTop + 146);
    ctx.stroke();
  }
  if (misses >= 3) {
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 84);
    ctx.lineTo(-42, bodyTop + 116);
    ctx.stroke();
  }
  if (misses >= 4) {
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 84);
    ctx.lineTo(42, bodyTop + 116);
    ctx.stroke();
  }
  if (misses >= 5) {
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 146);
    ctx.lineTo(-36, bodyTop + 198);
    ctx.stroke();
  }
  if (misses >= 6) {
    ctx.beginPath();
    ctx.moveTo(0, bodyTop + 146);
    ctx.lineTo(36, bodyTop + 198);
    ctx.stroke();
  }

  ctx.restore();
}

function wrapCanvasText(text, maxWidth) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function drawWordStage(width, height) {
  const word = state.solution ? revealWord(state.solution, state.guessed) : '_ _ _ _ _';
  const panelWidth = Math.min(width - 28, Math.max(272, width * 0.46));
  const panelX = Math.max(14, width - panelWidth - 16);
  const panelY = 18;
  const titleSize = panelWidth < 320 ? 15 : 18;
  const baseWordSize = panelWidth < 320 ? 30 : 44;
  const hintSize = panelWidth < 300 ? 13 : 15;
  const innerX = panelX + 22;
  const innerWidth = panelWidth - 44;
  const hintText = 'Keep the signal clean. Misses distort the rope.';

  const titleLineHeight = titleSize + 6;
  ctx.font = `700 ${titleSize}px "DM Sans", sans-serif`;
  const categoryLines = wrapCanvasText(`Category: ${state.category || '--'}`, innerWidth);
  const categoryHeight = categoryLines.length * titleLineHeight;

  let wordSize = baseWordSize;
  ctx.font = `700 ${wordSize}px "Unbounded", sans-serif`;
  while (ctx.measureText(word).width > innerWidth && wordSize > 22) {
    wordSize -= 2;
    ctx.font = `700 ${wordSize}px "Unbounded", sans-serif`;
  }

  const wordY = panelY + 22 + categoryHeight + (panelWidth < 320 ? 26 : 32);
  const hintLineHeight = hintSize + 5;
  ctx.font = `600 ${hintSize}px "DM Sans", sans-serif`;
  const hintLines = wrapCanvasText(hintText, innerWidth);
  const hintStartY = wordY + (panelWidth < 320 ? 22 : 30);
  const minPanelHeight = panelWidth < 320 ? 152 : 176;
  const panelHeight = Math.max(minPanelHeight, hintStartY - panelY + hintLines.length * hintLineHeight + 18);

  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
  panelGradient.addColorStop(0, 'rgba(18, 44, 68, 0.82)');
  panelGradient.addColorStop(1, 'rgba(10, 27, 43, 0.9)');

  ctx.fillStyle = panelGradient;
  ctx.strokeStyle = 'rgba(110, 222, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e7f4ff';
  ctx.font = `700 ${titleSize}px "DM Sans", sans-serif`;
  for (let i = 0; i < categoryLines.length; i += 1) {
    ctx.fillText(categoryLines[i], innerX, panelY + 26 + (i + 1) * titleLineHeight);
  }
  ctx.fillStyle = '#ffe3c2';
  ctx.font = `700 ${wordSize}px "Unbounded", sans-serif`;
  ctx.fillText(word, innerX, wordY);

  ctx.fillStyle = '#9fd4ff';
  ctx.font = `600 ${hintSize}px "DM Sans", sans-serif`;
  for (let i = 0; i < hintLines.length; i += 1) {
    ctx.fillText(hintLines[i], innerX, hintStartY + i * hintLineHeight);
  }
}

function drawScene(timeMs) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(width * dpr));
  const targetHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const timeSec = timeMs / 1000;
  drawParallaxBackground(width, height, timeSec);
  drawHangman(width, height, timeSec);
  drawWordStage(width, height);
}

function loop(now) {
  const delta = Math.min(50, now - lastFrame);
  lastFrame = now;
  visualClockMs = now;

  if (state.mode === 'playing') {
    state = stepState(state, delta);
  }

  drawScene(now);
  animationFrame = window.requestAnimationFrame(loop);
}

async function setMuted(nextMuted) {
  audio.setMuted(nextMuted);
  if (!nextMuted && musicEnabled) {
    await audio.startMusic();
  }
  updateAudioButtons();
}

function setMusicEnabled(nextEnabled) {
  musicEnabled = nextEnabled;
  if (!nextEnabled) {
    audio.stopMusic();
  } else if (!audio.isMuted()) {
    audio.startMusic();
  }
  updateAudioButtons();
}

function updateAudioButtons() {
  muteBtn.textContent = `Sound: ${audio.isMuted() ? 'Off' : 'On'} (M)`;
  const needsArm = musicEnabled && !audio.isMuted() && !audio.isUnlocked();
  musicBtn.textContent = `Music: ${musicEnabled ? 'On' : 'Off'}${needsArm ? ' • Tap to arm' : ''}`;
}

function installAudioWakeHooks() {
  const wake = async () => {
    await primeAudio();
    if (audio.isUnlocked()) {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    }
  };

  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('touchstart', wake, { passive: true });
  window.addEventListener('keydown', wake);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && musicEnabled && !audio.isMuted()) {
      audio.startMusic();
      updateAudioButtons();
    }
  });

  window.addEventListener('focus', () => {
    if (musicEnabled && !audio.isMuted()) {
      audio.startMusic();
      updateAudioButtons();
    }
  });
}

buildKeyboard();
syncHud();
updateAudioButtons();
installAudioWakeHooks();

keyboardRoot.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-letter]');
  if (!target) return;
  await primeAudio();
  requestLetter(target.dataset.letter);
});

startBtn.addEventListener('click', async () => {
  await primeAudio();
  requestStartOrNextRound();
});

pauseBtn.addEventListener('click', async () => {
  await primeAudio();
  requestPauseToggle();
});

resetBtn.addEventListener('click', async () => {
  await primeAudio();
  requestReset();
});

muteBtn.addEventListener('click', async () => {
  await primeAudio();
  setMuted(!audio.isMuted());
});

musicBtn.addEventListener('click', async () => {
  await primeAudio();
  setMusicEnabled(!musicEnabled);
});

fullscreenBtn.addEventListener('click', async () => {
  await toggleFullscreen();
});

document.addEventListener('keydown', async (event) => {
  const key = event.key.toUpperCase();
  const isLetter = /^[A-Z]$/.test(key);
  const isControl = ['ENTER', 'P', 'R', 'F', 'M'].includes(key);
  if (!isLetter && !isControl) return;

  event.preventDefault();
  await primeAudio();

  if (key === 'ENTER') {
    requestStartOrNextRound();
    return;
  }
  if (key === 'P') {
    requestPauseToggle();
    return;
  }
  if (key === 'R') {
    requestReset();
    return;
  }
  if (key === 'F') {
    await toggleFullscreen();
    return;
  }
  if (key === 'M') {
    await setMuted(!audio.isMuted());
    return;
  }
  requestLetter(key);
});

window.render_game_to_text = () =>
  JSON.stringify({
    ...buildTextSnapshot(state),
    audio: {
      muted: audio.isMuted(),
      unlocked: audio.isUnlocked(),
      music_enabled: musicEnabled,
      music_active: audio.isMusicActive()
    }
  });
window.advanceTime = (ms) => {
  const dt = 1000 / 60;
  const steps = Math.max(1, Math.round(ms / dt));
  for (let i = 0; i < steps; i += 1) {
    state = stepState(state, dt);
  }
  syncHud();
  drawScene(visualClockMs + ms);
};
window.__hangman_debug = {
  getState: () => state,
  getAudioState: () => ({
    muted: audio.isMuted(),
    unlocked: audio.isUnlocked(),
    musicEnabled,
    musicActive: audio.isMusicActive()
  }),
  forceGuess: (letter) => {
    commitState(applyGuess(state, String(letter || '').toUpperCase()));
  },
  forceStart: () => {
    requestStartOrNextRound();
  },
  alphabet: getAlphabet()
};

animationFrame = window.requestAnimationFrame(loop);

window.addEventListener('beforeunload', () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  audio.stopMusic();
});
