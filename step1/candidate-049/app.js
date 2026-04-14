(() => {
  "use strict";

  // --- Symbols & payouts ---
  const SYMBOLS = [
    { emoji: "\u{1F916}", name: "Robot" },   // 🤖
    { emoji: "\u{1F680}", name: "Rocket" },  // 🚀
    { emoji: "\u26A1",     name: "Bolt" },    // ⚡
    { emoji: "\u{1F4AA}", name: "Flex" },    // 💪
    { emoji: "\u{1F441}", name: "Eye" },     // 👁
    { emoji: "\u{1F4A3}", name: "Bomb" },    // 💣
  ];

  const TRIPLE_PAYOUTS = {
    Robot: 10,
    Rocket: 8,
    Bolt: 6,
    Flex: 5,
    Eye: 4,
    Bomb: 3,
  };

  const PAIR_MULTIPLIER = 1.5;

  // --- AI-flavored quips ---
  const WIN_QUIPS = [
    "The neural net smiles upon you!",
    "Tokens generated! No hallucinations this time.",
    "You just out-prompted the house.",
    "Even GPT couldn\u2019t predict that win.",
    "Inference complete: you\u2019re rich (in fake tokens).",
    "Training complete. Result: profit.",
    "Your loss function just went negative!",
  ];

  const LOSE_QUIPS = [
    "Model collapsed. Tokens lost.",
    "That spin was a hallucination.",
    "Overfitting to bad luck\u2026",
    "The AI giveth and the AI taketh.",
    "Your prompt was rejected.",
    "Error 402: payment required (more tokens).",
    "Gradient descent into poverty.",
  ];

  const BROKE_QUIPS = [
    "Out of tokens. Just like a free-tier API key.",
    "Rate limited by reality.",
    "Context window: empty. Wallet: also empty.",
  ];

  // --- State ---
  let tokens = 100;
  let bet = 10;
  let spinning = false;
  const BET_STEP = 5;
  const MIN_BET = 5;

  // --- DOM refs ---
  const tokenCountEl = document.getElementById("token-count");
  const betAmountEl = document.getElementById("bet-amount");
  const spinBtn = document.getElementById("spin-btn");
  const betUpBtn = document.getElementById("bet-up");
  const betDownBtn = document.getElementById("bet-down");
  const messageEl = document.getElementById("message");
  const historyList = document.getElementById("history-list");
  const reelEls = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2"),
  ];
  const reelWindows = reelEls.map((r) => r.parentElement);

  // --- Helpers ---
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function render() {
    tokenCountEl.textContent = tokens;
    betAmountEl.textContent = bet;
    spinBtn.disabled = spinning || tokens < bet;
  }

  function setMessage(text, cls) {
    messageEl.textContent = text;
    messageEl.className = "message " + (cls || "");
  }

  function addHistory(symbols, payout) {
    const li = document.createElement("li");
    const emojis = symbols.map((s) => s.emoji).join(" ");
    if (payout > 0) {
      li.textContent = `${emojis}  \u2192 +${payout} tokens`;
      li.classList.add("win-entry");
    } else {
      li.textContent = `${emojis}  \u2192 -${bet} tokens`;
      li.classList.add("lose-entry");
    }
    historyList.prepend(li);
    // Keep history manageable
    while (historyList.children.length > 50) {
      historyList.removeChild(historyList.lastChild);
    }
  }

  // --- Evaluate spin result ---
  function evaluate(results) {
    const names = results.map((s) => s.name);

    // Three of a kind
    if (names[0] === names[1] && names[1] === names[2]) {
      const mult = TRIPLE_PAYOUTS[names[0]] || 3;
      return { win: true, multiplier: mult };
    }

    // Any pair
    if (names[0] === names[1] || names[1] === names[2] || names[0] === names[2]) {
      return { win: true, multiplier: PAIR_MULTIPLIER };
    }

    return { win: false, multiplier: 0 };
  }

  // --- Reel animation ---
  function animateReel(reelEl, windowEl, finalSymbol, duration) {
    return new Promise((resolve) => {
      windowEl.classList.add("spinning");
      const totalSteps = Math.floor(duration / 60);
      let step = 0;

      // Fill reel with random symbols for scrolling effect
      reelEl.innerHTML = "";
      for (let i = 0; i < totalSteps + 1; i++) {
        const div = document.createElement("div");
        div.classList.add("symbol");
        div.textContent = i === totalSteps ? finalSymbol.emoji : pick(SYMBOLS).emoji;
        reelEl.appendChild(div);
      }

      // Animate by shifting transform
      const symbolHeight = 100;
      function tick() {
        if (step >= totalSteps) {
          reelEl.style.transform = `translateY(-${totalSteps * symbolHeight}px)`;
          windowEl.classList.remove("spinning");
          resolve();
          return;
        }
        step++;
        reelEl.style.transform = `translateY(-${step * symbolHeight}px)`;
        requestAnimationFrame(tick);
      }

      reelEl.style.transform = "translateY(0)";
      requestAnimationFrame(tick);
    });
  }

  // --- Spin ---
  async function spin() {
    if (spinning || tokens < bet) return;
    spinning = true;
    setMessage("");
    render();

    // Deduct bet
    tokens -= bet;
    render();

    // Pick results
    const results = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];

    // Staggered reel animations
    await Promise.all([
      animateReel(reelEls[0], reelWindows[0], results[0], 600),
      animateReel(reelEls[1], reelWindows[1], results[1], 900),
      animateReel(reelEls[2], reelWindows[2], results[2], 1200),
    ]);

    // Evaluate
    const outcome = evaluate(results);
    let payout = 0;

    if (outcome.win) {
      payout = Math.floor(bet * outcome.multiplier);
      tokens += payout;
      setMessage(`${pick(WIN_QUIPS)} (+${payout} tokens)`, "win");
    } else {
      setMessage(pick(LOSE_QUIPS), "lose");
    }

    addHistory(results, payout);

    if (tokens <= 0) {
      tokens = 0;
      setMessage(pick(BROKE_QUIPS), "broke");
    }

    spinning = false;
    render();
  }

  // --- Bet controls ---
  betUpBtn.addEventListener("click", () => {
    if (bet + BET_STEP <= tokens) {
      bet += BET_STEP;
      render();
    }
  });

  betDownBtn.addEventListener("click", () => {
    if (bet - BET_STEP >= MIN_BET) {
      bet -= BET_STEP;
      render();
    }
  });

  // --- Spin trigger ---
  spinBtn.addEventListener("click", spin);

  // Keyboard shortcut: space to spin
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      spin();
    }
  });

  // --- Init ---
  render();
  setMessage("Press SPIN to burn some tokens!");
})();
