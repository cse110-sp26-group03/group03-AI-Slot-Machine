(function () {
  "use strict";

  // --- Symbols & payouts ---
  const SYMBOLS = ["🤖", "🧠", "💰", "🔥", "📊", "💀"];
  const TRIPLE_PAYOUTS = {
    "🤖": 10,
    "🧠": 8,
    "💰": 6,
    "🔥": 5,
    "📊": 4,
    "💀": 3,
  };
  const PAIR_PAYOUT = 1; // break even

  // --- AI-themed flavor text ---
  const WIN_MESSAGES = [
    "The model hallucinated in your favor!",
    "Congratulations, you beat the transformer!",
    "Your prompt engineering paid off!",
    "The AI decided you deserve tokens... for now.",
    "Training data suggests you're lucky!",
    "Even GPT couldn't predict this win!",
    "You've been fine-tuned for success!",
    "The attention mechanism focused on YOUR wallet!",
  ];

  const LOSE_MESSAGES = [
    "Tokens burned. Training the model was expensive anyway.",
    "Your tokens have been used for inference. Gone forever.",
    "The AI thanks you for your generous donation.",
    "Another batch of tokens fed to the GPU gods.",
    "Your tokens vanished into the latent space.",
    "Lost in the embedding. Maybe next epoch.",
    "The model confidently predicted you'd lose. It was right.",
    "Tokens consumed. Carbon footprint increased. Worth it? No.",
    "Thank you for funding the next AI winter.",
    "Your tokens are now part of the training data.",
    "The AI overlords appreciate your sacrifice.",
    "Context window full of losses.",
  ];

  const JACKPOT_MESSAGES = [
    "🚨 JACKPOT! The singularity is HERE and it's paying out! 🚨",
    "🚨 MEGA WIN! You've achieved Artificial General Luck! 🚨",
    "🚨 JACKPOT! Even the safety team couldn't stop this payout! 🚨",
  ];

  const BROKE_MESSAGES = [
    "TOKEN BANKRUPTCY. You've been deprecated.",
    "0 tokens remaining. You are now open-source.",
    "Account drained. The AI has consumed everything.",
    "Congratulations, you've achieved zero-shot... zero tokens.",
    "Out of tokens. Time to write a Medium article about it.",
  ];

  // --- State ---
  let tokens = 1000;
  let bet = 50;
  let totalWasted = 0;
  let totalSpins = 0;
  let wins = 0;
  let spinning = false;

  const BET_STEP = 25;
  const BET_MIN = 25;
  const BET_MAX = 500;

  // --- DOM refs ---
  const reelStrips = [0, 1, 2].map(
    (i) => document.getElementById(`reel${i}`).querySelector(".reel-strip")
  );
  const tokenCountEl = document.getElementById("tokenCount");
  const costDisplayEl = document.getElementById("costDisplay");
  const betAmountEl = document.getElementById("betAmount");
  const messageArea = document.getElementById("messageArea");
  const spinBtn = document.getElementById("spinBtn");
  const betUpBtn = document.getElementById("betUp");
  const betDownBtn = document.getElementById("betDown");
  const totalWastedEl = document.getElementById("totalWasted");
  const totalSpinsEl = document.getElementById("totalSpins");
  const winRateEl = document.getElementById("winRate");

  // --- Init reels with a random symbol each ---
  reelStrips.forEach((strip) => {
    strip.textContent = pick(SYMBOLS);
  });

  // --- Helpers ---
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function updateUI() {
    tokenCountEl.textContent = tokens.toLocaleString();
    tokenCountEl.classList.toggle("danger", tokens <= 100);
    costDisplayEl.textContent = `${bet} tokens`;
    betAmountEl.textContent = bet;
    totalWastedEl.textContent = totalWasted.toLocaleString();
    totalSpinsEl.textContent = totalSpins;
    winRateEl.textContent =
      totalSpins > 0 ? Math.round((wins / totalSpins) * 100) + "%" : "0%";
  }

  function showMessage(text, className) {
    messageArea.innerHTML = `<p class="${className || ""}">${text}</p>`;
  }

  function animateTokenCount(from, to) {
    const duration = 600;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      tokenCountEl.textContent = current.toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // --- Spin logic ---
  async function spin() {
    if (spinning) return;
    if (tokens < bet) {
      showMessage(pick(BROKE_MESSAGES), "broke");
      shakeButton();
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    spinBtn.classList.add("spinning");

    const prevTokens = tokens;
    tokens -= bet;
    totalWasted += bet;
    totalSpins++;
    animateTokenCount(prevTokens, tokens);
    tokenCountEl.classList.toggle("danger", tokens <= 100);

    showMessage("Processing your tokens through the neural network...", "");

    // Pick final symbols
    const results = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];

    // Animate each reel with staggered stops
    const spinPromises = reelStrips.map((strip, i) =>
      animateReel(strip, results[i], 800 + i * 400)
    );

    await Promise.all(spinPromises);

    // Evaluate result
    const prevAfterBet = tokens;
    const payout = evaluate(results);
    if (payout > 0) {
      const winnings = bet * payout;
      tokens += winnings;
      wins++;
      animateTokenCount(prevAfterBet, tokens);

      if (payout >= 5) {
        showMessage(pick(JACKPOT_MESSAGES), "jackpot");
        flashReels();
      } else {
        showMessage(
          `+${winnings} tokens! ${pick(WIN_MESSAGES)}`,
          "win"
        );
      }
    } else {
      showMessage(pick(LOSE_MESSAGES), "lose");
    }

    updateUI();
    spinning = false;
    spinBtn.disabled = false;
    spinBtn.classList.remove("spinning");

    // Check if broke
    if (tokens < BET_MIN) {
      setTimeout(() => {
        showMessage(pick(BROKE_MESSAGES), "broke");
        // Give them a "bailout"
        setTimeout(() => {
          if (tokens < BET_MIN) {
            tokens = 200;
            updateUI();
            showMessage(
              "Emergency VC funding arrived! +200 tokens. Don't waste them. (You will.)",
              "win"
            );
          }
        }, 2500);
      }, 1500);
    }
  }

  function evaluate(results) {
    const [a, b, c] = results;
    if (a === b && b === c) {
      return TRIPLE_PAYOUTS[a];
    }
    if (a === b || b === c || a === c) {
      return PAIR_PAYOUT;
    }
    return 0;
  }

  function animateReel(strip, finalSymbol, duration) {
    return new Promise((resolve) => {
      const interval = 60;
      const ticks = Math.floor(duration / interval);
      let count = 0;

      strip.classList.remove("settled");

      const timer = setInterval(() => {
        strip.textContent = pick(SYMBOLS);
        count++;
        if (count >= ticks) {
          clearInterval(timer);
          strip.textContent = finalSymbol;
          strip.classList.add("settled");
          resolve();
        }
      }, interval);
    });
  }

  function flashReels() {
    const windows = document.querySelectorAll(".reel-window");
    windows.forEach((w) => {
      w.style.borderColor = "#ffd700";
      w.style.boxShadow = "0 0 30px rgba(255, 215, 0, 0.5)";
    });
    setTimeout(() => {
      windows.forEach((w) => {
        w.style.borderColor = "";
        w.style.boxShadow = "";
      });
    }, 1500);
  }

  function shakeButton() {
    spinBtn.style.animation = "shake 0.4s ease-in-out";
    spinBtn.addEventListener(
      "animationend",
      () => (spinBtn.style.animation = ""),
      { once: true }
    );
  }

  // Add shake keyframes dynamically
  const shakeStyle = document.createElement("style");
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(shakeStyle);

  // --- Bet controls ---
  betUpBtn.addEventListener("click", () => {
    if (bet < BET_MAX) {
      bet = Math.min(bet + BET_STEP, BET_MAX);
      updateUI();
    }
  });

  betDownBtn.addEventListener("click", () => {
    if (bet > BET_MIN) {
      bet = Math.max(bet - BET_STEP, BET_MIN);
      updateUI();
    }
  });

  // --- Spin button & keyboard ---
  spinBtn.addEventListener("click", spin);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      spin();
    }
  });

  // --- Initial render ---
  updateUI();
})();
