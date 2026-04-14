/* ============================================================ */
/*  TOKEN//GAMBLE :: AI SLOT TERMINAL                           */
/*  Vanilla JS slot machine — retro CRT aesthetic               */
/* ============================================================ */

"use strict";

/* ============================================================ */
/*  SYMBOL DEFINITIONS :: weighted probabilities + payouts      */
/* ============================================================ */
const SYMBOL_TABLE = [
  {
    emoji: "🧠",
    name: "AGI",
    weight: 1,
    multiplier: 100,
    description: "Artificial general intelligence. Definitely 6 months away. Has been for 3 years."
  },
  {
    emoji: "💎",
    name: "SERIES_Z",
    weight: 2,
    multiplier: 40,
    description: "A $2B seed round from a fund that also bet on crypto dog coins."
  },
  {
    emoji: "🚀",
    name: "HYPE_CYCLE",
    weight: 4,
    multiplier: 15,
    description: "Vertical line on a chart your cofounder drew on a napkin at YC."
  },
  {
    emoji: "🤖",
    name: "CHATBOT",
    weight: 7,
    multiplier: 8,
    description: "Wraps an API you don't own. Valuation: $400M. Revenue: $0.12."
  },
  {
    emoji: "📈",
    name: "KPI_GO_UP",
    weight: 9,
    multiplier: 4,
    description: "Number goes up. Nobody can explain why. Do NOT investigate further."
  },
  {
    emoji: "💻",
    name: "GPU_CLUSTER",
    weight: 11,
    multiplier: 2,
    description: "$40M of H100s melting in a warehouse to generate a limerick."
  },
  {
    emoji: "📎",
    name: "PAPERCLIP",
    weight: 14,
    multiplier: 1,
    description: "You have become the raw material. You were warned in the alignment papers."
  }
];

/* build weighted probability pool for reel spins */
const WEIGHTED_SYMBOL_POOL = (() => {
  const pool = [];
  SYMBOL_TABLE.forEach(sym => {
    for (let i = 0; i < sym.weight; i++) pool.push(sym);
  });
  return pool;
})();

const SYMBOL_COUNT = SYMBOL_TABLE.length;

/* ============================================================ */
/*  GAME STATE                                                  */
/* ============================================================ */
const gameState = {
  balance: 1000,
  currentBet: 10,
  totalSpins: 0,
  totalWins: 0,
  peakBalance: 1000,
  totalWagered: 0,
  biggestHit: 0,
  temperature: 0,         // 0..10
  consecutiveSpins: 0,
  spinHistory: [],
  isSpinning: false,
  soundEnabled: true
};

const BET_PRESETS = [10, 25, 50, 100, 250, 500];
const MAX_HISTORY = 10;
const MAX_TEMPERATURE = 10;

/* ============================================================ */
/*  DOM REFERENCES                                              */
/* ============================================================ */
const dom = {
  balance: document.getElementById("balance-display"),
  bet: document.getElementById("bet-display"),
  temperatureBar: document.getElementById("temperature-bar"),
  reels: [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2")
  ],
  reelStrips: [],
  resultMessage: document.getElementById("result-message"),
  spinBtn: document.getElementById("spin-btn"),
  paytableBtn: document.getElementById("paytable-btn"),
  paytableModal: document.getElementById("paytable-modal"),
  paytableBody: document.getElementById("paytable-body"),
  paytableClose: document.getElementById("paytable-close"),
  bankruptOverlay: document.getElementById("bankrupt-overlay"),
  bankruptMessage: document.getElementById("bankrupt-message"),
  restartBtn: document.getElementById("restart-btn"),
  betPresets: document.querySelectorAll(".bet-preset"),
  allInBtn: document.getElementById("all-in-btn"),
  muteToggle: document.getElementById("mute-toggle"),
  statSpins: document.getElementById("stat-spins"),
  statWinrate: document.getElementById("stat-winrate"),
  statPeak: document.getElementById("stat-peak"),
  statWagered: document.getElementById("stat-wagered"),
  statBiggest: document.getElementById("stat-biggest"),
  historyList: document.getElementById("history-list"),
  particleCanvas: document.getElementById("particle-canvas")
};

/* collect reel-strip refs */
dom.reels.forEach(reel => {
  dom.reelStrips.push(reel.querySelector(".reel-strip"));
});

/* ============================================================ */
/*  REEL STRIP CONSTRUCTION                                     */
/*  Each strip is a tall column of randomized symbols that we    */
/*  translate upward during spins.                               */
/* ============================================================ */
const CELL_HEIGHT = 130;     // must match CSS .reel-cell height
const STRIP_LENGTH = 40;     // number of cells per strip
const strips = [[], [], []]; // symbol arrays for each reel

function buildReelStrips() {
  for (let r = 0; r < 3; r++) {
    const stripEl = dom.reelStrips[r];
    stripEl.innerHTML = "";
    strips[r] = [];
    for (let i = 0; i < STRIP_LENGTH; i++) {
      const sym = randomWeightedSymbol();
      strips[r].push(sym);
      const cell = document.createElement("div");
      cell.className = "reel-cell";
      cell.textContent = sym.emoji;
      stripEl.appendChild(cell);
    }
    stripEl.style.transform = "translateY(0px)";
  }
}

function randomWeightedSymbol() {
  return WEIGHTED_SYMBOL_POOL[Math.floor(Math.random() * WEIGHTED_SYMBOL_POOL.length)];
}

/* ============================================================ */
/*  AUDIO ENGINE :: Web Audio with AR envelopes                  */
/* ============================================================ */
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

/**
 * Play a tone with a simple attack/release envelope.
 * @param {number} freq      frequency in Hz
 * @param {number} duration  tone length in seconds
 * @param {string} type      oscillator type
 * @param {number} gain      peak gain (0..1)
 */
function playTone(freq, duration, type = "square", gain = 0.15) {
  if (!gameState.soundEnabled) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + 0.01);       // attack
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration); // release
  osc.connect(env).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playTick()     { playTone(880, 0.05, "square", 0.08); }
function playLand()     { playTone(220, 0.15, "triangle", 0.18); }
function playWin()      {
  playTone(523, 0.12, "square", 0.15);
  setTimeout(() => playTone(659, 0.12, "square", 0.15), 90);
  setTimeout(() => playTone(784, 0.2, "square", 0.18), 180);
}
function playBigWin() {
  const notes = [523, 659, 784, 1046, 1319];
  notes.forEach((n, i) => setTimeout(() => playTone(n, 0.18, "sawtooth", 0.18), i * 80));
}
function playLose()     { playTone(140, 0.25, "sawtooth", 0.1); }
function playBankrupt() {
  if (!gameState.soundEnabled) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.25, now + 0.05);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  osc.connect(env).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 1.35);
}

/* ============================================================ */
/*  REEL ANIMATION :: rAF mechanical stepping motion             */
/* ============================================================ */
function spinReels(finalSymbols, onComplete) {
  /*
   * finalSymbols: [sym, sym, sym] — indices for each reel's final landing
   * We'll spin each reel for different durations (staggered stops).
   */
  const stopDelays = [900, 1350, 1800]; // ms per reel
  const stepInterval = 70;              // ms between symbol ticks while spinning
  const startTime = performance.now();

  // Place target symbol at a known landing row (e.g., index 20) for each strip
  const LANDING_INDEX = 20;
  finalSymbols.forEach((sym, r) => {
    strips[r][LANDING_INDEX] = sym;
    const cell = dom.reelStrips[r].children[LANDING_INDEX];
    cell.textContent = sym.emoji;
  });

  const reelStates = [0, 1, 2].map(r => ({
    index: r,
    stopAt: startTime + stopDelays[r],
    lastStep: startTime,
    offset: 0,
    stopped: false,
    lastTickSym: null
  }));

  function frame(now) {
    let allStopped = true;

    reelStates.forEach(state => {
      if (state.stopped) return;
      allStopped = false;

      if (now >= state.stopAt) {
        // snap to landing
        const targetY = -(LANDING_INDEX - 1) * CELL_HEIGHT; // center visible row
        dom.reelStrips[state.index].style.transform = `translateY(${targetY}px)`;
        dom.reels[state.index].classList.remove("landed");
        // force reflow to restart animation
        void dom.reels[state.index].offsetWidth;
        dom.reels[state.index].classList.add("landed");
        state.stopped = true;
        playLand();
        return;
      }

      // step motion — tick every stepInterval ms
      if (now - state.lastStep >= stepInterval) {
        state.lastStep = now;
        state.offset = (state.offset + 1) % STRIP_LENGTH;
        const pseudoY = -(state.offset * CELL_HEIGHT);
        dom.reelStrips[state.index].style.transform = `translateY(${pseudoY}px)`;
        playTick();
      }
    });

    if (!allStopped) {
      requestAnimationFrame(frame);
    } else {
      // small delay so bounce animation finishes
      setTimeout(onComplete, 350);
    }
  }
  requestAnimationFrame(frame);
}

/* ============================================================ */
/*  CORE SPIN LOGIC                                             */
/* ============================================================ */
function handleSpin() {
  if (gameState.isSpinning) return;
  if (gameState.balance < gameState.currentBet) {
    flashMessage("> ERR: insufficient_tokens", "lose");
    return;
  }

  gameState.isSpinning = true;
  dom.spinBtn.disabled = true;
  dom.resultMessage.classList.remove("win", "lose", "big-win");
  dom.resultMessage.textContent = "> model.generate() running...";

  // deduct bet
  gameState.balance -= gameState.currentBet;
  gameState.totalWagered += gameState.currentBet;
  gameState.totalSpins += 1;
  gameState.consecutiveSpins += 1;
  updateTemperature();
  updateStatusBar();

  // roll final symbols
  const finalSymbols = [
    randomWeightedSymbol(),
    randomWeightedSymbol(),
    randomWeightedSymbol()
  ];

  spinReels(finalSymbols, () => {
    evaluateResult(finalSymbols);
    gameState.isSpinning = false;
    dom.spinBtn.disabled = false;

    if (gameState.balance <= 0) {
      triggerBankrupt();
    }
  });
}

/* ============================================================ */
/*  EVALUATE RESULT :: triple / pair / loss                      */
/* ============================================================ */
function evaluateResult(symbols) {
  const [a, b, c] = symbols;
  let payout = 0;
  let matchType = "loss";
  let matchSymbol = null;

  if (a.name === b.name && b.name === c.name) {
    payout = gameState.currentBet * a.multiplier;
    matchType = "triple";
    matchSymbol = a;
  } else if (a.name === b.name || b.name === c.name || a.name === c.name) {
    const pairSym = (a.name === b.name) ? a : (b.name === c.name) ? b : a;
    payout = Math.floor(gameState.currentBet * pairSym.multiplier / 3);
    matchType = "pair";
    matchSymbol = pairSym;
  }

  if (payout > 0) {
    gameState.balance += payout;
    gameState.totalWins += 1;
    gameState.consecutiveSpins = 0; // cool down temperature on win
    updateTemperature();
    if (payout > gameState.biggestHit) gameState.biggestHit = payout;
    if (gameState.balance > gameState.peakBalance) gameState.peakBalance = gameState.balance;

    const label = matchType === "triple" ? "TRIPLE" : "pair";
    const msg = `> ${label}_${matchSymbol.name} :: +${payout} tokens`;
    const cls = (matchType === "triple") ? "big-win" : "win";
    flashMessage(msg, cls);

    if (matchType === "triple") playBigWin();
    else playWin();

    burstParticles(matchType === "triple" ? 120 : 60);
    logHistory(symbols, payout, true);
  } else {
    flashMessage("> null :: exception raised in wallet.py", "lose");
    playLose();
    logHistory(symbols, -gameState.currentBet, false);
  }

  updateStatusBar();
  updateStats();
}

/* ============================================================ */
/*  UI UPDATES                                                  */
/* ============================================================ */
function updateStatusBar() {
  dom.balance.textContent = gameState.balance;
  dom.bet.textContent = gameState.currentBet;
}

function updateStats() {
  dom.statSpins.textContent = gameState.totalSpins;
  const rate = gameState.totalSpins > 0
    ? Math.round((gameState.totalWins / gameState.totalSpins) * 100)
    : 0;
  dom.statWinrate.textContent = `${rate}%`;
  dom.statPeak.textContent = gameState.peakBalance;
  dom.statWagered.textContent = gameState.totalWagered;
  dom.statBiggest.textContent = gameState.biggestHit;
}

function flashMessage(text, cls) {
  dom.resultMessage.textContent = text;
  dom.resultMessage.classList.remove("win", "lose", "big-win");
  if (cls) dom.resultMessage.classList.add(cls);
}

/* ============================================================ */
/*  TEMPERATURE BAR :: 10 blocks, green -> red                  */
/* ============================================================ */
function buildTemperatureBar() {
  dom.temperatureBar.innerHTML = "";
  for (let i = 0; i < MAX_TEMPERATURE; i++) {
    const block = document.createElement("div");
    block.className = "temp-block";
    dom.temperatureBar.appendChild(block);
  }
}

function updateTemperature() {
  // temperature grows with consecutive losing spins, caps at MAX_TEMPERATURE
  gameState.temperature = Math.min(gameState.consecutiveSpins, MAX_TEMPERATURE);
  const blocks = dom.temperatureBar.children;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i < gameState.temperature) {
      const hue = 120 - (i * 12); // 120 = green, drops toward red
      block.style.background = `hsl(${hue}, 100%, 50%)`;
      block.style.color = `hsl(${hue}, 100%, 60%)`;
      block.classList.add("active");
    } else {
      block.style.background = "#0a1a0a";
      block.style.color = "";
      block.classList.remove("active");
    }
  }
}

/* ============================================================ */
/*  SPIN HISTORY                                                */
/* ============================================================ */
function logHistory(symbols, delta, isWin) {
  gameState.spinHistory.unshift({
    symbols: symbols.map(s => s.emoji).join(""),
    delta,
    isWin
  });
  if (gameState.spinHistory.length > MAX_HISTORY) {
    gameState.spinHistory.pop();
  }
  renderHistory();
}

function renderHistory() {
  if (gameState.spinHistory.length === 0) {
    dom.historyList.innerHTML = '<li class="empty">// no spins logged</li>';
    return;
  }
  dom.historyList.innerHTML = "";
  gameState.spinHistory.forEach(entry => {
    const li = document.createElement("li");
    li.className = entry.isWin ? "win-entry" : "lose-entry";
    const sign = entry.delta >= 0 ? "+" : "";
    li.innerHTML = `<span>${entry.symbols}</span><span>${sign}${entry.delta}</span>`;
    dom.historyList.appendChild(li);
  });
}

/* ============================================================ */
/*  BET CONTROLS                                                */
/* ============================================================ */
function handleBetPresetClick(e) {
  const btn = e.currentTarget;
  if (btn.id === "all-in-btn") {
    setBet(gameState.balance);
  } else {
    const amt = parseInt(btn.dataset.bet, 10);
    setBet(amt);
  }
}

function setBet(amount) {
  if (gameState.isSpinning) return;
  gameState.currentBet = Math.max(1, Math.min(amount, gameState.balance));
  updateStatusBar();
  // highlight matching preset
  dom.betPresets.forEach(b => {
    const v = b.dataset.bet ? parseInt(b.dataset.bet, 10) : -1;
    b.classList.toggle("active", v === gameState.currentBet);
  });
}

/* ============================================================ */
/*  PARTICLE BURST :: canvas on wins                             */
/* ============================================================ */
const particleCanvas = dom.particleCanvas;
const pctx = particleCanvas.getContext("2d");
let activeParticles = [];

function resizeCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function burstParticles(count) {
  const rect = dom.reels[1].getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    activeParticles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 2 + Math.random() * 3,
      hue: 90 + Math.random() * 60
    });
  }
}

function particleLoop() {
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  activeParticles = activeParticles.filter(p => p.life > 0);
  activeParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.015;
    pctx.globalAlpha = Math.max(0, p.life);
    pctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
    pctx.shadowColor = pctx.fillStyle;
    pctx.shadowBlur = 10;
    pctx.fillRect(p.x, p.y, p.size, p.size);
  });
  pctx.globalAlpha = 1;
  pctx.shadowBlur = 0;
  requestAnimationFrame(particleLoop);
}
particleLoop();

/* ============================================================ */
/*  PAYTABLE MODAL                                              */
/* ============================================================ */
function buildPaytable() {
  dom.paytableBody.innerHTML = "";
  // sort by multiplier desc for display
  const sorted = [...SYMBOL_TABLE].sort((a, b) => b.multiplier - a.multiplier);
  sorted.forEach(sym => {
    const row = document.createElement("div");
    row.className = "paytable-row";
    row.innerHTML = `
      <div class="sym">${sym.emoji}</div>
      <div class="mult">x${sym.multiplier}</div>
      <div class="desc"><strong>${sym.name}</strong><br>${sym.description}</div>
    `;
    dom.paytableBody.appendChild(row);
  });
}

function togglePaytable(show) {
  dom.paytableModal.classList.toggle("hidden", !show);
}

/* ============================================================ */
/*  BANKRUPT FLOW                                               */
/* ============================================================ */
const BANKRUPT_MESSAGES = [
  "Your loss function has converged to zero tokens. Congratulations, you are the baseline now.",
  "The model has achieved perfect alignment — with your wallet's vanishing point.",
  "Training complete. Final checkpoint: destitute. Consider pivoting to blockchain.",
  "RuntimeError: HopesAndDreams() returned None. You have been ~reclassified~ as training data.",
  "The VCs have seen your pitch deck and respectfully ghosted your bank account."
];

function triggerBankrupt() {
  const msg = BANKRUPT_MESSAGES[Math.floor(Math.random() * BANKRUPT_MESSAGES.length)];
  dom.bankruptMessage.textContent = msg;
  dom.bankruptOverlay.classList.remove("hidden");
  playBankrupt();
}

function restartGame() {
  gameState.balance = 1000;
  gameState.currentBet = 10;
  gameState.totalSpins = 0;
  gameState.totalWins = 0;
  gameState.peakBalance = 1000;
  gameState.totalWagered = 0;
  gameState.biggestHit = 0;
  gameState.temperature = 0;
  gameState.consecutiveSpins = 0;
  gameState.spinHistory = [];
  dom.bankruptOverlay.classList.add("hidden");
  setBet(10);
  updateStatusBar();
  updateStats();
  updateTemperature();
  renderHistory();
  flashMessage("> system rebooted :: good luck human", "");
}

/* ============================================================ */
/*  MUTE TOGGLE                                                 */
/* ============================================================ */
function toggleMute() {
  gameState.soundEnabled = !gameState.soundEnabled;
  dom.muteToggle.textContent = gameState.soundEnabled ? "[ sound: ON ]" : "[ sound: OFF ]";
}

/* ============================================================ */
/*  EVENT WIRING                                                */
/* ============================================================ */
function attachEventListeners() {
  dom.spinBtn.addEventListener("click", handleSpin);
  dom.paytableBtn.addEventListener("click", () => togglePaytable(true));
  dom.paytableClose.addEventListener("click", () => togglePaytable(false));
  dom.paytableModal.addEventListener("click", (e) => {
    if (e.target === dom.paytableModal) togglePaytable(false);
  });
  dom.restartBtn.addEventListener("click", restartGame);
  dom.muteToggle.addEventListener("click", toggleMute);
  dom.betPresets.forEach(btn => btn.addEventListener("click", handleBetPresetClick));

  // spacebar = spin
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !gameState.isSpinning) {
      e.preventDefault();
      handleSpin();
    }
    if (e.code === "Escape") {
      togglePaytable(false);
    }
  });
}

/* ============================================================ */
/*  INIT                                                        */
/* ============================================================ */
function init() {
  buildReelStrips();
  buildTemperatureBar();
  buildPaytable();
  attachEventListeners();
  setBet(10);
  updateStatusBar();
  updateStats();
  updateTemperature();
  renderHistory();
}

init();
