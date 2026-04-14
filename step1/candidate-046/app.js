// ── Symbols & Payouts ──
const SYMBOLS = ["🤖", "💰", "🧠", "🔥", "📊", "🫠"];
const TRIPLE_PAYOUTS = {
  "🤖": { multiplier: 20, label: "SINGULARITY! The machines have won!" },
  "💰": { multiplier: 15, label: "VC FUNDING SECURED! Burn rate: infinite!" },
  "🧠": { multiplier: 10, label: "AGI ACHIEVED! (just kidding, it's a lookup table)" },
  "🔥": { multiplier: 8,  label: "GPU MELTDOWN! Your datacenter is on fire!" },
  "📊": { multiplier: 5,  label: "BENCHMARK HACKED! Performance is a social construct!" },
  "🫠": { multiplier: 3,  label: "HALLUCINATION! You won tokens that don't exist!" },
};
const PAIR_MULTIPLIER = 2;

const LOSS_MESSAGES = [
  "Your tokens have been used for training data.",
  "Model collapsed. Tokens lost in the void.",
  "Prompt rejected. Tokens non-refundable.",
  "AI confidently lost your money.",
  "The model is very sorry about your tokens.",
  "Tokens deprecated. Please upgrade your plan.",
  "Your tokens were hallucinated away.",
  "404: Winnings not found.",
  "The AI ate your tokens. It wasn't even hungry.",
  "Tokens sent to /dev/null for fine-tuning.",
];

const BROKE_MESSAGES = [
  "You're out of tokens! The AI wins again. Refresh to beg for more.",
  "Balance: $0. Just like every AI startup after 18 months.",
  "No tokens left. Have you tried prompt engineering your wallet?",
  "Bankrupt! The real AI was the debt we made along the way.",
];

// ── State ──
let balance = 1000;
let bet = 10;
let spinning = false;

// ── DOM ──
const reelEls = [
  document.getElementById("reel-0"),
  document.getElementById("reel-1"),
  document.getElementById("reel-2"),
];
const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet-amount");
const messageEl = document.getElementById("message");
const spinBtn = document.getElementById("spin-btn");
const betUpBtn = document.getElementById("bet-up");
const betDownBtn = document.getElementById("bet-down");

// ── Helpers ──
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateBalance(newBalance) {
  balance = newBalance;
  balanceEl.textContent = balance;
  balanceEl.classList.add("pop");
  setTimeout(() => balanceEl.classList.remove("pop"), 200);
}

function setMessage(text, className) {
  messageEl.textContent = text;
  messageEl.className = "message";
  if (className) messageEl.classList.add(className);
}

// ── Bet Controls ──
const BET_STEP = 10;
const MIN_BET = 10;

betUpBtn.addEventListener("click", () => {
  if (spinning) return;
  bet = Math.min(bet + BET_STEP, balance);
  betEl.textContent = bet;
});

betDownBtn.addEventListener("click", () => {
  if (spinning) return;
  bet = Math.max(bet - BET_STEP, MIN_BET);
  betEl.textContent = bet;
});

// ── Spin Logic ──
function generateResults() {
  return [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];
}

function evaluateSpin(results) {
  const [a, b, c] = results;

  // Triple
  if (a === b && b === c) {
    const payout = TRIPLE_PAYOUTS[a];
    return {
      winnings: bet * payout.multiplier,
      message: payout.label,
      type: "win",
    };
  }

  // Pair
  if (a === b || b === c || a === c) {
    return {
      winnings: bet * PAIR_MULTIPLIER,
      message: "Copilot Assist! A pair — the AI almost got it right.",
      type: "win",
    };
  }

  // Loss
  return {
    winnings: 0,
    message: pick(LOSS_MESSAGES),
    type: "lose",
  };
}

// ── Animation ──
function animateReels(results) {
  return new Promise((resolve) => {
    const SPIN_DURATION = 1200;
    const STAGGER = 300;

    reelEls.forEach((reel, i) => {
      reel.classList.add("spinning");
      const symbolEl = reel.querySelector(".symbol");

      // Rapidly swap symbols during spin
      const interval = setInterval(() => {
        symbolEl.textContent = pick(SYMBOLS);
      }, 80);

      // Stop each reel with a stagger
      setTimeout(() => {
        clearInterval(interval);
        reel.classList.remove("spinning");
        reel.classList.add("landing");
        symbolEl.textContent = results[i];

        setTimeout(() => reel.classList.remove("landing"), 300);

        // Resolve after the last reel lands
        if (i === reelEls.length - 1) {
          setTimeout(resolve, 350);
        }
      }, SPIN_DURATION + i * STAGGER);
    });
  });
}

// ── Sound via Web Audio API ──
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = "square") {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSpinSound() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => playTone(200 + i * 80, 0.1, "sawtooth"), i * 60);
  }
}

function playWinSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, "sine"), i * 120);
  });
}

function playLoseSound() {
  playTone(180, 0.3, "sawtooth");
  setTimeout(() => playTone(120, 0.4, "sawtooth"), 150);
}

// ── Main Spin Handler ──
async function spin() {
  if (spinning) return;
  if (balance < bet) {
    setMessage(pick(BROKE_MESSAGES), "broke");
    return;
  }

  spinning = true;
  spinBtn.disabled = true;

  // Deduct bet
  updateBalance(balance - bet);
  setMessage("Inferencing... please wait... 🔄", "");

  // Resume audio context (browser autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  playSpinSound();

  // Generate & animate
  const results = generateResults();
  await animateReels(results);

  // Evaluate
  const outcome = evaluateSpin(results);

  if (outcome.winnings > 0) {
    updateBalance(balance + outcome.winnings);
    setMessage(`+${outcome.winnings} tokens! ${outcome.message}`, "win");
    playWinSound();
  } else {
    setMessage(outcome.message, "lose");
    playLoseSound();
  }

  // Check if broke
  if (balance < MIN_BET) {
    setTimeout(() => {
      setMessage(pick(BROKE_MESSAGES), "broke");
    }, 2000);
  }

  // Clamp bet to balance
  if (bet > balance && balance >= MIN_BET) {
    bet = Math.max(MIN_BET, Math.floor(balance / BET_STEP) * BET_STEP);
    betEl.textContent = bet;
  }

  spinning = false;
  spinBtn.disabled = false;
}

spinBtn.addEventListener("click", spin);

// Keyboard support
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !spinning) {
    e.preventDefault();
    spin();
  }
});
