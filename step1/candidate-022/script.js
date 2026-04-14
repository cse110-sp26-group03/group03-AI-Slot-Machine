const SYMBOLS = [
  { icon: '🤖', name: 'Bot',         weight: 20, payout: 3 },
  { icon: '🧠', name: 'Brain',       weight: 15, payout: 5 },
  { icon: '💾', name: 'Weights',     weight: 12, payout: 8 },
  { icon: '📉', name: 'Loss',        weight: 18, payout: 2 },
  { icon: '🔥', name: 'GPU Fire',    weight: 10, payout: 10 },
  { icon: '👁️', name: 'AGI',         weight: 3,  payout: 50 },
  { icon: '🪙', name: 'Token',       weight: 14, payout: 4 },
  { icon: '💀', name: 'Hallucinate', weight: 8,  payout: 0 },
];

const WIN_QUIPS = [
  "The model aligned. Briefly.",
  "Stochastic parrots sing your name.",
  "Emergent behavior detected: profit.",
  "You beat the scaling laws.",
  "Gradient descent into riches.",
];
const LOSE_QUIPS = [
  "The model hallucinated your winnings.",
  "Attention is all you lost.",
  "Your prompt was not engineered enough.",
  "Training loss: emotional.",
  "The AI confidently returned: nothing.",
  "RLHF says: skill issue.",
];
const JACKPOT_QUIPS = [
  "🚨 AGI ACHIEVED. Please notify the board.",
  "🚨 SUPERINTELLIGENCE UNLOCKED. Sam is calling.",
];

const state = {
  balance: 1000,
  burned: 0,
  context: 10,
  spinning: false,
};

const weightedPool = SYMBOLS.flatMap(s => Array(s.weight).fill(s));
const pick = () => weightedPool[Math.floor(Math.random() * weightedPool.length)];
const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const $ = id => document.getElementById(id);

function render() {
  $('balance').textContent = state.balance;
  $('burned').textContent = state.burned;
  $('context').style.width = Math.min(100, state.context) + '%';
  $('spin').disabled = state.spinning || state.balance < Number($('bet').value);
}

function log(msg, cls = 'sys') {
  const el = document.createElement('div');
  el.className = 'entry ' + cls;
  el.textContent = msg;
  const l = $('log');
  l.prepend(el);
  while (l.children.length > 30) l.lastChild.remove();
}

function buildStrip(reelEl, finalSymbol) {
  const strip = reelEl.querySelector('.strip');
  strip.innerHTML = '';
  const seq = [];
  for (let i = 0; i < 20; i++) seq.push(pick());
  seq.push(finalSymbol);
  for (const s of seq) {
    const d = document.createElement('div');
    d.textContent = s.icon;
    strip.appendChild(d);
  }
  return strip;
}

async function spin() {
  const bet = Number($('bet').value);
  if (bet < 10 || !Number.isFinite(bet)) return;
  if (state.balance < bet) { log("Insufficient tokens. Try begging.", 'lose'); return; }

  state.spinning = true;
  state.balance -= bet;
  state.burned += bet;
  state.context = Math.min(100, state.context + 3);
  render();
  log(`Burned ${bet} tokens on inference...`, 'sys');

  const results = [pick(), pick(), pick()];
  const reels = [$('reel0'), $('reel1'), $('reel2')];

  reels.forEach((r, i) => {
    r.classList.add('spinning');
    buildStrip(r, results[i]);
  });

  for (let i = 0; i < 3; i++) {
    await new Promise(res => setTimeout(res, 600 + i * 500));
    const strip = reels[i].querySelector('.strip');
    strip.style.transform = `translateY(-${120 * 20}px)`;
    reels[i].classList.remove('spinning');
  }

  await new Promise(res => setTimeout(res, 300));

  let payout = 0;
  let quip;
  if (results[0].name === results[1].name && results[1].name === results[2].name) {
    payout = bet * results[0].payout;
    quip = results[0].name === 'AGI' ? rand(JACKPOT_QUIPS) : rand(WIN_QUIPS);
  } else if (
    results[0].name === results[1].name ||
    results[1].name === results[2].name ||
    results[0].name === results[2].name
  ) {
    payout = Math.floor(bet * 1.5);
    quip = "Partial alignment. Partial payout.";
  } else {
    quip = rand(LOSE_QUIPS);
  }

  if (results.some(r => r.name === 'Hallucinate') && payout > 0) {
    payout = Math.floor(payout / 2);
    quip = "Hallucination tax applied. " + quip;
  }

  if (payout > 0) {
    state.balance += payout;
    log(`+${payout} tokens — ${quip}`, 'win');
  } else {
    log(quip, 'lose');
  }

  if (state.context >= 100) {
    log("⚠️ Context window full. Compacting — you lose 20% balance.", 'lose');
    state.balance = Math.floor(state.balance * 0.8);
    state.context = 10;
  }

  state.spinning = false;
  render();
}

function beg() {
  if (state.balance > 100) {
    log("Sam says: you don't need a handout yet.", 'sys');
    return;
  }
  const grant = 200 + Math.floor(Math.random() * 300);
  state.balance += grant;
  log(`Series Z funding round closed: +${grant} tokens. Terms: your soul.`, 'win');
  render();
}

$('spin').addEventListener('click', spin);
$('beg').addEventListener('click', beg);
$('bet').addEventListener('input', render);

log("System online. Model loaded. Please gamble responsibly (you won't).", 'sys');
render();
