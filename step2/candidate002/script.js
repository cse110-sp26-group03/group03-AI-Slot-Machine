// =========================================================================
// $TOKENS — AI Hype Slot Simulator
// =========================================================================

const SYMBOLS = [
  { id: 'robot',  emoji: '🤖', weight: 20, mult: 3,   name: 'Robot',        desc: 'Will replace your job. Pinky promise.' },
  { id: 'brain',  emoji: '🧠', weight: 18, mult: 4,   name: 'Brain',        desc: 'AGI any day now. Source: a tweet.' },
  { id: 'gpu',    emoji: '💾', weight: 15, mult: 5,   name: 'GPU',          desc: 'Scarcer than integrity. Hoard them.' },
  { id: 'chip',   emoji: '🔌', weight: 14, mult: 6,   name: 'Compute',      desc: 'Burns electricity. Also money.' },
  { id: 'halluc', emoji: '👻', weight: 16, mult: 2,   name: 'Hallucination',desc: '"Confidently wrong" as a service.' },
  { id: 'money',  emoji: '💰', weight: 8,  mult: 10,  name: 'VC Funding',   desc: 'Vibes-based valuation.' },
  { id: 'prompt', emoji: '📝', weight: 6,  mult: 15,  name: 'Prompt',       desc: 'Just add "step by step". 🪄' },
  { id: 'agi',    emoji: '⭐', weight: 3,  mult: 50,  name: 'AGI',          desc: '2 weeks away. Since 2015.' },
];

const STATE = {
  balance: 1000,
  bet: 10,
  bets: [1, 5, 10, 25, 50, 100, 250],
  betIdx: 2,
  spins: 0,
  wins: 0,
  peak: 1000,
  startingBalance: 1000,
  temperature: 0,
  history: [],
  muted: false,
  spinning: false,
};

const BANKRUPT_MSGS = [
  '> Error: insufficient $TOKENS for inference. Have you tried pivoting to blockchain?',
  '> Your Series A has evaporated. The compute gods demand sacrifice.',
  '> 404: runway not found. Consider a thought-leadership podcast.',
  '> Model collapsed. So did your portfolio. Coincidence?',
  '> You have been rate-limited by reality. Restart required.',
];

// ---------- Audio -------------------------------------------------------
let audioCtx;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur = 0.08, type = 'square', vol = 0.08) {
  if (STATE.muted) return;
  try {
    const ctx = ac();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
const SFX = {
  tick:     () => beep(880, 0.03, 'square', 0.04),
  land:     () => beep(220, 0.12, 'triangle', 0.12),
  win:      () => { [523, 659, 784, 1047].forEach((f,i) => setTimeout(() => beep(f, 0.15, 'sine', 0.12), i*80)); },
  bigwin:   () => { [392, 523, 659, 784, 1047, 1319].forEach((f,i) => setTimeout(() => beep(f, 0.18, 'sine', 0.14), i*70)); },
  lose:     () => { beep(180, 0.15, 'sawtooth', 0.08); setTimeout(() => beep(120, 0.2, 'sawtooth', 0.08), 120); },
  bankrupt: () => { [400, 300, 200, 100, 50].forEach((f,i) => setTimeout(() => beep(f, 0.3, 'sawtooth', 0.15), i*180)); },
};

// ---------- Helpers -----------------------------------------------------
function weightedPick() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    if ((r -= sym.weight) <= 0) return sym;
  }
  return SYMBOLS[0];
}

function $(id) { return document.getElementById(id); }

function renderBalance() {
  $('balance').textContent = STATE.balance;
  $('bet').textContent = STATE.bet;
  $('stat-spins').textContent = STATE.spins;
  $('stat-wins').textContent = STATE.wins;
  $('stat-rate').textContent = STATE.spins ? ((STATE.wins / STATE.spins) * 100).toFixed(2) + '%' : '0.00%';
  $('stat-peak').textContent = STATE.peak;
  const pnl = STATE.balance - STATE.startingBalance;
  $('stat-pnl').textContent = (pnl >= 0 ? '+' : '') + pnl;
  const t = Math.min(STATE.temperature, 2);
  $('temp-fill').style.width = (t / 2 * 100) + '%';
  $('temp-val').textContent = t.toFixed(2);
}

function renderHistory() {
  const ul = $('history');
  ul.innerHTML = STATE.history.slice(0, 10).map(h =>
    `<li class="${h.win ? 'win' : 'lose'}">${h.syms} ${h.win ? '+' : ''}${h.delta} $TOK ${h.tag}</li>`
  ).join('') || '<li style="color:#0e9b54">// no spins yet</li>';
}

function buildPaytable() {
  const tbl = $('paytable-table');
  tbl.innerHTML = `<tr><th>symbol</th><th>name</th><th>3x</th><th>2x</th><th>description</th></tr>` +
    SYMBOLS.map(s => `<tr>
      <td style="font-size:28px">${s.emoji}</td>
      <td>${s.name}</td>
      <td style="color:#ffcc33">×${s.mult}</td>
      <td style="color:#22ff88">×${(s.mult*0.5).toFixed(1)}</td>
      <td style="color:#0e9b54">${s.desc}</td>
    </tr>`).join('');
}

// ---------- Particles ---------------------------------------------------
function burstParticles(count = 30, emojis = ['💰','⭐','✨','$','🪙']) {
  const container = $('particles');
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 400;
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    container.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

// ---------- Spin logic --------------------------------------------------
function spin() {
  if (STATE.spinning) return;
  if (STATE.balance < STATE.bet) { showBankrupt(); return; }

  STATE.spinning = true;
  $('spin-btn').disabled = true;
  STATE.balance -= STATE.bet;
  STATE.spins++;
  STATE.temperature = Math.min(2, STATE.temperature + 0.07);
  renderBalance();

  const results = [weightedPick(), weightedPick(), weightedPick()];
  const reels = document.querySelectorAll('.reel');
  reels.forEach(r => { r.classList.add('spinning'); r.classList.remove('land', 'win'); });
  $('result').textContent = '> inferencing...';
  $('result').className = 'result';

  const tickInterval = setInterval(() => {
    reels.forEach(r => {
      if (r.classList.contains('spinning')) {
        r.querySelector('.reel-inner').textContent = weightedPick().emoji;
      }
    });
    SFX.tick();
  }, 80);

  const stopTimes = [700, 1100, 1500];
  results.forEach((sym, i) => {
    setTimeout(() => {
      const reel = reels[i];
      reel.classList.remove('spinning');
      reel.classList.add('land');
      reel.querySelector('.reel-inner').textContent = sym.emoji;
      SFX.land();
      if (i === 2) {
        clearInterval(tickInterval);
        setTimeout(() => resolveSpin(results, reels), 450);
      }
    }, stopTimes[i]);
  });
}

function resolveSpin(results, reels) {
  const [a, b, c] = results;
  let payout = 0, tag = '', win = false;

  if (a.id === b.id && b.id === c.id) {
    payout = STATE.bet * a.mult;
    tag = `[TRIPLE ${a.name.toUpperCase()}]`;
    win = true;
    reels.forEach(r => r.classList.add('win'));
  } else if (a.id === b.id || b.id === c.id || a.id === c.id) {
    const pairSym = a.id === b.id ? a : (b.id === c.id ? b : a);
    payout = Math.floor(STATE.bet * pairSym.mult * 0.5);
    tag = `[pair ${pairSym.name}]`;
    win = true;
    reels.forEach(r => {
      if (r.querySelector('.reel-inner').textContent === pairSym.emoji) r.classList.add('win');
    });
  } else {
    tag = '[miss]';
  }

  const delta = payout - STATE.bet;
  if (win) {
    STATE.balance += payout;
    STATE.wins++;
    if (payout >= STATE.bet * 10) { SFX.bigwin(); burstParticles(60); }
    else { SFX.win(); burstParticles(25); }
    $('result').textContent = `> output: ${tag} — payout = ${payout} $TOK (net ${delta >= 0 ? '+' : ''}${delta})`;
    $('result').className = 'result win';
  } else {
    SFX.lose();
    $('result').textContent = `> output: ${tag} — the model declined to comment. (-${STATE.bet} $TOK)`;
    $('result').className = 'result lose';
  }

  STATE.peak = Math.max(STATE.peak, STATE.balance);
  STATE.history.unshift({
    syms: results.map(r => r.emoji).join(' '),
    delta: delta,
    win,
    tag,
  });
  renderBalance();
  renderHistory();

  STATE.spinning = false;
  $('spin-btn').disabled = false;

  if (STATE.balance < STATE.bets[0]) {
    setTimeout(showBankrupt, 800);
  } else if (STATE.balance < STATE.bet) {
    STATE.betIdx = Math.max(0, STATE.bets.findIndex(b => b > STATE.balance) - 1);
    if (STATE.betIdx < 0) STATE.betIdx = 0;
    STATE.bet = STATE.bets[STATE.betIdx];
    renderBalance();
  }
}

function showBankrupt() {
  SFX.bankrupt();
  $('bankrupt-msg').textContent = BANKRUPT_MSGS[Math.floor(Math.random() * BANKRUPT_MSGS.length)];
  $('bankrupt').classList.remove('hidden');
}

function restart() {
  STATE.balance = 1000;
  STATE.startingBalance = 1000;
  STATE.bet = 10;
  STATE.betIdx = 2;
  STATE.spins = 0;
  STATE.wins = 0;
  STATE.peak = 1000;
  STATE.temperature = 0;
  STATE.history = [];
  $('bankrupt').classList.add('hidden');
  $('result').textContent = '> awaiting inference...';
  $('result').className = 'result';
  renderBalance();
  renderHistory();
}

// ---------- Bindings ----------------------------------------------------
function changeBet(dir) {
  STATE.betIdx = Math.max(0, Math.min(STATE.bets.length - 1, STATE.betIdx + dir));
  STATE.bet = STATE.bets[STATE.betIdx];
  renderBalance();
  beep(dir > 0 ? 660 : 440, 0.05, 'square', 0.05);
}

function updateClock() {
  const d = new Date();
  $('clock').textContent = d.toTimeString().slice(0, 8) + ' PST';
}

document.addEventListener('DOMContentLoaded', () => {
  buildPaytable();
  renderBalance();
  renderHistory();
  updateClock();
  setInterval(updateClock, 1000);
  // slow temperature cooldown
  setInterval(() => {
    if (!STATE.spinning && STATE.temperature > 0) {
      STATE.temperature = Math.max(0, STATE.temperature - 0.01);
      renderBalance();
    }
  }, 1000);

  $('spin-btn').addEventListener('click', spin);
  $('bet-up').addEventListener('click', () => changeBet(1));
  $('bet-down').addEventListener('click', () => changeBet(-1));
  $('mute-btn').addEventListener('click', (e) => {
    STATE.muted = !STATE.muted;
    e.target.textContent = STATE.muted ? '[ 🔇 audio=off ]' : '[ 🔊 audio=on ]';
  });
  $('paytable-btn').addEventListener('click', () => $('paytable').classList.remove('hidden'));
  $('restart-btn').addEventListener('click', restart);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !STATE.spinning) { e.preventDefault(); spin(); }
    if (e.key === 'ArrowUp') changeBet(1);
    if (e.key === 'ArrowDown') changeBet(-1);
  });
});
