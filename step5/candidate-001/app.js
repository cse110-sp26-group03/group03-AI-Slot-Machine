/* ================================================
   TOKEN TIDES — AI-themed underwater slot machine
   ================================================ */

// ---- Slot symbols: ocean creatures with payout multipliers ----
const SYMBOLS = [
  { emoji: "🐙", name: "Octopus",   multiplier: 8 },
  { emoji: "🦈", name: "Shark",     multiplier: 6 },
  { emoji: "🐳", name: "Whale",     multiplier: 10 },
  { emoji: "🐡", name: "Pufferfish",multiplier: 4 },
  { emoji: "🦀", name: "Crab",      multiplier: 3 },
  { emoji: "🐠", name: "Tropical",  multiplier: 2 },
  { emoji: "🦞", name: "Lobster",   multiplier: 5 },
  { emoji: "🐢", name: "Turtle",    multiplier: 7 },
  { emoji: "🦑", name: "Squid",     multiplier: 4 },
];

// ---- AI quips that mock artificial intelligence ----
const AI_QUIPS = [
  '"I could hallucinate better odds."',
  '"This is basically gradient descent but for your wallet."',
  '"Your loss function is literally your bank account."',
  '"Spinning reels: the original neural network."',
  '"I trained on a billion parameters and still can\'t predict these."',
  '"Have you tried prompt-engineering your luck?"',
  '"This slot machine passes the Turing test for disappointment."',
  '"Error 402: Insufficient tokens."',
  '"My context window doesn\'t include your winning streak."',
  '"I\'m not biased — you\'re just unlucky."',
  '"Running inference on your poor life choices..."',
  '"Attention mechanism says: pay attention to your balance."',
  '"Your expected value is approximately zero. You\'re welcome."',
  '"Fine-tuning your gambling addiction since 2024."',
  '"RLHF couldn\'t fix these odds."',
];

// ---- Win celebration subtitles ----
const WIN_SUBTITLES = [
  '"Even GPT couldn\'t predict this."',
  '"The AI overlords smile upon you."',
  '"Tokens successfully hallucinated into existence."',
  '"Your prompt finally returned something useful."',
  '"Model output: pure dopamine."',
  '"Benchmark: you just beat the house."',
];

// ---- Game-over taunts ----
const GAME_OVER_TAUNTS = [
  '"Looks like your prompt engineering skills don\'t transfer to gambling."',
  '"Model collapsed. Out of tokens. Classic."',
  '"Even a random baseline would\'ve done better."',
  '"Training complete: you learned nothing."',
  '"Maybe try fine-tuning your strategy next time."',
];

// ---- Game state ----
const gameState = {
  balance: 1000,
  betAmount: 10,
  isSpinning: false,
  isMuted: false,
  totalSpins: 0,
  totalWins: 0,
  biggestWin: 0,
  spinHistory: [],       // last 10 results
  grid: [],              // current 3x3 symbol grid (indices into SYMBOLS)
};

// ---- Bet step sizes ----
const BET_STEPS = [5, 10, 25, 50, 100, 250, 500];

// ---- DOM references ----
const dom = {
  balanceAmount:   document.getElementById("balance-amount"),
  betAmount:       document.getElementById("bet-amount"),
  spinBtn:         document.getElementById("spin-btn"),
  allInBtn:        document.getElementById("all-in-btn"),
  betUp:           document.getElementById("bet-up"),
  betDown:         document.getElementById("bet-down"),
  muteBtn:         document.getElementById("mute-btn"),
  restartBtn:      document.getElementById("restart-btn"),
  reelGrid:        document.getElementById("reel-grid"),
  aiQuip:          document.getElementById("ai-quip"),
  // Stats
  statTotalSpins:  document.getElementById("stat-total-spins"),
  statWins:        document.getElementById("stat-wins"),
  statWinRate:     document.getElementById("stat-win-rate"),
  statBiggestWin:  document.getElementById("stat-biggest-win"),
  statAiMood:      document.getElementById("stat-ai-mood"),
  // History
  historyList:     document.getElementById("history-list"),
  // Win overlay
  winOverlay:      document.getElementById("win-overlay"),
  winTitle:        document.getElementById("win-title"),
  winAmount:       document.getElementById("win-amount"),
  winSubtitle:     document.getElementById("win-subtitle"),
  confettiContainer: document.getElementById("confetti-container"),
  // Game over
  gameOver:        document.getElementById("game-over"),
  goSpins:         document.getElementById("go-spins"),
  goBest:          document.getElementById("go-best"),
  gameOverRestart: document.getElementById("game-over-restart"),
};

// ---- All reel cells in row-major order ----
const reelCells = Array.from(dom.reelGrid.querySelectorAll(".reel-cell"));

/* ================================================
   AUDIO — Web Audio API beeps and boops
   ================================================ */
let audioContext = null;

/** Lazily create AudioContext (browser requires user gesture) */
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/** Play a simple tone */
function playTone(frequency, duration, type = "sine", volume = 0.15) {
  if (gameState.isMuted) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available — silently ignore
  }
}

/** Reel tick sound (fast clicking during spin) */
function playReelTick() {
  playTone(800 + Math.random() * 400, 0.05, "square", 0.06);
}

/** Spin start whoosh */
function playSpinStart() {
  playTone(200, 0.3, "sawtooth", 0.1);
}

/** Reel stop thud */
function playReelStop() {
  playTone(150, 0.15, "triangle", 0.12);
}

/** Win jingle — ascending notes */
function playWinSound(big) {
  const notes = big ? [523, 659, 784, 1047] : [523, 659, 784];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.25, "sine", 0.18), i * 120);
  });
}

/** Loss sound — descending buzz */
function playLossSound() {
  playTone(300, 0.15, "sawtooth", 0.08);
  setTimeout(() => playTone(200, 0.2, "sawtooth", 0.06), 100);
}

/* ================================================
   HELPERS
   ================================================ */

/** Pick a random item from an array */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a random symbol index */
function randomSymbolIndex() {
  return Math.floor(Math.random() * SYMBOLS.length);
}

/** Update the displayed balance */
function updateBalanceDisplay() {
  dom.balanceAmount.textContent = gameState.balance.toLocaleString();
}

/** Update bet display */
function updateBetDisplay() {
  dom.betAmount.textContent = gameState.betAmount.toLocaleString();
}

/** Update the stats panel */
function updateStatsPanel() {
  dom.statTotalSpins.textContent = gameState.totalSpins;
  dom.statWins.textContent = gameState.totalWins;
  const winRate = gameState.totalSpins > 0
    ? Math.round((gameState.totalWins / gameState.totalSpins) * 100)
    : 0;
  dom.statWinRate.textContent = winRate + "%";
  dom.statBiggestWin.textContent = gameState.biggestWin.toLocaleString();

  // AI mood based on player performance
  if (gameState.balance > 2000) dom.statAiMood.textContent = "😰";
  else if (gameState.balance > 1200) dom.statAiMood.textContent = "😟";
  else if (gameState.balance > 800) dom.statAiMood.textContent = "😐";
  else if (gameState.balance > 400) dom.statAiMood.textContent = "😏";
  else if (gameState.balance > 100) dom.statAiMood.textContent = "😈";
  else dom.statAiMood.textContent = "🤑";
}

/** Add an entry to the spin history panel (max 10) */
function addHistoryEntry(betAmount, winAmount) {
  gameState.spinHistory.unshift({ betAmount, winAmount });
  if (gameState.spinHistory.length > 10) {
    gameState.spinHistory.pop();
  }
  renderHistory();
}

/** Render the history list */
function renderHistory() {
  dom.historyList.innerHTML = "";
  if (gameState.spinHistory.length === 0) {
    dom.historyList.innerHTML = '<li class="history-empty">No spins yet...</li>';
    return;
  }
  gameState.spinHistory.forEach((entry) => {
    const li = document.createElement("li");
    const isWin = entry.winAmount > 0;
    li.className = isWin ? "history-win" : "history-loss";
    const netAmount = isWin ? `+${entry.winAmount}` : `-${entry.betAmount}`;
    li.textContent = `Bet ${entry.betAmount} → ${netAmount}`;
    dom.historyList.appendChild(li);
  });
}

/** Show a random AI quip */
function showRandomQuip() {
  dom.aiQuip.textContent = randomChoice(AI_QUIPS);
}

/* ================================================
   BET ADJUSTMENT
   ================================================ */

/** Increase bet to the next step */
function increaseBet() {
  if (gameState.isSpinning) return;
  const currentIndex = BET_STEPS.indexOf(gameState.betAmount);
  if (currentIndex < BET_STEPS.length - 1) {
    const nextBet = BET_STEPS[currentIndex + 1];
    // Don't allow bet higher than balance
    if (nextBet <= gameState.balance) {
      gameState.betAmount = nextBet;
    }
  }
  // If current bet isn't in BET_STEPS (e.g. after all-in), snap to nearest valid step
  if (currentIndex === -1) {
    const validStep = BET_STEPS.find(s => s > gameState.betAmount && s <= gameState.balance);
    if (validStep) gameState.betAmount = validStep;
  }
  updateBetDisplay();
}

/** Decrease bet to the previous step */
function decreaseBet() {
  if (gameState.isSpinning) return;
  const currentIndex = BET_STEPS.indexOf(gameState.betAmount);
  if (currentIndex > 0) {
    gameState.betAmount = BET_STEPS[currentIndex - 1];
  }
  // If current bet isn't in BET_STEPS, snap to nearest lower valid step
  if (currentIndex === -1) {
    const validSteps = BET_STEPS.filter(s => s < gameState.betAmount);
    if (validSteps.length > 0) {
      gameState.betAmount = validSteps[validSteps.length - 1];
    }
  }
  updateBetDisplay();
}

/** All-in: bet everything */
function allIn() {
  if (gameState.isSpinning) return;
  gameState.betAmount = gameState.balance;
  updateBetDisplay();
}

/* ================================================
   WINNING LOGIC
   ================================================ */

/**
 * Check the 3x3 grid for wins.
 * Returns an array of winning line objects: { cells: [indices], symbolIndex }
 * Wins = matching rows, columns, or diagonals (all 3 cells same symbol)
 */
function checkWins(grid) {
  const winningLines = [];

  // All possible lines in a 3x3 grid (row-major indices)
  const lines = [
    // Rows
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    // Columns
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    // Diagonals
    [0, 4, 8],
    [2, 4, 6],
  ];

  lines.forEach((line) => {
    const [a, b, c] = line;
    if (grid[a] === grid[b] && grid[b] === grid[c]) {
      winningLines.push({
        cells: line,
        symbolIndex: grid[a],
      });
    }
  });

  return winningLines;
}

/**
 * Calculate total payout from winning lines.
 * Each line pays: bet * symbol multiplier
 */
function calculatePayout(winningLines, betAmount) {
  let totalPayout = 0;
  winningLines.forEach((line) => {
    const symbol = SYMBOLS[line.symbolIndex];
    totalPayout += betAmount * symbol.multiplier;
  });
  return totalPayout;
}

/* ================================================
   SPIN MECHANICS
   ================================================ */

/** Set cell content to a symbol */
function setCellSymbol(cellIndex, symbolIndex) {
  const cell = reelCells[cellIndex];
  const symbolSpan = cell.querySelector(".symbol");
  symbolSpan.textContent = SYMBOLS[symbolIndex].emoji;
}

/** Clear all winning highlights from cells */
function clearWinHighlights() {
  reelCells.forEach((cell) => {
    cell.classList.remove("winning");
  });
}

/** Highlight winning cells */
function highlightWinningCells(winningLines) {
  const winningCellIndices = new Set();
  winningLines.forEach((line) => {
    line.cells.forEach((idx) => winningCellIndices.add(idx));
  });
  winningCellIndices.forEach((idx) => {
    reelCells[idx].classList.add("winning");
  });
}

/**
 * Main spin function.
 * Animates reels with staggered column stops, then checks for wins.
 */
async function spin() {
  // Guard: prevent double-spin and insufficient balance
  if (gameState.isSpinning) return;
  if (gameState.balance < gameState.betAmount) return;
  if (gameState.betAmount <= 0) return;

  gameState.isSpinning = true;
  dom.spinBtn.disabled = true;
  dom.allInBtn.disabled = true;

  // Clear previous win highlights instantly
  clearWinHighlights();

  // Deduct bet
  const currentBet = gameState.betAmount;
  gameState.balance -= currentBet;
  updateBalanceDisplay();

  // Generate final grid outcome
  const finalGrid = [];
  for (let i = 0; i < 9; i++) {
    finalGrid.push(randomSymbolIndex());
  }
  gameState.grid = finalGrid;

  // Play spin start sound
  playSpinStart();

  // Show random quip
  showRandomQuip();

  // Start spinning animation on all cells
  reelCells.forEach((cell) => cell.classList.add("spinning"));

  // Rapidly cycle symbols during spin
  const spinTickInterval = setInterval(() => {
    reelCells.forEach((cell, idx) => {
      if (cell.classList.contains("spinning")) {
        const symbolSpan = cell.querySelector(".symbol");
        symbolSpan.textContent = SYMBOLS[randomSymbolIndex()].emoji;
        playReelTick();
      }
    });
  }, 80);

  // Stop columns one at a time with staggered delays
  const columnStopDelays = [600, 1000, 1400]; // ms delay per column

  for (let col = 0; col < 3; col++) {
    await new Promise((resolve) => setTimeout(resolve, col === 0 ? columnStopDelays[0] : columnStopDelays[col] - columnStopDelays[col - 1]));

    // Stop the 3 cells in this column (rows 0, 1, 2)
    for (let row = 0; row < 3; row++) {
      const cellIndex = row * 3 + col;
      reelCells[cellIndex].classList.remove("spinning");
      setCellSymbol(cellIndex, finalGrid[cellIndex]);
    }
    playReelStop();
  }

  // Stop the rapid-cycling interval
  clearInterval(spinTickInterval);

  // Short pause to let the final symbols settle visually
  await new Promise((resolve) => setTimeout(resolve, 200));

  // ---- Evaluate results ----
  const winningLines = checkWins(finalGrid);
  const payout = calculatePayout(winningLines, currentBet);

  gameState.totalSpins++;

  if (payout > 0) {
    // Win!
    gameState.totalWins++;
    gameState.balance += payout;
    if (payout > gameState.biggestWin) {
      gameState.biggestWin = payout;
    }
    updateBalanceDisplay();
    highlightWinningCells(winningLines);
    addHistoryEntry(currentBet, payout);

    // Determine win tier for celebration
    const isBigWin = payout >= currentBet * 6;
    const isJackpot = winningLines.length >= 3;

    playWinSound(isBigWin || isJackpot);

    // Show dramatic win overlay
    await showWinOverlay(payout, isBigWin, isJackpot);
  } else {
    // Loss
    addHistoryEntry(currentBet, 0);
    playLossSound();
  }

  updateStatsPanel();

  // Clamp bet to balance if balance dropped below current bet
  if (gameState.betAmount > gameState.balance && gameState.balance > 0) {
    // Find the highest valid bet step at or below balance
    const validSteps = BET_STEPS.filter(s => s <= gameState.balance);
    gameState.betAmount = validSteps.length > 0 ? validSteps[validSteps.length - 1] : gameState.balance;
    updateBetDisplay();
  }

  gameState.isSpinning = false;
  dom.spinBtn.disabled = false;
  dom.allInBtn.disabled = false;

  // Check for game over
  if (gameState.balance <= 0) {
    showGameOver();
  }
}

/* ================================================
   WIN OVERLAY & CONFETTI
   ================================================ */

/** Create confetti pieces inside the overlay */
function spawnConfetti(count = 80) {
  dom.confettiContainer.innerHTML = "";
  const colors = ["#ffd700", "#ff6b6b", "#00b894", "#6c5ce7", "#fd79a8", "#00cec9", "#e17055", "#a29bfe"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = randomChoice(colors);
    piece.style.width = (Math.random() * 10 + 5) + "px";
    piece.style.height = (Math.random() * 10 + 5) + "px";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.animationDuration = (Math.random() * 2 + 1.5) + "s";
    piece.style.animationDelay = (Math.random() * 0.8) + "s";
    dom.confettiContainer.appendChild(piece);
  }
}

/** Show the dramatic win overlay, then auto-dismiss */
function showWinOverlay(amount, isBigWin, isJackpot) {
  return new Promise((resolve) => {
    // Set title based on win tier
    if (isJackpot) {
      dom.winTitle.textContent = "JACKPOT";
    } else if (isBigWin) {
      dom.winTitle.textContent = "BIG WIN";
    } else {
      dom.winTitle.textContent = "YOU WIN";
    }

    dom.winAmount.textContent = `+${amount.toLocaleString()} TOKENS`;
    dom.winSubtitle.textContent = randomChoice(WIN_SUBTITLES);

    spawnConfetti(isJackpot ? 150 : isBigWin ? 100 : 60);

    dom.winOverlay.classList.remove("hidden");

    // Auto-dismiss after a dramatic pause (click also dismisses)
    const displayDuration = isJackpot ? 3500 : isBigWin ? 2800 : 2000;

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      dom.winOverlay.classList.add("hidden");
      dom.confettiContainer.innerHTML = "";
      dom.winOverlay.removeEventListener("click", dismiss);
      resolve();
    };

    dom.winOverlay.addEventListener("click", dismiss);
    setTimeout(dismiss, displayDuration);
  });
}

/* ================================================
   GAME OVER
   ================================================ */

function showGameOver() {
  dom.goSpins.textContent = gameState.totalSpins;
  dom.goBest.textContent = gameState.biggestWin.toLocaleString();

  // Pick a random taunt
  const tauntEl = document.querySelector(".ai-taunt");
  tauntEl.textContent = randomChoice(GAME_OVER_TAUNTS);

  dom.gameOver.classList.remove("hidden");
}

/* ================================================
   RESTART / RESET
   ================================================ */

function restartGame() {
  gameState.balance = 1000;
  gameState.betAmount = 10;
  gameState.isSpinning = false;
  gameState.totalSpins = 0;
  gameState.totalWins = 0;
  gameState.biggestWin = 0;
  gameState.spinHistory = [];
  gameState.grid = [];

  updateBalanceDisplay();
  updateBetDisplay();
  updateStatsPanel();
  renderHistory();
  clearWinHighlights();

  // Reset grid symbols to defaults
  const defaultSymbols = [0, 4, 3, 6, 5, 1, 7, 2, 8];
  defaultSymbols.forEach((symIdx, cellIdx) => {
    setCellSymbol(cellIdx, symIdx);
  });

  dom.gameOver.classList.add("hidden");
  dom.winOverlay.classList.add("hidden");
  dom.spinBtn.disabled = false;
  dom.allInBtn.disabled = false;

  showRandomQuip();
}

/* ================================================
   MUTE TOGGLE
   ================================================ */

function toggleMute() {
  gameState.isMuted = !gameState.isMuted;
  dom.muteBtn.textContent = gameState.isMuted ? "🔇" : "🔊";
}

/* ================================================
   EVENT LISTENERS
   ================================================ */

// Spin button
dom.spinBtn.addEventListener("click", spin);

// Bet adjustment buttons
dom.betUp.addEventListener("click", increaseBet);
dom.betDown.addEventListener("click", decreaseBet);

// All-in button
dom.allInBtn.addEventListener("click", () => {
  allIn();
  spin();
});

// Mute toggle
dom.muteBtn.addEventListener("click", toggleMute);

// Restart buttons
dom.restartBtn.addEventListener("click", restartGame);
dom.gameOverRestart.addEventListener("click", restartGame);

// Keyboard controls
document.addEventListener("keydown", (event) => {
  // Don't respond to keys while overlays are visible
  if (!dom.gameOver.classList.contains("hidden")) return;
  if (!dom.winOverlay.classList.contains("hidden")) {
    // Dismiss win overlay on any key
    dom.winOverlay.click();
    return;
  }

  switch (event.key) {
    case "ArrowRight":
    case "ArrowUp":
      event.preventDefault();
      increaseBet();
      break;
    case "ArrowLeft":
    case "ArrowDown":
      event.preventDefault();
      decreaseBet();
      break;
    case " ":
    case "Enter":
      event.preventDefault();
      spin();
      break;
    case "m":
    case "M":
      toggleMute();
      break;
  }
});

/* ================================================
   INITIALIZATION
   ================================================ */

// Set initial display values
updateBalanceDisplay();
updateBetDisplay();
updateStatsPanel();
showRandomQuip();
