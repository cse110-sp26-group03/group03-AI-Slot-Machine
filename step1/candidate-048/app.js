// ── Symbols & their weights (higher = more common) ─────────
const SYMBOLS = [
  { emoji: "\u{1F916}", name: "Robot",         weight: 25 }, // GPT Jackpot
  { emoji: "\u{1F680}", name: "Rocket",        weight: 20 }, // To The Moon
  { emoji: "\u{1F913}", name: "Nerd",          weight: 18 }, // Nerd Bonus
  { emoji: "\u{1F4B0}", name: "Money Bag",     weight: 22 }, // VC Funding
  { emoji: "\u{1F525}", name: "Fire",          weight: 28 }, // Dumpster Fire
  { emoji: "\u26A0\uFE0F",  name: "Warning",  weight: 30 }, // Hallucination
];

// ── Payouts ─────────────────────────────────────────────────
const TRIPLE_PAYOUTS = {
  Robot:     10,
  Rocket:    8,
  Nerd:      6,
  "Money Bag": 5,
  Fire:      4,
  Warning:   3,
};
const DOUBLE_PAYOUT = 1.5;

// ── AI-themed quips ─────────────────────────────────────────
const WIN_MESSAGES = [
  "The model predicted a win! (for once)",
  "Your prompt engineering paid off!",
  "Even a broken LLM is right sometimes!",
  "Congratulations! Your tokens were well-spent!",
  "The AI overlords smile upon you!",
  "That's more tokens than GPT-4 uses per sentence!",
  "You've beaten the neural network!",
  "Hot take: you're luckier than a fine-tuned model!",
];

const LOSE_MESSAGES = [
  "Tokens burned faster than an API call to GPT-4.",
  "That's what we call a hallucinated win.",
  "The AI giveth, the AI taketh away.",
  "Your tokens have been fed to the transformer.",
  "Don't worry, OpenAI loses money on every request too.",
  "Error 402: Payment required. Oh wait, we already took it.",
  "Training data suggests you should try again.",
  "Loss function minimized... your wallet.",
  "The attention mechanism was not paying attention.",
  "Looks like your luck needs more RLHF.",
];

const BROKE_MESSAGES = [
  "Context window exceeded. No tokens remaining.",
  "You've reached your rate limit. Come back never.",
  "All tokens have been consumed. Just like a real AI API!",
  "Bankrupt! At least you didn't spend $100M training a model.",
];

// ── State ───────────────────────────────────────────────────
let balance = 1000;
let bet = 50;
let spinning = false;
const BET_STEP = 25;
const MIN_BET = 25;

// ── DOM refs ────────────────────────────────────────────────
const balanceEl  = document.getElementById("balance");
const betAmountEl = document.getElementById("bet-amount");
const spinBtn    = document.getElementById("spin-btn");
const messageEl  = document.getElementById("message");
const reelEls    = [
  document.getElementById("reel0"),
  document.getElementById("reel1"),
  document.getElementById("reel2"),
];

// ── Weighted random pick ────────────────────────────────────
function pickSymbol() {
  const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Update UI helpers ───────────────────────────────────────
function updateBalance() {
  balanceEl.textContent = balance;
}

function updateBet() {
  betAmountEl.textContent = bet;
}

function showMessage(text, cls) {
  messageEl.textContent = text;
  messageEl.className = "message " + cls;
}

// ── Bet controls ────────────────────────────────────────────
document.getElementById("bet-down").addEventListener("click", () => {
  if (spinning) return;
  bet = Math.max(MIN_BET, bet - BET_STEP);
  updateBet();
});

document.getElementById("bet-up").addEventListener("click", () => {
  if (spinning) return;
  bet = Math.min(balance, bet + BET_STEP);
  updateBet();
});

// ── Confetti burst ──────────────────────────────────────────
function spawnConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const colors = ["#ffd700", "#00d4ff", "#ff6b6b", "#50fa7b", "#ff79c6", "#bd93f9"];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.top = -10 + "px";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.style.animationDuration = 1 + Math.random() * 1.5 + "s";
    canvas.appendChild(piece);
  }
  setTimeout(() => { canvas.innerHTML = ""; }, 2500);
}

// ── Core spin logic ─────────────────────────────────────────
function spin() {
  if (spinning) return;
  if (balance <= 0) {
    showMessage(randomFrom(BROKE_MESSAGES), "broke");
    return;
  }
  if (bet > balance) {
    bet = balance;
    updateBet();
  }

  spinning = true;
  spinBtn.disabled = true;
  balance -= bet;
  updateBalance();
  messageEl.textContent = "";
  messageEl.className = "message";

  // Clear previous winner highlights
  reelEls.forEach((r) => r.classList.remove("winner"));

  // Pick results ahead of time
  const results = [pickSymbol(), pickSymbol(), pickSymbol()];

  // Start spinning animation on all reels
  reelEls.forEach((reel) => reel.classList.add("spinning"));

  // Rapidly cycle random symbols during spin
  const intervalIds = reelEls.map((reel) => {
    return setInterval(() => {
      const sym = pickSymbol();
      reel.querySelector(".symbol").textContent = sym.emoji;
    }, 70);
  });

  // Stop each reel with a staggered delay
  const delays = [600, 1100, 1600];
  reelEls.forEach((reel, i) => {
    setTimeout(() => {
      clearInterval(intervalIds[i]);
      reel.classList.remove("spinning");
      reel.querySelector(".symbol").textContent = results[i].emoji;

      // Play a click sound via Web Audio API
      playClick();
    }, delays[i]);
  });

  // Evaluate after all reels stop
  setTimeout(() => {
    evaluate(results);
    spinning = false;
    spinBtn.disabled = balance <= 0;
  }, delays[2] + 100);
}

// ── Evaluate results ────────────────────────────────────────
function evaluate(results) {
  const [a, b, c] = results.map((r) => r.name);

  // Triple match
  if (a === b && b === c) {
    const multiplier = TRIPLE_PAYOUTS[a];
    const winnings = Math.floor(bet * multiplier);
    balance += winnings;
    updateBalance();
    reelEls.forEach((r) => r.classList.add("winner"));
    showMessage(
      `${results[0].emoji} TRIPLE! +${winnings} tokens! ${randomFrom(WIN_MESSAGES)}`,
      "win"
    );
    spawnConfetti();
    return;
  }

  // Double match
  if (a === b || b === c || a === c) {
    const winnings = Math.floor(bet * DOUBLE_PAYOUT);
    balance += winnings;
    updateBalance();

    // Highlight matching reels
    if (a === b) { reelEls[0].classList.add("winner"); reelEls[1].classList.add("winner"); }
    if (b === c) { reelEls[1].classList.add("winner"); reelEls[2].classList.add("winner"); }
    if (a === c) { reelEls[0].classList.add("winner"); reelEls[2].classList.add("winner"); }

    showMessage(
      `Partial match! +${winnings} tokens. ${randomFrom(WIN_MESSAGES)}`,
      "win"
    );
    return;
  }

  // No match
  showMessage(randomFrom(LOSE_MESSAGES), "lose");
  document.querySelector(".machine").classList.add("shake");
  setTimeout(() => {
    document.querySelector(".machine").classList.remove("shake");
  }, 500);

  // Check if broke
  if (balance <= 0) {
    setTimeout(() => showMessage(randomFrom(BROKE_MESSAGES), "broke"), 1200);
  }
}

// ── Simple click sound via Web Audio API ────────────────────
let audioCtx = null;
function playClick() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 600 + Math.random() * 400;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

// ── Event listeners ─────────────────────────────────────────
spinBtn.addEventListener("click", spin);

// Keyboard: space or Enter to spin
document.addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "Enter") && e.target === document.body) {
    e.preventDefault();
    spin();
  }
});

// ── Init ────────────────────────────────────────────────────
updateBalance();
updateBet();
showMessage("Feed your tokens to the machine. Press SPIN!", "info");
