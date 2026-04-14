(() => {
  "use strict";

  // ── Symbols & their weights (higher = more common) ──
  const SYMBOLS = [
    { emoji: "🤖", name: "Robot",        weight: 3 },
    { emoji: "🧠", name: "Brain",        weight: 3 },
    { emoji: "🔥", name: "Fire",         weight: 4 },
    { emoji: "💀", name: "Skull",        weight: 4 },
    { emoji: "📎", name: "Clippy",       weight: 5 },
    { emoji: "🌀", name: "Hallucinate",  weight: 6 },
  ];

  // Build a weighted pool for random picks
  const POOL = SYMBOLS.flatMap((s) => Array(s.weight).fill(s.emoji));

  // Payouts for triple matches (keyed by emoji)
  const TRIPLE_PAY = {
    "🤖": { mult: 10, label: "AI OVERLORD! Skynet sends its regards." },
    "🧠": { mult: 8,  label: "BIG BRAIN ENERGY! You've achieved AGI (Absurdly Good Income)." },
    "🔥": { mult: 6,  label: "GPU MELTDOWN! Your data center is on fire, but hey — tokens!" },
    "💀": { mult: 5,  label: "MODEL COLLAPSED! At least it collapsed in your favor." },
    "📎": { mult: 4,  label: "CLIPPY'S REVENGE! \"It looks like you're winning tokens!\"" },
    "🌀": { mult: 3,  label: "HALLUCINATION! These tokens might not be real…" },
  };

  const PAIR_MULT = 1.5;

  // ── Snarky loss messages ──
  const LOSS_MESSAGES = [
    "Your tokens have been used for training data. Thanks!",
    "That spin cost more than a GPT-4 API call. Ouch.",
    "The AI giveth, and the AI taketh away.",
    "Error 404: Winnings not found.",
    "Your tokens were sacrificed to the gradient descent gods.",
    "The model confidently predicted you'd win. It was wrong.",
    "Tokens recycled into compute. Very sustainable of you.",
    "The AI hallucinated a win for you, but we checked.",
    "Those tokens are now in the latent space. Good luck getting them back.",
    "\"I'm sorry, Dave. I'm afraid I can't pay that.\"",
    "Your tokens have been deprecated. Please upgrade.",
    "Prompt rejected. Reason: not enough luck in your context window.",
    "The neural net says: better luck next epoch.",
    "Tokens lost in the attention mechanism. They weren't attending.",
    "Overfitting to losses, underfitting to wins. Classic.",
  ];

  // ── State ──
  let tokens = 1000;
  let bet = 50;
  let spinning = false;
  const BET_STEP = 25;
  const MIN_BET = 25;

  // ── DOM refs ──
  const tokenCountEl = document.getElementById("token-count");
  const betAmountEl = document.getElementById("bet-amount");
  const spinBtn = document.getElementById("spin-btn");
  const betUpBtn = document.getElementById("bet-up");
  const betDownBtn = document.getElementById("bet-down");
  const messageEl = document.getElementById("message");
  const reelEls = [0, 1, 2].map((i) => document.getElementById(`reel-${i}`));
  const reelWindows = document.querySelectorAll(".reel-window");
  const machineEl = document.querySelector(".machine");

  // ── Helpers ──
  function randomSymbol() {
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  function updateDisplay() {
    tokenCountEl.textContent = tokens;
    betAmountEl.textContent = bet;
    spinBtn.disabled = spinning || tokens < bet;
  }

  function setMessage(text, cls) {
    messageEl.textContent = text;
    messageEl.className = "message" + (cls ? ` ${cls}` : "");
  }

  function playClick() {
    // Subtle audio feedback via Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 220;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.stop(ctx.currentTime + 0.1);
    } catch (_) {
      // Audio not available — no problem
    }
  }

  function playWinSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.value = 0.1;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
        osc.stop(ctx.currentTime + i * 0.12 + 0.25);
      });
    } catch (_) {}
  }

  // ── Spin logic ──
  async function spin() {
    if (spinning || tokens < bet) return;
    spinning = true;
    tokens -= bet;
    updateDisplay();
    playClick();

    // Pick final symbols
    const results = [randomSymbol(), randomSymbol(), randomSymbol()];

    // Clear previous match highlights
    reelWindows.forEach((w) => w.classList.remove("matched"));

    // Animate each reel with staggered stop times
    const spinDurations = [600, 900, 1200];

    const spinPromises = reelEls.map((reel, i) => {
      return new Promise((resolve) => {
        reel.classList.add("spinning");
        const interval = 60;
        const symbolEl = reel.querySelector(".symbol");
        const ticker = setInterval(() => {
          symbolEl.textContent = randomSymbol();
        }, interval);

        setTimeout(() => {
          clearInterval(ticker);
          reel.classList.remove("spinning");
          symbolEl.textContent = results[i];
          resolve();
        }, spinDurations[i]);
      });
    });

    await Promise.all(spinPromises);

    // Evaluate results
    evaluate(results);

    spinning = false;
    updateDisplay();
  }

  function evaluate(results) {
    const [a, b, c] = results;

    // Triple
    if (a === b && b === c) {
      const info = TRIPLE_PAY[a];
      const winnings = bet * info.mult;
      tokens += winnings;
      setMessage(`${info.label} +${winnings} tokens!`, "win");
      reelWindows.forEach((w) => w.classList.add("matched"));
      playWinSound();
      return;
    }

    // Pair
    if (a === b || b === c || a === c) {
      const winnings = Math.floor(bet * PAIR_MULT);
      tokens += winnings;
      const pairSymbol = a === b ? a : (b === c ? b : a);

      const pairMessages = [
        `Two ${pairSymbol}s! Almost sentient. +${winnings} tokens.`,
        `A pair of ${pairSymbol}s — the AI is warming up. +${winnings} tokens.`,
        `${pairSymbol}${pairSymbol} — partial match. The model needs more data. +${winnings} tokens.`,
      ];
      setMessage(pairMessages[Math.floor(Math.random() * pairMessages.length)], "win");

      // Highlight matching reels
      if (a === b) { reelWindows[0].classList.add("matched"); reelWindows[1].classList.add("matched"); }
      if (b === c) { reelWindows[1].classList.add("matched"); reelWindows[2].classList.add("matched"); }
      if (a === c) { reelWindows[0].classList.add("matched"); reelWindows[2].classList.add("matched"); }
      playWinSound();
      return;
    }

    // Loss
    setMessage(LOSS_MESSAGES[Math.floor(Math.random() * LOSS_MESSAGES.length)], "lose");

    // Broke check
    if (tokens <= 0) {
      tokens = 0;
      setMessage("OUT OF TOKENS! The AI consumed them all. Refreshing your context window (free 1000 tokens)…", "broke");
      machineEl.classList.add("shake");
      setTimeout(() => {
        machineEl.classList.remove("shake");
        tokens = 1000;
        bet = 50;
        updateDisplay();
        setMessage("Fine. We'll give you 1000 more tokens. Don't say AI never did anything for you.", "");
      }, 2500);
    }
  }

  // ── Event listeners ──
  spinBtn.addEventListener("click", spin);

  betUpBtn.addEventListener("click", () => {
    if (spinning) return;
    bet = Math.min(bet + BET_STEP, tokens);
    updateDisplay();
  });

  betDownBtn.addEventListener("click", () => {
    if (spinning) return;
    bet = Math.max(bet - BET_STEP, MIN_BET);
    updateDisplay();
  });

  // Keyboard: spacebar to spin
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      spin();
    }
  });

  // ── Init ──
  updateDisplay();
  setMessage("Insert tokens and pull the lever. The AI promises it's fair. (It's not.)", "");
})();
