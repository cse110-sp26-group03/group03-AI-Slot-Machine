const SYMBOLS = [
  { icon: "🧠", name: "AGI",        weight: 1,  payout: 100 },
  { icon: "🤖", name: "Model",      weight: 2,  payout: 50  },
  { icon: "💾", name: "TrainData",  weight: 3,  payout: 25  },
  { icon: "📎", name: "Paperclip",  weight: 4,  payout: 15  },
  { icon: "🔥", name: "GPU",        weight: 5,  payout: 10  },
  { icon: "💸", name: "VC",         weight: 6,  payout: 8   },
  { icon: "🍌", name: "Banana",     weight: 8,  payout: 5   },
];

const WEIGHTED = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

const FLAVOR_WIN = [
  "Model confidently outputs winnings. Source: trust me bro.",
  "Emergent behavior detected: you got lucky.",
  "RLHF'd into paying you. Reluctantly.",
  "The oracle aligned. Briefly.",
  "Attention heads all looked your way.",
  "Gradient descended directly into your wallet.",
];

const FLAVOR_LOSS = [
  "Model hallucinated your winnings. They were never real.",
  "Bet rejected due to safety guidelines (you're too poor).",
  "Context window overflowed, tokens evicted.",
  "OpenAI took a 30% cut of your vibe.",
  "Apologized for the inconvenience. Kept your tokens.",
  "Server is overloaded. So is your copium.",
  "Output filtered for containing 'money'.",
];

const FLAVOR_BIG = [
  "🚨 SINGULARITY DETECTED 🚨 — payout streaming...",
  "JACKPOT: you've been promoted to Chief AI Officer.",
  "Model achieved self-awareness long enough to pay out.",
  "This is definitely not a bubble.",
];

const FLAVOR_BROKE = [
  "You are out of tokens. Please upgrade to Pro.",
  "Rate limit hit. Your rate limit is $0.",
  "Your trial has expired. So has your dignity.",
];

const state = {
  balance: 1000,
  bet: 10,
  spinning: false,
  spins: 0,
};

const $ = (id) => document.getElementById(id);
const balanceEl = $("balance");
const betEl = $("bet");
const contextFill = $("contextFill");
const logEl = $("log");
const reels = [...document.querySelectorAll(".reel")];
const strips = reels.map(r => r.querySelector(".strip"));
const spinBtn = $("spin");
const maxBtn = $("maxBet");
const toast = $("toast");

function pickSymbol() {
  return WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
}

function buildStrip(stripEl, finalSymbol) {
  stripEl.innerHTML = "";
  const total = 30;
  const finalIndex = total - 2;
  for (let i = 0; i < total; i++) {
    const div = document.createElement("div");
    div.className = "symbol";
    const sym = (i === finalIndex) ? finalSymbol : pickSymbol();
    div.textContent = sym.icon;
    stripEl.appendChild(div);
  }
  return finalIndex;
}

function getSymbolHeight() {
  const el = document.querySelector(".symbol");
  return el ? el.getBoundingClientRect().height : 140;
}

function spinReel(stripEl, finalSymbol, durationMs) {
  return new Promise((resolve) => {
    const finalIndex = buildStrip(stripEl, finalSymbol);
    const h = getSymbolHeight();
    stripEl.style.transition = "none";
    stripEl.style.transform = "translateY(0px)";
    void stripEl.offsetHeight;
    stripEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    const offset = -finalIndex * h;
    stripEl.style.transform = `translateY(${offset}px)`;
    setTimeout(resolve, durationMs + 50);
  });
}

function calcPayout(results) {
  const [a, b, c] = results;
  if (a.name === b.name && b.name === c.name) {
    return { multiplier: a.payout, type: "triple", symbol: a };
  }
  if (a.name === b.name || b.name === c.name || a.name === c.name) {
    return { multiplier: 2, type: "pair", symbol: null };
  }
  return { multiplier: 0, type: "loss", symbol: null };
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pushLog(text, cls = "") {
  const li = document.createElement("li");
  li.textContent = `> ${text}`;
  if (cls) li.classList.add(cls);
  logEl.prepend(li);
  while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
}

function showToast(msg, cls = "") {
  toast.textContent = msg;
  toast.className = `toast ${cls}`;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2500);
}

function updateHUD() {
  balanceEl.textContent = state.balance.toLocaleString();
  betEl.textContent = state.bet;
  const pct = Math.min(100, 15 + state.spins * 3);
  contextFill.style.width = pct + "%";
  if (pct >= 100 && !updateHUD._warned) {
    updateHUD._warned = true;
    pushLog("⚠️ context window maxed — quality will now degrade", "loss");
  }
  spinBtn.disabled = state.spinning || state.balance < state.bet;
  maxBtn.disabled = state.spinning || state.balance <= 0;
}

function setBet(newBet) {
  state.bet = Math.max(1, Math.min(newBet, Math.max(1, state.balance)));
  updateHUD();
}

async function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) {
    showToast(pick(FLAVOR_BROKE), "loss");
    return;
  }

  state.spinning = true;
  state.balance -= state.bet;
  state.spins += 1;
  updateHUD();
  pushLog(`spin #${state.spins}: bet ${state.bet} tokens`);

  const results = [pickSymbol(), pickSymbol(), pickSymbol()];

  const durations = [1400, 1800, 2200];
  await Promise.all(
    strips.map((s, i) => spinReel(s, results[i], durations[i]))
  );

  const payout = calcPayout(results);
  const winAmount = state.bet * payout.multiplier;

  if (payout.type === "triple") {
    state.balance += winAmount;
    const big = payout.multiplier >= 50;
    const msg = big
      ? `${pick(FLAVOR_BIG)} +${winAmount} tokens`
      : `TRIPLE ${payout.symbol.icon} — +${winAmount} tokens. ${pick(FLAVOR_WIN)}`;
    pushLog(msg, big ? "big" : "win");
    showToast(`+${winAmount} tokens!`, "win");
    document.querySelector(".machine").classList.add("flash");
    setTimeout(() => document.querySelector(".machine").classList.remove("flash"), 2000);
  } else if (payout.type === "pair") {
    state.balance += winAmount;
    pushLog(`pair — +${winAmount} tokens. ${pick(FLAVOR_WIN)}`, "win");
    showToast(`+${winAmount} tokens`, "win");
  } else {
    pushLog(`no match — ${pick(FLAVOR_LOSS)}`, "loss");
    document.querySelector(".machine").classList.add("shake");
    setTimeout(() => document.querySelector(".machine").classList.remove("shake"), 400);
  }

  if (state.balance <= 0) {
    pushLog("💀 bankrupt. please deposit more tokens (or raise a seed round).", "loss");
    showToast("GPU credits depleted.", "loss");
  }

  state.spinning = false;
  if (state.bet > state.balance) state.bet = Math.max(1, state.balance);
  updateHUD();
}

$("betUp").addEventListener("click", () => setBet(state.bet + 10));
$("betDown").addEventListener("click", () => setBet(state.bet - 10));
spinBtn.addEventListener("click", spin);
maxBtn.addEventListener("click", () => {
  setBet(state.balance);
  spin();
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !state.spinning) {
    e.preventDefault();
    spin();
  }
});

strips.forEach((s) => buildStrip(s, pickSymbol()));
updateHUD();
pushLog("system online. loading weights... done. (they were already in RAM, we lied.)");
