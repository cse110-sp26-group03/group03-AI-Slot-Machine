const SYMBOLS = [
  { emoji: '🤖', name: 'Chatbot',      weight: 20, payout: 5 },
  { emoji: '🧠', name: 'Neural Net',   weight: 15, payout: 10 },
  { emoji: '💾', name: 'Dataset',      weight: 12, payout: 15 },
  { emoji: '🔥', name: 'GPU',          weight: 8,  payout: 25 },
  { emoji: '📎', name: 'Paperclip',    weight: 6,  payout: 50 },
  { emoji: '👾', name: 'Hallucination', weight: 10, payout: 0, hallucinate: true },
  { emoji: '💸', name: 'Compute Bill', weight: 4,  payout: -30 },
  { emoji: '✨', name: 'AGI',          weight: 1,  payout: 500 },
];

const QUIPS = {
  jackpot: [
    'AGI ACHIEVED! The singularity pays out handsomely.',
    'You\'ve aligned the models. Retirement incoming.',
    'OpenAI is calling. They want their compute back.',
  ],
  bigWin: [
    'Your prompt engineering is unmatched.',
    'The model temperature was JUST right.',
    'Emergent behavior detected — in your favor!',
  ],
  win: [
    'Tokens flow like attention weights.',
    'Backpropagation in your favor.',
    'The loss function smiles upon you.',
  ],
  smallWin: [
    'A modest inference. Barely covers the API call.',
    'You broke even on electricity. Barely.',
  ],
  loss: [
    'Compute bill arrived. Refactor your life.',
    'Your tokens were consumed by a runaway for-loop.',
    'Model collapsed. So did your wallet.',
    'GPT hallucinated your winnings away.',
    'The transformer transformed your cash into vibes.',
  ],
  hallucinate: [
    'You won! ...Actually, no. That was a hallucination.',
    'The model confidently reports a payout that does not exist.',
    'Citations needed. Tokens deducted.',
  ],
  near: [
    'Two out of three. The model was THIS close to converging.',
    'Almost aligned! Try increasing the learning rate.',
  ],
};

const state = {
  balance: 1000,
  bet: 50,
  context: 0,
  halluc: 0,
  spinning: false,
};

const $ = (id) => document.getElementById(id);
const balanceEl = $('balance');
const contextEl = $('context');
const hallucEl  = $('halluc');
const betEl     = $('bet');
const spinBtn   = $('spin');
const msgEl     = $('message');
const logEl     = $('log');

function pickWeighted() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[0];
}

function buildStrip(finalSymbol) {
  const strip = document.createElement('div');
  strip.className = 'strip';
  const count = 24;
  for (let i = 0; i < count - 1; i++) {
    const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const div = document.createElement('div');
    div.className = 'symbol';
    div.textContent = s.emoji;
    strip.appendChild(div);
  }
  const finalDiv = document.createElement('div');
  finalDiv.className = 'symbol';
  finalDiv.textContent = finalSymbol.emoji;
  strip.appendChild(finalDiv);
  return strip;
}

function spinReel(reelId, finalSymbol, delay) {
  return new Promise((resolve) => {
    const reel = $(reelId);
    const strip = buildStrip(finalSymbol);
    reel.innerHTML = '';
    reel.appendChild(strip);
    strip.style.transform = 'translateY(0)';

    requestAnimationFrame(() => {
      const totalSymbols = strip.children.length;
      const offset = (totalSymbols - 1) * 130;
      strip.style.transition = `transform ${1.5 + delay / 1000}s cubic-bezier(0.15, 0.75, 0.25, 1)`;
      strip.style.transform = `translateY(-${offset}px)`;
    });

    setTimeout(resolve, 1600 + delay);
  });
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function updateUI() {
  balanceEl.textContent = state.balance;
  contextEl.textContent = `${Math.min(100, state.context)}%`;
  hallucEl.textContent = state.halluc;
  betEl.textContent = state.bet;
  spinBtn.disabled = state.spinning || state.balance < state.bet;
  if (state.balance <= 0) {
    spinBtn.disabled = true;
    msgEl.textContent = '💀 Out of tokens. Please subscribe to Premium+ for $20/month.';
    msgEl.className = 'message bad';
  }
}

function log(text, cls = '') {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  logEl.prepend(li);
  while (logEl.children.length > 15) logEl.removeChild(logEl.lastChild);
}

function setMessage(text, cls = '') {
  msgEl.textContent = text;
  msgEl.className = 'message ' + cls;
}

async function spin() {
  if (state.spinning || state.balance < state.bet) return;
  state.spinning = true;
  state.balance -= state.bet;
  state.context = Math.min(100, state.context + 7);
  updateUI();
  setMessage('Running inference...', '');

  const results = [pickWeighted(), pickWeighted(), pickWeighted()];

  if (state.context >= 100) {
    results[Math.floor(Math.random() * 3)] = SYMBOLS.find(s => s.hallucinate);
    state.context = 0;
  }

  await Promise.all([
    spinReel('reel0', results[0], 0),
    spinReel('reel1', results[1], 200),
    spinReel('reel2', results[2], 400),
  ]);

  resolveOutcome(results);
  state.spinning = false;
  updateUI();
}

function resolveOutcome(results) {
  const [a, b, c] = results;
  const allMatch = a.name === b.name && b.name === c.name;
  const anyHallucinate = results.some(r => r.hallucinate);
  const twoMatch = !allMatch && (a.name === b.name || b.name === c.name || a.name === c.name);

  let payout = 0;
  let cls = '';
  let message = '';

  if (anyHallucinate && allMatch) {
    state.halluc += 3;
    message = pick(QUIPS.hallucinate);
    cls = 'bad';
    document.querySelector('.machine').classList.add('shake');
    setTimeout(() => document.querySelector('.machine').classList.remove('shake'), 400);
  } else if (allMatch) {
    const multiplier = state.bet / 10;
    payout = Math.round(a.payout * multiplier);
    if (a.name === 'AGI') {
      message = pick(QUIPS.jackpot);
      cls = 'big';
    } else if (a.payout >= 25) {
      message = pick(QUIPS.bigWin);
      cls = 'big';
    } else if (a.payout < 0) {
      message = `💸 Triple Compute Bill! ${Math.abs(payout)} tokens vanished.`;
      cls = 'bad';
    } else {
      message = pick(QUIPS.win);
      cls = '';
    }
  } else if (anyHallucinate) {
    state.halluc += 1;
    message = pick(QUIPS.hallucinate);
    cls = 'bad';
  } else if (twoMatch) {
    payout = Math.round(state.bet * 0.5);
    message = pick(QUIPS.near);
    cls = '';
  } else {
    message = pick(QUIPS.loss);
    cls = 'bad';
  }

  state.balance += payout;
  if (state.balance < 0) state.balance = 0;

  const summary = `${a.emoji}${b.emoji}${c.emoji} → ${payout >= 0 ? '+' : ''}${payout}`;
  let logCls = 'loss';
  if (payout > state.bet * 5) logCls = 'big';
  else if (payout > 0) logCls = 'win';
  log(summary, logCls);

  setMessage(message, cls);
}

function initReels() {
  ['reel0', 'reel1', 'reel2'].forEach((id, i) => {
    const reel = $(id);
    const strip = document.createElement('div');
    strip.className = 'strip';
    const div = document.createElement('div');
    div.className = 'symbol';
    div.textContent = SYMBOLS[i % SYMBOLS.length].emoji;
    strip.appendChild(div);
    reel.appendChild(strip);
  });
}

document.querySelectorAll('.bet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const delta = parseInt(btn.dataset.delta, 10);
    state.bet = Math.max(10, Math.min(500, state.bet + delta));
    updateUI();
  });
});

spinBtn.addEventListener('click', spin);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !state.spinning) {
    e.preventDefault();
    spin();
  }
});

initReels();
updateUI();
log('System booted. Weights initialized randomly (we hope).');
