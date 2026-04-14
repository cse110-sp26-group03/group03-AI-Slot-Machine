// ── Symbols & payouts ────────────────────────────────
const SYMBOLS = ["🤖", "🧠", "🔥", "💬", "⚡", "💀", "🎰"];

const TRIPLE_PAYOUTS = {
  "🤖": 12,
  "🧠": 8,
  "🔥": 6,
  "💬": 5,
  "⚡": 4,
  "💀": 3,
  "🎰": 10,
};

const PAIR_MULTIPLIER = 1.5;

const TRIPLE_NAMES = {
  "🤖": "Singularity Achieved!",
  "🧠": "Emergent Reasoning!",
  "🔥": "GPU Thermal Event!",
  "💬": "Prompt Leak Detected!",
  "⚡": "Rate Limit Surge!",
  "💀": "Model Collapse!",
  "🎰": "Jackpot Hallucination!",
};

const LOSS_QUIPS = [
  "Tokens vaporized. The model says you're welcome.",
  "That inference cost you dearly.",
  "The AI giveth nothing and taketh your tokens.",
  "Your prompt was rejected by the universe.",
  "Training data suggests you should stop.",
  "Context window: wasted.",
  "The attention mechanism ignored you.",
  "Gradient descent into poverty.",
  "Your tokens have been fine-tuned into oblivion.",
  "Loss function: yours.",
];

const WIN_QUIPS = [
  "The model hallucinated in your favor!",
  "Tokens generated from the latent space!",
  "You've been positively reinforced!",
  "Reward model approves this outcome!",
  "Your alignment paid off!",
  "RLHF smiles upon you!",
  "The weights were in your favor!",
];

// ── State ────────────────────────────────────────────
const BET_STEPS = [10, 25, 50, 100, 250];
let betIndex = 2; // starts at 50
let balance = 1000;
let spinning = false;

// ── DOM refs ─────────────────────────────────────────
const balanceEl = document.getElementById("balance");
const costEl = document.getElementById("cost-display");
const betChip = document.getElementById("bet-chip");
const spinBtn = document.getElementById("spin");
const banner = document.getElementById("result-banner");
const tickerText = document.getElementById("ticker-text");
const reelEls = [0, 1, 2].map((i) => document.getElementById(`reel-${i}`));
const reelFrames = reelEls.map((el) => el.parentElement);

// ── Helpers ──────────────────────────────────────────
function currentBet() {
  return BET_STEPS[betIndex];
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateUI() {
  balanceEl.textContent = balance;
  const bet = currentBet();
  costEl.textContent = bet;
  betChip.textContent = bet;
  spinBtn.disabled = balance < bet;
}

function showBanner(text, isWin) {
  banner.textContent = text;
  banner.className = `result-banner ${isWin ? "win" : "lose"}`;
}

function hideBanner() {
  banner.className = "result-banner hidden";
}

function setTicker(msg) {
  tickerText.textContent = msg;
}

// ── Build reel strips ────────────────────────────────
// Each reel has a long virtual strip of symbols for animation
const REEL_LENGTH = 40;

function buildStrip(reelEl) {
  reelEl.innerHTML = "";
  for (let i = 0; i < REEL_LENGTH; i++) {
    const div = document.createElement("div");
    div.className = "reel-symbol";
    div.textContent = randomSymbol();
    reelEl.appendChild(div);
  }
}

function initReels() {
  reelEls.forEach((el) => {
    buildStrip(el);
    // Show first symbol centered
    el.style.transform = "translateY(0px)";
  });
}

// ── Reel height (matches CSS) ────────────────────────
function symbolHeight() {
  return reelFrames[0].clientHeight;
}

// ── Spin logic ───────────────────────────────────────
function spin() {
  if (spinning) return;
  const bet = currentBet();
  if (balance < bet) return;

  spinning = true;
  balance -= bet;
  updateUI();
  hideBanner();
  spinBtn.disabled = true;

  // Remove prior winner highlights
  reelFrames.forEach((f) => f.classList.remove("winner"));

  // Pick final symbols
  const results = [randomSymbol(), randomSymbol(), randomSymbol()];

  // Rebuild strips with chosen results at target positions
  const stopPositions = [22, 26, 30]; // staggered stops
  reelEls.forEach((el, i) => {
    buildStrip(el);
    // Place the result symbol at the stop position
    el.children[stopPositions[i]].textContent = results[i];
    el.style.transform = "translateY(0px)";
    reelFrames[i].classList.add("spinning");
  });

  const h = symbolHeight();
  let settled = 0;

  reelEls.forEach((el, i) => {
    const target = stopPositions[i];
    const totalDist = target * h;
    const duration = 1200 + i * 400; // stagger: 1.2s, 1.6s, 2.0s
    let start = null;

    function animate(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const y = ease * totalDist;
      el.style.transform = `translateY(-${y}px)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        reelFrames[i].classList.remove("spinning");
        settled++;
        if (settled === 3) {
          resolve(results, bet);
        }
      }
    }

    requestAnimationFrame(animate);
  });
}

// ── Resolve outcome ──────────────────────────────────
function resolve(results, bet) {
  const [a, b, c] = results;
  let payout = 0;
  let msg = "";

  if (a === b && b === c) {
    // Triple
    const mult = TRIPLE_PAYOUTS[a] || 3;
    payout = bet * mult;
    msg = `${TRIPLE_NAMES[a] || "Triple!"} Won ${payout} tokens!`;
    reelFrames.forEach((f) => f.classList.add("winner"));
  } else if (a === b || b === c || a === c) {
    // Pair
    payout = Math.floor(bet * PAIR_MULTIPLIER);
    msg = `Pair matched! Won ${payout} tokens.`;
  }

  if (payout > 0) {
    balance += payout;
    showBanner(msg, true);
    setTicker(pick(WIN_QUIPS));
  } else {
    showBanner(`−${bet} tokens`, false);
    setTicker(pick(LOSS_QUIPS));
  }

  updateUI();
  spinning = false;

  if (balance <= 0) {
    setTicker("All tokens burned. The model has consumed you. Refresh to try again.");
    spinBtn.disabled = true;
  }
}

// ── Bet controls ─────────────────────────────────────
document.getElementById("bet-down").addEventListener("click", () => {
  if (betIndex > 0) {
    betIndex--;
    updateUI();
  }
});

document.getElementById("bet-up").addEventListener("click", () => {
  if (betIndex < BET_STEPS.length - 1) {
    betIndex++;
    updateUI();
  }
});

// ── Spin trigger ─────────────────────────────────────
spinBtn.addEventListener("click", spin);

// Keyboard: spacebar to spin
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    spin();
  }
});

// ── Init ─────────────────────────────────────────────
initReels();
updateUI();
