// hallucinator.exe // AI slot machine logic

const SYMBOLS = [
  {
    key: "hallu",  emoji: "🌀", name: "Hallucination",
    weight: 30, mult: 0,
    desc: "Model confidently returns garbage. Pays exactly what it knows: nothing."
  },
  {
    key: "data",   emoji: "📊", name: "Training Data",
    weight: 24, mult: 1,
    desc: "Scraped from the public internet without consent. Break-even payout."
  },
  {
    key: "token",  emoji: "🔣", name: "Token",
    weight: 18, mult: 2,
    desc: "Subword fragment. Burned in bulk. 2× multiplier, for now."
  },
  {
    key: "gpu",    emoji: "💽", name: "GPU Cluster",
    weight: 12, mult: 4,
    desc: "8× H100s melting the datacenter. 4× multiplier, 40 MW draw."
  },
  {
    key: "robot",  emoji: "🤖", name: "Agent",
    weight: 8,  mult: 8,
    desc: "Autonomous agent running unsupervised in prod. What could go wrong?"
  },
  {
    key: "brain",  emoji: "🧠", name: "Attention Head",
    weight: 5,  mult: 20,
    desc: "Attends to everything except your bank account."
  },
  {
    key: "agi",    emoji: "🔮", name: "AGI (alleged)",
    weight: 3,  mult: 100,
    desc: "Artificial General Intelligence. Always 6 months away. JACKPOT."
  },
];

const BANKRUPT_MSGS = [
  "RuntimeError: token budget exceeded.\n'AGI is just around the corner' — the corner was a cliff.",
  "Your compute grant has been revoked.\nThe board of directors thanks you for the training data.",
  "OOM: cannot allocate another hopium_token.\nConsider a Series-Z round from a sovereign wealth fund.",
  "Model collapsed. All tokens hallucinated into the void.\nHave you considered prompt engineering as a career?",
  "You have been superseded by a smaller, cheaper model.\nSeverance package: 0 tokens. Best of luck.",
];

// ---- State ----
const state = {
  balance: 1000,
  bet: 10,
  minBet: 1,
  maxBet: 500,
  betSteps: [1, 5, 10, 25, 50, 100, 250, 500],
  spinning: false,
  muted: false,
  temperature: 0.20,
  consecutive: 0,
  stats: {
    spins: 0,
    wins: 0,
    peak: 1000,
    wagered: 0,
    won: 0,
    biggest: 0,
  },
  history: [],
};

const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);

// ---- Audio ----
let audioCtx = null;
function ac() {
  if (!audioCtx) {
    const C = window.AudioContext || window.webkitAudioContext;
    audioCtx = new C();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, { type = "square", gain = 0.08, attack = 0.005, release = 0.05, detune = 0 } = {}) {
  if (state.muted) return;
  const ctx = ac();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  osc.connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + dur - release);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function sfxTick()   { tone(880 + Math.random() * 240, 0.04, { type: "square", gain: 0.05 }); }
function sfxLand()   { tone(180, 0.12, { type: "triangle", gain: 0.12 }); tone(90, 0.18, { type: "sine", gain: 0.1 }); }
function sfxWin(mult) {
  const base = mult >= 20 ? 523 : 392;
  const notes = mult >= 20 ? [523, 659, 784, 1047] : [392, 494, 587, 784];
  notes.forEach((f, i) => setTimeout(() => tone(f, 0.15, { type: "square", gain: 0.09 }), i * 90));
}
function sfxLose() {
  tone(220, 0.18, { type: "sawtooth", gain: 0.06 });
  setTimeout(() => tone(160, 0.22, { type: "sawtooth", gain: 0.06 }), 120);
}
function sfxBankrupt() {
  [440, 330, 247, 165, 110].forEach((f, i) => {
    setTimeout(() => tone(f, 0.35, { type: "sawtooth", gain: 0.09, release: 0.2 }), i * 180);
  });
}

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);
const reelsEl = $("reels");
const reelEls = Array.from(reelsEl.querySelectorAll(".reel"));
const reelSymbolEls = reelEls.map((r) => r.querySelector(".reel-symbol"));
const balanceEl = $("balance");
const betEl = $("bet");
const tempFillEl = $("temp-fill");
const tempValEl = $("temp-val");
const resultEl = $("result-line");
const historyEl = $("history");
const statusEl = $("status-line");
const particlesEl = $("particles");

// ---- Helpers ----
function pickSymbol() {
  let r = Math.random() * totalWeight;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[0];
}

function fmt(n) { return Math.round(n).toLocaleString(); }

function render() {
  balanceEl.textContent = fmt(state.balance);
  betEl.textContent = fmt(state.bet);
  const tPct = Math.min(100, (state.temperature / 2.0) * 100);
  tempFillEl.style.width = tPct + "%";
  tempValEl.textContent = state.temperature.toFixed(2);
  $("stat-spins").textContent = state.stats.spins;
  $("stat-winrate").textContent = state.stats.spins
    ? Math.round((state.stats.wins / state.stats.spins) * 100) + "%"
    : "—";
  $("stat-peak").textContent = fmt(state.stats.peak);
  $("stat-wagered").textContent = fmt(state.stats.wagered);
  $("stat-won").textContent = fmt(state.stats.won);
  $("stat-biggest").textContent = fmt(state.stats.biggest);

  $("bet-down").disabled = state.spinning || state.bet <= state.minBet;
  $("bet-up").disabled = state.spinning || state.bet >= state.balance || state.bet >= state.maxBet;
  $("spin-btn").disabled = state.spinning || state.balance < state.bet;
}

function renderHistory() {
  if (state.history.length === 0) {
    historyEl.innerHTML = '<li class="empty">// no inferences logged</li>';
    return;
  }
  historyEl.innerHTML = state.history
    .map((h) => {
      const cls = h.delta > 0 ? "win" : h.delta < 0 ? "lose" : "";
      const sign = h.delta > 0 ? "+" : "";
      const deltaCls = h.delta > 0 ? "pos" : "neg";
      return `<li class="${cls}">
        <span class="h-symbols">${h.symbols}</span>
        <span class="h-delta ${deltaCls}">${sign}${fmt(h.delta)}</span>
      </li>`;
    })
    .join("");
}

function setStatus(msg) { statusEl.textContent = msg; }

// ---- Spin logic ----
function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) return;

  state.spinning = true;
  state.balance -= state.bet;
  state.stats.wagered += state.bet;
  state.stats.spins += 1;
  state.consecutive += 1;
  state.temperature = Math.min(2.0, 0.20 + state.consecutive * 0.08);

  resultEl.className = "result-line";
  resultEl.textContent = "> sampling next_token...";
  setStatus(`POST /v1/completions  bet=${state.bet}  temp=${state.temperature.toFixed(2)}`);
  render();

  const results = [pickSymbol(), pickSymbol(), pickSymbol()];
  const stopDelays = [900, 1350, 1800];

  reelEls.forEach((r) => {
    r.classList.remove("win", "landing");
    r.classList.add("spinning");
  });

  const tickInterval = setInterval(() => {
    if (state.muted) return;
    reelSymbolEls.forEach((el, i) => {
      if (reelEls[i].classList.contains("spinning")) {
        el.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji;
      }
    });
    sfxTick();
  }, 90);

  // During spin we show random emojis via the tick loop above.
  results.forEach((sym, i) => {
    setTimeout(() => {
      reelEls[i].classList.remove("spinning");
      reelEls[i].classList.add("landing");
      reelSymbolEls[i].textContent = sym.emoji;
      sfxLand();
      if (i === results.length - 1) {
        clearInterval(tickInterval);
        setTimeout(() => finishSpin(results), 420);
      }
    }, stopDelays[i]);
  });
}

function finishSpin(results) {
  const [a, b, c] = results;
  let payoutMult = 0;
  let winType = "none";
  let winningIdx = [];

  if (a.key === b.key && b.key === c.key) {
    payoutMult = a.mult;
    winType = "triple";
    winningIdx = [0, 1, 2];
  } else {
    // pair detection
    const pairs = [
      [0, 1, a, b],
      [1, 2, b, c],
      [0, 2, a, c],
    ];
    for (const [i, j, s1, s2] of pairs) {
      if (s1.key === s2.key && s1.mult > 0) {
        payoutMult = Math.max(payoutMult, s1.mult / 3);
        if (payoutMult === s1.mult / 3) {
          winType = "pair";
          winningIdx = [i, j];
        }
      }
    }
  }

  const payout = Math.floor(payoutMult * state.bet);
  const symbolsStr = `${a.emoji}${b.emoji}${c.emoji}`;
  const delta = payout - state.bet;

  if (payout > 0) {
    state.balance += payout;
    state.stats.wins += 1;
    state.stats.won += payout;
    if (payout > state.stats.biggest) state.stats.biggest = payout;
    if (state.balance > state.stats.peak) state.stats.peak = state.balance;

    winningIdx.forEach((i) => reelEls[i].classList.add("win"));

    const label = winType === "triple" ? "triple_match" : "pair_match";
    resultEl.className = "result-line win";
    resultEl.textContent = `> ${label}: ${a.name === b.name ? a.name : (winType === "pair" ? results[winningIdx[0]].name : "combo")} × ${payoutMult.toFixed(payoutMult < 1 ? 2 : 1)} = +${fmt(payout)} TKN`;
    setStatus(`response: 200 OK  reward_signal=+${fmt(payout)}`);
    sfxWin(payoutMult);
    burstParticles(winType === "triple" ? 30 : 14, payoutMult);
  } else {
    resultEl.className = "result-line lose";
    resultEl.textContent = "> inference complete: no_match. loss.backward(); your_wallet.step()";
    setStatus("response: 200 OK  reward_signal=0.0");
    sfxLose();
  }

  state.history.unshift({
    symbols: symbolsStr,
    delta,
    payout,
    type: winType,
  });
  if (state.history.length > 10) state.history.pop();

  // reset consecutive streak on any win
  if (payout > 0) {
    state.consecutive = 0;
    state.temperature = 0.20;
  }

  state.spinning = false;
  render();
  renderHistory();

  if (state.balance < state.minBet) {
    setTimeout(showBankrupt, 400);
  } else if (state.balance < state.bet) {
    state.bet = Math.max(state.minBet, previousBetStep(state.balance));
    render();
  }
}

function previousBetStep(balance) {
  let best = state.betSteps[0];
  for (const s of state.betSteps) {
    if (s <= balance) best = s;
  }
  return best;
}

function burstParticles(count, mult) {
  const rect = particlesEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const tokens = ["$", "+", "TKN", "◆", "▲", "▼", "★", "◉"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = mult >= 20
      ? (Math.random() < 0.4 ? "JACKPOT" : tokens[Math.floor(Math.random() * tokens.length)])
      : tokens[Math.floor(Math.random() * tokens.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 180;
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    p.style.animationDelay = (Math.random() * 0.2) + "s";
    particlesEl.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

// ---- Bankrupt ----
function showBankrupt() {
  const msg = BANKRUPT_MSGS[Math.floor(Math.random() * BANKRUPT_MSGS.length)];
  $("bankrupt-msg").textContent = msg;
  $("bankrupt-modal").classList.remove("hidden");
  sfxBankrupt();
  setStatus("FATAL: balance=0  process terminated.");
}

function reset(full = true) {
  state.balance = 1000;
  state.bet = 10;
  state.consecutive = 0;
  state.temperature = 0.20;
  state.spinning = false;
  if (full) {
    state.stats = { spins: 0, wins: 0, peak: 1000, wagered: 0, won: 0, biggest: 0 };
    state.history = [];
  }
  reelEls.forEach((r) => r.classList.remove("win", "spinning", "landing"));
  reelSymbolEls.forEach((el) => (el.textContent = "?"));
  resultEl.className = "result-line";
  resultEl.textContent = "> awaiting prompt...";
  setStatus("system.ready // weights reinitialized from scratch");
  $("bankrupt-modal").classList.add("hidden");
  render();
  renderHistory();
}

// ---- Paytable ----
function buildPaytable() {
  const body = $("paytable-body");
  body.innerHTML = [...SYMBOLS]
    .sort((a, b) => b.mult - a.mult)
    .map((s) => {
      const mLabel = s.mult === 0 ? "×0" : `×${s.mult}`;
      return `<div class="paytable-row">
        <div class="pt-symbol">${s.emoji}</div>
        <div>
          <div class="pt-name">${s.name}</div>
          <div class="pt-desc">${s.desc}</div>
        </div>
        <div class="pt-mult">${mLabel}</div>
      </div>`;
    })
    .join("");
}

// ---- Wiring ----
$("spin-btn").addEventListener("click", spin);

$("bet-up").addEventListener("click", () => {
  const idx = state.betSteps.indexOf(state.bet);
  const next = idx === -1
    ? state.betSteps.find((s) => s > state.bet) || state.bet
    : state.betSteps[Math.min(state.betSteps.length - 1, idx + 1)];
  if (next <= state.balance && next <= state.maxBet) state.bet = next;
  render();
});

$("bet-down").addEventListener("click", () => {
  const idx = state.betSteps.indexOf(state.bet);
  const next = idx === -1
    ? [...state.betSteps].reverse().find((s) => s < state.bet) || state.bet
    : state.betSteps[Math.max(0, idx - 1)];
  state.bet = next;
  render();
});

$("mute-toggle").addEventListener("click", (e) => {
  state.muted = !state.muted;
  e.target.textContent = state.muted ? "[ sound: OFF ]" : "[ sound: ON ]";
});

$("paytable-btn").addEventListener("click", () => {
  buildPaytable();
  $("paytable-modal").classList.remove("hidden");
});

$("close-paytable").addEventListener("click", () => {
  $("paytable-modal").classList.add("hidden");
});

$("paytable-modal").addEventListener("click", (e) => {
  if (e.target.id === "paytable-modal") $("paytable-modal").classList.add("hidden");
});

$("reset-btn").addEventListener("click", () => reset(true));
$("restart-btn").addEventListener("click", () => reset(true));

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !state.spinning) {
    e.preventDefault();
    spin();
  } else if (e.key === "m" || e.key === "M") {
    $("mute-toggle").click();
  } else if (e.key === "Escape") {
    $("paytable-modal").classList.add("hidden");
  }
});

// init
render();
renderHistory();
