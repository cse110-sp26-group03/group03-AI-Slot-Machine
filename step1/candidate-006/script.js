const SYMBOLS = [
  { id: "gpu",    icon: "🖥️", name: "GPU",           weight: 3,  mult: 50 },
  { id: "brain",  icon: "🧠", name: "AGI",           weight: 2,  mult: 100 },
  { id: "robot",  icon: "🤖", name: "Chatbot",       weight: 6,  mult: 20 },
  { id: "token",  icon: "🪙", name: "Token",         weight: 10, mult: 5  },
  { id: "fire",   icon: "🔥", name: "Burn Rate",     weight: 8,  mult: 8  },
  { id: "ghost",  icon: "👻", name: "Hallucination", weight: 7,  mult: 3  },
  { id: "bug",    icon: "🐛", name: "Prompt Bug",    weight: 9,  mult: 2  },
  { id: "trash",  icon: "🗑️", name: "Training Data", weight: 11, mult: 1  },
];

const LOSS_QUIPS = [
  "Your tokens hallucinated themselves into the void.",
  "The model is 99% confident you just lost.",
  "Compute consumed. Insight produced: none.",
  "Your loss has been added to the training set.",
  "Error 402: Tokens required. You had some. Past tense.",
  "The AI is learning. From your wallet.",
  "Gradient descended. So did your balance.",
];

const WIN_QUIPS = [
  "Statistically improbable. Emotionally satisfying.",
  "You've achieved Artificial General Luck.",
  "The model aligned. With your wallet.",
  "Jackpot confidence score: 420.69%",
  "Your synergy has produced value.",
  "Somewhere, a VC just shed a single tear of joy.",
];

const NEAR_MISS_QUIPS = [
  "So close. The model was thinking about winning.",
  "Almost. Try fine-tuning your luck.",
  "One token short of enlightenment.",
];

const STRIP_LENGTH = 30;
const SYMBOL_HEIGHT = 64;
const VISIBLE_ROWS = 3;
const CENTER_OFFSET = SYMBOL_HEIGHT;

const state = {
  balance: 1000,
  bet: 10,
  betOptions: [5, 10, 25, 50, 100, 250],
  betIndex: 1,
  spinning: false,
  reels: [],
};

function totalWeight() {
  return SYMBOLS.reduce((s, x) => s + x.weight, 0);
}

function weightedPick() {
  const t = totalWeight();
  let r = Math.random() * t;
  for (const s of SYMBOLS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function buildStrip(reelEl) {
  const strip = reelEl.querySelector(".strip");
  strip.innerHTML = "";
  const symbols = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    const s = weightedPick();
    symbols.push(s);
    const d = document.createElement("div");
    d.className = "symbol";
    d.textContent = s.icon;
    d.dataset.id = s.id;
    strip.appendChild(d);
  }
  strip.style.transform = `translateY(0px)`;
  return { strip, symbols };
}

function initReels() {
  const reelEls = document.querySelectorAll(".reel");
  state.reels = [...reelEls].map((el) => ({ el, ...buildStrip(el) }));
}

function renderPaytable() {
  const ul = document.getElementById("paytable");
  ul.innerHTML = "";
  [...SYMBOLS]
    .sort((a, b) => b.mult - a.mult)
    .forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="sym">${s.icon}${s.icon}${s.icon}</span>
        <span class="name">${s.name}</span>
        <span class="mult">×${s.mult}</span>
      `;
      ul.appendChild(li);
    });
}

function setBalance(v, loss = false) {
  state.balance = Math.max(0, v);
  const el = document.getElementById("balance");
  el.textContent = state.balance;
  el.classList.remove("balance-flash", "loss");
  void el.offsetWidth;
  el.classList.add("balance-flash");
  if (loss) el.classList.add("loss");
}

function setBet(idx) {
  state.betIndex = Math.max(0, Math.min(state.betOptions.length - 1, idx));
  state.bet = state.betOptions[state.betIndex];
  document.getElementById("bet").textContent = state.bet;
  updateConfidence();
}

function updateConfidence() {
  const confs = ["99.9%", "107.2%", "42.0%", "PLEASE", "TRUST ME", "∞%"];
  document.getElementById("confidence").textContent =
    confs[Math.floor(Math.random() * confs.length)];
}

function toast(msg, duration = 2200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.remove("show"), duration);
}

function spinReel(reel, finalSymbolId, duration) {
  return new Promise((resolve) => {
    const { strip, symbols } = reel;
    let finalIdx = symbols.findIndex((s) => s.id === finalSymbolId);
    if (finalIdx < 2) finalIdx += symbols.length;
    const extraLoops = 4;
    const distance = (STRIP_LENGTH * extraLoops + finalIdx - 1) * SYMBOL_HEIGHT;
    const topSymbolsNeeded = 2;
    const padCount = STRIP_LENGTH * (extraLoops + 1);
    while (strip.children.length < padCount) {
      const s = symbols[strip.children.length % symbols.length];
      const d = document.createElement("div");
      d.className = "symbol";
      d.textContent = s.icon;
      d.dataset.id = s.id;
      strip.appendChild(d);
    }
    strip.style.transition = "none";
    strip.style.transform = `translateY(0px)`;
    void strip.offsetHeight;
    strip.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.2, 1)`;
    strip.style.transform = `translateY(-${distance}px)`;
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

function pickResult() {
  return [weightedPick(), weightedPick(), weightedPick()];
}

async function spin() {
  if (state.spinning) return;
  if (state.balance < state.bet) {
    toast("INSUFFICIENT TOKENS. Have you tried having more money?");
    return;
  }

  state.spinning = true;
  const spinBtn = document.getElementById("spin");
  spinBtn.disabled = true;
  document.getElementById("reels").classList.remove("win");

  setBalance(state.balance - state.bet, true);
  updateConfidence();

  const result = pickResult();

  const durations = [900, 1300, 1700];
  const spinPromises = state.reels.map((r, i) =>
    spinReel(r, result[i].id, durations[i])
  );
  await Promise.all(spinPromises);

  evaluate(result);

  state.spinning = false;
  spinBtn.disabled = false;
}

function evaluate(result) {
  const [a, b, c] = result;
  let win = 0;
  let msg = "";
  const reelsEl = document.getElementById("reels");

  if (a.id === b.id && b.id === c.id) {
    win = state.bet * a.mult;
    reelsEl.classList.add("win");
    if (a.id === "brain") {
      msg = `🎉 AGI JACKPOT! +${win} tokens. Singularity delayed.`;
    } else if (a.mult >= 20) {
      msg = `BIG WIN: ${a.name} × ${a.mult}! +${win} tokens.`;
    } else {
      msg = `Three ${a.name}s! +${win} tokens.`;
    }
  } else if (a.id === b.id || b.id === c.id) {
    const pair = a.id === b.id ? a : b;
    win = Math.floor(state.bet * Math.max(1, pair.mult / 4));
    msg = `Pair of ${pair.name}s. +${win}. ${randomQuip(NEAR_MISS_QUIPS)}`;
  } else {
    msg = randomQuip(LOSS_QUIPS);
  }

  if (win > 0) {
    setBalance(state.balance + win);
    toast(`${msg} ${randomQuip(WIN_QUIPS)}`, 3200);
  } else {
    toast(msg, 2600);
  }

  if (state.balance === 0) {
    setTimeout(() => {
      toast("You are bankrupt. The AI is not. Free retraining: +500 tokens.", 4000);
      setBalance(500);
    }, 1500);
  }
}

function randomQuip(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wire() {
  document.getElementById("spin").addEventListener("click", spin);
  document.getElementById("betUp").addEventListener("click", () => setBet(state.betIndex + 1));
  document.getElementById("betDown").addEventListener("click", () => setBet(state.betIndex - 1));
  document.getElementById("maxBet").addEventListener("click", () => {
    setBet(state.betOptions.length - 1);
    spin();
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      spin();
    } else if (e.key === "ArrowUp") {
      setBet(state.betIndex + 1);
    } else if (e.key === "ArrowDown") {
      setBet(state.betIndex - 1);
    }
  });
}

function init() {
  initReels();
  renderPaytable();
  setBalance(state.balance);
  setBet(state.betIndex);
  wire();
  setTimeout(() => toast("Welcome. Your tokens will now be 'optimized'.", 3000), 400);
}

init();
