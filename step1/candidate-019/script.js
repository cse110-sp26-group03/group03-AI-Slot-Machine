const SYMBOLS = [
  { icon: '🤖', name: 'Bot',         payout: 10,  weight: 10 },
  { icon: '🧠', name: 'Brain',       payout: 25,  weight: 6  },
  { icon: '💾', name: 'Data',        payout: 5,   weight: 14 },
  { icon: '🔥', name: 'GPU Fire',    payout: 50,  weight: 3  },
  { icon: '📎', name: 'Clippy',      payout: 15,  weight: 8  },
  { icon: '🌀', name: 'Hallucination', payout: 0, weight: 9, special: 'hallucinate' },
  { icon: '💸', name: 'API Bill',    payout: -20, weight: 7, special: 'bill' },
  { icon: '⭐', name: 'Token',       payout: 3,   weight: 15 },
  { icon: '🚀', name: 'AGI',         payout: 200, weight: 1  },
];

const WIN_QUIPS = [
  "The model aligned with your vibes.",
  "Alignment achieved. Briefly.",
  "You rolled a nat 20 on prompt engineering.",
  "Gradient descended into your wallet.",
  "The stochastic parrot sang your song.",
  "Temperature was zero. It was meant to be.",
];
const LOSE_QUIPS = [
  "As a large language model, I cannot help you win.",
  "I'm sorry, I can't assist with that payout.",
  "The context window forgot your winnings.",
  "Model is at capacity. Please try again.",
  "Output truncated. So was your balance.",
  "Rate limit exceeded on luck.",
];
const HALLUCINATE_QUIPS = [
  "You won 1,000,000 tokens! (just kidding, you won 0)",
  "Technically correct is the best kind of correct. You lost.",
  "The reels confidently displayed symbols that never existed.",
  "Source: trust me bro.",
];
const BILL_QUIPS = [
  "Your inference bill arrived. COD.",
  "OpenAI would like a word. And 20 tokens.",
  "GPU go brrr, wallet go 💀.",
];

const state = {
  tokens: 1000,
  bet: 10,
  hallucinations: 0,
  spinning: false,
};

const BETS = [1, 5, 10, 25, 50, 100, 500];

const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);

function pickSymbol() {
  let r = Math.random() * totalWeight;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[0];
}

function buildStrip(reelEl, finalSymbol) {
  const strip = reelEl.querySelector('.strip');
  strip.innerHTML = '';
  const count = 30;
  const symbols = [];
  for (let i = 0; i < count - 1; i++) symbols.push(pickSymbol());
  symbols.push(finalSymbol);
  for (const s of symbols) {
    const d = document.createElement('div');
    d.className = 'symbol';
    d.textContent = s.icon;
    strip.appendChild(d);
  }
  return symbols;
}

function spinReel(reelEl, finalSymbol, duration) {
  return new Promise(resolve => {
    const strip = reelEl.querySelector('.strip');
    buildStrip(reelEl, finalSymbol);
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    void strip.offsetHeight;

    const symbolHeight = reelEl.querySelector('.symbol').offsetHeight;
    const totalOffset = symbolHeight * 29;

    strip.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
    strip.style.transform = `translateY(-${totalOffset}px)`;

    setTimeout(resolve, duration);
  });
}

function updateUI() {
  document.getElementById('tokens').textContent = state.tokens;
  document.getElementById('bet').textContent = state.bet;
  document.getElementById('bet-cost').textContent = state.bet;
  document.getElementById('hallucinations').textContent = state.hallucinations;
  document.getElementById('spin').disabled = state.spinning || state.tokens < state.bet;
}

function setMessage(text, kind = '') {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = 'message' + (kind ? ' ' + kind : '');
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function spin() {
  if (state.spinning || state.tokens < state.bet) return;
  state.spinning = true;
  state.tokens -= state.bet;
  updateUI();
  setMessage("Prompting the model...", '');

  document.getElementById('lever').classList.add('pulled');
  setTimeout(() => document.getElementById('lever').classList.remove('pulled'), 400);

  document.querySelectorAll('.reel').forEach(r => r.classList.remove('win'));

  const results = [pickSymbol(), pickSymbol(), pickSymbol()];
  const reels = [0,1,2].map(i => document.getElementById('reel-' + i));

  await Promise.all([
    spinReel(reels[0], results[0], 1500),
    spinReel(reels[1], results[1], 2000),
    spinReel(reels[2], results[2], 2500),
  ]);

  resolveOutcome(results, reels);
  state.spinning = false;
  updateUI();
}

function resolveOutcome(results, reels) {
  const [a, b, c] = results;
  const allSame = a.name === b.name && b.name === c.name;
  const twoSame = !allSame && (a.name === b.name || b.name === c.name || a.name === c.name);

  let msg = '';
  let kind = '';
  let winIndices = [];

  if (allSame) {
    if (a.special === 'hallucinate') {
      state.hallucinations += 3;
      msg = `TRIPLE HALLUCINATION! ${pick(HALLUCINATE_QUIPS)}`;
      kind = 'lose';
    } else if (a.special === 'bill') {
      const bill = Math.abs(a.payout) * 3 * (state.bet / 10);
      state.tokens = Math.max(0, state.tokens - Math.floor(bill));
      msg = `💸 TRIPLE API BILL! Lost ${Math.floor(bill)} tokens. ${pick(BILL_QUIPS)}`;
      kind = 'lose';
    } else {
      const prize = a.payout * 3 * (state.bet / 10);
      state.tokens += Math.floor(prize);
      msg = `🎉 JACKPOT! Three ${a.name}s! +${Math.floor(prize)} tokens. ${pick(WIN_QUIPS)}`;
      kind = 'win';
      winIndices = [0, 1, 2];
    }
  } else if (twoSame) {
    const matched = a.name === b.name ? a : (b.name === c.name ? b : a);
    if (matched.special === 'hallucinate') {
      state.hallucinations += 1;
      msg = `Partial hallucination detected. ${pick(HALLUCINATE_QUIPS)}`;
      kind = 'lose';
    } else if (matched.special === 'bill') {
      const bill = Math.abs(matched.payout) * (state.bet / 10);
      state.tokens = Math.max(0, state.tokens - Math.floor(bill));
      msg = `Partial API bill. -${Math.floor(bill)} tokens. ${pick(BILL_QUIPS)}`;
      kind = 'lose';
    } else {
      const prize = Math.floor(matched.payout * (state.bet / 10));
      state.tokens += prize;
      msg = `Two ${matched.name}s! +${prize} tokens. ${pick(WIN_QUIPS)}`;
      kind = prize > 0 ? 'win' : '';
      if (a.name === b.name) winIndices = [0, 1];
      else if (b.name === c.name) winIndices = [1, 2];
      else winIndices = [0, 2];
    }
  } else {
    msg = pick(LOSE_QUIPS);
    kind = 'lose';
  }

  if (state.tokens <= 0 && kind !== 'win') {
    msg += " You're out of tokens. Beg for more.";
  }

  setMessage(msg, kind);
  winIndices.forEach(i => reels[i].classList.add('win'));
}

function beg() {
  if (state.tokens > 50) {
    setMessage("You still have tokens. Greed is not alignment.", 'lose');
    return;
  }
  const alms = Math.floor(Math.random() * 80) + 20;
  state.tokens += alms;
  setMessage(`Sam Altman glanced your way. +${alms} tokens (pity alms).`, 'win');
  updateUI();
}

function changeBet(dir) {
  const i = BETS.indexOf(state.bet);
  const ni = Math.max(0, Math.min(BETS.length - 1, i + dir));
  state.bet = BETS[ni];
  updateUI();
}

function buildPaytable() {
  const ul = document.getElementById('paytable');
  ul.innerHTML = '';
  for (const s of SYMBOLS) {
    const li = document.createElement('li');
    let val;
    if (s.special === 'hallucinate') val = '???';
    else if (s.special === 'bill') val = `${s.payout * 3}`;
    else val = `+${s.payout * 3}`;
    li.innerHTML = `<span>${s.icon} ${s.icon} ${s.icon}</span><span>${val}</span>`;
    ul.appendChild(li);
  }
}

function initReels() {
  document.querySelectorAll('.reel').forEach(reel => {
    const strip = reel.querySelector('.strip');
    const s = pickSymbol();
    const d = document.createElement('div');
    d.className = 'symbol';
    d.textContent = s.icon;
    strip.appendChild(d);
  });
}

document.getElementById('spin').addEventListener('click', spin);
document.getElementById('lever').addEventListener('click', spin);
document.getElementById('bet-up').addEventListener('click', () => changeBet(1));
document.getElementById('bet-down').addEventListener('click', () => changeBet(-1));
document.getElementById('beg').addEventListener('click', beg);
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); spin(); }
});

buildPaytable();
initReels();
updateUI();
