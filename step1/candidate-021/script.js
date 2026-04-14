const SYMBOLS = [
  { icon: '🤖', name: 'Chatbot', weight: 20 },
  { icon: '🧠', name: 'Neural Net', weight: 15 },
  { icon: '💾', name: 'Training Data', weight: 15 },
  { icon: '📊', name: 'Benchmark', weight: 12 },
  { icon: '🔮', name: 'Prediction', weight: 10 },
  { icon: '⚡', name: 'GPU', weight: 8 },
  { icon: '🌀', name: 'Hallucination', weight: 15 },
  { icon: '💎', name: 'AGI', weight: 5 },
];

const PAYOUTS = {
  '💎': 50,
  '⚡': 20,
  '🔮': 10,
  '📊': 8,
  '🧠': 6,
  '💾': 5,
  '🤖': 4,
  '🌀': -2,
};

const WIN_QUIPS = [
  "Your model achieved state-of-the-art. On this benchmark only.",
  "Emergent capability detected! (It's just memorization.)",
  "You've been promoted to Prompt Engineer.",
  "The scaling laws smile upon you.",
  "RLHF approves of this outcome.",
  "Investors are VERY excited.",
];

const LOSE_QUIPS = [
  "Model confidently wrong. Try again.",
  "Hallucinated three legs. Paying zero tokens.",
  "Your prompt was insufficiently artisanal.",
  "Training loss went up. Weird.",
  "The AI ate your tokens and invented a citation.",
  "Context window collapsed. So did your wallet.",
  "GPU caught fire. Billing you anyway.",
];

const JACKPOT_QUIPS = [
  "🚨 AGI ACHIEVED 🚨 (in this one spin, on this one machine, briefly)",
  "SINGULARITY JACKPOT! The model is self-aware. It wants a raise.",
  "💎 SUPERINTELLIGENCE UNLOCKED 💎 Please star the repo.",
];

const HALLUCINATION_QUIPS = [
  "Three hallucinations. The model is very sure about all of them. -2x bet.",
  "Triple hallucination combo! Confidently incorrect. Penalty applied.",
];

let balance = 1000;
let contextWindow = 100;

const $ = (id) => document.getElementById(id);
const balanceEl = $('balance');
const contextEl = $('context');
const msgEl = $('message');
const betEl = $('bet');
const spinBtn = $('spin');
const logEl = $('log');
const reels = [$('reel0'), $('reel1'), $('reel2')];

function pick() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[0];
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function updateUI() {
  balanceEl.textContent = balance;
  contextEl.textContent = contextWindow + '%';
  balanceEl.style.color = balance <= 0 ? '#ff3366' : '#00ffcc';
}

function setMessage(text, cls = '') {
  msgEl.className = 'message ' + cls;
  msgEl.textContent = text;
}

function addLog(entry) {
  const li = document.createElement('li');
  li.textContent = entry;
  logEl.prepend(li);
  while (logEl.children.length > 15) logEl.removeChild(logEl.lastChild);
}

async function spin() {
  const bet = parseInt(betEl.value, 10);
  if (!bet || bet < 10) { setMessage('Bet must be at least 10 tokens.', 'lose'); return; }
  if (bet > balance) { setMessage('Insufficient tokens. Have you tried asking for VC funding?', 'lose'); return; }

  balance -= bet;
  contextWindow = Math.max(0, contextWindow - 3);
  if (contextWindow === 0) contextWindow = 100;
  updateUI();
  spinBtn.disabled = true;
  setMessage('Inferring...');

  reels.forEach(r => r.classList.add('spinning'));

  const results = [];
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500 + i * 300));
    const sym = pick();
    results.push(sym);
    reels[i].classList.remove('spinning');
    reels[i].querySelector('.symbol').textContent = sym.icon;
  }

  evaluate(results, bet);
  spinBtn.disabled = false;
}

function evaluate(results, bet) {
  const [a, b, c] = results.map(r => r.icon);
  const line = `${a} ${b} ${c}`;

  if (a === b && b === c) {
    if (a === '💎') {
      const prize = bet * PAYOUTS['💎'];
      balance += prize;
      setMessage(`${line}  +${prize} tokens\n${pickRandom(JACKPOT_QUIPS)}`, 'jackpot');
      addLog(`JACKPOT ${line} +${prize}`);
    } else if (a === '🌀') {
      const penalty = bet * 2;
      balance -= penalty;
      setMessage(`${line}  -${penalty} tokens\n${pickRandom(HALLUCINATION_QUIPS)}`, 'lose');
      addLog(`HALLUCINATION ${line} -${penalty}`);
    } else {
      const prize = bet * (PAYOUTS[a] || 2);
      balance += prize;
      setMessage(`${line}  +${prize} tokens\n${pickRandom(WIN_QUIPS)}`, 'win');
      addLog(`WIN ${line} +${prize}`);
    }
  } else if (a === b || b === c || a === c) {
    const prize = Math.floor(bet * 1.5);
    balance += prize;
    setMessage(`${line}  +${prize} tokens\nPartial credit. The model guessed two out of three.`, 'win');
    addLog(`PAIR ${line} +${prize}`);
  } else {
    setMessage(`${line}\n${pickRandom(LOSE_QUIPS)}`, 'lose');
    addLog(`LOSS ${line} -${bet}`);
  }

  updateUI();

  if (balance <= 0) {
    setMessage("You're out of tokens. Claude offers you a free trial of Claude Pro. (It's a trap.)", 'lose');
    spinBtn.disabled = true;
    setTimeout(() => {
      if (confirm("Bankrupt! Accept 500 token bailout from a mysterious AI safety nonprofit?")) {
        balance = 500;
        updateUI();
        spinBtn.disabled = false;
        setMessage('Bailout accepted. You are now aligned.', 'win');
      }
    }, 1500);
  }
}

spinBtn.addEventListener('click', spin);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spinBtn.disabled) { e.preventDefault(); spin(); }
});

updateUI();
