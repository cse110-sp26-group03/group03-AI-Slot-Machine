/**
 * AI Slot Machine — spend tokens, win tokens, mock AI.
 * Pure vanilla JS, no dependencies.
 */

const SYMBOLS = ['🤖', '🧠', '🔥', '💬', '⚡', '💀'];

const PAYOUTS = {
  '🤖🤖🤖': { multiplier: 10, label: 'FULL HALLUCINATION! The model is confident and completely wrong!' },
  '🧠🧠🧠': { multiplier: 8,  label: 'EMERGENT INTELLIGENCE! ...or maybe just a parlor trick.' },
  '🔥🔥🔥': { multiplier: 6,  label: 'GPU MELTDOWN! Your H100s are on fire!' },
  '💬💬💬': { multiplier: 5,  label: 'PROMPT INJECTION! You jailbroke the slot machine!' },
  '⚡⚡⚡': { multiplier: 4,  label: 'TOKEN OVERFLOW! Context window exceeded!' },
  '💀💀💀': { multiplier: 3,  label: 'MODEL COLLAPSE! Trained on its own output!' },
};

const LOSE_MESSAGES = [
  'Tokens burned. That\'s the AI business model.',
  'Your prompt was too vague. Tokens wasted.',
  'The model hallucinated your winnings.',
  'Training data not found. You lose.',
  'Output: [REDACTED]. Cost: your tokens.',
  'Rate limited. Try again with fewer hopes.',
  'The AI confidently lost your tokens.',
  'Overfitting to losses. Classic.',
  'Your tokens have been used for fine-tuning. Goodbye.',
  'Error 429: Too many token requests.',
  'The model says you won! (It\'s hallucinating.)',
  'Inference complete. Result: poverty.',
  'Benchmarks say you should have won. Reality disagrees.',
  'RLHF optimized for maximum disappointment.',
];

const PAIR_MESSAGES = [
  'Partial match! The AI almost understood your prompt.',
  'Two out of three — like most AI benchmarks.',
  'Close enough for a demo, not for production.',
  'The model got it mostly right. Ship it!',
];

// --- State ---
let tokens = 1000;
let bet = 50;
let spinning = false;
const BET_STEP = 25;
const MIN_BET = 25;
const MAX_BET = 500;

// --- DOM refs ---
const tokenCountEl = document.getElementById('token-count');
const betAmountEl = document.getElementById('bet-amount');
const spinBtn = document.getElementById('spin-btn');
const betUpBtn = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const messageEl = document.getElementById('message');
const reelEls = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2'),
];
const reelWindows = document.querySelectorAll('.reel-window');

// --- Audio via Web Audio API ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, duration, type = 'square', gain = 0.08) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  vol.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(vol);
  vol.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSpinTick() {
  playTone(300 + Math.random() * 200, 0.05, 'square', 0.04);
}

function playLandSound(index) {
  playTone(400 + index * 150, 0.15, 'triangle', 0.07);
}

function playWinSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.1), i * 100);
  });
}

function playLoseSound() {
  playTone(200, 0.3, 'sawtooth', 0.05);
  setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.04), 150);
}

// --- Helpers ---
function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateDisplay() {
  tokenCountEl.textContent = tokens;
  betAmountEl.textContent = bet;

  // Clamp bet to available tokens
  if (bet > tokens && tokens > 0) {
    bet = Math.max(MIN_BET, Math.floor(tokens / BET_STEP) * BET_STEP);
    if (bet > tokens) bet = tokens;
    betAmountEl.textContent = bet;
  }

  spinBtn.disabled = spinning || tokens < MIN_BET;
  betDownBtn.disabled = spinning || bet <= MIN_BET;
  betUpBtn.disabled = spinning || bet >= MAX_BET || bet + BET_STEP > tokens;
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;
}

function flashTokens(type) {
  tokenCountEl.classList.add(type);
  setTimeout(() => tokenCountEl.classList.remove(type), 600);
}

// --- Reel animation ---
function buildReelStrip(finalSymbol) {
  // Build a strip of random symbols with the final one at the end
  const count = 6; // symbols to scroll through
  const symbols = [];
  for (let i = 0; i < count; i++) {
    symbols.push(randomSymbol());
  }
  symbols.push(finalSymbol);
  return symbols;
}

function animateReel(reelEl, finalSymbol, delay) {
  return new Promise((resolve) => {
    const strip = buildReelStrip(finalSymbol);

    // Build DOM for the strip
    reelEl.innerHTML = '';
    strip.forEach((sym) => {
      const div = document.createElement('div');
      div.className = 'symbol';
      div.textContent = sym;
      reelEl.appendChild(div);
    });

    // Start spinning animation
    reelEl.classList.add('spinning');

    // Tick sounds during spin
    const tickInterval = setInterval(() => playSpinTick(), 100);

    setTimeout(() => {
      clearInterval(tickInterval);
      reelEl.classList.remove('spinning');

      // Show only the final symbol
      reelEl.innerHTML = '';
      const finalDiv = document.createElement('div');
      finalDiv.className = 'symbol';
      finalDiv.textContent = finalSymbol;
      reelEl.appendChild(finalDiv);

      reelEl.classList.add('landing');
      playLandSound(reelEls.indexOf(reelEl));

      setTimeout(() => reelEl.classList.remove('landing'), 300);
      resolve();
    }, 800 + delay);
  });
}

// --- Evaluate result ---
function evaluate(results) {
  const key = results.join('');

  // Check triple match
  if (PAYOUTS[key]) {
    return {
      type: 'win',
      multiplier: PAYOUTS[key].multiplier,
      message: PAYOUTS[key].label,
    };
  }

  // Check pair
  if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
    return {
      type: 'win',
      multiplier: 1.5,
      message: randomFrom(PAIR_MESSAGES),
    };
  }

  // Loss
  return {
    type: 'lose',
    multiplier: 0,
    message: randomFrom(LOSE_MESSAGES),
  };
}

// --- Spin ---
async function spin() {
  if (spinning || tokens < bet) return;
  spinning = true;

  // Deduct bet
  tokens -= bet;
  updateDisplay();
  setMessage('Generating response...', '');

  // Clear winner highlights
  reelWindows.forEach((w) => w.classList.remove('winner'));

  // Determine results
  const results = [randomSymbol(), randomSymbol(), randomSymbol()];

  // Animate reels with staggered stops
  await Promise.all(
    reelEls.map((el, i) => animateReel(el, results[i], i * 400))
  );

  // Evaluate
  const outcome = evaluate(results);

  if (outcome.type === 'win') {
    const winnings = Math.floor(bet * outcome.multiplier);
    tokens += winnings;
    flashTokens('win');
    playWinSound();
    setMessage(`+${winnings} tokens! ${outcome.message}`, 'win');

    // Highlight matching reels
    if (outcome.multiplier > 2) {
      reelWindows.forEach((w) => w.classList.add('winner'));
    }
  } else {
    flashTokens('lose');
    playLoseSound();
    setMessage(outcome.message, 'lose');
  }

  // Check broke
  if (tokens < MIN_BET) {
    setTimeout(() => {
      setMessage('OUT OF TOKENS. The AI wins. As always. (Refreshing...)', 'broke');
      setTimeout(() => {
        tokens = 1000;
        bet = 50;
        updateDisplay();
        setMessage('VC funding secured! 1000 tokens restored.', 'win');
      }, 3000);
    }, 1500);
  }

  spinning = false;
  updateDisplay();
}

// --- Event listeners ---
spinBtn.addEventListener('click', spin);

betUpBtn.addEventListener('click', () => {
  if (bet + BET_STEP <= MAX_BET && bet + BET_STEP <= tokens) {
    bet += BET_STEP;
    updateDisplay();
  }
});

betDownBtn.addEventListener('click', () => {
  if (bet - BET_STEP >= MIN_BET) {
    bet -= BET_STEP;
    updateDisplay();
  }
});

// Keyboard support — spacebar to spin
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spinning) {
    e.preventDefault();
    spin();
  }
});

// Init
updateDisplay();
setMessage('Press GENERATE to burn some tokens!', '');
