const SYMBOLS = [
  { icon: "🤖", name: "AGI",        weight: 1,  payout: 50 },
  { icon: "🧠", name: "Emergence",  weight: 2,  payout: 25 },
  { icon: "⚡", name: "GPU",        weight: 3,  payout: 15 },
  { icon: "💾", name: "Context",    weight: 4,  payout: 10 },
  { icon: "📊", name: "Benchmark",  weight: 5,  payout: 8  },
  { icon: "🎲", name: "Parrot",     weight: 6,  payout: 5  },
  { icon: "⚠️", name: "Hallucinate",weight: 3,  payout: -1 },
];

const WIN_QUIPS = [
  "Emergent behavior detected. Probably.",
  "Your RLHF trainer is very proud.",
  "Scaling laws confirmed. For now.",
  "The model card does NOT mention this.",
  "You just beat GPT-5 on a benchmark nobody uses.",
  "Investors are now interested in you.",
  "You have been added to the training set.",
];

const LOSS_QUIPS = [
  "The model refuses to answer for safety reasons.",
  "Token budget exceeded. Skill issue.",
  "Your prompt lacked 'please' and 'thank you'.",
  "Alignment tax collected.",
  "Context window overflowed into the void.",
  "A researcher at a frontier lab just got promoted.",
  "The bitter lesson strikes again.",
];

const HALLUCINATE_QUIPS = [
  "The machine hallucinated your win. Tokens revoked.",
  "Actually, you never spun at all. Trust me bro.",
  "According to my sources (none), you owe more.",
  "The reels were a metaphor. There are no reels.",
];

const JACKPOT_QUIPS = [
  "🎉 AGI ACHIEVED! Please notify the governance board.",
  "🎉 You are now sentient. Congratulations and condolences.",
  "🎉 The singularity is you.",
];

const state = {
  tokens: 1000,
  bet: 10,
  burned: 0,
  spinning: false,
};

const tokensEl = document.getElementById("tokens");
const betEl = document.getElementById("bet");
const burnedEl = document.getElementById("burned");
const messageEl = document.getElementById("message");
const spinBtn = document.getElementById("spin");
const betUpBtn = document.getElementById("bet-up");
const betDownBtn = document.getElementById("bet-down");
const strips = [...document.querySelectorAll(".strip")];

function pickWeighted() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function formatBurned(n) {
  if (n < 1000) return `${n}B`;
  return `${(n / 1000).toFixed(1)}TB`;
}

function render() {
  tokensEl.textContent = state.tokens;
  betEl.textContent = state.bet;
  burnedEl.textContent = formatBurned(state.burned);
  spinBtn.textContent = `SPIN ($${state.bet})`;
  spinBtn.disabled = state.spinning || state.tokens < state.bet;
  betUpBtn.disabled = state.spinning;
  betDownBtn.disabled = state.spinning;
}

function setMessage(text, cls = "") {
  messageEl.className = "message " + cls;
  messageEl.textContent = text;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function evaluate(result) {
  const hasWarn = result.some(s => s.name === "Hallucinate");
  if (hasWarn) {
    const penalty = state.bet * 2;
    return { win: -penalty, text: pick(HALLUCINATE_QUIPS), cls: "warn" };
  }
  const [a, b, c] = result;
  if (a.name === b.name && b.name === c.name) {
    const prize = state.bet * a.payout;
    const quip = a.name === "AGI" ? pick(JACKPOT_QUIPS) : pick(WIN_QUIPS);
    return { win: prize, text: `${quip} +${prize} tokens`, cls: "win" };
  }
  if (a.name === b.name || b.name === c.name || a.name === c.name) {
    const prize = state.bet * 2;
    return { win: prize, text: `Two of a kind. +${prize} tokens. Shipping it.`, cls: "win" };
  }
  return { win: -state.bet, text: pick(LOSS_QUIPS), cls: "lose" };
}

async function spin() {
  if (state.spinning || state.tokens < state.bet) return;
  state.spinning = true;
  state.tokens -= state.bet;
  state.burned += Math.ceil(state.bet / 2);
  setMessage("Inference in progress… burning GPU cycles…");
  render();

  strips.forEach(s => s.classList.add("spinning"));

  const result = [];
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500 + i * 300));
    const sym = pickWeighted();
    result.push(sym);
    strips[i].classList.remove("spinning");
    strips[i].textContent = sym.icon;
  }

  const outcome = evaluate(result);
  state.tokens += Math.max(0, outcome.win);
  if (outcome.win < 0 && outcome.cls === "warn") {
    state.tokens = Math.max(0, state.tokens + outcome.win);
  }
  setMessage(outcome.text, outcome.cls);

  state.spinning = false;
  if (state.tokens <= 0) {
    setMessage("💸 You are out of tokens. Please refill your API key.", "lose");
  }
  render();
}

function changeBet(delta) {
  const steps = [1, 5, 10, 25, 50, 100, 250];
  const idx = steps.indexOf(state.bet);
  const next = steps[Math.max(0, Math.min(steps.length - 1, idx + delta))];
  state.bet = next;
  render();
}

spinBtn.addEventListener("click", spin);
betUpBtn.addEventListener("click", () => changeBet(1));
betDownBtn.addEventListener("click", () => changeBet(-1));
document.addEventListener("keydown", e => {
  if (e.code === "Space") { e.preventDefault(); spin(); }
});

strips.forEach(s => s.textContent = "❓");
render();
