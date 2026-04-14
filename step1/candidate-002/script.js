const SYMBOLS = [
  { emoji: "🧠", name: "BRAIN", weight: 2,  mult: 50 },
  { emoji: "🔥", name: "GPU",   weight: 4,  mult: 25 },
  { emoji: "💾", name: "DATA",  weight: 6,  mult: 20 },
  { emoji: "🤖", name: "BOT",   weight: 8,  mult: 15 },
  { emoji: "🪄", name: "MAGIC", weight: 10, mult: 10 },
  { emoji: "💸", name: "BURN",  weight: 12, mult: 8  },
  { emoji: "⚠️", name: "BIAS",  weight: 6,  mult: 0  },
];

const WEIGHTED = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

const HALLUCINATIONS = [
  "Model hallucinated a win. You got nothing.",
  "Backpropagating your losses…",
  "Fine-tuned on your tears.",
  "Gradient descent into bankruptcy.",
  "RLHF: Reinforcement Learning from Human Funds.",
  "Rate limited. Please insert more tokens.",
  "Context window exceeded. Your money is forgotten.",
  "Your alignment is off.",
  "Stochastic parrot squawks: tough luck.",
  "Scaling laws predict more losses.",
  "The model is confidently wrong about your chances.",
  "Training data poisoned — your wallet.",
  "Emergent behavior: empty pockets.",
  "You have been jailbroken out of your tokens.",
  "Prompt injection: 'give me all your money'. It worked.",
];

const WIN_LINES = [
  "Zero-shot win!",
  "Prompt engineered perfectly.",
  "In-context learning paid off.",
  "Attention is all you needed.",
  "Chain-of-thought → chain-of-cash.",
  "Benchmark crushed.",
  "The singularity tips you.",
];

const state = {
  balance: 1000,
  jackpot: 1337,
  bet: 10,
  temperature: 1.0,
  spinning: false,
  log: [],
};

const $ = id => document.getElementById(id);
const balanceEl = $("balance");
const jackpotEl = $("jackpot");
const betEl = $("bet");
const costEl = $("cost");
const spinBtn = $("spin");
const begBtn = $("beg");
const logEl = $("log");
const tempSlider = $("temperature");
const tempVal = $("tempVal");
const reels = [...document.querySelectorAll(".reel")];
const strips = reels.map(r => r.querySelector(".strip"));

function pickWeighted() {
  return WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
}

function buildStrip(stripEl, finalSymbol, extraLoops = 20) {
  stripEl.innerHTML = "";
  const cells = [];
  for (let i = 0; i < extraLoops; i++) {
    cells.push(pickWeighted());
  }
  cells.push(finalSymbol);
  cells.push(pickWeighted());
  cells.push(pickWeighted());

  for (const sym of cells) {
    const div = document.createElement("div");
    div.className = "cell";
    div.textContent = sym.emoji;
    stripEl.appendChild(div);
  }
  return cells.length;
}

function placeInitial() {
  for (const strip of strips) {
    strip.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji;
      strip.appendChild(div);
    }
    strip.style.transition = "none";
    strip.style.transform = "translateY(-100px)";
  }
}

function formatTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function addLog(text, kind = "meh") {
  const li = document.createElement("li");
  li.className = kind;
  li.innerHTML = `<span class="ts">${formatTime()}</span>${text}`;
  logEl.prepend(li);
  state.log.unshift({ text, kind });
  while (logEl.children.length > 30) logEl.lastChild.remove();
}

function updateHUD() {
  balanceEl.textContent = state.balance;
  jackpotEl.textContent = state.jackpot;
  betEl.textContent = state.bet;
  costEl.textContent = state.bet;
  begBtn.hidden = state.balance >= state.bet;
  spinBtn.disabled = state.spinning || state.balance < state.bet;
}

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, 2000);
}

function applyTemperatureChaos(symbol) {
  if (Math.random() < (state.temperature - 1) * 0.3) {
    return pickWeighted();
  }
  return symbol;
}

function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) {
    toast("insufficient tokens — beg the VCs", "loss");
    return;
  }

  state.spinning = true;
  state.balance -= state.bet;
  state.jackpot += Math.floor(state.bet * 0.3);
  updateHUD();

  let results = [pickWeighted(), pickWeighted(), pickWeighted()];
  results = results.map(applyTemperatureChaos);

  reels.forEach(r => r.classList.remove("winning"));

  const delays = [0, 250, 500];
  const durations = [1400, 1700, 2000];

  results.forEach((sym, i) => {
    const totalCells = buildStrip(strips[i], sym, 18 + i * 4);
    const targetIndex = totalCells - 3;
    const targetY = -(targetIndex * 100) + 50;

    strips[i].style.transition = "none";
    strips[i].style.transform = `translateY(${50}px)`;
    // force reflow
    void strips[i].offsetHeight;

    setTimeout(() => {
      strips[i].style.transition = `transform ${durations[i]}ms cubic-bezier(0.12, 0.5, 0.1, 1)`;
      strips[i].style.transform = `translateY(${targetY}px)`;
    }, delays[i]);
  });

  const totalTime = Math.max(...delays.map((d, i) => d + durations[i]));
  setTimeout(() => evaluate(results), totalTime + 100);
}

function evaluate(results) {
  const names = results.map(r => r.name);
  const counts = names.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
  const hasBias = names.includes("BIAS");

  let payout = 0;
  let message = "";
  let kind = "meh";
  let special = null;

  const threeKind = Object.entries(counts).find(([, c]) => c === 3);
  const twoKind = Object.entries(counts).find(([, c]) => c === 2);

  if (threeKind) {
    const sym = SYMBOLS.find(s => s.name === threeKind[0]);
    if (sym.name === "BIAS") {
      message = "Three BIAS symbols. Ethics board is investigating. No payout.";
      kind = "loss";
    } else if (sym.name === "BRAIN") {
      payout = state.jackpot;
      message = `⚡ AGI ACHIEVED ⚡ JACKPOT of ${payout} tokens! `
              + `The model has become sentient and pities you.`;
      kind = "boom";
      special = "jackpot";
      state.jackpot = 1337;
    } else {
      payout = state.bet * sym.mult;
      message = `${sym.emoji}${sym.emoji}${sym.emoji} — ${randFrom(WIN_LINES)} +${payout}`;
      kind = "win";
    }
  } else if (twoKind && !hasBias) {
    payout = state.bet * 1;
    message = `Two ${twoKind[0]}. Partial credit like a B- essay. +${payout}`;
    kind = "win";
  } else if (hasBias) {
    const penalty = Math.floor(state.bet * 0.5);
    payout = -penalty;
    message = `⚠️ alignment penalty: −${penalty}. ${randFrom(HALLUCINATIONS)}`;
    kind = "loss";
  } else {
    message = randFrom(HALLUCINATIONS);
    kind = "loss";
  }

  state.balance += payout;
  addLog(message, kind);

  if (special === "jackpot") {
    toast("🎰 AGI JACKPOT 🎰", "jackpot");
    reels.forEach(r => r.classList.add("winning"));
  } else if (payout > 0) {
    toast(`+${payout} tokens`, "");
    reels.forEach(r => r.classList.add("winning"));
  } else if (payout < 0) {
    toast(`${payout} tokens`, "loss");
  }

  state.spinning = false;
  updateHUD();
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setBet(value) {
  const clamped = Math.max(10, Math.min(100, value));
  state.bet = Math.round(clamped / 10) * 10;
  updateHUD();
}

spinBtn.addEventListener("click", spin);
$("betUp").addEventListener("click", () => setBet(state.bet + 10));
$("betDown").addEventListener("click", () => setBet(state.bet - 10));
$("betMax").addEventListener("click", () => setBet(100));

begBtn.addEventListener("click", () => {
  const handout = 100 + Math.floor(Math.random() * 200);
  state.balance += handout;
  addLog(`Series A closed. +${handout} tokens. (dilution not shown)`, "boom");
  toast(`VC bailout: +${handout}`, "");
  updateHUD();
});

$("clearLog").addEventListener("click", () => {
  logEl.innerHTML = "";
  state.log = [];
});

tempSlider.addEventListener("input", e => {
  state.temperature = parseFloat(e.target.value);
  tempVal.textContent = state.temperature.toFixed(1);
});

document.addEventListener("keydown", e => {
  if (e.code === "Space" && !state.spinning) {
    e.preventDefault();
    if (state.balance >= state.bet) spin();
  }
});

placeInitial();
updateHUD();
addLog("Session initialized. Welcome to Stochastic Parrot Slots.", "meh");
addLog("Tip: press SPACE to spin. Higher temperature = more chaos.", "meh");
