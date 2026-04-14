const SYMBOLS = [
  { icon: '🧠', name: 'AGI',         payout: 50, weight: 1 },
  { icon: '🤖', name: 'Robot',       payout: 20, weight: 3 },
  { icon: '📎', name: 'Paperclip',   payout: 15, weight: 4 },
  { icon: '💸', name: 'VC Money',    payout: 10, weight: 5 },
  { icon: '🔥', name: 'GPU Fire',    payout: 8,  weight: 6 },
  { icon: '👁️', name: 'Six Fingers', payout: 5,  weight: 8 },
];

const SNARK_WIN = [
  "Three matching tokens! The model is *definitely* not memorizing.",
  "Congratulations, you've been approved for Series A.",
  "The neural net says: this was statistically inevitable.",
  "You won! (This outcome was hallucinated, but the tokens are real.)",
  "RLHF complete. Reward signal: positive.",
];

const SNARK_PARTIAL = [
  "Two of a kind. The model is 'pretty sure' that counts.",
  "Almost! The third reel was preempted by a safety filter.",
  "Partial credit. Like a confident wrong answer.",
];

const SNARK_LOSE = [
  "The model apologizes for the confusion.",
  "I cannot help with that request. (You lost.)",
  "As a large slot machine, I have no preferences. You still lost.",
  "Tokens deducted. Have you tried being more specific in your prompt?",
  "The reels are working as intended.",
  "Your subscription does not include winning.",
];

const SNARK_BROKE = [
  "Out of tokens. Please upgrade to Slots Pro Max ($200/mo).",
  "You've hit your context window. Tokens depleted.",
  "Insufficient compute. Try begging the foundation model.",
];

const state = {
  balance: 1000,
  bet: 10,
  spinning: false,
  reels: [0, 0, 0],
};

const $balance = document.getElementById('balance');
const $bet = document.getElementById('bet');
const $lastWin = document.getElementById('last-win');
const $message = document.getElementById('message');
const $spin = document.getElementById('spin');
const $betUp = document.getElementById('bet-up');
const $betDown = document.getElementById('bet-down');
const strips = [0, 1, 2].map(i => document.getElementById(`strip-${i}`));
const reelEls = document.querySelectorAll('.reel');

function buildStrips() {
  strips.forEach(strip => {
    strip.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const div = document.createElement('div');
      div.textContent = sym.icon;
      strip.appendChild(div);
    }
  });
}

function weightedPick() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOLS[i].weight;
    if (r <= 0) return i;
  }
  return SYMBOLS.length - 1;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function render() {
  $balance.textContent = state.balance;
  $bet.textContent = state.bet;
}

function setReelTo(stripIdx, symIdx) {
  const strip = strips[stripIdx];
  const landingIdx = strip.children.length - 3;
  strip.children[landingIdx].textContent = SYMBOLS[symIdx].icon;
  strip.style.transition = 'none';
  strip.style.transform = `translateY(-${(landingIdx - 0) * 120}px)`;
}

async function spinReel(stripIdx, finalSymIdx, duration) {
  const strip = strips[stripIdx];
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0)';
  void strip.offsetHeight;

  const landingIdx = strip.children.length - 3;
  strip.children[landingIdx].textContent = SYMBOLS[finalSymIdx].icon;

  strip.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.45, 0.25, 1)`;
  strip.style.transform = `translateY(-${landingIdx * 120}px)`;

  return new Promise(resolve => setTimeout(resolve, duration));
}

async function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) {
    $message.textContent = pick(SNARK_BROKE);
    $message.className = 'lose';
    return;
  }

  state.spinning = true;
  state.balance -= state.bet;
  reelEls.forEach(r => r.classList.remove('winning'));
  $message.textContent = "Computing... burning rainforest...";
  $message.className = '';
  $spin.disabled = true;
  $betUp.disabled = true;
  $betDown.disabled = true;
  render();

  buildStrips();

  const results = [weightedPick(), weightedPick(), weightedPick()];

  await Promise.all([
    spinReel(0, results[0], 1200),
    spinReel(1, results[1], 1600),
    spinReel(2, results[2], 2000),
  ]);

  evaluate(results);

  state.spinning = false;
  $spin.disabled = false;
  $betUp.disabled = false;
  $betDown.disabled = false;
  render();
}

function evaluate(results) {
  const [a, b, c] = results;
  let win = 0;
  let msg = '';
  let cls = 'lose';

  if (a === b && b === c) {
    win = SYMBOLS[a].payout * state.bet;
    msg = `${SYMBOLS[a].name.toUpperCase()}! +${win} tokens. ${pick(SNARK_WIN)}`;
    cls = win >= state.bet * 20 ? 'big-win' : 'win';
    reelEls.forEach(r => r.classList.add('winning'));
  } else if (a === b || b === c || a === c) {
    win = state.bet * 2;
    msg = `+${win} tokens. ${pick(SNARK_PARTIAL)}`;
    cls = 'win';
    if (a === b) { reelEls[0].classList.add('winning'); reelEls[1].classList.add('winning'); }
    else if (b === c) { reelEls[1].classList.add('winning'); reelEls[2].classList.add('winning'); }
    else { reelEls[0].classList.add('winning'); reelEls[2].classList.add('winning'); }
  } else {
    msg = pick(SNARK_LOSE);
  }

  state.balance += win;
  $lastWin.textContent = win;
  $message.textContent = msg;
  $message.className = cls;
}

$spin.addEventListener('click', spin);
$betUp.addEventListener('click', () => {
  if (state.spinning) return;
  state.bet = Math.min(100, state.bet + 10);
  render();
});
$betDown.addEventListener('click', () => {
  if (state.spinning) return;
  state.bet = Math.max(10, state.bet - 10);
  render();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); spin(); }
});

buildStrips();
strips.forEach((s, i) => setReelTo(i, i));
render();
