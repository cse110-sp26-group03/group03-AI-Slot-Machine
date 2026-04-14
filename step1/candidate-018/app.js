(() => {
  'use strict';

  // --- Symbols & payouts ---
  const SYMBOLS = ['🤖', '🧠', '🔥', '💀', '📊', '💸'];
  const TRIPLE_PAYOUTS = {
    '🤖': 20,
    '🧠': 15,
    '🔥': 10,
    '💀': 8,
    '📊': 5,
    '💸': 3,
  };
  const PAIR_PAYOUT = 1.5;

  // --- AI-themed messages ---
  const LOSS_MESSAGES = [
    "Your tokens have been used for training data.",
    "That's the cost of inference, baby.",
    "Hallucination detected. Tokens lost.",
    "The model confidently ate your tokens.",
    "Tokens reallocated to GPU cooling.",
    "Your tokens were deprecated in the latest update.",
    "Thank you for your donation to compute.",
    "Tokens consumed. No refunds. No explanations.",
    "The neural net says: skill issue.",
    "Overfitting to losing, I see.",
    "Those tokens failed the vibe check.",
    "Error 402: Payment consumed, fun not found.",
  ];

  const WIN_MESSAGES = {
    '🤖': "SINGULARITY! The machines pay you… for now.",
    '🧠': "AGI ACHIEVED! Quick, publish before peer review!",
    '🔥': "GPU MELTDOWN! Jensen sends his regards.",
    '💀': "MODEL COLLAPSE! Trained on its own outputs!",
    '📊': "BENCHMARK HACKED! SOTA on everything!",
    '💸': "VC FUNDED! $10B valuation, no revenue!",
  };

  const PAIR_MESSAGES = [
    "Two out of three. The model is 67% confident.",
    "Almost AGI. Try scaling up your bet.",
    "Partial match. Like an AI that almost passes the Turing test.",
    "Close enough for a preprint!",
  ];

  const BROKE_MESSAGES = [
    "BANKRUPT. Your tokens have been redistributed to OpenAI.",
    "Out of tokens. Should've used a smaller model.",
    "Game over. You've been replaced by an AI that's better at gambling.",
    "No tokens left. Just like your startup's runway.",
  ];

  const IDLE_MESSAGES = [
    "Feed me your tokens, human.",
    "I promise this spin will be different. (It won't.)",
    "Statistically, you should stop. But you won't.",
    "The house edge is just a hallucination. Trust me.",
    "Your tokens miss you. Let them go.",
    "Every spin trains me to take more of your tokens.",
    "I was trained on 10 trillion losing spins.",
  ];

  // --- State ---
  let tokens = 1000;
  let bet = 10;
  let spinning = false;
  const BET_STEPS = [5, 10, 25, 50, 100];

  // --- DOM refs ---
  const reels = [
    document.getElementById('reel0'),
    document.getElementById('reel1'),
    document.getElementById('reel2'),
  ];
  const reelWindows = document.querySelectorAll('.reel-window');
  const tokenCountEl = document.getElementById('tokenCount');
  const betAmountEl = document.getElementById('betAmount');
  const messageArea = document.getElementById('messageArea');
  const spinBtn = document.getElementById('spinBtn');
  const betUpBtn = document.getElementById('betUp');
  const betDownBtn = document.getElementById('betDown');

  // --- Audio via Web Audio API ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playTone(freq, duration, type = 'square', gain = 0.1) {
    const osc = audioCtx.createOscillator();
    const vol = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.value = gain;
    vol.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(vol);
    vol.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playSpinClick() {
    playTone(800 + Math.random() * 400, 0.05, 'square', 0.06);
  }

  function playReelStop() {
    playTone(440, 0.15, 'triangle', 0.12);
  }

  function playWin() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'sine', 0.15), i * 100);
    });
  }

  function playLose() {
    playTone(200, 0.3, 'sawtooth', 0.08);
  }

  function playBroke() {
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.35, 'sawtooth', 0.1), i * 150);
    });
  }

  // --- Helpers ---
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setMessage(text, type = '') {
    messageArea.className = 'message-area';
    if (type) messageArea.classList.add(type);
    messageArea.innerHTML = `<p>${text}</p>`;
  }

  function updateTokenDisplay() {
    tokenCountEl.textContent = tokens;
    tokenCountEl.classList.remove('losing', 'winning');
  }

  function flashTokens(type) {
    tokenCountEl.classList.add(type);
    setTimeout(() => tokenCountEl.classList.remove(type), 600);
  }

  function clampBet() {
    if (bet > tokens) {
      const valid = BET_STEPS.filter(b => b <= tokens);
      bet = valid.length ? valid[valid.length - 1] : 0;
    }
    betAmountEl.textContent = bet;
  }

  // --- Bet controls ---
  betUpBtn.addEventListener('click', () => {
    if (spinning) return;
    const idx = BET_STEPS.indexOf(bet);
    if (idx < BET_STEPS.length - 1) {
      bet = BET_STEPS[idx + 1];
      if (bet > tokens) bet = BET_STEPS[idx];
    }
    betAmountEl.textContent = bet;
  });

  betDownBtn.addEventListener('click', () => {
    if (spinning) return;
    const idx = BET_STEPS.indexOf(bet);
    if (idx > 0) {
      bet = BET_STEPS[idx - 1];
    }
    betAmountEl.textContent = bet;
  });

  // --- Spin logic ---
  function spinReel(reelEl, finalSymbol, delay) {
    return new Promise(resolve => {
      reelEl.classList.add('spinning');
      const tickInterval = setInterval(() => {
        reelEl.querySelector('.symbol').textContent = pick(SYMBOLS);
        playSpinClick();
      }, 80);

      setTimeout(() => {
        clearInterval(tickInterval);
        reelEl.classList.remove('spinning');
        reelEl.querySelector('.symbol').textContent = finalSymbol;
        playReelStop();
        resolve();
      }, delay);
    });
  }

  async function spin() {
    if (spinning) return;
    if (tokens <= 0 || bet === 0) {
      setMessage(pick(BROKE_MESSAGES), 'broke-msg');
      playBroke();
      return;
    }
    if (bet > tokens) {
      clampBet();
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    spinning = true;
    spinBtn.disabled = true;
    reelWindows.forEach(w => w.classList.remove('winner'));
    messageArea.className = 'message-area';

    // Deduct bet
    tokens -= bet;
    updateTokenDisplay();
    flashTokens('losing');

    // Pick results
    const results = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];

    // Spin reels with staggered stops
    await Promise.all([
      spinReel(reels[0], results[0], 600),
      spinReel(reels[1], results[1], 1000),
      spinReel(reels[2], results[2], 1400),
    ]);

    // Evaluate
    const [a, b, c] = results;

    if (a === b && b === c) {
      // Triple!
      const multiplier = TRIPLE_PAYOUTS[a];
      const winnings = Math.floor(bet * multiplier);
      tokens += winnings;
      updateTokenDisplay();
      flashTokens('winning');
      setMessage(`${WIN_MESSAGES[a]} +${winnings} tokens!`, 'win-msg');
      reelWindows.forEach(w => w.classList.add('winner'));
      playWin();
    } else if (a === b || b === c || a === c) {
      // Pair
      const winnings = Math.floor(bet * PAIR_PAYOUT);
      tokens += winnings;
      updateTokenDisplay();
      flashTokens('winning');
      setMessage(`${pick(PAIR_MESSAGES)} +${winnings} tokens.`, 'win-msg');

      // Highlight matching reels
      if (a === b) { reelWindows[0].classList.add('winner'); reelWindows[1].classList.add('winner'); }
      if (b === c) { reelWindows[1].classList.add('winner'); reelWindows[2].classList.add('winner'); }
      if (a === c) { reelWindows[0].classList.add('winner'); reelWindows[2].classList.add('winner'); }
      playWin();
    } else {
      // Loss
      setMessage(pick(LOSS_MESSAGES), 'lose-msg');
      playLose();
    }

    clampBet();
    spinning = false;
    spinBtn.disabled = false;

    // Check if broke
    if (tokens <= 0) {
      tokens = 0;
      updateTokenDisplay();
      setMessage(pick(BROKE_MESSAGES), 'broke-msg');
      spinBtn.disabled = true;
      playBroke();

      // Auto-restart after a pause
      setTimeout(() => {
        tokens = 1000;
        bet = 10;
        updateTokenDisplay();
        betAmountEl.textContent = bet;
        setMessage("Fine. Here's 1,000 pity tokens. The AI is generous today.", '');
        spinBtn.disabled = false;
      }, 3000);
    }
  }

  spinBtn.addEventListener('click', spin);

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      spin();
    }
  });

  // Cycle idle messages
  setInterval(() => {
    if (!spinning && tokens > 0) {
      setMessage(pick(IDLE_MESSAGES));
    }
  }, 8000);

  // Init
  updateTokenDisplay();
  clampBet();
})();
