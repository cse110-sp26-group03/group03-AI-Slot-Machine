const SYMBOLS = ['🧠', '💸', '🤖', '📄', '🔥', '🍓', '💀'];
const PAYOUTS = {
  '🧠': 50, '💸': 25, '🤖': 15, '📄': 10, '🔥': 8, '🍓': 5,
};

const WIN_QUIPS = {
  '🧠': "AGI achieved! (by our internal benchmarks)",
  '💸': "Series F closed. Valuation: vibes.",
  '🤖': "Three agents aligned. Briefly.",
  '📄': "Paper accepted at NeurIPS Workshop on Workshops.",
  '🔥': "Datacenter on fire. Insurance pays out!",
  '🍓': "🍓 revealed. The lattice hums.",
};

const LOSE_QUIPS = [
  "The model confidently returned nothing.",
  "Context window exceeded. Try fewer hopes.",
  "RLHF rejected your vibes.",
  "Temperature too high. Output incoherent.",
  "Scaling laws say: no.",
  "The attention heads looked elsewhere.",
  "Tokenizer split your luck in half.",
  "Prompt injected by reality.",
];

const HALLUCINATION_QUIPS = [
  "💀 HALLUCINATION: model insists it won. It didn't. You owe 2×.",
  "💀 The model fabricated a citation AND took your tokens.",
  "💀 Reward hacking detected. The house hacks back.",
];

let balance = 1000;
let burned = 0;
let spinning = false;

const balanceEl = document.getElementById('balance');
const burnedEl = document.getElementById('burned');
const messageEl = document.getElementById('message');
const spinBtn = document.getElementById('spin');
const bailoutBtn = document.getElementById('bailout');
const betSel = document.getElementById('bet');
const reels = [0, 1, 2].map(i => document.getElementById('reel' + i));
const strips = reels.map(r => r.querySelector('.strip'));

function render() {
  balanceEl.textContent = balance.toLocaleString();
  burnedEl.textContent = burned.toLocaleString();
  spinBtn.disabled = spinning || balance < Number(betSel.value);
}

function randSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function setMessage(text, cls = '') {
  messageEl.className = 'message' + (cls ? ' ' + cls : '');
  messageEl.textContent = text;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function spin() {
  if (spinning) return;
  const bet = Number(betSel.value);
  if (balance < bet) return;
  spinning = true;
  balance -= bet;
  burned += bet;
  render();
  setMessage("Inference in progress…");

  reels.forEach(r => r.classList.add('spinning'));

  // Animate random symbols during spin
  const interval = setInterval(() => {
    strips.forEach(s => s.textContent = randSymbol());
  }, 80);

  const result = [randSymbol(), randSymbol(), randSymbol()];

  // Stop reels sequentially
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 700 + i * 400));
    reels[i].classList.remove('spinning');
    strips[i].textContent = result[i];
  }

  clearInterval(interval);
  strips.forEach((s, i) => s.textContent = result[i]);

  evaluate(result, bet);
  spinning = false;
  render();
}

function evaluate(result, bet) {
  const [a, b, c] = result;
  const allMatch = a === b && b === c;

  if (allMatch && a === '💀') {
    const penalty = bet * 2;
    balance -= penalty;
    burned += penalty;
    document.querySelector('.machine').classList.add('flash');
    setTimeout(() => document.querySelector('.machine').classList.remove('flash'), 1500);
    setMessage(pick(HALLUCINATION_QUIPS), 'loss');
    return;
  }

  if (allMatch && PAYOUTS[a]) {
    const winnings = bet * PAYOUTS[a];
    balance += winnings;
    document.querySelector('.machine').classList.add('flash');
    setTimeout(() => document.querySelector('.machine').classList.remove('flash'), 1500);
    setMessage(`${WIN_QUIPS[a]} +${winnings.toLocaleString()} tokens!`, 'win');
    return;
  }

  // Two matching (ignore 💀 pairs)
  const pair = (a === b || b === c || a === c) && !(a === '💀' && b === '💀') && !(b === '💀' && c === '💀') && !(a === '💀' && c === '💀');
  if (pair) {
    const winnings = bet * 2;
    balance += winnings;
    setMessage(`Partial pattern match. The model is ${Math.floor(Math.random()*40+60)}% confident. +${winnings} tokens.`, 'win');
    return;
  }

  setMessage(pick(LOSE_QUIPS), 'loss');
}

spinBtn.addEventListener('click', spin);
betSel.addEventListener('change', render);
bailoutBtn.addEventListener('click', () => {
  if (spinning) return;
  if (balance > 200) {
    setMessage("VCs laughed. You still have runway — come back when you're desperate.");
    return;
  }
  balance += 1000;
  burned += 0;
  const quips = [
    "a16z wires 1000 tokens. They want 40% and a board seat.",
    "Seed round closed at 'trust me bro' valuation. +1000 tokens.",
    "Pivoted to B2B agents. VCs threw money. +1000 tokens.",
    "Rebranded to '.ai'. Raised instantly. +1000 tokens.",
  ];
  setMessage(pick(quips), 'win');
  render();
});

// Initial display
strips.forEach(s => s.textContent = '❓');
render();
