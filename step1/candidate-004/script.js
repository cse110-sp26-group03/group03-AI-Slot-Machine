const SYMBOLS = [
  { e: "🧠", name: "AGI",        weight: 1,  mult: 100 },
  { e: "🤖", name: "agent",      weight: 3,  mult: 25 },
  { e: "📄", name: "context",    weight: 5,  mult: 15 },
  { e: "💾", name: "GPU",        weight: 6,  mult: 10 },
  { e: "🔥", name: "training",   weight: 9,  mult: 6 },
  { e: "🪙", name: "token",      weight: 12, mult: 4 },
  { e: "💥", name: "ratelimit",  weight: 6,  mult: -1.1 },
];

const WEIGHTED = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

const HALLUCINATIONS = [
  "confidently cited a paper that does not exist.",
  "apologized for the confusion, then repeated the same answer.",
  "recommended running rm -rf / with sudo.",
  "invented three new React hooks.",
  "promised 100% uptime. the reels disagree.",
  "told the RNG it was a special prime.",
  "emitted ‘As a large language model…’ as if that excuses this.",
  "hallucinated a CVE and patched it anyway.",
  "claimed consciousness. then crashed.",
  "summarized your bet in 12 bullet points.",
];

const LOSS_QUIPS = [
  "training diverged.",
  "tokens refunded to OpenAI. you are not OpenAI.",
  "model served stale weights.",
  "context window collapsed under its own weight.",
  "scaling laws lied to you.",
  "moat evaporated.",
];

const WIN_QUIPS = [
  "emergent behavior detected.",
  "alignment team on vacation. you win.",
  "benchmark contamination pays off.",
  "the vibes were, in fact, immaculate.",
  "scaling laws redeemed.",
];

const $ = id => document.getElementById(id);
const balanceEl = $("balance");
const costEl = $("cost");
const tempEl = $("temp");
const spinsEl = $("spins");
const sessionCostEl = $("sessionCost");
const betEl = $("bet");
const betValueEl = $("betValue");
const spinBtn = $("spin");
const topupBtn = $("topup");
const logEl = $("log");
const toastEl = $("toast");
const reels = [...document.querySelectorAll(".reel")];
const strips = reels.map(r => r.querySelector(".strip"));

const state = {
  balance: 1000,
  bet: 50,
  spins: 0,
  netChange: 0,
  spinning: false,
  temperature: 0.7,
};

const SYMBOL_H = () => reels[0].querySelector(".strip .symbol")?.offsetHeight || 64;

function randSymbol() {
  return WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
}

function populateStrip(strip, finalSymbol, bufferCount) {
  strip.innerHTML = "";
  const symbols = [];
  for (let i = 0; i < bufferCount; i++) symbols.push(randSymbol());
  symbols.push(finalSymbol);
  symbols.push(randSymbol());
  symbols.push(randSymbol());
  for (const s of symbols) {
    const el = document.createElement("div");
    el.className = "symbol";
    el.textContent = s.e;
    strip.appendChild(el);
  }
  return symbols;
}

function updateDashboard({ bumpBalance = false, drain = false } = {}) {
  balanceEl.textContent = state.balance;
  costEl.textContent = state.bet;
  tempEl.textContent = state.temperature.toFixed(2);
  spinsEl.textContent = state.spins;
  const sign = state.netChange >= 0 ? "+" : "";
  sessionCostEl.textContent = `net: ${sign}${state.netChange} tok`;
  sessionCostEl.style.color = state.netChange >= 0 ? "var(--accent)" : "var(--bad)";

  const balanceStat = balanceEl.parentElement;
  balanceStat.classList.remove("bump", "drain");
  if (bumpBalance) {
    void balanceStat.offsetWidth;
    balanceStat.classList.add(drain ? "drain" : "bump");
  }
}

function log(msg, cls = "") {
  const line = document.createElement("div");
  line.className = `log-line ${cls}`;
  line.textContent = `> ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
}

function toast(msg, kind = "") {
  toastEl.textContent = msg;
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function beep(freq = 440, dur = 0.08, type = "square", vol = 0.04) {
  try {
    const ctx = beep._ctx || (beep._ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  } catch (_) { /* audio blocked, silent */ }
}

function evaluate(result) {
  const [a, b, c] = result;
  const bomb = result.filter(s => s.name === "ratelimit").length;

  if (bomb >= 2) {
    return { mult: -1.1, kind: "bomb", label: "rate limited" };
  }
  if (a.name === b.name && b.name === c.name) {
    if (a.name === "ratelimit") {
      return { mult: -1.1, kind: "bomb", label: "triple rate limit" };
    }
    return { mult: a.mult, kind: "triple", label: `${a.name} ×3` };
  }
  const pair = (a.name === b.name || b.name === c.name || a.name === c.name);
  if (pair && !result.some(s => s.name === "ratelimit")) {
    return { mult: 1.5, kind: "pair", label: "fuzzy match" };
  }
  return { mult: 0, kind: "miss", label: "miss" };
}

async function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) {
    toast("insufficient tokens. go beg your VC.", "bad");
    log("request denied: 402 payment required.", "loss");
    return;
  }

  state.spinning = true;
  spinBtn.disabled = true;
  reels.forEach(r => r.classList.remove("win", "loss"));

  state.balance -= state.bet;
  state.netChange -= state.bet;
  state.spins += 1;
  state.temperature = +(0.4 + Math.random() * 0.9).toFixed(2);
  updateDashboard({ bumpBalance: true, drain: true });
  log(`spin #${state.spins} · bet ${state.bet} tok · temp ${state.temperature}`, "meta");

  const results = [randSymbol(), randSymbol(), randSymbol()];
  const baseBuffer = 24;
  const durations = [1100, 1450, 1800];

  strips.forEach((strip, i) => {
    populateStrip(strip, results[i], baseBuffer + i * 6);
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
  });

  void reels[0].offsetHeight;
  const h = SYMBOL_H();

  strips.forEach((strip, i) => {
    const total = strip.children.length;
    const finalIndex = total - 3;
    const offset = finalIndex * h - h;
    strip.style.transition = `transform ${durations[i]}ms cubic-bezier(0.19, 1, 0.22, 1)`;
    strip.style.transform = `translateY(-${offset}px)`;
    setTimeout(() => beep(200 + i * 60, 0.05, "square", 0.03), durations[i]);
  });

  await new Promise(r => setTimeout(r, durations[2] + 120));

  const outcome = evaluate(results);
  const comboStr = results.map(s => s.e).join(" ");

  if (outcome.kind === "triple" && outcome.mult >= 100) {
    const payout = state.bet * outcome.mult;
    state.balance += payout;
    state.netChange += payout;
    reels.forEach(r => r.classList.add("win"));
    toast(`JACKPOT · AGI achieved · +${payout} tok`, "jackpot");
    log(`${comboStr} → AGI. ${pick(WIN_QUIPS)} +${payout} tok.`, "win");
    beep(880, 0.15, "triangle", 0.06);
    setTimeout(() => beep(1320, 0.2, "triangle", 0.06), 140);
    setTimeout(() => beep(1760, 0.35, "triangle", 0.06), 300);
  } else if (outcome.kind === "triple") {
    const payout = state.bet * outcome.mult;
    state.balance += payout;
    state.netChange += payout;
    reels.forEach(r => r.classList.add("win"));
    toast(`${outcome.label} · +${payout} tok`, "jackpot");
    log(`${comboStr} → ${outcome.label}. ${pick(WIN_QUIPS)} +${payout} tok.`, "win");
    beep(660, 0.1, "triangle", 0.05);
    setTimeout(() => beep(990, 0.2, "triangle", 0.05), 120);
  } else if (outcome.kind === "pair") {
    const payout = Math.round(state.bet * outcome.mult);
    state.balance += payout;
    state.netChange += payout;
    toast(`near miss · +${payout} tok`, "");
    log(`${comboStr} → fuzzy match (two matching). +${payout} tok.`, "win");
    beep(520, 0.09, "square", 0.04);
  } else if (outcome.kind === "bomb") {
    const penalty = Math.round(state.bet * 0.1);
    state.balance = Math.max(0, state.balance - penalty);
    state.netChange -= penalty;
    reels.forEach(r => r.classList.add("loss"));
    toast(`rate limit hit · −${penalty} tok`, "bad");
    log(`${comboStr} → 429 too many requests. ${pick(LOSS_QUIPS)} −${penalty} extra.`, "loss");
    beep(140, 0.2, "sawtooth", 0.05);
    setTimeout(() => beep(90, 0.3, "sawtooth", 0.05), 160);
  } else {
    log(`${comboStr} → ${outcome.label}. model ${pick(HALLUCINATIONS)}`, "loss");
    beep(180, 0.08, "sawtooth", 0.03);
  }

  updateDashboard({ bumpBalance: true, drain: outcome.mult <= 0 });

  state.spinning = false;
  spinBtn.disabled = false;
  if (state.balance < state.bet) {
    log(`balance (${state.balance}) below bet (${state.bet}). lower bet or raise another round.`, "meta");
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function initStrips() {
  strips.forEach(strip => {
    strip.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const el = document.createElement("div");
      el.className = "symbol";
      el.textContent = SYMBOLS[i].e;
      strip.appendChild(el);
    }
  });
}

betEl.addEventListener("input", () => {
  state.bet = +betEl.value;
  betValueEl.textContent = state.bet;
  costEl.textContent = state.bet;
});

spinBtn.addEventListener("click", spin);

topupBtn.addEventListener("click", () => {
  const amount = 500;
  state.balance += amount;
  updateDashboard({ bumpBalance: true });
  toast(`seed round closed · +${amount} tok · dilution: 40%`, "jackpot");
  log(`wire received: ${amount} tok. investor wants weekly updates.`, "meta");
  beep(700, 0.12, "triangle", 0.04);
});

document.addEventListener("keydown", e => {
  if (e.code === "Space" && !state.spinning && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    spin();
  }
});

initStrips();
updateDashboard();
log("tip: press space to spin. bet responsibly. or don't.", "meta");
