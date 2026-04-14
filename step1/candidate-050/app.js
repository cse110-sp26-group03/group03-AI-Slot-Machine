/**
 * AI Slot Machine — Token Burner 3000
 * Vanilla JavaScript, no dependencies.
 *
 * Theme: poking fun at AI hype — you "spend" tokens (like LLM tokens)
 * on each spin and occasionally win some back.
 */

/* ============================================================
   Symbol definitions
   Each symbol has an emoji, a weight (higher = more common),
   and a multiplier when three match.
   ============================================================ */
const SYMBOLS = [
  { emoji: '🤖', name: 'Robot',       weight: 8,  triple: 10  },
  { emoji: '🧠', name: 'Brain',       weight: 10, triple: 8   },
  { emoji: '💰', name: 'Money',       weight: 12, triple: 6   },
  { emoji: '🔥', name: 'Fire',        weight: 15, triple: 5   },
  { emoji: '💀', name: 'Skull',       weight: 18, triple: 4   },
  { emoji: '🐛', name: 'Bug',         weight: 22, triple: 3   },
];

/** Multiplier awarded when exactly two reels match. */
const PAIR_MULTIPLIER = 1.5;

/** Build a weighted pool so random picks respect symbol rarity. */
function buildWeightedPool() {
  const pool = [];
  for (const sym of SYMBOLS) {
    for (let i = 0; i < sym.weight; i++) {
      pool.push(sym);
    }
  }
  return pool;
}

const POOL = buildWeightedPool();

/**
 * Pick a random symbol from the weighted pool.
 * @returns {object} A symbol object.
 */
function randomSymbol() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

/* ============================================================
   Snarky messages — displayed after each spin
   ============================================================ */
const WIN_MESSAGES = [
  'The AI overlords smile upon you!',
  'You just hallucinated a profit!',
  'OpenAI wants to know your location.',
  'Congrats — you beat the transformer.',
  'Your prompt engineering paid off!',
  'Sam Altman is typing...',
  'GPU go brrr — in YOUR favor!',
  'A rare non-hallucinated win!',
];

const LOSE_MESSAGES = [
  'Tokens burned. The model thanks you.',
  'Training data acquired: you lose.',
  'Your tokens have been fine-tuned away.',
  'Error 402: Insufficient luck.',
  'The AI giveth, the AI taketh away.',
  'Hallucination detected — that was your money.',
  'Context window exceeded. Wallet empty.',
  'Model collapsed. Tokens lost.',
  'Your inference budget has been reallocated.',
  'Alignment tax: collected.',
  'These tokens could have been a ChatGPT Plus subscription.',
  'Prompt rejected. Balance decreased.',
];

const BROKE_MESSAGES = [
  'You are out of tokens. Just like a free-tier user.',
  'Balance: 0. Time to beg VCs for more.',
  'Bankrupt — even GPT-2 saw this coming.',
  'No tokens left. The machine goes idle.',
];

/**
 * Pick a random item from an array.
 * @param {Array} arr - Source array.
 * @returns {*} Random element.
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ============================================================
   Game state
   ============================================================ */
let balance = 1000;
let bet = 50;
let spinning = false;

const BET_STEP = 25;
const BET_MIN  = 25;
const BET_MAX  = 500;

/* ============================================================
   DOM references
   ============================================================ */
const balanceEl  = document.getElementById('balance');
const betAmountEl = document.getElementById('bet-amount');
const spinBtn    = document.getElementById('spin-btn');
const betUpBtn   = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const messageEl  = document.getElementById('message');
const reelStrips = [
  document.querySelector('#reel-0 .reel-strip'),
  document.querySelector('#reel-1 .reel-strip'),
  document.querySelector('#reel-2 .reel-strip'),
];
const reelWindows = document.querySelectorAll('.reel-window');
const machineEl   = document.querySelector('.machine');

/* ============================================================
   Rendering helpers
   ============================================================ */

/**
 * Update the on-screen balance display with a brief scale animation.
 */
function renderBalance() {
  balanceEl.textContent = balance;
  balanceEl.classList.add('bump');
  setTimeout(() => balanceEl.classList.remove('bump'), 180);

  if (balance <= 0) {
    machineEl.classList.add('broke');
  } else {
    machineEl.classList.remove('broke');
  }
}

/**
 * Show a message with an optional style class.
 * @param {string} text - Message text.
 * @param {'win'|'lose'|'info'} type - Visual style.
 */
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + (type || '');
}

/**
 * Set a specific emoji on a reel strip.
 * @param {number} index - Reel index (0-2).
 * @param {string} emoji - Emoji character.
 */
function setReel(index, emoji) {
  reelStrips[index].textContent = emoji;
}

/* ============================================================
   Spin logic
   ============================================================ */

/**
 * Main spin handler. Deducts bet, animates reels, evaluates result.
 */
function spin() {
  if (spinning) return;
  if (balance < bet) {
    showMessage(pick(BROKE_MESSAGES), 'info');
    return;
  }

  spinning = true;
  spinBtn.disabled = true;

  /* Deduct bet */
  balance -= bet;
  renderBalance();
  showMessage('Processing your inference request...', '');

  /* Clear previous win highlights */
  reelWindows.forEach(w => w.classList.remove('winner'));

  /* Pick results up-front */
  const results = [randomSymbol(), randomSymbol(), randomSymbol()];

  /* Start spinning animation on all reels */
  reelStrips.forEach(strip => {
    strip.classList.add('spinning');
    strip.textContent = randomSymbol().emoji;
  });

  /* Rapidly cycle display symbols during spin */
  const cycleIntervals = reelStrips.map((strip, i) => {
    return setInterval(() => {
      strip.textContent = randomSymbol().emoji;
    }, 80);
  });

  /* Stop each reel with a staggered delay */
  const delays = [600, 1100, 1600];
  delays.forEach((delay, i) => {
    setTimeout(() => {
      clearInterval(cycleIntervals[i]);
      reelStrips[i].classList.remove('spinning');
      setReel(i, results[i].emoji);
    }, delay);
  });

  /* Evaluate after all reels stop */
  setTimeout(() => {
    evaluate(results);
    spinning = false;
    spinBtn.disabled = false;
  }, delays[2] + 100);
}

/**
 * Evaluate the spin results and award winnings.
 * @param {object[]} results - Array of three symbol objects.
 */
function evaluate(results) {
  const [a, b, c] = results;

  /* Three of a kind */
  if (a.emoji === b.emoji && b.emoji === c.emoji) {
    const winnings = Math.round(bet * a.triple);
    balance += winnings;
    renderBalance();
    reelWindows.forEach(w => w.classList.add('winner'));
    showMessage(`${a.emoji}${a.emoji}${a.emoji} — ${pick(WIN_MESSAGES)} (+${winnings} tokens)`, 'win');
    return;
  }

  /* Pair (any two match) */
  if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
    const winnings = Math.round(bet * PAIR_MULTIPLIER);
    balance += winnings;
    renderBalance();

    /* Highlight matching reels */
    if (a.emoji === b.emoji) { reelWindows[0].classList.add('winner'); reelWindows[1].classList.add('winner'); }
    if (b.emoji === c.emoji) { reelWindows[1].classList.add('winner'); reelWindows[2].classList.add('winner'); }
    if (a.emoji === c.emoji) { reelWindows[0].classList.add('winner'); reelWindows[2].classList.add('winner'); }

    showMessage(`Partial hallucination — close enough. (+${winnings} tokens)`, 'win');
    return;
  }

  /* No match */
  showMessage(pick(LOSE_MESSAGES), 'lose');
}

/* ============================================================
   Bet controls
   ============================================================ */

/**
 * Adjust the bet amount, clamped between BET_MIN and BET_MAX
 * and never exceeding the current balance.
 * @param {number} delta - Amount to add (can be negative).
 */
function adjustBet(delta) {
  bet = Math.max(BET_MIN, Math.min(BET_MAX, bet + delta));
  betAmountEl.textContent = bet;
}

betUpBtn.addEventListener('click', () => adjustBet(BET_STEP));
betDownBtn.addEventListener('click', () => adjustBet(-BET_STEP));

/* Spin on button click or spacebar */
spinBtn.addEventListener('click', spin);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    spin();
  }
});

/* ============================================================
   Initialization
   ============================================================ */

/** Set up the initial reel display and welcome message. */
function init() {
  reelStrips.forEach(strip => {
    strip.textContent = randomSymbol().emoji;
  });
  renderBalance();
  betAmountEl.textContent = bet;
  showMessage('Insert tokens and pull the lever (or press Space).', '');
}

init();
