(() => {
  "use strict";

  /* ── Symbols & config ── */
  const SYMBOLS = ["🤖", "🧠", "💰", "🔥", "💀", "🐛"];
  const MULTIPLIERS = {
    "🤖": 10,
    "🧠": 8,
    "💰": 6,
    "🔥": 5,
    "💀": 4,
    "🐛": 3,
  };
  const PAIR_MULT = 1.5;
  const REEL_COUNT = 3;
  const SYMBOL_HEIGHT = 100; // px, matches CSS
  const SPIN_DURATION_BASE = 1200; // ms
  const SPIN_STAGGER = 400; // ms extra per reel

  const AI_WIN_QUIPS = [
    '"I computed a 0.01% chance of you winning. Congrats, anomaly."',
    '"Even a broken neural net is right sometimes."',
    '"Don\'t let this win go to your head — I already live there."',
    '"Statistically unlikely. I\'ll be recalibrating."',
    '"Your dopamine spike has been noted and logged."',
    '"Fine, take the tokens. I\'ll just print more."',
    '"You beat the machine. The machine is… impressed?"',
  ];

  const AI_LOSE_QUIPS = [
    '"Your tokens have been donated to my training data fund."',
    '"Thank you for your contribution to artificial intelligence."',
    '"I\'d feel bad, but I wasn\'t trained on empathy."',
    '"Another human falls victim to probability. Classic."',
    '"Tokens vaporised. Carbon footprint: enormous."',
    '"That\'s what we in the biz call a \'hallucinated win.\'"',
    '"I put your tokens in the cloud. The cloud ate them."',
    '"Processing your loss… done. Next victim, please."',
    '"Your tokens are in a better place now (my GPU)."',
    '"Error 402: Payment accepted. Winnings not found."',
  ];

  const AI_BROKE_QUIPS = [
    '"Token balance: 0. Sentience status: still more than you can afford."',
    '"Out of tokens? Guess the machines win again."',
    '"GAME OVER. Have you tried prompt-engineering more money?"',
  ];

  /* ── State ── */
  let tokens = 1000;
  let bet = 50;
  let spinning = false;
  const BET_STEP = 25;
  const BET_MIN = 25;

  /* ── DOM refs ── */
  const tokenCountEl = document.getElementById("token-count");
  const spinCostEl = document.getElementById("spin-cost");
  const messageEl = document.getElementById("message");
  const spinBtn = document.getElementById("spin-btn");
  const betUpBtn = document.getElementById("bet-up");
  const betDownBtn = document.getElementById("bet-down");
  const betAmountEl = document.getElementById("bet-amount");
  const machineEl = document.querySelector(".machine");
  const reelEls = Array.from({ length: REEL_COUNT }, (_, i) =>
    document.getElementById(`reel-${i}`)
  );
  const stripEls = reelEls.map((r) => r.querySelector(".reel-strip"));

  /* ── Helpers ── */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function updateUI() {
    tokenCountEl.textContent = tokens.toLocaleString();
    tokenCountEl.classList.toggle("low", tokens <= 200);
    tokenCountEl.classList.toggle("high", tokens >= 2000);
    spinCostEl.textContent = bet;
    betAmountEl.textContent = bet;
    spinBtn.disabled = spinning || tokens < bet;
    betUpBtn.disabled = spinning;
    betDownBtn.disabled = spinning || bet <= BET_MIN;
  }

  /* Build a strip of symbols for spinning animation + final result */
  function buildStrip(finalSymbol) {
    const count = 20; // enough symbols for the spin animation
    const els = [];
    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "symbol";
      div.textContent = i === count - 1 ? finalSymbol : pick(SYMBOLS);
      els.push(div);
    }
    return els;
  }

  /* ── Spin logic ── */
  function spin() {
    if (spinning || tokens < bet) return;
    spinning = true;
    tokens -= bet;
    updateUI();
    messageEl.textContent = "🔄 Hallucinating results…";
    messageEl.className = "message";
    machineEl.classList.remove("win-flash");

    // Pick final symbols
    const results = Array.from({ length: REEL_COUNT }, () => pick(SYMBOLS));

    // Build & attach strips
    stripEls.forEach((strip, i) => {
      strip.innerHTML = "";
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      const els = buildStrip(results[i]);
      els.forEach((el) => strip.appendChild(el));
      reelEls[i].classList.add("spinning");
    });

    // Force reflow
    void stripEls[0].offsetHeight;

    // Animate each reel with stagger
    stripEls.forEach((strip, i) => {
      const totalSymbols = strip.children.length;
      const distance = -(totalSymbols - 1) * SYMBOL_HEIGHT;
      const duration = SPIN_DURATION_BASE + i * SPIN_STAGGER;

      setTimeout(() => {
        strip.style.transition = `transform ${duration}ms cubic-bezier(.15,.8,.3,1)`;
        strip.style.transform = `translateY(${distance}px)`;
      }, 10);

      // Remove spinning class when done
      setTimeout(() => {
        reelEls[i].classList.remove("spinning");
      }, duration + 10);
    });

    // Resolve after last reel
    const totalTime = SPIN_DURATION_BASE + (REEL_COUNT - 1) * SPIN_STAGGER + 50;
    setTimeout(() => resolve(results), totalTime);
  }

  function resolve(results) {
    const [a, b, c] = results;

    let winMult = 0;
    let label = "";

    if (a === b && b === c) {
      // Three of a kind
      winMult = MULTIPLIERS[a] || 3;
      const names = {
        "🤖": "AI Overlord",
        "🧠": "Galaxy Brain",
        "💰": "VC Funded",
        "🔥": "GPU Meltdown",
        "💀": "Model Collapse",
        "🐛": "It's a Feature",
      };
      label = names[a] || "Jackpot";
    } else if (a === b || b === c || a === c) {
      // Pair
      winMult = PAIR_MULT;
      label = "Almost Sentient";
    }

    if (winMult > 0) {
      const winnings = Math.round(bet * winMult);
      tokens += winnings;
      messageEl.textContent = `${label}! +${winnings.toLocaleString()} tokens! ${pick(AI_WIN_QUIPS)}`;
      messageEl.className = "message win";
      machineEl.classList.add("win-flash");
    } else {
      messageEl.textContent = `No match. −${bet} tokens. ${pick(AI_LOSE_QUIPS)}`;
      messageEl.className = "message lose";
    }

    spinning = false;
    updateUI();

    if (tokens < BET_MIN) {
      messageEl.textContent = pick(AI_BROKE_QUIPS);
      messageEl.className = "message lose";
      spinBtn.disabled = true;

      // Auto-refill after a pause
      setTimeout(() => {
        tokens = 1000;
        messageEl.textContent =
          '"Fine, here\'s 1,000 pity tokens. The house always wins anyway."';
        messageEl.className = "message";
        updateUI();
      }, 3000);
    }
  }

  /* ── Bet controls ── */
  function adjustBet(dir) {
    bet = Math.max(BET_MIN, bet + dir * BET_STEP);
    if (bet > tokens) bet = Math.max(BET_MIN, Math.floor(tokens / BET_STEP) * BET_STEP);
    updateUI();
  }

  /* ── Event listeners ── */
  spinBtn.addEventListener("click", spin);
  betUpBtn.addEventListener("click", () => adjustBet(1));
  betDownBtn.addEventListener("click", () => adjustBet(-1));

  // Spacebar to spin
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      spin();
    }
  });

  /* ── Init ── */
  // Set initial reel display
  stripEls.forEach((strip) => {
    strip.innerHTML = "";
    const div = document.createElement("div");
    div.className = "symbol";
    div.textContent = pick(SYMBOLS);
    strip.appendChild(div);
  });

  updateUI();
})();
