/* =========================================================================
   AI SLOT MACHINE - vanilla JS game logic
   Theme: satirizes AI hype. Players win/spend "tokens".
   ========================================================================= */

// ============================ SYMBOL DEFINITIONS ============================
// Each symbol has: emoji, weight (higher = more common), multiplier (triple payout),
// and a humorous AI-flavored description for the paytable.
const SLOT_SYMBOLS = [
  { emoji: "🤖", name: "bot",       weight: 30, multiplier: 2,   desc: "just another chatbot with a system prompt" },
  { emoji: "💬", name: "prompt",    weight: 25, multiplier: 3,   desc: "you are a helpful assistant..." },
  { emoji: "🧠", name: "neuron",    weight: 18, multiplier: 5,   desc: "one (1) artificial brain cell" },
  { emoji: "📊", name: "benchmark", weight: 12, multiplier: 8,   desc: "we beat GPT-4 on a benchmark we invented" },
  { emoji: "💎", name: "token",     weight: 8,  multiplier: 15,  desc: "priced like oil, burned like coal" },
  { emoji: "🦄", name: "unicorn",   weight: 5,  multiplier: 30,  desc: "$10B valuation, zero revenue" },
  { emoji: "🚀", name: "agi",       weight: 2,  multiplier: 100, desc: "2 weeks away. always." },
];

// ============================ GAME STATE ============================
const gameState = {
  balance: 1000,
  currentBet: 10,
  totalSpins: 0,
  totalWins: 0,
  totalWagered: 0,
  biggestHit: 0,
  peakBalance: 1000,
  consecutiveSpins: 0,
  history: [],
  isSpinning: false,
  muted: false,
};

// ============================ DOM REFERENCES ============================
const reelElements = [
  document.getElementById("reel0"),
  document.getElementById("reel1"),
  document.getElementById("reel2"),
];
const balanceDisplay     = document.getElementById("balanceDisplay");
const betDisplay         = document.getElementById("betDisplay");
const lastResultDisplay  = document.getElementById("lastResultDisplay");
const messageLine        = document.getElementById("messageLine");
const spinButton         = document.getElementById("spinButton");
const allInButton        = document.getElementById("allInButton");
const resetButton        = document.getElementById("resetButton");
const paytableToggle     = document.getElementById("paytableToggle");
const paytablePanel      = document.getElementById("paytablePanel");
const paytableBody       = document.getElementById("paytableBody");
const muteToggle         = document.getElementById("muteToggle");
const temperatureMeter   = document.getElementById("temperatureMeter");
const temperatureValue   = document.getElementById("temperatureValue");
const historyList        = document.getElementById("historyList");
const particleLayer      = document.getElementById("particleLayer");
const bankruptOverlay    = document.getElementById("bankruptOverlay");
const bankruptMessage    = document.getElementById("bankruptMessage");
const restartButton      = document.getElementById("restartButton");

// ============================ AUDIO ENGINE ============================
// Lazily created AudioContext; each sound uses attack/release envelopes.
let audioContext = null;
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency, duration, type = "square", attack = 0.005, release = 0.08, volume = 0.08) {
  if (gameState.muted) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.linearRampToValueAtTime(0, now + duration + release);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + release + 0.02);
}

const soundEffects = {
  tick:     () => playTone(880, 0.02, "square", 0.001, 0.02, 0.04),
  land:     () => playTone(330, 0.08, "triangle", 0.005, 0.1, 0.1),
  win:      () => {
    [523, 659, 784, 988].forEach((freq, index) =>
      setTimeout(() => playTone(freq, 0.12, "sine", 0.01, 0.15, 0.1), index * 80)
    );
  },
  lose:     () => playTone(150, 0.25, "sawtooth", 0.01, 0.2, 0.07),
  bankrupt: () => {
    [300, 240, 180, 120, 60].forEach((freq, index) =>
      setTimeout(() => playTone(freq, 0.2, "sawtooth", 0.01, 0.25, 0.12), index * 130)
    );
  },
};

// ============================ WEIGHTED SYMBOL PICK ============================
function pickWeightedSymbol() {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const symbol of SLOT_SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol;
  }
  return SLOT_SYMBOLS[0];
}

// ============================ REEL ANIMATION ============================
// Animates reels with mechanical stepping + staggered stops via requestAnimationFrame.
function spinReelsAnimated(finalSymbols, onComplete) {
  const stopTimes = [700, 1100, 1500]; // staggered stop ms
  const startTime = performance.now();
  const stepInterval = 75; // ms between symbol changes
  let nextStepAt = [0, 0, 0];
  const settled = [false, false, false];
  let lastTickSound = 0;

  reelElements.forEach((reel) => {
    reel.classList.remove("landed", "winning");
  });

  function frame(now) {
    const elapsed = now - startTime;

    for (let reelIndex = 0; reelIndex < 3; reelIndex++) {
      if (settled[reelIndex]) continue;

      if (elapsed >= stopTimes[reelIndex]) {
        // ============ LAND REEL ============
        const symbolEl = reelElements[reelIndex].querySelector(".symbol");
        symbolEl.textContent = finalSymbols[reelIndex].emoji;
        reelElements[reelIndex].classList.add("landed");
        settled[reelIndex] = true;
        soundEffects.land();
      } else if (elapsed >= nextStepAt[reelIndex]) {
        // ============ STEP TO RANDOM SYMBOL ============
        const symbolEl = reelElements[reelIndex].querySelector(".symbol");
        const randomPick = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        symbolEl.textContent = randomPick.emoji;
        nextStepAt[reelIndex] = elapsed + stepInterval;
        if (now - lastTickSound > 45) {
          soundEffects.tick();
          lastTickSound = now;
        }
      }
    }

    if (settled.every(Boolean)) {
      onComplete();
    } else {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

// ============================ PAYOUT LOGIC ============================
function evaluateSpin(symbols) {
  const [a, b, c] = symbols;

  // Triple match: full multiplier payout
  if (a.name === b.name && b.name === c.name) {
    return { type: "triple", winningIndices: [0, 1, 2], symbol: a, payout: gameState.currentBet * a.multiplier };
  }

  // Pair match: 1/3 of triple payout
  if (a.name === b.name) {
    return { type: "pair", winningIndices: [0, 1], symbol: a, payout: Math.floor((gameState.currentBet * a.multiplier) / 3) };
  }
  if (b.name === c.name) {
    return { type: "pair", winningIndices: [1, 2], symbol: b, payout: Math.floor((gameState.currentBet * b.multiplier) / 3) };
  }
  if (a.name === c.name) {
    return { type: "pair", winningIndices: [0, 2], symbol: a, payout: Math.floor((gameState.currentBet * a.multiplier) / 3) };
  }

  // No match - complete loss of bet
  return { type: "loss", winningIndices: [], symbol: null, payout: 0 };
}

// ============================ PARTICLE BURST ============================
function spawnParticleBurst() {
  const rect = particleLayer.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const characters = ["✦", "✺", "◆", "✹", "*", "$", "+"];

  for (let index = 0; index < 32; index++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.textContent = characters[Math.floor(Math.random() * characters.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 150;
    particle.style.left = centerX + "px";
    particle.style.top = centerY + "px";
    particle.style.setProperty("--dx", Math.cos(angle) * distance + "px");
    particle.style.setProperty("--dy", Math.sin(angle) * distance + "px");
    particleLayer.appendChild(particle);
    setTimeout(() => particle.remove(), 950);
  }
}

// ============================ TEMPERATURE METER ============================
// 10 discrete blocks; rises with consecutive spins, green -> red gradient.
function renderTemperatureMeter() {
  const activeBlocks = Math.min(10, gameState.consecutiveSpins);
  temperatureMeter.innerHTML = "";
  for (let blockIndex = 0; blockIndex < 10; blockIndex++) {
    const block = document.createElement("div");
    block.className = "temp-block";
    if (blockIndex < activeBlocks) {
      block.classList.add("active");
      // interpolate green -> yellow -> red
      const hue = Math.max(0, 120 - blockIndex * 13);
      block.style.background = `hsl(${hue}, 100%, 50%)`;
      block.style.color = `hsl(${hue}, 100%, 50%)`;
    }
    temperatureMeter.appendChild(block);
  }
  const temperatureValueNumber = (activeBlocks / 10) * 2;
  temperatureValue.textContent = temperatureValueNumber.toFixed(1);
}

// ============================ UI REFRESH ============================
function refreshDisplays() {
  balanceDisplay.textContent = gameState.balance;
  betDisplay.textContent = gameState.currentBet;

  document.getElementById("statSpins").textContent = gameState.totalSpins;
  const winRate = gameState.totalSpins > 0
    ? Math.round((gameState.totalWins / gameState.totalSpins) * 100)
    : 0;
  document.getElementById("statWinRate").textContent = winRate + "%";
  document.getElementById("statPeak").textContent = gameState.peakBalance;
  document.getElementById("statWagered").textContent = gameState.totalWagered;
  document.getElementById("statBiggest").textContent = gameState.biggestHit;

  // History list - render last 10
  historyList.innerHTML = "";
  for (const entry of gameState.history.slice(-10).reverse()) {
    const listItem = document.createElement("li");
    listItem.className = entry.payout > 0 ? "win" : "lose";
    const sign = entry.payout > 0 ? "+" : "-";
    const amount = entry.payout > 0 ? entry.payout : entry.bet;
    listItem.textContent = `${entry.emojis.join("")} ${sign}${amount}`;
    historyList.appendChild(listItem);
  }

  // Highlight current bet preset
  document.querySelectorAll(".bet-preset").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.bet) === gameState.currentBet);
  });
}

// ============================ SNARKY MESSAGES ============================
const WIN_MESSAGES = [
  "alignment achieved. rewards dispensed.",
  "stochastic parrot squawks in your favor.",
  "hallucination monetized successfully.",
  "investors rejoice. ethics board absent.",
];
const LOSE_MESSAGES = [
  "model refused to answer. bet consumed.",
  "context window exceeded. so was your budget.",
  "rate limited. tokens vaporized.",
  "the model is thinking... your money is gone.",
];
const BANKRUPT_MESSAGES = [
  '"Your free trial of capitalism has ended."',
  '"ERROR: wallet.balance cannot be negative."',
  '"Please insert more VC funding to continue."',
  '"The AI bubble burst. You were inside it."',
];

function randomFrom(array) { return array[Math.floor(Math.random() * array.length)]; }

// ============================ SPIN HANDLER ============================
function performSpin() {
  if (gameState.isSpinning) return;
  if (gameState.currentBet > gameState.balance) {
    messageLine.textContent = "> insufficient.tokens — lower the bet";
    messageLine.className = "message-line lose";
    return;
  }

  gameState.isSpinning = true;
  setControlsEnabled(false);

  // Deduct bet upfront
  gameState.balance -= gameState.currentBet;
  gameState.totalWagered += gameState.currentBet;
  gameState.totalSpins += 1;
  gameState.consecutiveSpins += 1;
  renderTemperatureMeter();
  refreshDisplays();

  messageLine.textContent = "> model.generate() streaming...";
  messageLine.className = "message-line";

  // Pick final symbols
  const finalSymbols = [pickWeightedSymbol(), pickWeightedSymbol(), pickWeightedSymbol()];

  spinReelsAnimated(finalSymbols, () => {
    // ============ AFTER REELS LAND ============
    const result = evaluateSpin(finalSymbols);
    const payout = result.payout;

    if (payout > 0) {
      // ============ WIN ============
      gameState.balance += payout;
      gameState.totalWins += 1;
      if (payout > gameState.biggestHit) gameState.biggestHit = payout;
      if (gameState.balance > gameState.peakBalance) gameState.peakBalance = gameState.balance;

      result.winningIndices.forEach((reelIndex) => reelElements[reelIndex].classList.add("winning"));

      const label = result.type === "triple" ? "TRIPLE" : "pair";
      messageLine.textContent = `> ${label} ${result.symbol.emoji} :: +${payout} tokens :: ${randomFrom(WIN_MESSAGES)}`;
      messageLine.className = "message-line win";
      lastResultDisplay.textContent = "+" + payout;
      soundEffects.win();
      spawnParticleBurst();
      // A win cools the model down
      gameState.consecutiveSpins = 0;
      renderTemperatureMeter();
    } else {
      // ============ LOSS ============
      messageLine.textContent = `> ${randomFrom(LOSE_MESSAGES)}`;
      messageLine.className = "message-line lose";
      lastResultDisplay.textContent = "-" + gameState.currentBet;
      soundEffects.lose();
    }

    // Record history
    gameState.history.push({
      emojis: finalSymbols.map((symbol) => symbol.emoji),
      payout: payout,
      bet: gameState.currentBet,
    });
    if (gameState.history.length > 40) gameState.history.shift();

    refreshDisplays();
    gameState.isSpinning = false;
    setControlsEnabled(true);

    // ============ BANKRUPT CHECK ============
    if (gameState.balance <= 0) {
      showBankruptOverlay();
    }
  });
}

// ============================ CONTROLS ============================
function setControlsEnabled(enabled) {
  spinButton.disabled = !enabled;
  allInButton.disabled = !enabled;
  document.querySelectorAll(".bet-preset").forEach((button) => (button.disabled = !enabled));
}

function setBetAmount(amount) {
  gameState.currentBet = Math.min(amount, Math.max(1, gameState.balance));
  refreshDisplays();
}

// ============================ BANKRUPT OVERLAY ============================
function showBankruptOverlay() {
  bankruptMessage.textContent = randomFrom(BANKRUPT_MESSAGES);
  bankruptOverlay.classList.remove("hidden");
  soundEffects.bankrupt();
}

function resetSession() {
  gameState.balance = 1000;
  gameState.currentBet = 10;
  gameState.totalSpins = 0;
  gameState.totalWins = 0;
  gameState.totalWagered = 0;
  gameState.biggestHit = 0;
  gameState.peakBalance = 1000;
  gameState.consecutiveSpins = 0;
  gameState.history = [];
  lastResultDisplay.textContent = "+0";
  messageLine.textContent = "> session.reset() complete";
  messageLine.className = "message-line";
  reelElements.forEach((reel) => {
    reel.classList.remove("landed", "winning");
    reel.querySelector(".symbol").textContent = "?";
  });
  bankruptOverlay.classList.add("hidden");
  renderTemperatureMeter();
  refreshDisplays();
}

// ============================ PAYTABLE RENDERING ============================
function buildPaytable() {
  paytableBody.innerHTML = "";
  for (const symbol of SLOT_SYMBOLS) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${symbol.emoji} ${symbol.name}</td>
      <td>x${symbol.multiplier}</td>
      <td>${symbol.desc}</td>
    `;
    paytableBody.appendChild(row);
  }
}

// ============================ EVENT WIRING ============================
spinButton.addEventListener("click", performSpin);

allInButton.addEventListener("click", () => {
  if (gameState.balance <= 0) return;
  setBetAmount(gameState.balance);
});

document.querySelectorAll(".bet-preset").forEach((button) => {
  button.addEventListener("click", () => setBetAmount(Number(button.dataset.bet)));
});

resetButton.addEventListener("click", resetSession);
restartButton.addEventListener("click", resetSession);

paytableToggle.addEventListener("click", () => {
  paytablePanel.classList.toggle("hidden");
  paytableToggle.textContent = paytablePanel.classList.contains("hidden")
    ? "paytable.show()"
    : "paytable.hide()";
});

muteToggle.addEventListener("click", () => {
  gameState.muted = !gameState.muted;
  muteToggle.textContent = gameState.muted ? "audio.off()" : "audio.on()";
});

// Keyboard: spacebar to spin
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !gameState.isSpinning) {
    event.preventDefault();
    performSpin();
  }
});

// ============================ INIT ============================
buildPaytable();
renderTemperatureMeter();
refreshDisplays();
