/* ── AI Slot Machine ─────────────────────────────── */
(() => {
  "use strict";

  // Symbols and their weights (higher = more common)
  const SYMBOLS = [
    { emoji: "🤖", name: "Robot",   weight: 2 },
    { emoji: "🧠", name: "Brain",   weight: 3 },
    { emoji: "🔥", name: "Fire",    weight: 4 },
    { emoji: "💰", name: "Money",   weight: 4 },
    { emoji: "⚡", name: "Bolt",    weight: 5 },
    { emoji: "🎲", name: "Dice",    weight: 6 },
  ];

  // Build a weighted pool for random picks
  const POOL = [];
  for (const sym of SYMBOLS) {
    for (let i = 0; i < sym.weight; i++) POOL.push(sym);
  }

  // Payouts: triple match multipliers
  const TRIPLE_PAYOUTS = {
    "🤖": { mult: 10, msg: "SINGULARITY JACKPOT! The machines have won!" },
    "🧠": { mult: 8,  msg: "NEURAL NETWORK NIRVANA! Your gradients are immaculate!" },
    "🔥": { mult: 6,  msg: "GPU MELTDOWN! Your data center is on fire!" },
    "💰": { mult: 5,  msg: "VC FUNDING SECURED! $500M at a $10B valuation!" },
    "⚡": { mult: 4,  msg: "OVERCLOCKED! Running inference at 420 tokens/sec!" },
    "🎲": { mult: 3,  msg: "DETERMINISTIC LUCK! (seed=42, obviously)" },
  };

  // Snarky messages for losses
  const LOSE_MESSAGES = [
    "Tokens burned. Just like a fine-tuning run on bad data.",
    "The model has spoken: you lose.",
    "Your tokens have been hallucinated away.",
    "Loss function: maximized. Great job!",
    "Even GPT-2 could've done better.",
    "Congratulations, you've trained on noise.",
    "Token go brrr… straight into /dev/null.",
    "That spin had the coherence of a temperature=2 response.",
    "Your tokens were sacrificed to the attention mechanism.",
    "Prompt rejected. Tokens non-refundable.",
    "The AI giveth, and the AI taketh away.",
    "Those tokens are in AI heaven now. (There is no AI heaven.)",
  ];

  const PAIR_MESSAGES = [
    "Partial hallucination — close enough for government AI.",
    "Two out of three ain't bad… said no ML engineer ever.",
    "Almost a pattern! Your pareidolia is showing.",
    "The model almost converged. Almost.",
    "A partial match — like an AI that's 'mostly' aligned.",
  ];

  const BROKE_MESSAGES = [
    "BANKRUPT! Your token budget has been exceeded. Just like every AI startup.",
    "OUT OF TOKENS! Time to write a grant proposal.",
    "GAME OVER! You've been deprecated. Refresh to reboot your funding.",
    "ZERO TOKENS! Even OpenAI has more money left than you.",
  ];

  // Bet levels
  const BET_STEPS = [10, 25, 50, 100, 250, 500];
  let betIndex = 2; // start at 50

  // State
  let balance = 1000;
  let spinning = false;

  // DOM refs
  const balanceEl = document.getElementById("balance");
  const betAmountEl = document.getElementById("bet-amount");
  const betDownBtn = document.getElementById("bet-down");
  const betUpBtn = document.getElementById("bet-up");
  const spinBtn = document.getElementById("spin-btn");
  const messageEl = document.getElementById("message");
  const strips = [
    document.getElementById("strip-0"),
    document.getElementById("strip-1"),
    document.getElementById("strip-2"),
  ];
  const reels = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2"),
  ];

  // ── Helpers ─────────────────────────────────────
  function pick() {
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  function randomMsg(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function updateBalance(val) {
    balance = val;
    balanceEl.textContent = balance;
  }

  function updateBetDisplay() {
    betAmountEl.textContent = BET_STEPS[betIndex];
    betDownBtn.disabled = betIndex === 0;
    betUpBtn.disabled = betIndex === BET_STEPS.length - 1;
  }

  function showMessage(text, cls) {
    messageEl.className = "message " + cls;
    messageEl.textContent = text;
  }

  function flashBalance(cls) {
    balanceEl.classList.remove("flash-win", "flash-lose");
    // Force reflow so re-adding the class restarts the animation
    void balanceEl.offsetWidth;
    balanceEl.classList.add(cls);
    setTimeout(() => balanceEl.classList.remove(cls), 2000);
  }

  // ── Reel Animation ──────────────────────────────
  // Each strip gets filled with random symbols, then animated via CSS transform.
  // The final symbol is placed at a known index so we control the outcome.
  const SPIN_SYMBOLS_COUNT = 20; // number of symbols to scroll through
  const SYMBOL_SIZE = 100; // must match CSS .symbol height

  function buildStrip(stripEl, finalSymbol) {
    stripEl.innerHTML = "";
    stripEl.style.transition = "none";
    stripEl.style.transform = "translateY(0)";

    for (let i = 0; i < SPIN_SYMBOLS_COUNT; i++) {
      const div = document.createElement("div");
      div.className = "symbol";
      div.textContent = pick().emoji;
      stripEl.appendChild(div);
    }
    // Replace last symbol with the determined result
    const lastDiv = document.createElement("div");
    lastDiv.className = "symbol";
    lastDiv.textContent = finalSymbol.emoji;
    stripEl.appendChild(lastDiv);
  }

  function animateStrip(stripEl, delay) {
    return new Promise((resolve) => {
      // Small delay so the browser paints the initial state
      setTimeout(() => {
        const totalSymbols = stripEl.children.length;
        const distance = (totalSymbols - 1) * SYMBOL_SIZE;
        stripEl.style.transition = `transform ${1.2 + delay * 0.3}s cubic-bezier(.15,.8,.3,1)`;
        stripEl.style.transform = `translateY(-${distance}px)`;

        stripEl.addEventListener("transitionend", () => resolve(), { once: true });
      }, delay * 200);
    });
  }

  // ── Spin Logic ──────────────────────────────────
  async function spin() {
    if (spinning) return;

    const bet = BET_STEPS[betIndex];
    if (bet > balance) {
      showMessage("Not enough tokens! Lower your bet, you over-prompted spender.", "info");
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    betDownBtn.disabled = true;
    betUpBtn.disabled = true;
    messageEl.textContent = "";
    messageEl.className = "message";
    reels.forEach(r => r.classList.remove("winner"));

    // Deduct bet
    updateBalance(balance - bet);

    // Determine outcome
    const results = [pick(), pick(), pick()];

    // Build & animate reels
    strips.forEach((strip, i) => buildStrip(strip, results[i]));

    // Force reflow before animation
    void strips[0].offsetWidth;

    await Promise.all(strips.map((strip, i) => animateStrip(strip, i)));

    // Evaluate result
    const emojis = results.map(r => r.emoji);
    const [a, b, c] = emojis;

    let winnings = 0;
    let msgText = "";
    let msgClass = "lose";

    if (a === b && b === c) {
      // Triple!
      const payout = TRIPLE_PAYOUTS[a];
      winnings = bet * payout.mult;
      msgText = `${payout.msg}\n+${winnings} tokens!`;
      msgClass = "win";
      reels.forEach(r => r.classList.add("winner"));
    } else if (a === b || b === c || a === c) {
      // Pair
      winnings = Math.floor(bet * 1.5);
      msgText = `${randomMsg(PAIR_MESSAGES)}\n+${winnings} tokens.`;
      msgClass = "win";
      // Highlight matching reels
      if (a === b) { reels[0].classList.add("winner"); reels[1].classList.add("winner"); }
      if (b === c) { reels[1].classList.add("winner"); reels[2].classList.add("winner"); }
      if (a === c) { reels[0].classList.add("winner"); reels[2].classList.add("winner"); }
    } else {
      msgText = randomMsg(LOSE_MESSAGES);
      msgClass = "lose";
    }

    if (winnings > 0) {
      updateBalance(balance + winnings);
      flashBalance("flash-win");
    } else {
      flashBalance("flash-lose");
    }

    showMessage(msgText, msgClass);

    // Check bankruptcy
    if (balance <= 0) {
      updateBalance(0);
      showMessage(randomMsg(BROKE_MESSAGES), "broke");
      spinBtn.disabled = true;
      spinning = false;
      // Auto-reset after a moment
      setTimeout(() => {
        updateBalance(1000);
        betIndex = 2;
        updateBetDisplay();
        showMessage("Investor bailout! Here's 1,000 fresh tokens. Try not to hallucinate them away.", "info");
        spinBtn.disabled = false;
      }, 3000);
      return;
    }

    spinning = false;
    spinBtn.disabled = false;
    updateBetDisplay();
  }

  // ── Event Listeners ─────────────────────────────
  spinBtn.addEventListener("click", spin);

  betDownBtn.addEventListener("click", () => {
    if (betIndex > 0) { betIndex--; updateBetDisplay(); }
  });

  betUpBtn.addEventListener("click", () => {
    if (betIndex < BET_STEPS.length - 1) { betIndex++; updateBetDisplay(); }
  });

  // Keyboard: spacebar to spin
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      spin();
    }
  });

  // ── Init ────────────────────────────────────────
  updateBetDisplay();
  // Place initial symbols in reels
  strips.forEach((strip) => {
    strip.innerHTML = "";
    const div = document.createElement("div");
    div.className = "symbol";
    div.textContent = pick().emoji;
    strip.appendChild(div);
  });

  showMessage("Feed your tokens to the machine. Press SPIN or hit SPACE.", "info");
})();
