/** AI Slot Machine */

const SYMBOLS = [
  { emoji: "\u{1F916}", name: "Robot", multiplier: 10 },
  { emoji: "\u{1F9E0}", name: "Brain", multiplier: 8 },
  { emoji: "\u{1F4A1}", name: "Lightbulb", multiplier: 6 },
  { emoji: "\u26A1",     name: "Zap", multiplier: 5 },
  { emoji: "\u{1F525}", name: "Fire", multiplier: 4 },
  { emoji: "\u{1F4B8}", name: "Money Wings", multiplier: 3 },
];

const WIN_MESSAGES = [
  "The AI has blessed you with tokens!",
  "GPT is jealous of your luck.",
  "Training data says you're a winner!",
  "You've been promoted to Senior Prompt Engineer!",
  "The model hallucinated... in your favor!",
  "Congratulations! Your inference was correct!",
  "Token generation at an all-time high!",
];

const LOSE_MESSAGES = [
  "Tokens burned. Just like GPU cycles.",
  "The model confidently predicted... wrong.",
  "Your prompt was rejected by the safety filter.",
  "Error 429: Too many losing requests.",
  "That's what you get for not fine-tuning.",
  "Even reinforcement learning gave up on you.",
  "Output: sadness. Temperature: absolute zero.",
  "Your tokens have been donated to cloud computing.",
  "The AI trained on your misfortune.",
];

const PAIR_MESSAGES = [
  "Almost sentient! A pair pays 1x.",
  "Two out of three — like most AI accuracy claims.",
  "Partial match. Like AI-generated hands.",
];

const BROKE_MESSAGES = [
  "You've run out of tokens. Just like a free-tier API key.",
  "Token balance: 0. Time to write a grant proposal.",
  "Out of tokens! Have you tried prompt engineering your wallet?",
  "Bankrupt. Even blockchain bros feel sorry for you.",
];

/* ---- State ---- */
let tokens = 100;
let bet = 10;
let spinning = false;
const BET_STEP = 5;
const MIN_BET = 5;

/* ---- DOM refs ---- */
const tokenCountEl = document.getElementById("token-count");
const betAmountEl = document.getElementById("bet-amount");
const spinBtn = document.getElementById("spin-btn");
const betUpBtn = document.getElementById("bet-up");
const betDownBtn = document.getElementById("bet-down");
const resultEl = document.getElementById("result-message");
const reelEls = [
  document.getElementById("reel-0"),
  document.getElementById("reel-1"),
  document.getElementById("reel-2"),
];
const reelWindows = document.querySelectorAll(".reel-window");
const machine = document.querySelector(".machine");

/* ---- Helpers ---- */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateDisplay() {
  tokenCountEl.textContent = tokens;
  tokenCountEl.classList.toggle("low", tokens <= 20);
  betAmountEl.textContent = bet;
  betDownBtn.disabled = bet <= MIN_BET;
  spinBtn.disabled = tokens < bet;
}

function showMessage(text, cls) {
  resultEl.textContent = text;
  resultEl.className = "result-message " + cls;
}

function clearWinGlow() {
  reelWindows.forEach((w) => w.classList.remove("win-glow"));
}

/* ---- Spinning logic ---- */
function spinReels() {
  if (spinning || tokens < bet) return;
  spinning = true;
  spinBtn.disabled = true;
  clearWinGlow();
  resultEl.textContent = "";
  resultEl.className = "result-message";

  // Deduct bet
  tokens -= bet;
  updateDisplay();

  // Pick results
  const results = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];

  // Animate each reel with staggered stops
  const SPIN_DURATION_BASE = 600;
  const SPIN_STAGGER = 400;

  reelWindows.forEach((w, i) => {
    w.classList.add("spinning");

    // Rapidly cycle symbols during spin
    const interval = setInterval(() => {
      reelEls[i].querySelector(".symbol").textContent = pick(SYMBOLS).emoji;
    }, 70);

    const stopTime = SPIN_DURATION_BASE + i * SPIN_STAGGER;

    setTimeout(() => {
      clearInterval(interval);
      w.classList.remove("spinning");
      w.classList.add("landing");
      reelEls[i].querySelector(".symbol").textContent = results[i].emoji;

      setTimeout(() => w.classList.remove("landing"), 300);

      // After last reel stops, evaluate
      if (i === 2) {
        setTimeout(() => evaluateResult(results), 200);
      }
    }, stopTime);
  });
}

function evaluateResult(results) {
  const [a, b, c] = results;

  if (a.name === b.name && b.name === c.name) {
    // Three of a kind
    const winnings = bet * a.multiplier;
    tokens += winnings;
    showMessage(
      `${pick(WIN_MESSAGES)} (+${winnings} tokens)`,
      "win"
    );
    reelWindows.forEach((w) => w.classList.add("win-glow"));
  } else if (a.name === b.name || b.name === c.name || a.name === c.name) {
    // Pair
    const winnings = bet;
    tokens += winnings;
    showMessage(`${pick(PAIR_MESSAGES)} (+${winnings})`, "win");
  } else {
    // Loss
    showMessage(pick(LOSE_MESSAGES), "lose");
    machine.classList.add("shake");
    setTimeout(() => machine.classList.remove("shake"), 400);
  }

  // Check if broke
  if (tokens <= 0) {
    tokens = 0;
    showMessage(pick(BROKE_MESSAGES), "broke");
    // Give a pity refill after a moment
    setTimeout(() => {
      tokens = 50;
      updateDisplay();
      showMessage(
        "An anonymous AI benefactor gave you 50 pity tokens.",
        "win"
      );
    }, 2500);
  }

  // Clamp bet to available tokens
  if (bet > tokens && tokens > 0) {
    bet = Math.max(MIN_BET, Math.floor(tokens / BET_STEP) * BET_STEP);
    if (bet > tokens) bet = MIN_BET;
  }

  updateDisplay();
  spinning = false;
}

/* ---- Event listeners ---- */
spinBtn.addEventListener("click", spinReels);

betUpBtn.addEventListener("click", () => {
  if (bet + BET_STEP <= tokens) {
    bet += BET_STEP;
    updateDisplay();
  }
});

betDownBtn.addEventListener("click", () => {
  if (bet - BET_STEP >= MIN_BET) {
    bet -= BET_STEP;
    updateDisplay();
  }
});

// Keyboard: space to spin
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !spinning) {
    e.preventDefault();
    spinReels();
  }
});

/* ---- Init ---- */
updateDisplay();
