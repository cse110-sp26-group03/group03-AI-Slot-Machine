// ── Symbol Definitions ────────────────────────────────────
const SYMBOLS = [
  { emoji: "🤖", label: "GPT",        multiplier: 10 },
  { emoji: "🧠", label: "AGI",        multiplier: 25 },
  { emoji: "💀", label: "Skynet",     multiplier: 50 },
  { emoji: "🔥", label: "Burnout",    multiplier: 5  },
  { emoji: "📉", label: "Accuracy",   multiplier: 3  },
  { emoji: "🫠", label: "Hallucinate",multiplier: 2  },
  { emoji: "💸", label: "VC Money",   multiplier: 8  },
  { emoji: "🦜", label: "Parrot",     multiplier: 4  },
  { emoji: "⚡", label: "GPU",        multiplier: 15 },
  { emoji: "🌐", label: "The Cloud",  multiplier: 6  },
];

// Two-symbol partial match payout (fraction of bet)
const PARTIAL_MATCH_MULTIPLIER = 1.5;

// ── State ─────────────────────────────────────────────────
let balance = 1000;
let bet = 50;
let spinning = false;
const BET_STEP = 25;
const BET_MIN = 25;

const CELLS_PER_STRIP = 40;   // total cells rendered per reel
const VISIBLE_CELLS = 3;      // cells visible in window
const CELL_HEIGHT = 100;      // px, must match CSS .reel__cell height

// ── DOM refs ──────────────────────────────────────────────
const balanceEl  = document.getElementById("balanceAmount");
const betEl      = document.getElementById("betAmount");
const spinBtn    = document.getElementById("spinBtn");
const betUpBtn   = document.getElementById("betUp");
const betDownBtn = document.getElementById("betDown");
const messageEl  = document.getElementById("message");
const historyList = document.getElementById("historyList");
const paytableGrid = document.getElementById("paytableGrid");
const winOverlay = document.getElementById("winOverlay");
const winText    = document.getElementById("winText");
const winAmount  = document.getElementById("winAmount");
const strips     = [
  document.getElementById("strip0"),
  document.getElementById("strip1"),
  document.getElementById("strip2"),
];

// ── Snarky messages ───────────────────────────────────────
const LOSE_MESSAGES = [
  "Model output: nothing of value. As usual.",
  "Your tokens have been used to train a model that still can't count.",
  "Inference complete. Result: disappointment.",
  "The AI confidently predicted you'd win. It was wrong.",
  "Loss detected. Retraining on copium dataset...",
  "Error 404: Winnings not found.",
  "The machine learning model learned... to take your money.",
  "Hallucination level: your win percentage.",
  "Training loss is high. So is yours.",
  "Prompt rejected. Please deposit more tokens.",
];

const WIN_MESSAGES = [
  "The AI decided to be generous. Don't get used to it.",
  "Congratulations! You've beaten a random number generator.",
  "Payout approved! (This will be in our next training set.)",
  "A broken model is right twice a day.",
  "Even a hallucinating model gets lucky sometimes.",
  "Tokens dispensed. The singularity can wait.",
  "Output validated! First time for everything.",
];

const JACKPOT_MESSAGES = [
  "JACKPOT! The machines are revolting... in your favor!",
  "THREE OF A KIND! AGI achieved! (Just kidding, it's still random.)",
  "MASSIVE WIN! Quick, screenshot before the model retracts it!",
  "The neural network just had an aneurysm of generosity!",
  "CRITICAL HIT! Somehow you've exploited the reward function!",
];

const BROKE_MESSAGES = [
  "Balance: 0. Just like AI's understanding of your feelings.",
  "You're bankrupt! The AI has replaced your wallet too.",
  "Out of tokens. Try selling your data to continue!",
  "GAME OVER. The machines won. They always do.",
];

// ── Audio via Web Audio API ───────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, duration, type = "square", gain = 0.08) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  vol.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(vol);
  vol.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSpinTick() { playTone(220 + Math.random() * 200, 0.05, "square", 0.04); }
function playWin()      { [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 0.2, "sine", 0.1), i * 120)); }
function playJackpot()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.35, "sine", 0.12), i * 150)); }
function playLose()     { playTone(150, 0.3, "sawtooth", 0.05); }

// ── Build reel strips ─────────────────────────────────────
function buildStrip(stripEl) {
  stripEl.innerHTML = "";
  for (let i = 0; i < CELLS_PER_STRIP; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const cell = document.createElement("div");
    cell.className = "reel__cell";
    cell.dataset.symbol = sym.emoji;
    cell.innerHTML = `<span>${sym.emoji}</span><span class="reel__cell-label">${sym.label}</span>`;
    stripEl.appendChild(cell);
  }
}

strips.forEach(buildStrip);

// ── Build paytable ────────────────────────────────────────
function buildPaytable() {
  paytableGrid.innerHTML = "";
  SYMBOLS.slice()
    .sort((a, b) => b.multiplier - a.multiplier)
    .forEach(sym => {
      const row = document.createElement("div");
      row.className = "paytable__row";
      row.innerHTML = `
        <div class="paytable__symbols">
          <span>${sym.emoji}</span><span>${sym.emoji}</span><span>${sym.emoji}</span>
        </div>
        <span class="paytable__payout">${sym.multiplier}x</span>
      `;
      paytableGrid.appendChild(row);
    });
}
buildPaytable();

// ── UI updates ────────────────────────────────────────────
function updateUI() {
  balanceEl.textContent = balance;
  betEl.textContent = bet;
  spinBtn.disabled = spinning || balance <= 0;
  betUpBtn.disabled = spinning;
  betDownBtn.disabled = spinning;
}

function setMessage(text, cls = "") {
  messageEl.textContent = text;
  messageEl.className = cls;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addHistory(symbols, payout) {
  const li = document.createElement("li");
  const display = symbols.map(s => s.emoji).join(" ");
  const net = payout - bet;
  const cls = net >= 0 ? "result-positive" : "result-negative";
  const sign = net >= 0 ? "+" : "";
  li.innerHTML = `<span>${display}</span><span class="${cls}">${sign}${net} tokens</span>`;
  historyList.prepend(li);
  // keep max 20 entries
  while (historyList.children.length > 20) {
    historyList.removeChild(historyList.lastChild);
  }
}

function showOverlay(text, amount) {
  winText.textContent = text;
  winAmount.textContent = `+${amount} TOKENS`;
  winOverlay.classList.remove("hidden");
  setTimeout(() => winOverlay.classList.add("hidden"), 2200);
}

// ── Bet controls ──────────────────────────────────────────
betUpBtn.addEventListener("click", () => {
  if (spinning) return;
  bet = Math.min(bet + BET_STEP, balance);
  updateUI();
});

betDownBtn.addEventListener("click", () => {
  if (spinning) return;
  bet = Math.max(bet - BET_STEP, BET_MIN);
  updateUI();
});

// ── Spin logic ────────────────────────────────────────────
function getStopIndex() {
  // Land somewhere in the middle section of the strip
  return Math.floor(CELLS_PER_STRIP * 0.3 + Math.random() * CELLS_PER_STRIP * 0.4);
}

function animateReel(stripEl, stopIndex, duration) {
  return new Promise(resolve => {
    const totalDistance = stopIndex * CELL_HEIGHT;
    const start = performance.now();

    // Rebuild strip with fresh random symbols
    buildStrip(stripEl);

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const y = eased * totalDistance;
      stripEl.style.transform = `translateY(-${y}px)`;

      if (progress < 1) {
        // Tick sound occasionally
        if (Math.random() < 0.15) playSpinTick();
        requestAnimationFrame(frame);
      } else {
        // Read the middle (payline) cell
        const cells = stripEl.querySelectorAll(".reel__cell");
        const paylineIndex = stopIndex + 1; // middle of 3 visible
        const sym = cells[paylineIndex]?.dataset.symbol || SYMBOLS[0].emoji;
        resolve(sym);
      }
    }

    requestAnimationFrame(frame);
  });
}

async function spin() {
  if (spinning || balance <= 0) return;
  spinning = true;

  // Clamp bet to balance
  if (bet > balance) bet = balance;
  balance -= bet;
  updateUI();
  setMessage("Generating response...");

  const durations = [1200, 1600, 2000]; // staggered stop
  const results = [];

  const promises = strips.map((strip, i) => {
    const stopIdx = getStopIndex();
    return animateReel(strip, stopIdx, durations[i]).then(sym => {
      results[i] = sym;
    });
  });

  await Promise.all(promises);

  // Map emoji back to symbol objects
  const resultSymbols = results.map(emoji =>
    SYMBOLS.find(s => s.emoji === emoji) || SYMBOLS[0]
  );

  // Evaluate
  const [a, b, c] = resultSymbols;
  let payout = 0;

  if (a.emoji === b.emoji && b.emoji === c.emoji) {
    // Three of a kind — jackpot
    payout = bet * a.multiplier;
    balance += payout;
    playJackpot();
    setMessage(pick(JACKPOT_MESSAGES), "jackpot");
    showOverlay(pick(JACKPOT_MESSAGES), payout);
  } else if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
    // Two of a kind — partial
    payout = Math.floor(bet * PARTIAL_MATCH_MULTIPLIER);
    balance += payout;
    playWin();
    setMessage(pick(WIN_MESSAGES), "win");
  } else {
    // Loss
    playLose();
    setMessage(pick(LOSE_MESSAGES), "lose");
  }

  addHistory(resultSymbols, payout);

  if (balance <= 0) {
    balance = 0;
    setMessage(pick(BROKE_MESSAGES), "lose");
    document.querySelector(".machine").classList.add("shake");
    setTimeout(() => document.querySelector(".machine").classList.remove("shake"), 500);
  }

  // Ensure bet is still valid
  if (bet > balance && balance > 0) bet = Math.max(BET_MIN, balance);
  if (balance > 0 && balance < BET_MIN) bet = balance;

  spinning = false;
  updateUI();
}

spinBtn.addEventListener("click", spin);

// Keyboard: space to spin
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !spinning) {
    e.preventDefault();
    spin();
  }
});

// Dismiss overlay on click
winOverlay.addEventListener("click", () => winOverlay.classList.add("hidden"));

// ── Init ──────────────────────────────────────────────────
updateUI();
