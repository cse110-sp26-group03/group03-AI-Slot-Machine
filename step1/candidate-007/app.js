'use strict';

// ---------------------------------------------------------------------------
// Symbols — each has an emoji, a label, and a weight (higher = more common)
// ---------------------------------------------------------------------------
const SYMBOLS = [
  { emoji: '🤖', label: 'Robot',       weight: 4 },
  { emoji: '💀', label: 'Hallucinate', weight: 3 },
  { emoji: '🧠', label: 'Big Brain',   weight: 5 },
  { emoji: '📎', label: 'Clippy',      weight: 5 },
  { emoji: '🔥', label: 'GPU Melt',    weight: 6 },
  { emoji: '💸', label: 'Tokens',      weight: 8 },
  { emoji: '🌀', label: 'Infinite Loop',weight: 7 },
  { emoji: '📉', label: 'Crash',       weight: 7 },
  { emoji: '🦜', label: 'Parrot',      weight: 6 },
];

const PAYOUTS = {
  '🤖': 500,
  '💀': 300,
  '🧠': 200,
  '📎': 150,
  '🔥': 100,
};

const PAIR_BONUS = 25;
const SPIN_COST  = 10;
const STARTING_TOKENS = 1000;
const REEL_COUNT = 3;
const SYMBOLS_PER_REEL = 20; // how many symbols to tile per reel strip
const SYMBOL_HEIGHT = 100;   // px, must match CSS

// Snarky messages for each outcome
const WIN_MESSAGES = {
  jackpot: [
    '🤖 JACKPOT! The robot uprising is fully funded!',
    '🤖 You won! The AI overlords approve.',
    '🤖 Context window: INFINITE. You win!',
  ],
  '💀': [
    '💀 HALLUCINATION! You won fake tokens that are definitely real.',
    '💀 The model confidently returned a win. It may be wrong.',
    '💀 Citation needed — but tokens acquired!',
  ],
  '🧠': [
    '🧠 BIG BRAIN move! GPT-4 would never.',
    '🧠 Chain-of-thought complete. Tokens earned.',
    '🧠 Emergent intelligence detected in your wallet.',
  ],
  '📎': [
    '📎 It looks like you\'re winning tokens. Want help with that?',
    '📎 CLIPPY JACKPOT! Paperclip maximizer approves.',
    '📎 Would you like to convert these tokens to paperclips?',
  ],
  '🔥': [
    '🔥 GPU MELTDOWN! The datacenter is on fire but you\'re rich.',
    '🔥 Nvidia stock just went up. Also you won.',
    '🔥 Training run complete. Side effect: you have tokens.',
  ],
  pair: [
    '✨ Two of a kind! The model found a pattern (it might be wrong).',
    '✨ Partial alignment achieved. Some tokens dispensed.',
    '✨ Close enough — AI rounds up. Tokens awarded.',
  ],
};

const LOSE_MESSAGES = [
  '📉 Tokens burned. The model is "learning" from your loss.',
  '🌀 Infinite loop detected. Tokens consumed.',
  '🦜 The parrot speaks. It says: "no match."',
  '💸 Tokens vaporised. Somewhere a GPU shed a tear.',
  '🤡 RLHF penalised this spin. Try again.',
  '📎 It looks like you lost. Can I help you lose more?',
  '🧾 Loss logged. Model will hallucinate a win next time.',
  '🪦 RIP tokens. They died so the AI could train.',
  '💬 "I\'m sorry, I can\'t do that." — your wallet',
  '🔮 Prediction: you will spin again. Confidence: 99.7%',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let tokens  = STARTING_TOKENS;
let spinning = false;

// Build weighted symbol pool once
const POOL = [];
for (const sym of SYMBOLS) {
  for (let i = 0; i < sym.weight; i++) POOL.push(sym.emoji);
}

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const tokenCountEl = document.getElementById('tokenCount');
const messageEl    = document.getElementById('message');
const spinBtn      = document.getElementById('spinBtn');
const jackpotOverlay = document.getElementById('jackpotOverlay');
const jackpotMessage = document.getElementById('jackpotMessage');
const machine      = document.querySelector('.machine');

// ---------------------------------------------------------------------------
// Reel setup
// ---------------------------------------------------------------------------
const reelInners = [];

function buildReels() {
  for (let r = 0; r < REEL_COUNT; r++) {
    const inner = document.getElementById(`inner${r}`);
    inner.innerHTML = '';
    const strip = generateStrip();
    // Duplicate so we can loop seamlessly
    const full = [...strip, ...strip];
    full.forEach(emoji => {
      const div = document.createElement('div');
      div.className = 'reel-symbol';
      div.textContent = emoji;
      inner.appendChild(div);
    });
    // Start showing the middle of the strip (index SYMBOLS_PER_REEL)
    inner.style.transform = `translateY(-${SYMBOLS_PER_REEL * SYMBOL_HEIGHT}px)`;
    reelInners[r] = inner;
  }
}

function generateStrip() {
  const strip = [];
  for (let i = 0; i < SYMBOLS_PER_REEL; i++) {
    strip.push(POOL[Math.floor(Math.random() * POOL.length)]);
  }
  return strip;
}

// ---------------------------------------------------------------------------
// Spinning logic
// ---------------------------------------------------------------------------
function pickResult() {
  return Array.from({ length: REEL_COUNT }, () => POOL[Math.floor(Math.random() * POOL.length)]);
}

function spinReel(inner, finalEmoji, delay) {
  return new Promise(resolve => {
    const totalDuration = 800 + delay; // ms
    const steps = Math.floor(totalDuration / 60);
    let step = 0;

    // Use Web Animations API for smooth scrolling
    const startY    = SYMBOLS_PER_REEL * SYMBOL_HEIGHT;
    const extraSpins = SYMBOLS_PER_REEL + Math.floor(Math.random() * 8);
    const totalTiles = extraSpins;

    // Figure out which index in the first strip has our final emoji
    const firstStrip = Array.from(inner.children)
      .slice(0, SYMBOLS_PER_REEL)
      .map(el => el.textContent);

    // Find a random occurrence of finalEmoji in the strip
    const candidates = firstStrip.reduce((acc, e, i) => { if (e === finalEmoji) acc.push(i); return acc; }, []);
    // Force the symbol into slot 0 of second strip for guaranteed landing
    // Place final emoji at known index in second copy
    const landingIndex = SYMBOLS_PER_REEL + Math.floor(Math.random() * SYMBOLS_PER_REEL);
    inner.children[landingIndex].textContent = finalEmoji;

    // Target: land so that landingIndex symbol is centered (middle row = offset 1 from top)
    // Visible window is 300px = 3 symbols. Middle row starts at SYMBOL_HEIGHT*1 = 100px
    const targetY = landingIndex * SYMBOL_HEIGHT - SYMBOL_HEIGHT;

    const anim = inner.animate(
      [
        { transform: `translateY(-${startY}px)` },
        { transform: `translateY(-${targetY}px)` },
      ],
      {
        duration: totalDuration,
        easing: `cubic-bezier(0.17, 0.67, 0.12, 1.0)`,
        fill: 'forwards',
      }
    );

    anim.onfinish = () => {
      inner.style.transform = `translateY(-${targetY}px)`;
      anim.cancel();
      resolve();
    };
  });
}

async function spin() {
  if (spinning) return;
  if (tokens < SPIN_COST) {
    showMessage('❌ Not enough tokens! Insert coins.', 'lose');
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  tokens -= SPIN_COST;
  updateTokenDisplay();
  clearMessage();

  const results = pickResult();

  // Rebuild reels so we get a fresh random strip each spin
  buildReels();

  // Mark reels as spinning visually
  for (let r = 0; r < REEL_COUNT; r++) {
    document.getElementById(`reel${r}`).classList.add('spinning');
  }

  // Spin reels with staggered stop times
  await Promise.all(
    reelInners.map((inner, i) => spinReel(inner, results[i], i * 400))
  );

  for (let r = 0; r < REEL_COUNT; r++) {
    document.getElementById(`reel${r}`).classList.remove('spinning');
  }

  // Evaluate
  evaluate(results);
  spinning = false;
  spinBtn.disabled = tokens < SPIN_COST;
}

function evaluate(results) {
  const [a, b, c] = results;

  if (a === b && b === c) {
    // Three of a kind
    const payout = PAYOUTS[a] ?? 50;
    tokens += payout;
    updateTokenDisplay();

    if (payout >= 300) {
      showJackpot(a, payout);
    } else {
      const msgs = WIN_MESSAGES[a] ?? WIN_MESSAGES.pair;
      showMessage(pick(msgs) + `  +${payout} tokens`, 'win');
    }
  } else if (a === b || b === c || a === c) {
    // Pair
    tokens += PAIR_BONUS;
    updateTokenDisplay();
    showMessage(pick(WIN_MESSAGES.pair) + `  +${PAIR_BONUS} tokens`, 'win');
  } else {
    // Loss
    machine.classList.remove('shake');
    void machine.offsetWidth; // reflow to restart animation
    machine.classList.add('shake');
    showMessage(pick(LOSE_MESSAGES), 'lose');
  }
}

// ---------------------------------------------------------------------------
// Jackpot overlay
// ---------------------------------------------------------------------------
function showJackpot(emoji, payout) {
  const msgs = WIN_MESSAGES[emoji] ?? WIN_MESSAGES.jackpot;
  jackpotMessage.textContent = pick(msgs) + `\n+${payout} tokens!`;
  jackpotOverlay.classList.remove('hidden');
}

function dismissJackpot() {
  jackpotOverlay.classList.add('hidden');
}

// Make dismissJackpot global (called from HTML)
window.dismissJackpot = dismissJackpot;

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function updateTokenDisplay() {
  tokenCountEl.textContent = tokens.toLocaleString();
  spinBtn.disabled = spinning || tokens < SPIN_COST;
}

function showMessage(text, type = 'neutral') {
  messageEl.className = `message ${type}`;
  messageEl.textContent = text;
}

function clearMessage() {
  messageEl.className = 'message neutral';
  messageEl.textContent = '';
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resetGame() {
  tokens = STARTING_TOKENS;
  updateTokenDisplay();
  buildReels();
  clearMessage();
  spinning = false;
  spinBtn.disabled = false;
}

// Make spin and resetGame global (called from HTML)
window.spin = spin;
window.resetGame = resetGame;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
buildReels();
updateTokenDisplay();
