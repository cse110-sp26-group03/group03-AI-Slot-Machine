(function () {
  "use strict";

  // --- Symbol definitions ---
  const SYMBOLS = [
    { emoji: "\u{1F916}", name: "Robot",         multiplier: 10 },
    { emoji: "\u{1F525}", name: "GPU Meltdown",  multiplier: 8 },
    { emoji: "\u{1F4B0}", name: "VC Funding",    multiplier: 6 },
    { emoji: "\u{1F9E0}", name: "Sentience",     multiplier: 5 },
    { emoji: "\u{1F4A9}", name: "Hallucination", multiplier: 4 },
    { emoji: "\u26A0\uFE0F",  name: "Bias",     multiplier: 3 },
  ];

  // Weighted pool — rarer symbols appear less often
  const POOL = [];
  const WEIGHTS = [2, 3, 4, 5, 6, 8]; // Robot is rarest, Bias is most common
  SYMBOLS.forEach(function (sym, i) {
    for (let w = 0; w < WEIGHTS[i]; w++) {
      POOL.push(sym);
    }
  });

  // --- Funny messages ---
  const WIN_MESSAGES = [
    "The AI overlords smile upon you!",
    "Congratulations! You've been promoted to GPT-7 beta tester.",
    "Big win! Sam Altman wants to know your location.",
    "Jackpot! Your tokens are definitely not hallucinated.",
    "Winner! The singularity is slightly closer now.",
    "Nice! Even DALL-E couldn't picture a better spin.",
  ];

  const LOSE_MESSAGES = [
    "Your tokens have been used for training data.",
    "Error 402: Insufficient vibes.",
    "The model confidently lost your money.",
    "Tokens hallucinated away. Very realistic though!",
    "Your request exceeded the context window... of luck.",
    "AI alignment problem: your wallet and zero.",
    "Rate limited by bad luck.",
    "The neural network has determined you should try again.",
    "Those tokens are in a better place now (OpenAI's servers).",
  ];

  const NEAR_MISS_MESSAGES = [
    "So close! The AI almost felt something.",
    "Two out of three — just like AI accuracy claims!",
    "Almost! The model was 97% confident you'd win.",
    "Partial match. Much like AI-generated code, almost right.",
  ];

  // --- State ---
  let tokens = 100;
  let spinning = false;

  // --- DOM refs ---
  const reelEls = [
    document.getElementById("reel-0"),
    document.getElementById("reel-1"),
    document.getElementById("reel-2"),
  ];
  const tokenCountEl = document.getElementById("token-count");
  const messageEl = document.getElementById("message");
  const spinBtn = document.getElementById("spin-btn");
  const betSelect = document.getElementById("bet-select");

  // --- Helpers ---
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function updateTokenDisplay() {
    tokenCountEl.textContent = tokens;
  }

  function setMessage(text, className) {
    messageEl.textContent = text;
    messageEl.className = "message" + (className ? " " + className : "");
  }

  function pickSymbol() {
    return randomFrom(POOL);
  }

  // --- Audio via Web Audio API ---
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type) {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {
      // Audio not supported — no-op
    }
  }

  function playSpinTick() {
    playTone(600 + Math.random() * 400, 0.06, "square");
  }

  function playWinSound() {
    [0, 100, 200, 300].forEach(function (delay) {
      setTimeout(function () {
        playTone(500 + delay * 2, 0.2, "sine");
      }, delay);
    });
  }

  function playLoseSound() {
    playTone(200, 0.3, "sawtooth");
  }

  // --- Spin animation ---
  function animateReel(reelEl, finalSymbol, duration) {
    return new Promise(function (resolve) {
      const startTime = performance.now();
      const tickInterval = 70; // ms between symbol changes
      let lastTick = 0;

      function frame(now) {
        const elapsed = now - startTime;
        if (elapsed - lastTick > tickInterval) {
          lastTick = elapsed;
          const rand = pickSymbol();
          reelEl.querySelector(".symbol").textContent = rand.emoji;
          playSpinTick();
        }
        if (elapsed < duration) {
          requestAnimationFrame(frame);
        } else {
          reelEl.querySelector(".symbol").textContent = finalSymbol.emoji;
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Evaluate result ---
  function evaluate(results, bet) {
    const a = results[0];
    const b = results[1];
    const c = results[2];

    // Three of a kind
    if (a.name === b.name && b.name === c.name) {
      const winAmount = bet * a.multiplier;
      tokens += winAmount;
      updateTokenDisplay();
      playWinSound();
      const flavor = randomFrom(WIN_MESSAGES);
      setMessage(
        a.emoji + a.emoji + a.emoji + " " + a.name + "! +" + winAmount + " tokens. " + flavor,
        "win"
      );
      return;
    }

    // Pair
    if (a.name === b.name || b.name === c.name || a.name === c.name) {
      const refund = bet; // 1x bet back
      tokens += refund;
      updateTokenDisplay();
      playTone(440, 0.15, "sine");
      setMessage(randomFrom(NEAR_MISS_MESSAGES) + " +" + refund + " tokens back.", "");
      return;
    }

    // Loss
    playLoseSound();
    setMessage(randomFrom(LOSE_MESSAGES), "lose");
  }

  // --- Spin handler ---
  async function spin() {
    if (spinning) return;

    const bet = parseInt(betSelect.value, 10);

    if (tokens < bet) {
      setMessage("Not enough tokens! Your context window of funds has been exhausted.", "lose");
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    tokens -= bet;
    updateTokenDisplay();
    setMessage("Processing your prompt...", "");

    // Pick results
    const results = [pickSymbol(), pickSymbol(), pickSymbol()];

    // Staggered reel animation
    await Promise.all([
      animateReel(reelEls[0], results[0], 800),
      animateReel(reelEls[1], results[1], 1200),
      animateReel(reelEls[2], results[2], 1600),
    ]);

    evaluate(results, bet);

    // Check for game over
    const minBet = parseInt(betSelect.options[0].value, 10);
    if (tokens < minBet) {
      setTimeout(function () {
        setMessage(
          "You're out of tokens! The AI has consumed them all. Refresh to beg for more.",
          "lose"
        );
        spinBtn.disabled = true;
      }, 1500);
    } else {
      spinning = false;
      spinBtn.disabled = false;
    }
  }

  // --- Init ---
  spinBtn.addEventListener("click", spin);

  // Allow spacebar to spin
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      spin();
    }
  });

  // Persist tokens to localStorage
  const saved = localStorage.getItem("ai-slots-tokens");
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed > 0) {
      tokens = parsed;
    }
  }
  updateTokenDisplay();

  // Save on change
  new MutationObserver(function () {
    localStorage.setItem("ai-slots-tokens", tokens);
  }).observe(tokenCountEl, { childList: true });
})();
