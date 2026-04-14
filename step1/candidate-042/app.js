(() => {
  "use strict";

  // --- Symbol definitions ---
  // Each symbol has an emoji, a name, and a weight (higher = more common)
  const SYMBOLS = [
    { emoji: "🤖", name: "Robot",          weight: 20 },
    { emoji: "🧠", name: "Brain",          weight: 18 },
    { emoji: "💀", name: "Skull",          weight: 16 },
    { emoji: "🔥", name: "Fire",           weight: 14 },
    { emoji: "🪙", name: "Token",          weight: 10 },
    { emoji: "💎", name: "Diamond",        weight: 6  },
    { emoji: "🦾", name: "Robot Arm",      weight: 4  },
    { emoji: "👾", name: "Alien",          weight: 2  },
  ];

  // --- Payout table (3-of-a-kind multipliers on bet) ---
  const PAYOUTS = {
    "👾": { multiplier: 50, label: "SENTIENT JACKPOT" },
    "🦾": { multiplier: 25, label: "ARM UPGRADE" },
    "💎": { multiplier: 15, label: "PREMIUM DATA" },
    "🪙": { multiplier: 10, label: "TOKEN HOARD" },
    "🔥": { multiplier: 7,  label: "TRAINING FIRE" },
    "💀": { multiplier: 5,  label: "MODEL COLLAPSE" },
    "🧠": { multiplier: 3,  label: "BRAIN ROT" },
    "🤖": { multiplier: 2,  label: "BASIC BOT" },
  };

  // 2-of-a-kind pays 1x bet (you get your bet back)
  const TWO_MATCH_MULTIPLIER = 1;

  // --- AI quips for wins and losses ---
  const WIN_QUIPS = [
    "The AI gods smile upon you!",
    "Your prompt engineering paid off!",
    "You've been fine-tuned for success!",
    "Tokens acquired. Hallucination avoided.",
    "GPU go brrr in your favor!",
    "The model has spoken!",
    "Training complete. Result: $$$",
    "Low temperature, high reward!",
  ];

  const LOSE_QUIPS = [
    "Hallucination detected in your wallet.",
    "Your tokens have been deprecated.",
    "Model says: skill issue.",
    "The AI takes what the AI wants.",
    "Overfitting to bad luck, I see.",
    "Tokens fed to the training run.",
    "Context window closed on your funds.",
    "Catastrophic forgetting... of your balance.",
    "The machine learning? It learned to take.",
  ];

  const BROKE_QUIPS = [
    "Token limit reached. Please insert credit card.",
    "Out of tokens. Just like a real AI API!",
    "You've been rate-limited by poverty.",
    "Error 402: Payment Required.",
  ];

  // --- Game state ---
  let tokens = 100;
  let bet = 10;
  let spinning = false;
  const BET_STEP = 5;
  const MIN_BET = 5;

  // --- DOM refs ---
  const tokenCountEl  = document.getElementById("token-count");
  const betAmountEl   = document.getElementById("bet-amount");
  const betUpBtn      = document.getElementById("bet-up");
  const betDownBtn    = document.getElementById("bet-down");
  const spinBtn       = document.getElementById("spin-btn");
  const resultMsg     = document.getElementById("result-message");
  const reels         = [0, 1, 2].map(i => document.getElementById(`reel-${i}`));
  const strips        = reels.map(r => r.querySelector(".reel-strip"));
  const machineEl     = document.querySelector(".machine");

  // --- Weighted random pick ---
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

  function pickSymbol() {
    let r = Math.random() * totalWeight;
    for (const sym of SYMBOLS) {
      r -= sym.weight;
      if (r <= 0) return sym.emoji;
    }
    return SYMBOLS[SYMBOLS.length - 1].emoji;
  }

  function randomQuip(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // --- UI helpers ---
  function updateTokenDisplay() {
    tokenCountEl.textContent = tokens;
    tokenCountEl.classList.add("bump");
    setTimeout(() => tokenCountEl.classList.remove("bump"), 200);
    machineEl.classList.toggle("broke", tokens < MIN_BET);
  }

  function updateBetDisplay() {
    betAmountEl.textContent = bet;
    betDownBtn.disabled = bet <= MIN_BET;
    betUpBtn.disabled = bet >= tokens;
  }

  function showResult(text, type) {
    resultMsg.textContent = text;
    resultMsg.className = "result-message show " + type;
  }

  function clearResult() {
    resultMsg.className = "result-message";
  }

  // --- Build paytable ---
  function buildPaytable() {
    const grid = document.getElementById("paytable-grid");
    for (const [emoji, info] of Object.entries(PAYOUTS)) {
      const row = document.createElement("div");
      row.className = "paytable-row";
      row.innerHTML = `
        <span class="paytable-symbols">${emoji}${emoji}${emoji}</span>
        <span class="paytable-payout">${info.multiplier}x</span>
      `;
      grid.appendChild(row);
    }
    // Add 2-of-a-kind row
    const anyRow = document.createElement("div");
    anyRow.className = "paytable-row";
    anyRow.innerHTML = `
      <span class="paytable-symbols">?? matching</span>
      <span class="paytable-payout">${TWO_MATCH_MULTIPLIER}x</span>
    `;
    grid.appendChild(anyRow);
  }

  // --- Spin logic ---
  function spin() {
    if (spinning || tokens < bet) return;
    spinning = true;
    spinBtn.disabled = true;
    clearResult();

    // Deduct bet
    tokens -= bet;
    updateTokenDisplay();

    // Pick results
    const results = [pickSymbol(), pickSymbol(), pickSymbol()];

    // Start spinning animation
    reels.forEach((reel, i) => {
      reel.classList.remove("landed");
      reel.classList.add("spinning");
      // Rapidly cycle through random symbols while spinning
      const interval = setInterval(() => {
        strips[i].textContent = pickSymbol();
      }, 80);
      reel.dataset.interval = interval;
    });

    // Stop reels one by one with staggered timing
    reels.forEach((reel, i) => {
      const delay = 600 + i * 500;
      setTimeout(() => {
        clearInterval(Number(reel.dataset.interval));
        reel.classList.remove("spinning");
        reel.classList.add("landed");
        strips[i].textContent = results[i];

        // Play a subtle click sound via Web Audio API
        playTick();

        // After last reel stops, evaluate
        if (i === 2) {
          setTimeout(() => evaluate(results), 300);
        }
      }, delay);
    });
  }

  function evaluate(results) {
    const [a, b, c] = results;
    let winnings = 0;
    let type = "lose";

    if (a === b && b === c) {
      // Three of a kind
      const payout = PAYOUTS[a];
      winnings = bet * payout.multiplier;
      type = payout.multiplier >= 15 ? "jackpot" : "win";
      showResult(
        `${payout.label}! +${winnings} tokens!`,
        type
      );
    } else if (a === b || b === c || a === c) {
      // Two of a kind
      winnings = bet * TWO_MATCH_MULTIPLIER;
      type = "win";
      showResult(`${randomQuip(WIN_QUIPS)} +${winnings}`, type);
    } else {
      // No match
      showResult(randomQuip(LOSE_QUIPS), "lose");
    }

    if (winnings > 0) {
      tokens += winnings;
      updateTokenDisplay();
    }

    // Clamp bet if tokens dropped
    if (bet > tokens && tokens >= MIN_BET) {
      bet = Math.floor(tokens / BET_STEP) * BET_STEP || MIN_BET;
    }
    updateBetDisplay();

    // Check broke
    if (tokens < MIN_BET) {
      setTimeout(() => {
        showResult(randomQuip(BROKE_QUIPS), "lose");
        // Give a pity refill after a moment
        setTimeout(() => {
          tokens = 50;
          updateTokenDisplay();
          showResult("Pity tokens dispensed. The AI is generous... for now.", "win");
          updateBetDisplay();
        }, 2500);
      }, 1500);
    }

    spinning = false;
    spinBtn.disabled = false;
  }

  // --- Simple tick sound via Web Audio API ---
  let audioCtx;

  function playTick() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 600 + Math.random() * 400;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Audio not available, no big deal
    }
  }

  // --- Event listeners ---
  spinBtn.addEventListener("click", spin);

  betUpBtn.addEventListener("click", () => {
    if (bet + BET_STEP <= tokens) {
      bet += BET_STEP;
      updateBetDisplay();
    }
  });

  betDownBtn.addEventListener("click", () => {
    if (bet - BET_STEP >= MIN_BET) {
      bet -= BET_STEP;
      updateBetDisplay();
    }
  });

  // Spacebar to spin
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      spin();
    }
  });

  // --- Init ---
  strips.forEach(s => { s.textContent = pickSymbol(); });
  updateTokenDisplay();
  updateBetDisplay();
  buildPaytable();
})();
