/* ==========================================================
   AI SLOT MACHINE — TOKEN BURNER 9000
   A satirical slot machine where tokens go to die.
   ========================================================== */

/* ==================== SYMBOL DEFINITIONS ==================== */
/* Each symbol has an emoji, display name, payout multiplier,
   weighted probability (higher = more common), and a snarky description. */
const SYMBOL_TABLE = [
  { emoji: "\uD83E\uDD16", name: "Robot",       multiplier: 2,   weight: 25, description: "Basic chatbot. Barely sentient." },
  { emoji: "\uD83E\uDDE0", name: "Brain",       multiplier: 3,   weight: 20, description: "Neural net. Mostly hallucinations." },
  { emoji: "\uD83D\uDCA1", name: "Lightbulb",   multiplier: 4,   weight: 18, description: "A startup idea worth $0." },
  { emoji: "\uD83D\uDD25", name: "Fire",        multiplier: 6,   weight: 14, description: "Your GPU after training." },
  { emoji: "\uD83D\uDE80", name: "Rocket",      multiplier: 8,   weight: 10, description: "To the moon! (of bankruptcy)" },
  { emoji: "\uD83D\uDC8E", name: "Gem",         multiplier: 12,  weight: 7,  description: "Rare. Like ethical AI funding." },
  { emoji: "\u2728",       name: "Sparkles",    multiplier: 20,  weight: 4,  description: "AGI achieved! (just kidding)" },
  { emoji: "\uD83E\uDDEC", name: "DNA",         multiplier: 50,  weight: 2,  description: "Synthetic superintelligence. Run." }
];

/* ==================== GAME CONSTANTS ==================== */
const STARTING_BALANCE = 1000;
const BET_STEPS = [10, 25, 50, 100, 250, 500];
const PAIR_PAYOUT_FRACTION = 1 / 3;
const MAX_HISTORY_LENGTH = 10;
const REEL_SYMBOL_COUNT = 40;           /* symbols per virtual reel strip */
const TEMPERATURE_BLOCKS = 10;
const TEMPERATURE_DECAY = 0.6;          /* multiplier per spin for cooling */
const TEMPERATURE_RISE = 0.12;          /* increment per consecutive spin */

/* ==================== BANKRUPT MESSAGES ==================== */
const BANKRUPT_MESSAGES = [
  "ERROR 402: Payment required. Your tokens have been hallucinated away.",
  "Model output: 'I'm sorry, but your balance appears to be... nothing.'",
  "Training complete. Loss: everything. Accuracy: 0%.",
  "Your portfolio has been optimized to zero. Peak efficiency.",
  "The AI determined the optimal allocation of your tokens was: elsewhere.",
  "FATAL: TokenUnderflowError — cannot subtract from void.",
  "Congratulations! You've reached token singularity: the point where all tokens converge to zero.",
  "sudo apt-get install more-tokens\n> E: Package 'more-tokens' has no installation candidate"
];

/* ==================== GAME STATE ==================== */
let playerBalance = STARTING_BALANCE;
let currentBetAmount = 25;
let isCurrentlySpinning = false;
let isSoundMuted = false;
let consecutiveSpinCount = 0;
let currentTemperature = 0;

/* Stats tracking */
let totalSpinsCount = 0;
let totalWinsCount = 0;
let peakBalanceAmount = STARTING_BALANCE;
let totalAmountWagered = 0;
let biggestSingleWin = 0;

/* Spin history log */
let spinHistoryLog = [];

/* ==================== DOM REFERENCES ==================== */
const balanceAmountDisplay = document.getElementById("balance-amount");
const spinButton = document.getElementById("spin-button");
const muteToggleButton = document.getElementById("mute-toggle");
const temperatureBar = document.getElementById("temp-bar");
const temperatureValueDisplay = document.getElementById("temp-value");
const spinHistoryContainer = document.getElementById("spin-history");
const paytableToggleButton = document.getElementById("paytable-toggle");
const paytablePanel = document.getElementById("paytable");
const paytableContent = document.getElementById("paytable-content");
const bankruptOverlay = document.getElementById("bankrupt-overlay");
const bankruptMessageText = document.getElementById("bankrupt-message");
const restartButton = document.getElementById("restart-button");
const particleCanvas = document.getElementById("particle-canvas");
const particleContext = particleCanvas.getContext("2d");

/* Stat display elements */
const statSpinsDisplay = document.getElementById("stat-spins");
const statWinrateDisplay = document.getElementById("stat-winrate");
const statPeakDisplay = document.getElementById("stat-peak");
const statWageredDisplay = document.getElementById("stat-wagered");
const statBiggestDisplay = document.getElementById("stat-biggest");

/* ==================== WEB AUDIO API — SOUND ENGINE ==================== */
let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/* Play a tone with attack/release envelope */
function playTone(frequency, duration, type, volume) {
  if (isSoundMuted) return;
  const ctx = ensureAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type || "square";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  const attackTime = 0.01;
  const releaseTime = Math.min(duration * 0.4, 0.1);
  const peakVolume = volume || 0.08;

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(peakVolume, ctx.currentTime + attackTime);
  gainNode.gain.setValueAtTime(peakVolume, ctx.currentTime + duration - releaseTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function playTickSound() {
  playTone(800, 0.04, "square", 0.04);
}

function playLandSound() {
  playTone(300, 0.12, "triangle", 0.1);
}

function playWinSound() {
  const ctx = ensureAudioContext();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, index) => {
    setTimeout(() => playTone(freq, 0.15, "square", 0.08), index * 100);
  });
}

function playLoseSound() {
  playTone(200, 0.25, "sawtooth", 0.06);
}

function playBankruptSound() {
  const notes = [400, 350, 300, 200, 150];
  notes.forEach((freq, index) => {
    setTimeout(() => playTone(freq, 0.2, "sawtooth", 0.07), index * 150);
  });
}

/* ==================== WEIGHTED RANDOM SYMBOL PICKER ==================== */
/* Build a cumulative weight table for efficient weighted selection */
const totalSymbolWeight = SYMBOL_TABLE.reduce((sum, s) => sum + s.weight, 0);
const cumulativeWeights = [];
let runningWeightTotal = 0;
for (const symbol of SYMBOL_TABLE) {
  runningWeightTotal += symbol.weight;
  cumulativeWeights.push(runningWeightTotal);
}

function pickRandomSymbolIndex() {
  const randomValue = Math.random() * totalSymbolWeight;
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (randomValue < cumulativeWeights[i]) return i;
  }
  return cumulativeWeights.length - 1;
}

/* ==================== REEL STRIP GENERATION ==================== */
/* Build a virtual strip of symbols for each reel */
function generateReelStrip(stripElement) {
  stripElement.innerHTML = "";
  const symbolIndices = [];
  for (let i = 0; i < REEL_SYMBOL_COUNT; i++) {
    const symbolIndex = pickRandomSymbolIndex();
    symbolIndices.push(symbolIndex);
    const symbolDiv = document.createElement("div");
    symbolDiv.className = "reel-symbol";
    symbolDiv.textContent = SYMBOL_TABLE[symbolIndex].emoji;
    stripElement.appendChild(symbolDiv);
  }
  return symbolIndices;
}

/* ==================== REEL ANIMATION ENGINE ==================== */
/* Each reel spins by stepping through symbols with requestAnimationFrame,
   creating a mechanical slot machine stepping motion. */

function animateReel(reelIndex, targetSymbolIndex, stopDelay) {
  return new Promise((resolve) => {
    const stripElement = document.getElementById(`strip-${reelIndex}`);
    const reelElement = document.getElementById(`reel-${reelIndex}`);
    const symbolHeight = reelElement.querySelector(".reel-window").clientHeight;

    /* Generate a fresh strip with the target symbol placed near the end */
    const totalSymbols = REEL_SYMBOL_COUNT;
    const targetPosition = totalSymbols - 3;

    stripElement.innerHTML = "";
    stripElement.classList.remove("landed");

    for (let i = 0; i < totalSymbols; i++) {
      const symbolDiv = document.createElement("div");
      symbolDiv.className = "reel-symbol";
      if (i === targetPosition) {
        symbolDiv.textContent = SYMBOL_TABLE[targetSymbolIndex].emoji;
      } else {
        symbolDiv.textContent = SYMBOL_TABLE[pickRandomSymbolIndex()].emoji;
      }
      stripElement.appendChild(symbolDiv);
    }

    /* Animate from top to the target position */
    const finalOffset = -(targetPosition * symbolHeight);
    let currentOffset = 0;
    let animationSpeed = symbolHeight * 0.5;
    let tickCounter = 0;
    const maxSpeed = symbolHeight * 1.2;
    const startTime = performance.now();
    let isDecelerating = false;

    function stepAnimation(timestamp) {
      const elapsedTime = timestamp - startTime;

      /* Accelerate during first phase, decelerate after stop delay */
      if (elapsedTime < stopDelay) {
        animationSpeed = Math.min(animationSpeed + 0.8, maxSpeed);
      } else {
        isDecelerating = true;
        animationSpeed = Math.max(animationSpeed * 0.92, symbolHeight * 0.15);
      }

      currentOffset -= animationSpeed;

      /* Play tick sound every full symbol step */
      const newTickCount = Math.floor(Math.abs(currentOffset) / symbolHeight);
      if (newTickCount > tickCounter) {
        tickCounter = newTickCount;
        if (tickCounter % 3 === 0) playTickSound();
      }

      /* Check if we've reached or passed the target */
      if (currentOffset <= finalOffset) {
        currentOffset = finalOffset;
        stripElement.style.transform = `translateY(${currentOffset}px)`;
        stripElement.classList.add("landed");
        playLandSound();
        resolve();
        return;
      }

      stripElement.style.transform = `translateY(${currentOffset}px)`;
      requestAnimationFrame(stepAnimation);
    }

    requestAnimationFrame(stepAnimation);
  });
}

/* ==================== SPIN LOGIC ==================== */
async function executeSpin() {
  if (isCurrentlySpinning) return;
  if (playerBalance <= 0) return;

  /* Resolve actual bet amount (handle all-in) */
  const actualBet = currentBetAmount === "all" ? playerBalance : Math.min(currentBetAmount, playerBalance);
  if (actualBet <= 0) return;

  isCurrentlySpinning = true;
  spinButton.disabled = true;
  spinButton.textContent = "generating...";

  /* Deduct bet */
  playerBalance -= actualBet;
  totalAmountWagered += actualBet;
  totalSpinsCount++;
  updateBalanceDisplay();

  /* Update temperature — rises with consecutive spins */
  consecutiveSpinCount++;
  currentTemperature = Math.min(1, currentTemperature + TEMPERATURE_RISE);
  updateTemperatureDisplay();

  /* Pick 3 random results */
  const reelResults = [
    pickRandomSymbolIndex(),
    pickRandomSymbolIndex(),
    pickRandomSymbolIndex()
  ];

  /* Animate all 3 reels with staggered stop times */
  await Promise.all([
    animateReel(0, reelResults[0], 600),
    animateReel(1, reelResults[1], 1000),
    animateReel(2, reelResults[2], 1400)
  ]);

  /* ==================== EVALUATE RESULTS ==================== */
  const resultSymbols = reelResults.map(i => SYMBOL_TABLE[i]);
  let winAmount = 0;
  let matchType = "";

  /* Check for triple match */
  if (reelResults[0] === reelResults[1] && reelResults[1] === reelResults[2]) {
    winAmount = Math.floor(actualBet * resultSymbols[0].multiplier);
    matchType = "TRIPLE";
  }
  /* Check for any pair match */
  else if (reelResults[0] === reelResults[1] || reelResults[1] === reelResults[2] || reelResults[0] === reelResults[2]) {
    /* Find the matching symbol */
    let matchedIndex;
    if (reelResults[0] === reelResults[1]) matchedIndex = reelResults[0];
    else if (reelResults[1] === reelResults[2]) matchedIndex = reelResults[1];
    else matchedIndex = reelResults[0];
    winAmount = Math.floor(actualBet * SYMBOL_TABLE[matchedIndex].multiplier * PAIR_PAYOUT_FRACTION);
    matchType = "PAIR";
  }

  /* Apply winnings */
  const isWin = winAmount > 0;
  if (isWin) {
    playerBalance += winAmount;
    totalWinsCount++;
    if (winAmount > biggestSingleWin) biggestSingleWin = winAmount;
    if (playerBalance > peakBalanceAmount) peakBalanceAmount = playerBalance;
  }

  /* ==================== UPDATE UI AFTER SPIN ==================== */
  updateBalanceDisplay();
  flashBalance(isWin);
  updateStatsDisplay();

  /* Sound effects */
  if (isWin) {
    playWinSound();
    spawnWinParticles();
  } else {
    playLoseSound();
  }

  /* Add to spin history */
  const historyEmojis = reelResults.map(i => SYMBOL_TABLE[i].emoji).join("");
  const historyNote = isWin ? `+${winAmount}` : `-${actualBet}`;
  addSpinHistoryEntry(historyEmojis, historyNote, isWin);

  /* Re-enable spin or show bankrupt */
  isCurrentlySpinning = false;
  if (playerBalance <= 0) {
    showBankruptScreen();
  } else {
    spinButton.disabled = false;
    spinButton.textContent = "model.generate()";
  }
}

/* ==================== BALANCE DISPLAY UPDATES ==================== */
function updateBalanceDisplay() {
  balanceAmountDisplay.textContent = playerBalance;
}

function flashBalance(isWin) {
  const flashClass = isWin ? "win-flash" : "lose-flash";
  balanceAmountDisplay.classList.add(flashClass);
  setTimeout(() => balanceAmountDisplay.classList.remove(flashClass), 500);
}

/* ==================== TEMPERATURE DISPLAY ==================== */
function buildTemperatureBar() {
  temperatureBar.innerHTML = "";
  const blockColors = [
    "#00ff41", "#33ff33", "#66ff00", "#99ff00", "#ccff00",
    "#ffff00", "#ffcc00", "#ff9900", "#ff5500", "#ff0000"
  ];
  for (let i = 0; i < TEMPERATURE_BLOCKS; i++) {
    const block = document.createElement("div");
    block.className = "temp-block";
    block.style.color = blockColors[i];
    block.dataset.color = blockColors[i];
    temperatureBar.appendChild(block);
  }
}

function updateTemperatureDisplay() {
  const blocks = temperatureBar.querySelectorAll(".temp-block");
  const activeBlockCount = Math.round(currentTemperature * TEMPERATURE_BLOCKS);
  blocks.forEach((block, index) => {
    if (index < activeBlockCount) {
      block.classList.add("active");
      block.style.background = block.dataset.color;
    } else {
      block.classList.remove("active");
      block.style.background = "#1a1a1a";
    }
  });
  temperatureValueDisplay.textContent = currentTemperature.toFixed(1);

  /* Decay temperature over time */
  clearTimeout(updateTemperatureDisplay.decayTimer);
  updateTemperatureDisplay.decayTimer = setTimeout(() => {
    if (!isCurrentlySpinning) {
      currentTemperature = Math.max(0, currentTemperature * TEMPERATURE_DECAY);
      consecutiveSpinCount = 0;
      updateTemperatureDisplay();
    }
  }, 3000);
}

/* ==================== STATS DISPLAY ==================== */
function updateStatsDisplay() {
  statSpinsDisplay.textContent = totalSpinsCount;
  const winRate = totalSpinsCount > 0 ? ((totalWinsCount / totalSpinsCount) * 100).toFixed(1) : "0.0";
  statWinrateDisplay.textContent = `${winRate}%`;
  statPeakDisplay.textContent = peakBalanceAmount;
  statWageredDisplay.textContent = totalAmountWagered;
  statBiggestDisplay.textContent = biggestSingleWin;
}

/* ==================== SPIN HISTORY ==================== */
function addSpinHistoryEntry(emojis, note, isWin) {
  spinHistoryLog.unshift({ emojis, note, isWin });
  if (spinHistoryLog.length > MAX_HISTORY_LENGTH) {
    spinHistoryLog.pop();
  }
  renderSpinHistory();
}

function renderSpinHistory() {
  spinHistoryContainer.innerHTML = "";
  for (const entry of spinHistoryLog) {
    const entryDiv = document.createElement("div");
    entryDiv.className = `history-entry ${entry.isWin ? "win" : "lose"}`;
    entryDiv.textContent = `${entry.emojis} ${entry.note}`;
    spinHistoryContainer.appendChild(entryDiv);
  }
}

/* ==================== PAYTABLE ==================== */
function buildPaytable() {
  paytableContent.innerHTML = "";
  for (const symbol of SYMBOL_TABLE) {
    const row = document.createElement("div");
    row.className = "paytable-row";
    row.innerHTML = `
      <span class="paytable-symbol">${symbol.emoji}</span>
      <span class="paytable-name">${symbol.name}</span>
      <span class="paytable-desc">${symbol.description}</span>
      <span class="paytable-mult">x${symbol.multiplier}</span>
    `;
    paytableContent.appendChild(row);
  }
}

/* ==================== PARTICLE BURST ON WIN ==================== */
let activeParticles = [];

function resizeParticleCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}

function spawnWinParticles() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 3;
  const particleCount = 60;

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 5;
    activeParticles.push({
      x: centerX,
      y: centerY,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 2,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02,
      size: 2 + Math.random() * 4,
      hue: 100 + Math.random() * 60   /* green-yellow range */
    });
  }

  if (!spawnWinParticles.animating) {
    spawnWinParticles.animating = true;
    animateParticles();
  }
}

function animateParticles() {
  particleContext.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  activeParticles = activeParticles.filter(p => p.life > 0);

  for (const particle of activeParticles) {
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    particle.velocityY += 0.08;    /* gravity */
    particle.life -= particle.decay;

    particleContext.fillStyle = `hsla(${particle.hue}, 100%, 60%, ${particle.life})`;
    particleContext.fillRect(particle.x, particle.y, particle.size, particle.size);
  }

  if (activeParticles.length > 0) {
    requestAnimationFrame(animateParticles);
  } else {
    spawnWinParticles.animating = false;
    particleContext.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  }
}

/* ==================== BANKRUPT SCREEN ==================== */
function showBankruptScreen() {
  playBankruptSound();
  const randomMessage = BANKRUPT_MESSAGES[Math.floor(Math.random() * BANKRUPT_MESSAGES.length)];
  bankruptMessageText.textContent = randomMessage;
  bankruptOverlay.classList.remove("hidden");
}

function restartGame() {
  playerBalance = STARTING_BALANCE;
  currentBetAmount = 25;
  isCurrentlySpinning = false;
  consecutiveSpinCount = 0;
  currentTemperature = 0;
  totalSpinsCount = 0;
  totalWinsCount = 0;
  peakBalanceAmount = STARTING_BALANCE;
  totalAmountWagered = 0;
  biggestSingleWin = 0;
  spinHistoryLog = [];

  updateBalanceDisplay();
  updateStatsDisplay();
  updateTemperatureDisplay();
  renderSpinHistory();

  /* Reset bet button selection */
  document.querySelectorAll(".bet-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector('.bet-btn[data-bet="25"]').classList.add("active");

  /* Reset reels to show random symbols */
  for (let i = 0; i < 3; i++) {
    const stripElement = document.getElementById(`strip-${i}`);
    stripElement.innerHTML = "";
    stripElement.style.transform = "translateY(0)";
    stripElement.classList.remove("landed");
    const symbolDiv = document.createElement("div");
    symbolDiv.className = "reel-symbol";
    symbolDiv.textContent = SYMBOL_TABLE[pickRandomSymbolIndex()].emoji;
    stripElement.appendChild(symbolDiv);
  }

  bankruptOverlay.classList.add("hidden");
  spinButton.disabled = false;
  spinButton.textContent = "model.generate()";
}

/* ==================== EVENT LISTENERS ==================== */

/* Spin button */
spinButton.addEventListener("click", executeSpin);

/* Bet buttons */
document.querySelectorAll(".bet-btn").forEach(button => {
  button.addEventListener("click", () => {
    if (isCurrentlySpinning) return;
    document.querySelectorAll(".bet-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    const betValue = button.dataset.bet;
    currentBetAmount = betValue === "all" ? "all" : parseInt(betValue, 10);
  });
});

/* Mute toggle */
muteToggleButton.addEventListener("click", () => {
  isSoundMuted = !isSoundMuted;
  muteToggleButton.textContent = isSoundMuted ? "SOUND: OFF" : "SOUND: ON";
});

/* Paytable toggle */
paytableToggleButton.addEventListener("click", () => {
  paytablePanel.classList.toggle("hidden");
});

/* Restart button */
restartButton.addEventListener("click", restartGame);

/* Keyboard shortcut — spacebar to spin */
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !isCurrentlySpinning && bankruptOverlay.classList.contains("hidden")) {
    event.preventDefault();
    executeSpin();
  }
});

/* Resize particle canvas on window resize */
window.addEventListener("resize", resizeParticleCanvas);

/* ==================== INITIALIZATION ==================== */
function initializeGame() {
  resizeParticleCanvas();
  buildTemperatureBar();
  buildPaytable();
  updateBalanceDisplay();
  updateStatsDisplay();

  /* Place an initial random symbol on each reel */
  for (let i = 0; i < 3; i++) {
    const stripElement = document.getElementById(`strip-${i}`);
    stripElement.innerHTML = "";
    const symbolDiv = document.createElement("div");
    symbolDiv.className = "reel-symbol";
    symbolDiv.textContent = SYMBOL_TABLE[pickRandomSymbolIndex()].emoji;
    stripElement.appendChild(symbolDiv);
  }
}

initializeGame();
