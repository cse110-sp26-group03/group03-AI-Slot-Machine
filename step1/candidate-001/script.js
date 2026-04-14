// SlopMachine 9000 — vanilla JS slot machine satirizing AI token economics.

const SYMBOLS = [
  { id: "robot",  emoji: "🤖", name: "Chatbot",       weight: 28, payout: 2,  flavor: "Three chatbots agree on nothing." },
  { id: "brain",  emoji: "🧠", name: "Wetware",       weight: 22, payout: 3,  flavor: "Biological compute is back, baby." },
  { id: "chip",   emoji: "💾", name: "Compute",       weight: 18, payout: 5,  flavor: "GPU goes brrr." },
  { id: "chart",  emoji: "📈", name: "Hockey Stick",  weight: 14, payout: 8,  flavor: "Series B unlocked." },
  { id: "rocket", emoji: "🚀", name: "Hype Cycle",    weight: 10, payout: 15, flavor: "To the moon (until Q3)." },
  { id: "money",  emoji: "💸", name: "Burn Rate",     weight: 6,  payout: 25, flavor: "You ARE the burn rate." },
  { id: "wild",   emoji: "🔮", name: "Hallucination", weight: 2,  payout: 100,flavor: "JACKPOT. Definitely real. Trust the model.", wild: true }
];

const SPIN_QUIPS = [
  "Inferring…", "Sampling from the prior…", "Aligning your values…",
  "Consulting the oracle…", "Backpropagating regret…", "Fine-tuning your wallet…",
  "Reticulating splines…", "Asking the model nicely…", "Loading 700B parameters…",
  "Negotiating with safety team…", "Distilling vibes…"
];

const LOSE_QUIPS = [
  "Model collapsed. Try again.",
  "Hallucinated a win. Sorry.",
  "Tokens consumed. Wisdom: zero.",
  "The dataset was contaminated.",
  "Loss function loved that.",
  "Closing your tab won't help.",
  "Have you tried prompting it better?",
  "Synthetic data, synthetic returns.",
  "Compute spent. Vibes earned.",
  "GPT-5 would have won that."
];

const NEAR_MISS_QUIPS = [
  "Off by one token.",
  "So close. Almost AGI.",
  "The benchmark says you won.",
  "In the multiverse you're rich."
];

const WIN_QUIPS = [
  "Emergent behavior detected!",
  "RLHF approves this payout.",
  "Scaling laws hold. For now.",
  "Your prompt was *chef's kiss*.",
  "The board has been notified."
];

const JACKPOT_QUIPS = [
  "🔮 HALLUCINATION JACKPOT — totally not made up!",
  "🔮 SUPERINTELLIGENCE ACHIEVED (this round only).",
  "🔮 The model loves you back."
];

// --- State ---
const state = {
  balance: 1000,
  bet: 10,
  burned: 0,
  net: 0,
  spins: 0,
  spinning: false,
};

const BETS = [1, 5, 10, 25, 50, 100, 500];

// --- DOM ---
const $ = (id) => document.getElementById(id);
const balanceEl = $("balance");
const burnedEl = $("burned");
const netEl = $("net");
const spinsEl = $("spins");
const betEl = $("bet");
const spinBtn = $("spinBtn");
const resetBtn = $("resetBtn");
const betUpBtn = $("betUp");
const betDownBtn = $("betDown");
const statusText = $("statusText");
const reelsContainer = $("reels");
const reels = Array.from(document.querySelectorAll(".reel"));
const strips = reels.map((r) => r.querySelector(".strip"));
const paytableEl = $("paytable");

// Cell height is read dynamically from the DOM so CSS media queries can change it.
function cellHeight(reel) {
  const c = reel.querySelector(".cell");
  return c ? c.offsetHeight : 140;
}

// --- Helpers ---
function weightedPick() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r < 0) return sym;
  }
  return SYMBOLS[0];
}

function buildStrip(strip, finalSymbol, extraLength = 30) {
  // Build a long strip of random symbols, ending in finalSymbol so it lands on the payline.
  strip.innerHTML = "";
  const symbols = [];
  for (let i = 0; i < extraLength; i++) symbols.push(weightedPick());
  symbols.push(finalSymbol);
  symbols.push(weightedPick());
  symbols.push(weightedPick());

  for (const s of symbols) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = s.emoji;
    cell.style.color = colorFor(s.id);
    strip.appendChild(cell);
  }
  return symbols;
}

function finalIndexOf(symbols) { return symbols.length - 3; }

function colorFor(id) {
  const map = {
    robot: "#7cf9d8", brain: "#ff9ad6", chip: "#9ad4ff",
    chart: "#9af0a3", rocket: "#ffd166", money: "#ffb347", wild: "#ff5edb"
  };
  return map[id] || "#ffffff";
}

function setStatus(text, kind = "") {
  statusText.textContent = text;
  statusText.className = kind;
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

function render() {
  balanceEl.textContent = fmt(state.balance);
  burnedEl.textContent = fmt(state.burned);
  netEl.textContent = (state.net >= 0 ? "+" : "") + fmt(state.net);
  netEl.style.color = state.net >= 0 ? "var(--neon)" : "var(--danger)";
  spinsEl.textContent = fmt(state.spins);
  betEl.textContent = fmt(state.bet);
  spinBtn.disabled = state.spinning || state.balance < state.bet;
  betUpBtn.disabled = state.spinning;
  betDownBtn.disabled = state.spinning;
  resetBtn.disabled = state.spinning || state.balance >= 50;
}

function renderPaytable() {
  paytableEl.innerHTML = "";
  for (const s of [...SYMBOLS].sort((a, b) => b.payout - a.payout)) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.innerHTML = `<span class="sym">${s.emoji}${s.emoji}${s.emoji}</span> ${s.name}`;
    const right = document.createElement("span");
    right.className = "pay";
    right.textContent = `×${s.payout}`;
    li.appendChild(left);
    li.appendChild(right);
    paytableEl.appendChild(li);
  }
}

function pickQuip(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function spinReel(reel, strip, finalSymbol, durationMs) {
  return new Promise((resolve) => {
    const symbols = buildStrip(strip, finalSymbol, 25 + Math.floor(Math.random() * 10));
    const CELL = cellHeight(reel);
    const reelHeight = reel.offsetHeight;
    const finalIndex = finalIndexOf(symbols);
    const targetY = -(finalIndex * CELL) + (reelHeight / 2 - CELL / 2);

    strip.style.transition = "none";
    strip.style.transform = `translateY(${reelHeight}px)`;
    void strip.offsetHeight;

    strip.style.transition = `transform ${durationMs}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
    strip.style.transform = `translateY(${targetY}px)`;

    const onEnd = () => {
      strip.removeEventListener("transitionend", onEnd);
      resolve();
    };
    strip.addEventListener("transitionend", onEnd);
  });
}

function evaluateWin(results, bet) {
  // Single payline: all three reels.
  const [a, b, c] = results;
  // Wild can substitute, but three wilds = jackpot (use wild payout).
  const allWild = a.wild && b.wild && c.wild;
  if (allWild) return { type: "jackpot", payout: SYMBOLS.find(s => s.wild).payout * bet, symbol: a };

  // Find non-wild target
  const nonWilds = [a, b, c].filter((s) => !s.wild);
  if (nonWilds.length === 0) return { type: "none", payout: 0 };
  const target = nonWilds[0];
  const allMatch = [a, b, c].every((s) => s.wild || s.id === target.id);
  if (allMatch) {
    const isJackpot = target.payout >= 25;
    return { type: isJackpot ? "jackpot" : "win", payout: target.payout * bet, symbol: target };
  }
  // Near miss: two of a kind (wild substitutes)
  const counts = {};
  for (const s of [a, b, c]) {
    if (s.wild) continue;
    counts[s.id] = (counts[s.id] || 0) + 1;
  }
  const maxCount = Math.max(0, ...Object.values(counts));
  const wildCount = [a, b, c].filter((s) => s.wild).length;
  if (maxCount + wildCount >= 2) return { type: "near", payout: 0 };
  return { type: "none", payout: 0 };
}

async function spin() {
  if (state.spinning || state.balance < state.bet) return;
  state.spinning = true;
  state.balance -= state.bet;
  state.burned += state.bet;
  state.net -= state.bet;
  state.spins += 1;
  render();
  setStatus(pickQuip(SPIN_QUIPS));

  const results = [weightedPick(), weightedPick(), weightedPick()];
  const durations = [900, 1300, 1700];

  await Promise.all(
    reels.map((reel, i) => spinReel(reel, strips[i], results[i], durations[i]))
  );

  const outcome = evaluateWin(results, state.bet);
  state.spinning = false;

  if (outcome.type === "jackpot") {
    state.balance += outcome.payout;
    state.net += outcome.payout;
    setStatus(`${pickQuip(JACKPOT_QUIPS)} +${fmt(outcome.payout)} tokens!`, "epic");
    reelsContainer.parentElement.classList.remove("flash");
    void reelsContainer.parentElement.offsetWidth;
    reelsContainer.parentElement.classList.add("flash");
  } else if (outcome.type === "win") {
    state.balance += outcome.payout;
    state.net += outcome.payout;
    setStatus(`${pickQuip(WIN_QUIPS)} ${outcome.symbol.flavor} +${fmt(outcome.payout)} tokens.`, "win");
  } else if (outcome.type === "near") {
    setStatus(pickQuip(NEAR_MISS_QUIPS), "lose");
  } else {
    setStatus(pickQuip(LOSE_QUIPS), "lose");
    document.querySelector(".reels-frame").classList.remove("shake");
    void document.querySelector(".reels-frame").offsetWidth;
    document.querySelector(".reels-frame").classList.add("shake");
  }

  if (state.balance < BETS[0]) {
    setStatus("💀 You are bankrupt. Time to pivot to crypto. (Click 'Beg for VC funding'.)", "lose");
  } else if (state.balance < state.bet) {
    // Auto-lower bet if user can no longer afford current bet.
    const affordable = [...BETS].reverse().find((b) => b <= state.balance);
    if (affordable) state.bet = affordable;
  }
  render();
}

function changeBet(dir) {
  const idx = BETS.indexOf(state.bet);
  const next = Math.max(0, Math.min(BETS.length - 1, idx + dir));
  const candidate = BETS[next];
  if (candidate <= state.balance) {
    state.bet = candidate;
    render();
  } else {
    setStatus("Insufficient tokens. The market has spoken.", "lose");
  }
}

function reset() {
  if (state.balance >= 50) return;
  state.balance += 1000;
  setStatus("💰 Term sheet signed. Valuation: vibes. +1000 tokens.", "win");
  render();
}

// --- Init ---
function init() {
  // Pre-fill reels with random idle symbols.
  for (const strip of strips) {
    strip.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = weightedPick();
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = s.emoji;
      cell.style.color = colorFor(s.id);
      strip.appendChild(cell);
    }
    const CELL = cellHeight(reels[0]);
    const reelHeight = reels[0].offsetHeight;
    strip.style.transform = `translateY(${reelHeight / 2 - CELL / 2 - CELL}px)`;
  }
  renderPaytable();
  render();

  spinBtn.addEventListener("click", spin);
  betUpBtn.addEventListener("click", () => changeBet(+1));
  betDownBtn.addEventListener("click", () => changeBet(-1));
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); spin(); }
    if (e.key === "ArrowUp") changeBet(+1);
    if (e.key === "ArrowDown") changeBet(-1);
  });
}

init();
