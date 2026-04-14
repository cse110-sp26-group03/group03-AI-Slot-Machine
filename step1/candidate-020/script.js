const SYMBOLS = [
  { s: "🧠", weight: 1,  name: "brain" },
  { s: "💸", weight: 2,  name: "cash" },
  { s: "📈", weight: 3,  name: "chart" },
  { s: "🤖", weight: 4,  name: "bot" },
  { s: "🔥", weight: 5,  name: "fire" },
  { s: "📎", weight: 6,  name: "clip" },
  { s: "🪙", weight: 8,  name: "coin" },
  { s: "💀", weight: 6,  name: "skull" },
];

const TRIPLE_PAYOUTS = {
  "🧠": { mult: 50, msg: "🧠 SUPERINTELLIGENCE ACHIEVED. The board is pleased." },
  "💸": { mult: 25, msg: "💸 Series F closed. Burn rate immaterial." },
  "📈": { mult: 15, msg: "📈 Scaling laws confirmed. Again." },
  "🤖": { mult: 10, msg: "🤖 Beep boop. You have been assimilated." },
  "🔥": { mult: 8,  msg: "🔥 GPU go brrr. Datacenter now on fire (literally)." },
  "📎": { mult: 5,  msg: "📎 Paperclip maximizer online. Please stand by." },
  "🪙": { mult: 3,  msg: "🪙 Triple coin. Modest. The model is disappointed." },
  "💀": { mult: 0,  msg: "💀 Triple skull. The model has achieved enlightenment. You have not." },
};

const LOSS_MSGS = [
  "Model hallucinated your winnings. Sorry.",
  "Context window exceeded. Tokens evicted.",
  "The attention mechanism was not paying attention.",
  "RLHF determined you don't deserve this.",
  "Your prompt lacked sufficient politeness.",
  "Alignment researchers intervened. For your safety.",
  "Training run diverged. Try again.",
  "The transformer transformed your tokens into nothing.",
];

const NEAR_MISS_MSGS = [
  "Two of a kind. The model is proud of you, mostly.",
  "Partial credit. Like an LLM answering math.",
  "Close. The third reel was simulating laziness.",
];

const BEG_MSGS = [
  "+100 tokens. A compassionate venture capitalist heard your prayer.",
  "+100 tokens. The foundation model granted you alms.",
  "+100 tokens. Scraped from an expired free trial.",
  "+100 tokens. Don't spend them all on one hallucination.",
];

const state = {
  tokens: 1000,
  bet: 10,
  lastWin: 0,
  spinning: false,
};

const els = {
  tokens: document.getElementById("tokens"),
  bet: document.getElementById("bet"),
  lastWin: document.getElementById("lastWin"),
  message: document.getElementById("message"),
  spin: document.getElementById("spin"),
  betUp: document.getElementById("betUp"),
  betDown: document.getElementById("betDown"),
  beg: document.getElementById("beg"),
  reels: [0,1,2].map(i => document.getElementById(`reel${i}`)),
  app: document.querySelector(".app"),
};

const BETS = [1, 5, 10, 25, 50, 100, 250];

function render() {
  els.tokens.textContent = state.tokens;
  els.bet.textContent = state.bet;
  els.lastWin.textContent = state.lastWin;
  els.spin.disabled = state.spinning || state.tokens < state.bet;
  els.betUp.disabled = state.spinning;
  els.betDown.disabled = state.spinning;
  els.beg.disabled = state.spinning || state.tokens > 0;
}

function buildWeightedPool() {
  const pool = [];
  SYMBOLS.forEach(s => { for (let i=0; i<s.weight; i++) pool.push(s.s); });
  return pool;
}
const POOL = buildWeightedPool();

function pickSymbol() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

function setReelSymbol(reelEl, symbol) {
  const strip = reelEl.querySelector(".strip");
  strip.innerHTML = `<div class="sym">${symbol}</div>`;
}

function startReelAnimation(reelEl) {
  const strip = reelEl.querySelector(".strip");
  const symbols = [];
  for (let i=0; i<12; i++) symbols.push(pickSymbol());
  strip.innerHTML = symbols.map(s => `<div class="sym">${s}</div>`).join("");
  reelEl.classList.add("spinning");
}

function stopReel(reelEl, finalSymbol) {
  reelEl.classList.remove("spinning");
  setReelSymbol(reelEl, finalSymbol);
}

function evaluate(result) {
  const [a, b, c] = result;
  if (a === b && b === c) {
    const payout = TRIPLE_PAYOUTS[a];
    return { win: state.bet * payout.mult, msg: payout.msg, triple: true };
  }
  if (a === b || b === c || a === c) {
    return { win: state.bet * 2, msg: NEAR_MISS_MSGS[Math.floor(Math.random()*NEAR_MISS_MSGS.length)], near: true };
  }
  return { win: 0, msg: LOSS_MSGS[Math.floor(Math.random()*LOSS_MSGS.length)] };
}

async function spin() {
  if (state.spinning || state.tokens < state.bet) return;
  state.spinning = true;
  state.tokens -= state.bet;
  state.lastWin = 0;
  els.message.textContent = "Burning compute...";
  render();

  els.reels.forEach(startReelAnimation);

  const result = [pickSymbol(), pickSymbol(), pickSymbol()];
  const stopTimes = [600, 1000, 1400];

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, stopTimes[i] - (i > 0 ? stopTimes[i-1] : 0)));
    stopReel(els.reels[i], result[i]);
  }

  const outcome = evaluate(result);
  state.tokens += outcome.win;
  state.lastWin = outcome.win;
  els.message.textContent = outcome.msg + (outcome.win ? ` (+${outcome.win})` : "");

  if (outcome.win > 0) {
    els.app.classList.remove("win-flash");
    void els.app.offsetWidth;
    els.app.classList.add("win-flash");
  }

  state.spinning = false;
  if (state.tokens <= 0) {
    els.message.textContent += " You're broke. Beg for more.";
  }
  render();
}

function adjustBet(dir) {
  const idx = BETS.indexOf(state.bet);
  const next = Math.max(0, Math.min(BETS.length - 1, idx + dir));
  state.bet = BETS[next];
  render();
}

function beg() {
  if (state.tokens > 0) return;
  state.tokens += 100;
  els.message.textContent = BEG_MSGS[Math.floor(Math.random()*BEG_MSGS.length)];
  render();
}

els.spin.addEventListener("click", spin);
els.betUp.addEventListener("click", () => adjustBet(1));
els.betDown.addEventListener("click", () => adjustBet(-1));
els.beg.addEventListener("click", beg);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); spin(); }
  if (e.key === "ArrowUp") adjustBet(1);
  if (e.key === "ArrowDown") adjustBet(-1);
});

els.reels.forEach(r => setReelSymbol(r, "🤖"));
render();
