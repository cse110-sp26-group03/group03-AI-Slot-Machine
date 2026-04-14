const SYMBOLS = [
  { icon: '🤖', name: 'Bot', weight: 5, payout: 10 },
  { icon: '🧠', name: 'Brain', weight: 4, payout: 15 },
  { icon: '💾', name: 'Weights', weight: 4, payout: 20 },
  { icon: '🔥', name: 'GPU', weight: 3, payout: 30 },
  { icon: '👁️', name: 'AGI', weight: 1, payout: 100 },
  { icon: '💩', name: 'Hallucination', weight: 6, payout: 0 },
  { icon: '🚫', name: 'Refusal', weight: 5, payout: 0 },
];

const LOSE_QUIPS = [
  "As an AI, I cannot help you win this spin.",
  "I apologize for the confusion. You lost.",
  "Model hallucinated a win. It was fake. You lost.",
  "Your request violates my token policy.",
  "I'm just a language model, and you're broke.",
  "Training data didn't include winning.",
  "404: Jackpot not found.",
  "Rate limited. Also, you lost.",
];

const WIN_QUIPS = [
  "You prompted successfully. Tokens awarded.",
  "The model agrees with your investment thesis.",
  "Stochastic parrot smiled upon you.",
  "Gradient descent landed in your favor.",
];

let balance = 1000;
let bet = 50;
let context = 0;
let spinning = false;

const $ = id => document.getElementById(id);
const balanceEl = $('balance');
const betEl = $('bet');
const contextEl = $('context');
const messageEl = $('message');
const spinBtn = $('spin');
const machine = document.querySelector('.machine');

function weightedPick() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[0];
}

function updateUI() {
  balanceEl.textContent = balance;
  betEl.textContent = bet;
  contextEl.textContent = Math.min(100, Math.floor(context)) + '%';
}

function setMessage(text, cls = '') {
  messageEl.textContent = text;
  messageEl.className = 'message ' + cls;
}

function spinReel(idx, finalSymbol, delay) {
  return new Promise(resolve => {
    const reel = $('reel' + idx);
    const strip = reel.querySelector('.strip');
    reel.classList.add('spinning');
    strip.textContent = weightedPick().icon;
    const tick = setInterval(() => {
      strip.textContent = weightedPick().icon;
    }, 80);
    setTimeout(() => {
      clearInterval(tick);
      reel.classList.remove('spinning');
      strip.textContent = finalSymbol.icon;
      resolve();
    }, delay);
  });
}

async function spin() {
  if (spinning) return;
  if (balance < bet) {
    setMessage("Insufficient tokens. Please upgrade to Pro.", 'lose');
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  balance -= bet;
  context = Math.min(100, context + 3 + Math.random() * 4);
  updateUI();
  setMessage("Running inference…");

  const results = [weightedPick(), weightedPick(), weightedPick()];

  await Promise.all([
    spinReel(0, results[0], 800),
    spinReel(1, results[1], 1400),
    spinReel(2, results[2], 2000),
  ]);

  const [a, b, c] = results;
  let winAmount = 0;
  let msg = '';
  let cls = 'lose';

  if (a.name === b.name && b.name === c.name) {
    if (a.payout === 0) {
      msg = a.name === 'Hallucination'
        ? "Triple hallucination! The model is very confident it won. It didn't."
        : "Triple refusal. As an AI, I cannot award tokens.";
    } else {
      winAmount = bet * a.payout / 10;
      if (a.name === 'AGI') {
        msg = `🎉 AGI ACHIEVED! Singularity jackpot: +${winAmount} tokens!`;
        machine.classList.add('jackpot');
        setTimeout(() => machine.classList.remove('jackpot'), 2000);
      } else {
        msg = `Triple ${a.name}! +${winAmount} tokens. ${WIN_QUIPS[Math.floor(Math.random()*WIN_QUIPS.length)]}`;
      }
      cls = 'win';
    }
  } else if (a.name === b.name || b.name === c.name || a.name === c.name) {
    const pair = a.name === b.name ? a : (b.name === c.name ? b : a);
    if (pair.payout > 0) {
      winAmount = Math.floor(bet * pair.payout / 30);
      msg = `Partial match (${pair.name} x2). +${winAmount} tokens. Mostly correct, like an LLM.`;
      cls = 'win';
    } else {
      msg = LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)];
    }
  } else {
    msg = LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)];
  }

  balance += winAmount;

  if (context >= 100) {
    msg += " ⚠️ Context window full. Compacting memory… you feel dumber.";
    context = 20;
  }

  updateUI();
  setMessage(msg, cls);

  if (balance <= 0) {
    setMessage("💸 You're out of tokens. Please insert credit card to continue training.", 'lose');
    spinBtn.disabled = true;
  } else {
    spinBtn.disabled = false;
  }
  spinning = false;
}

$('betUp').addEventListener('click', () => {
  if (spinning) return;
  bet = Math.min(500, bet + 50);
  updateUI();
});

$('betDown').addEventListener('click', () => {
  if (spinning) return;
  bet = Math.max(50, bet - 50);
  updateUI();
});

spinBtn.addEventListener('click', spin);

document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); spin(); }
});

for (let i = 0; i < 3; i++) {
  document.querySelector(`#reel${i} .strip`).textContent = '❓';
}
updateUI();
