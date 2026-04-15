/* ============================================================
   TOKEN BURNER 9000 — AI Slot Machine
   Pure vanilla JS, no frameworks, no libraries.
   ============================================================ */

// ---- Symbol Definitions ----
const SYMBOLS = [
  { emoji: '\u{1F916}', name: 'Robot',         weight: 20, multiplier: 2,   desc: 'A generic LLM wrapper startup' },
  { emoji: '\u{1F9E0}', name: 'Brain',         weight: 18, multiplier: 3,   desc: '"We\'re building AGI" (it\'s a chatbot)' },
  { emoji: '\u{1F4BB}', name: 'GPU',           weight: 15, multiplier: 5,   desc: 'NVIDIA sends their regards' },
  { emoji: '\u{1F4A8}', name: 'Hallucination', weight: 22, multiplier: 1.5, desc: 'Confidently wrong since 2022' },
  { emoji: '\u{2728}',  name: 'Sparkle',       weight: 10, multiplier: 8,   desc: '"AI-powered" (added an API call)' },
  { emoji: '\u{1F525}', name: 'Overfit',       weight: 8,  multiplier: 12,  desc: 'Works great on the training set!' },
  { emoji: '\u{1F4B0}', name: 'VC Money',      weight: 5,  multiplier: 25,  desc: '$50M seed round, no revenue' },
  { emoji: '\u{1F47E}', name: 'Singularity',   weight: 2,  multiplier: 50,  desc: 'The machines have become sentient' },
];

const PAIR_PAYOUT_RATIO = 0.2;
const SYMBOL_HEIGHT_DESKTOP = 100;
const SYMBOL_HEIGHT_MOBILE = 80;

const BANKRUPT_MESSAGES = [
  "Your tokens have been hallucinated away.\nThe model is confident this is fine.",
  "ERROR: balance underflow.\nHave you tried prompt engineering your luck?",
  "Training complete. Loss: everything.\nYour portfolio has been fine-tuned to zero.",
  "The AI has determined your optimal\nbalance is 0. Trust the model.",
  "Context window exceeded.\nYour tokens were lost in the attention mechanism.",
  "Model collapsed. All tokens consumed\nduring inference. No refunds.",
];

// ---- State ----
let balance = 1000;
let bet = 10;
let spinning = false;
let muted = false;
let temperature = 0;
let totalSpins = 0;
let totalWins = 0;
let peakBalance = 1000;
let history = [];
let consecutiveSpins = 0;
let audioCtx = null;

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);
const balanceEl = $('balanceDisplay');
const betEl = $('betDisplay');
const spinBtn = $('spinBtn');
const muteBtn = $('muteBtn');
const betUp = $('betUp');
const betDown = $('betDown');
const winMsg = $('winMessage');
const tempFill = $('tempFill');
const tempValue = $('tempValue');
const statSpins = $('statSpins');
const statWinRate = $('statWinRate');
const statPeak = $('statPeak');
const historyLog = $('historyLog');
const paytableEl = $('paytable');
const paytableBody = $('paytableBody');
const paytableToggle = $('paytableToggle');
const bankruptOverlay = $('bankruptOverlay');
const bankruptMessage = $('bankruptMessage');
const restartBtn = $('restartBtn');
const particleCanvas = $('particleCanvas');
const ctx = particleCanvas.getContext('2d');

// ---- Utility: weighted random pick ----
function weightedPick() {
  const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[0];
}

// ---- Get symbol height based on viewport ----
function getSymbolHeight() {
  return window.innerWidth <= 480 ? SYMBOL_HEIGHT_MOBILE : SYMBOL_HEIGHT_DESKTOP;
}

// ---- Audio (Web Audio API) ----
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type, volume) {
  if (muted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume || 0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxTick() { playTone(800, 0.04, 'square', 0.05); }
function sfxLand() { playTone(200, 0.12, 'triangle', 0.1); }
function sfxWin() {
  [440, 554, 659, 880].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.18, 'square', 0.1), i * 80);
  });
}
function sfxLose() { playTone(150, 0.3, 'sawtooth', 0.06); }
function sfxBankrupt() {
  [300, 250, 200, 150, 100].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.1), i * 120);
  });
}

// ---- Particle System ----
let particles = [];

function resizeCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      size: 2 + Math.random() * 4,
      color: color || '#00ff41',
    });
  }
}

function updateParticles() {
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  if (particles.length > 0) requestAnimationFrame(updateParticles);
}

function triggerWinParticles() {
  const rect = document.querySelector('.reels-frame').getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#00ff41', '#ffb800', '#00e5ff', '#ff2244', '#ff66ff'];
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const c = colors[i % colors.length];
      spawnParticles(cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 40, 25, c);
    }, i * 60);
  }
  requestAnimationFrame(updateParticles);
}

// ---- Build Paytable ----
function buildPaytable() {
  paytableBody.innerHTML = '';
  for (const sym of SYMBOLS) {
    const row = document.createElement('div');
    row.className = 'paytable-row';
    row.innerHTML =
      '<span class="pt-emoji">' + sym.emoji + '</span>' +
      '<span class="pt-name">' + sym.name + '</span>' +
      '<span class="pt-mult">x' + sym.multiplier + '</span>' +
      '<span class="pt-desc">' + sym.desc + '</span>';
    paytableBody.appendChild(row);
  }
}

// ---- Reel Rendering ----
// Each strip: padding symbol, target symbol, padding symbol
function buildStrip(stripEl, symbol) {
  stripEl.innerHTML = '';
  // We show 3 cells: top padding, center (visible), bottom padding
  const syms = [weightedPick(), symbol, weightedPick()];
  for (const s of syms) {
    const div = document.createElement('div');
    div.className = 'reel-symbol';
    div.textContent = s.emoji;
    stripEl.appendChild(div);
  }
  const h = getSymbolHeight();
  stripEl.style.transform = 'translateY(-' + h + 'px)';
}

function initReels() {
  for (let i = 0; i < 3; i++) {
    const strip = $('strip' + i);
    buildStrip(strip, weightedPick());
  }
}

// ---- Spin Animation ----
// Animate by rapidly cycling random symbols, then land on the final one
function animateReel(reelIndex, finalSymbol, duration) {
  return new Promise((resolve) => {
    const strip = $('strip' + reelIndex);
    const h = getSymbolHeight();
    const tickInterval = 70; // ms between ticks
    let elapsed = 0;
    const startTime = Date.now();

    const interval = setInterval(() => {
      elapsed = Date.now() - startTime;
      // Show random symbol cycling
      const randSym = weightedPick();
      strip.children[1].textContent = randSym.emoji;
      // Slight vertical jitter for stepping feel
      const jitter = (Math.random() - 0.5) * 6;
      strip.style.transform = 'translateY(' + (-h + jitter) + 'px)';
      sfxTick();

      if (elapsed >= duration) {
        clearInterval(interval);
        // Land on final symbol
        buildStrip(strip, finalSymbol);
        // Bounce animation
        strip.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
        strip.style.transform = 'translateY(' + (-h + 8) + 'px)';
        sfxLand();
        setTimeout(() => {
          strip.style.transform = 'translateY(-' + h + 'px)';
          setTimeout(() => {
            strip.style.transition = 'none';
            resolve();
          }, 150);
        }, 150);
      }
    }, tickInterval);
  });
}

// ---- Evaluate Result ----
function evaluate(results) {
  const names = results.map(r => r.name);
  // Triple match
  if (names[0] === names[1] && names[1] === names[2]) {
    return { type: 'triple', symbol: results[0], payout: results[0].multiplier };
  }
  // Pair matches
  if (names[0] === names[1]) return { type: 'pair', symbol: results[0], payout: results[0].multiplier * PAIR_PAYOUT_RATIO };
  if (names[1] === names[2]) return { type: 'pair', symbol: results[1], payout: results[1].multiplier * PAIR_PAYOUT_RATIO };
  if (names[0] === names[2]) return { type: 'pair', symbol: results[0], payout: results[0].multiplier * PAIR_PAYOUT_RATIO };
  return { type: 'loss', symbol: null, payout: 0 };
}

// ---- Update UI ----
function updateBalance() {
  balanceEl.textContent = balance;
  if (balance > peakBalance) peakBalance = balance;
}

function updateStats() {
  statSpins.textContent = totalSpins;
  statWinRate.textContent = totalSpins > 0 ? (totalWins / totalSpins * 100).toFixed(1) + '%' : '0.0%';
  statPeak.textContent = peakBalance;
}

function updateTemperature() {
  // Temperature rises with consecutive spins, decays otherwise
  temperature = Math.min(2.0, consecutiveSpins * 0.12);
  const pct = (temperature / 2.0) * 100;
  tempFill.style.width = pct + '%';
  tempFill.className = 'temp-fill' + (temperature > 1.4 ? ' overheated' : temperature > 0.8 ? ' hot' : '');
  tempValue.textContent = temperature.toFixed(2);
}

function addHistory(results, outcome, winAmount) {
  const emojis = results.map(r => r.emoji).join(' ');
  let tag;
  if (outcome.type === 'triple') {
    tag = '<span class="win-tag">TRIPLE +' + winAmount + '</span>';
  } else if (outcome.type === 'pair') {
    tag = '<span class="win-tag">PAIR +' + winAmount + '</span>';
  } else {
    tag = '<span class="lose-tag">-' + bet + '</span>';
  }
  history.unshift({ emojis, tag });
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  historyLog.innerHTML = '';
  for (let i = 0; i < history.length; i++) {
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    entry.innerHTML = history[i].emojis + '  ' + history[i].tag;
    historyLog.appendChild(entry);
  }
}

function showWinMessage(outcome, amount) {
  if (outcome.type === 'triple') {
    winMsg.textContent = '>>> TRIPLE ' + outcome.symbol.name.toUpperCase() + '! +' + amount + ' tokens <<<';
    winMsg.className = 'win-message win';
  } else if (outcome.type === 'pair') {
    winMsg.textContent = 'pair(' + outcome.symbol.name + ') => +' + amount + ' tokens';
    winMsg.className = 'win-message win';
  } else {
    winMsg.textContent = '// no match — tokens lost to the void';
    winMsg.className = 'win-message lose';
  }
}

// ---- Bankrupt ----
function checkBankrupt() {
  if (balance <= 0) {
    balance = 0;
    updateBalance();
    sfxBankrupt();
    bankruptMessage.textContent = BANKRUPT_MESSAGES[Math.floor(Math.random() * BANKRUPT_MESSAGES.length)];
    bankruptOverlay.classList.add('active');
  }
}

function restart() {
  balance = 1000;
  bet = 10;
  temperature = 0;
  consecutiveSpins = 0;
  totalSpins = 0;
  totalWins = 0;
  peakBalance = 1000;
  history = [];
  updateBalance();
  updateStats();
  updateTemperature();
  betEl.textContent = bet;
  winMsg.textContent = '';
  winMsg.className = 'win-message';
  historyLog.innerHTML = '<div class="history-entry dim">[ awaiting inference... ]</div>';
  bankruptOverlay.classList.remove('active');
  initReels();
}

// ---- Spin ----
async function spin() {
  if (spinning || balance < bet) return;
  ensureAudio();
  spinning = true;
  spinBtn.disabled = true;
  betUp.disabled = true;
  betDown.disabled = true;

  // Deduct bet
  balance -= bet;
  updateBalance();

  // Pick results
  const results = [weightedPick(), weightedPick(), weightedPick()];

  // Animate reels with staggered stop
  const durations = [600, 900, 1200];
  const promises = results.map((sym, i) => animateReel(i, sym, durations[i]));
  await Promise.all(promises);

  // Evaluate
  const outcome = evaluate(results);
  let winAmount = 0;
  if (outcome.payout > 0) {
    winAmount = Math.round(bet * outcome.payout);
    balance += winAmount;
    totalWins++;
    updateBalance();
    sfxWin();
    triggerWinParticles();
  } else {
    sfxLose();
  }

  totalSpins++;
  consecutiveSpins++;
  updateStats();
  updateTemperature();
  showWinMessage(outcome, winAmount);
  addHistory(results, outcome, winAmount);

  spinning = false;
  spinBtn.disabled = false;
  betUp.disabled = false;
  betDown.disabled = false;

  // Auto-clamp bet to balance
  if (bet > balance && balance > 0) {
    bet = Math.max(10, Math.floor(balance / 10) * 10);
    betEl.textContent = bet;
  }

  checkBankrupt();
}

// ---- Event Listeners ----
spinBtn.addEventListener('click', spin);

betUp.addEventListener('click', () => {
  if (spinning) return;
  const step = bet < 50 ? 10 : bet < 200 ? 25 : 50;
  bet = Math.min(balance, bet + step);
  betEl.textContent = bet;
});

betDown.addEventListener('click', () => {
  if (spinning) return;
  const step = bet <= 50 ? 10 : bet <= 200 ? 25 : 50;
  bet = Math.max(10, bet - step);
  betEl.textContent = bet;
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
});

paytableToggle.addEventListener('click', () => {
  paytableEl.classList.toggle('open');
  paytableToggle.textContent = paytableEl.classList.contains('open') ? '// hide paytable' : '// show paytable';
});

restartBtn.addEventListener('click', restart);

// Keyboard shortcut: space to spin
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spinning && document.activeElement === document.body) {
    e.preventDefault();
    spin();
  }
});

// ---- Init ----
buildPaytable();
initReels();
updateBalance();
updateStats();
updateTemperature();
