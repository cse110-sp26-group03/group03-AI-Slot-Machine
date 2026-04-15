/* ============================================
   DEEP SEA AI SLOTS — app.js
   A slot machine that makes fun of AI,
   themed like an aquarium with ocean symbols.
   ============================================ */

// ====== SYMBOL DEFINITIONS ======
// Each symbol has an emoji, a name, a weight (higher = more common), and a payout multiplier.
// Ocean/fish creatures doubling as AI parodies.
const SYMBOLS = [
  { emoji: "🐙", name: "Hallucinating Octopus",  weight: 5,  payout: 50 },  // Jackpot — rarest
  { emoji: "🦈", name: "Shark GPT",              weight: 8,  payout: 25 },
  { emoji: "🐋", name: "Whale Model",            weight: 10, payout: 15 },
  { emoji: "🐡",  name: "Pufferfish Prompt",     weight: 14, payout: 10 },
  { emoji: "🦑", name: "Squid Tokenizer",        weight: 16, payout: 7  },
  { emoji: "🐠", name: "Tropical Transformer",   weight: 20, payout: 5  },
  { emoji: "🦀", name: "Crab Crawler",           weight: 22, payout: 3  },
  { emoji: "🐚", name: "Shell Script",           weight: 25, payout: 2  },
  { emoji: "🪸",  name: "Coral Cache",           weight: 28, payout: 1  },
];

// Build a weighted pool for random selection
const WEIGHTED_POOL = buildWeightedPool(SYMBOLS);

// ====== GAME STATE ======
let tokenBalance = 1000;     // Starting tokens
let currentBet = 10;         // Current wager per spin
const MIN_BET = 5;           // Minimum bet allowed
const MAX_BET = 500;         // Maximum bet allowed
const BET_STEP = 5;          // Bet increment/decrement step
let isSpinning = false;      // Lock to prevent double-spins
let isMuted = false;         // Sound toggle state

// Stats tracking
let totalSpins = 0;
let totalWins = 0;
let biggestWin = 0;
let totalTokensWon = 0;
let totalTokensLost = 0;

// Spin history (most recent first)
const spinHistory = [];
const MAX_HISTORY = 50;      // Cap history entries

// The current 3x3 grid state (array of 3 rows, each with 3 symbol objects)
let gridState = [
  [SYMBOLS[3], SYMBOLS[3], SYMBOLS[3]],
  [SYMBOLS[3], SYMBOLS[3], SYMBOLS[3]],
  [SYMBOLS[3], SYMBOLS[3], SYMBOLS[3]],
];

// ====== AI HUMOR QUIPS ======
// Shown after each spin to roast the player or AI
const QUIPS_WIN = [
  '"The AI predicted you\'d win. It was wrong 99% of the time, but hey."',
  '"You beat the algorithm! (It wasn\'t trying very hard.)"',
  '"Tokens acquired. Sentience still pending."',
  '"Even a broken neural net is right twice a day."',
  '"Your reward function is temporarily satisfied."',
  '"The model hallucinated a win — but this time it\'s real!"',
  '"Congratulations! You\'ve been positively reinforced."',
  '"This win was not in the training data. Impressive."',
];

const QUIPS_LOSE = [
  '"Thank you for your contribution to the compute fund."',
  '"Tokens go in, nothing comes out. Classic AI."',
  '"The model has learned to take your tokens efficiently."',
  '"Your prompt was rejected. And so were your tokens."',
  '"Error 402: Payment required. Oh wait, we already took it."',
  '"The AI appreciates your generous donation."',
  '"Training data suggests you should stop. You won\'t."',
  '"Context window: shrinking. Wallet: also shrinking."',
  '"Overfitting to the belief that the next spin will be different."',
  '"The loss function is working as intended… for us."',
];

const QUIPS_JACKPOT = [
  '"You\'ve broken the simulation. The octopus is not amused."',
  '"MAXIMUM HALLUCINATION ACHIEVED. Tokens are real though."',
  '"The AI didn\'t see this coming. Neither did your bank account."',
];

// ====== DOM REFERENCES ======
const tokenCountEl = document.getElementById("token-count");
const betAmountEl = document.getElementById("bet-amount");
const lastWinEl = document.getElementById("last-win");
const spinBtn = document.getElementById("spin-btn");
const allInBtn = document.getElementById("allin-btn");
const muteBtn = document.getElementById("mute-btn");
const betUpBtn = document.getElementById("bet-up");
const betDownBtn = document.getElementById("bet-down");
const quipText = document.getElementById("quip-text");
const slotGrid = document.getElementById("slot-grid");
const statTotalSpins = document.getElementById("stat-total-spins");
const statWins = document.getElementById("stat-wins");
const statWinRate = document.getElementById("stat-win-rate");
const statBiggestWin = document.getElementById("stat-biggest-win");
const statTokensWon = document.getElementById("stat-tokens-won");
const statTokensLost = document.getElementById("stat-tokens-lost");
const historyList = document.getElementById("history-list");
const jackpotOverlay = document.getElementById("jackpot-overlay");
const jackpotAmount = document.getElementById("jackpot-amount");
const jackpotDismissBtn = document.getElementById("jackpot-dismiss-btn");
const gameoverOverlay = document.getElementById("gameover-overlay");
const gameoverSpins = document.getElementById("gameover-spins");
const restartBtn = document.getElementById("restart-btn");
const paytableEl = document.getElementById("paytable");

// ====== AUDIO SYSTEM ======
// Using Web Audio API to generate sounds without external files
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

/**
 * Lazily initializes the audio context (must be triggered by user gesture).
 */
function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/**
 * Plays a simple synthesized tone.
 * @param {number} frequency - Frequency in Hz
 * @param {string} waveType - Oscillator type (sine, square, triangle, sawtooth)
 * @param {number} duration - Duration in seconds
 * @param {number} volume - Gain value 0-1
 */
function playTone(frequency, waveType, duration, volume = 0.3) {
  if (isMuted) return;
  ensureAudioContext();

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  // Fade out to avoid clicks
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration);
}

/** Plays the spinning tick sound — a quick blip for each symbol change */
function playSoundSpinTick() {
  playTone(600 + Math.random() * 200, "sine", 0.05, 0.1);
}

/** Plays the reel-stop sound — a satisfying thud */
function playSoundReelStop() {
  playTone(250, "triangle", 0.15, 0.25);
}

/** Plays a cheerful ascending tone for a win */
function playSoundWin() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, "sine", 0.2, 0.3), i * 100);
  });
}

/** Plays a descending sad tone for a loss */
function playSoundLose() {
  playTone(300, "sawtooth", 0.3, 0.15);
  setTimeout(() => playTone(200, "sawtooth", 0.4, 0.1), 150);
}

/** Plays a dramatic jackpot fanfare */
function playSoundJackpot() {
  const notes = [523, 659, 784, 1047, 1319, 1568]; // rising scale
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, "square", 0.3, 0.25), i * 120);
  });
  // Big finish
  setTimeout(() => playTone(2093, "sine", 0.8, 0.35), notes.length * 120);
}

/** Plays a grim game-over sound */
function playSoundGameOver() {
  const notes = [400, 350, 300, 200];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, "sawtooth", 0.4, 0.2), i * 200);
  });
}

// ====== UTILITY FUNCTIONS ======

/**
 * Builds a flat array pool from weighted symbols for random selection.
 * Symbols with higher weight appear more often.
 * @param {Array} symbols - Array of symbol objects with weight property
 * @returns {Array} Flat array of symbol objects
 */
function buildWeightedPool(symbols) {
  const pool = [];
  for (const symbol of symbols) {
    for (let i = 0; i < symbol.weight; i++) {
      pool.push(symbol);
    }
  }
  return pool;
}

/**
 * Picks a random symbol from the weighted pool.
 * @returns {Object} A random symbol object
 */
function getRandomSymbol() {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}

/**
 * Picks a random element from an array.
 * @param {Array} arr - The array to pick from
 * @returns {*} A random element
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns all the slot cell DOM elements in row-major order.
 * @returns {NodeList} The 9 slot-cell elements
 */
function getSlotCells() {
  return slotGrid.querySelectorAll(".slot-cell");
}

// ====== DISPLAY UPDATE FUNCTIONS ======

/** Updates the token count display with a pulse animation */
function updateTokenDisplay(direction) {
  tokenCountEl.textContent = tokenBalance;
  if (direction) {
    tokenCountEl.classList.remove("pulse-up", "pulse-down");
    // Force reflow so re-adding the class triggers the animation again
    void tokenCountEl.offsetWidth;
    tokenCountEl.classList.add(direction === "up" ? "pulse-up" : "pulse-down");
  }
}

/** Updates the bet amount display */
function updateBetDisplay() {
  betAmountEl.textContent = currentBet;
}

/** Updates the last win display */
function updateLastWinDisplay(amount) {
  lastWinEl.textContent = amount;
}

/** Updates all stats panel values */
function updateStatsPanel() {
  statTotalSpins.textContent = totalSpins;
  statWins.textContent = totalWins;
  statWinRate.textContent = totalSpins > 0
    ? Math.round((totalWins / totalSpins) * 100) + "%"
    : "0%";
  statBiggestWin.textContent = biggestWin;
  statTokensWon.textContent = totalTokensWon;
  statTokensLost.textContent = totalTokensLost;
}

/** Shows a random quip in the banner */
function showQuip(type) {
  let quip;
  if (type === "jackpot") {
    quip = randomChoice(QUIPS_JACKPOT);
  } else if (type === "win") {
    quip = randomChoice(QUIPS_WIN);
  } else {
    quip = randomChoice(QUIPS_LOSE);
  }
  quipText.style.opacity = "0";
  setTimeout(() => {
    quipText.textContent = quip;
    quipText.style.opacity = "1";
  }, 200);
}

/**
 * Renders the grid state to the DOM.
 * Optionally highlights winning cells.
 * @param {Set|null} winningCellKeys - Set of "row,col" strings to highlight
 */
function renderGrid(winningCellKeys = null) {
  const cells = getSlotCells();
  cells.forEach((cell) => {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const symbol = gridState[row][col];
    cell.querySelector(".symbol").textContent = symbol.emoji;
    cell.classList.remove("winner", "spinning");

    if (winningCellKeys && winningCellKeys.has(`${row},${col}`)) {
      cell.classList.add("winner");
    }
  });
}

// ====== SPIN HISTORY ======

/**
 * Adds a spin result to the history panel.
 * @param {Array} middleRow - The 3 symbols from the middle row (or representative row)
 * @param {number} winAmount - How much was won (0 if loss)
 * @param {number} betAmount - The bet for this spin
 */
function addHistoryEntry(middleRow, winAmount, betAmount) {
  const isWin = winAmount > 0;
  const symbolStr = middleRow.map((s) => s.emoji).join(" ");

  // Create entry object
  spinHistory.unshift({
    symbols: symbolStr,
    win: winAmount,
    bet: betAmount,
    isWin: isWin,
    spinNumber: totalSpins,
  });

  // Cap history
  if (spinHistory.length > MAX_HISTORY) {
    spinHistory.pop();
  }

  // Re-render history list
  renderHistory();
}

/** Re-renders the history list from spinHistory array */
function renderHistory() {
  if (spinHistory.length === 0) {
    historyList.innerHTML =
      '<p class="history-empty">No spins yet. Your tokens are temporarily safe.</p>';
    return;
  }

  historyList.innerHTML = spinHistory
    .map((entry) => {
      const resultClass = entry.isWin ? "win" : "loss";
      const resultText = entry.isWin ? `+${entry.win}` : `-${entry.bet}`;
      return `
        <div class="history-entry ${resultClass}">
          <span class="history-symbols">${entry.symbols}</span>
          <span>Spin #${entry.spinNumber} · Bet: ${entry.bet}</span>
          <span class="history-result ${resultClass}">${resultText}</span>
        </div>`;
    })
    .join("");
}

// ====== WIN DETECTION ======

/**
 * Checks the 3x3 grid for winning combinations.
 * Winning lines: 3 rows, 3 columns, 2 diagonals = 8 possible lines.
 * Returns the total payout multiplier and the set of winning cell coordinates.
 * @returns {{ totalMultiplier: number, winningCells: Set<string>, isJackpot: boolean }}
 */
function checkWins() {
  let totalMultiplier = 0;
  const winningCells = new Set();
  let isJackpot = false;

  // Define all 8 possible winning lines as [row,col] triples
  const lines = [
    // Rows
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    // Columns
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    // Diagonals
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    const symbolA = gridState[a[0]][a[1]];
    const symbolB = gridState[b[0]][b[1]];
    const symbolC = gridState[c[0]][c[1]];

    // Three matching symbols = a win on this line
    if (symbolA.emoji === symbolB.emoji && symbolB.emoji === symbolC.emoji) {
      totalMultiplier += symbolA.payout;

      // Mark these cells as winners
      line.forEach(([r, col]) => winningCells.add(`${r},${col}`));

      // Check if it's the jackpot symbol (octopus)
      if (symbolA.emoji === "🐙") {
        isJackpot = true;
      }
    }
  }

  return { totalMultiplier, winningCells, isJackpot };
}

// ====== SPIN ANIMATION ======

/**
 * Runs the spinning animation for the 3x3 grid.
 * Each column stops at staggered intervals for dramatic effect.
 * @returns {Promise} Resolves when animation is complete
 */
function animateSpin() {
  return new Promise((resolve) => {
    const cells = getSlotCells();
    const spinDurationBase = 800;   // Base spin time in ms
    const columnDelay = 400;        // Extra delay per column
    const tickInterval = 80;        // How fast symbols cycle during spin

    // Start all cells spinning
    cells.forEach((cell) => cell.classList.add("spinning"));

    // Set up cycling intervals for each column
    const columnIntervals = [null, null, null];

    for (let col = 0; col < 3; col++) {
      // Cycle symbols rapidly during spin
      columnIntervals[col] = setInterval(() => {
        for (let row = 0; row < 3; row++) {
          const randomSym = getRandomSymbol();
          const cell = slotGrid.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
          );
          cell.querySelector(".symbol").textContent = randomSym.emoji;
        }
        playSoundSpinTick();
      }, tickInterval);

      // Stop each column after staggered delay
      const stopTime = spinDurationBase + col * columnDelay;
      setTimeout(() => {
        clearInterval(columnIntervals[col]);

        // Set final symbols from gridState
        for (let row = 0; row < 3; row++) {
          const cell = slotGrid.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
          );
          cell.querySelector(".symbol").textContent =
            gridState[row][col].emoji;
          cell.classList.remove("spinning");
        }
        playSoundReelStop();

        // If last column, resolve
        if (col === 2) {
          setTimeout(resolve, 150);
        }
      }, stopTime);
    }
  });
}

// ====== JACKPOT & GAME OVER OVERLAYS ======

/**
 * Shows the full-screen jackpot celebration.
 * @param {number} amount - The jackpot winnings
 * @returns {Promise} Resolves when player dismisses
 */
function showJackpot(amount) {
  return new Promise((resolve) => {
    jackpotAmount.textContent = `+${amount} TOKENS`;
    jackpotOverlay.classList.remove("hidden");
    playSoundJackpot();

    const dismiss = () => {
      jackpotOverlay.classList.add("hidden");
      jackpotDismissBtn.removeEventListener("click", dismiss);
      resolve();
    };
    jackpotDismissBtn.addEventListener("click", dismiss);
  });
}

/** Shows the game-over screen when tokens hit zero */
function showGameOver() {
  gameoverSpins.textContent = totalSpins;
  gameoverOverlay.classList.remove("hidden");
  playSoundGameOver();
}

/** Resets the entire game state and hides overlays */
function restartGame() {
  tokenBalance = 1000;
  currentBet = 10;
  totalSpins = 0;
  totalWins = 0;
  biggestWin = 0;
  totalTokensWon = 0;
  totalTokensLost = 0;
  spinHistory.length = 0;
  isSpinning = false;

  // Reset grid to pufferfish
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      gridState[r][c] = SYMBOLS[3];
    }
  }

  updateTokenDisplay();
  updateBetDisplay();
  updateLastWinDisplay(0);
  updateStatsPanel();
  renderHistory();
  renderGrid();

  gameoverOverlay.classList.add("hidden");
  quipText.textContent =
    '"Spinning up the neural nets… please hold your hallucinations."';

  spinBtn.disabled = false;
  allInBtn.disabled = false;
}

// ====== CORE SPIN LOGIC ======

/**
 * Executes a single spin of the slot machine.
 * Deducts the bet, generates random symbols, checks for wins,
 * updates balance, stats, and history.
 */
async function spin() {
  if (isSpinning) return;
  if (tokenBalance <= 0) {
    showGameOver();
    return;
  }

  // Clamp bet to available tokens
  if (currentBet > tokenBalance) {
    currentBet = tokenBalance;
    updateBetDisplay();
  }

  isSpinning = true;
  spinBtn.disabled = true;
  allInBtn.disabled = true;

  const betThisSpin = currentBet;

  // Deduct bet
  tokenBalance -= betThisSpin;
  updateTokenDisplay("down");

  // Generate new random grid
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      gridState[row][col] = getRandomSymbol();
    }
  }

  // Animate the spin
  await animateSpin();

  // Check for wins
  const { totalMultiplier, winningCells, isJackpot } = checkWins();
  const winAmount = betThisSpin * totalMultiplier;

  // Update stats
  totalSpins++;
  if (winAmount > 0) {
    totalWins++;
    tokenBalance += winAmount;
    totalTokensWon += winAmount;
    if (winAmount > biggestWin) biggestWin = winAmount;
  } else {
    totalTokensLost += betThisSpin;
  }

  // Render grid with winning highlights
  renderGrid(winningCells);

  // Play appropriate sounds and show quip
  if (isJackpot) {
    await showJackpot(winAmount);
    showQuip("jackpot");
    updateTokenDisplay("up");
  } else if (winAmount > 0) {
    playSoundWin();
    showQuip("win");
    updateTokenDisplay("up");
  } else {
    playSoundLose();
    showQuip("lose");
  }

  // Update all displays
  updateLastWinDisplay(winAmount);
  updateStatsPanel();

  // Add to history (use middle row as representative)
  addHistoryEntry(gridState[1], winAmount, betThisSpin);

  // Re-enable buttons
  isSpinning = false;
  spinBtn.disabled = false;
  allInBtn.disabled = false;

  // Check for game over
  if (tokenBalance <= 0) {
    showGameOver();
  }
}

// ====== BET ADJUSTMENT ======

/** Increases the current bet by one step, capped at max and balance */
function increaseBet() {
  if (isSpinning) return;
  currentBet = Math.min(currentBet + BET_STEP, MAX_BET, tokenBalance);
  updateBetDisplay();
}

/** Decreases the current bet by one step, floored at min */
function decreaseBet() {
  if (isSpinning) return;
  currentBet = Math.max(currentBet - BET_STEP, MIN_BET);
  updateBetDisplay();
}

/** Sets bet to entire token balance for the "All In" feature */
function goAllIn() {
  if (isSpinning) return;
  currentBet = Math.min(tokenBalance, MAX_BET);
  updateBetDisplay();
  spin();
}

// ====== MUTE TOGGLE ======

/** Toggles sound on/off and updates the mute button icon */
function toggleMute() {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
}

// ====== PAYTABLE RENDERING ======

/** Builds the paytable display from SYMBOLS data */
function renderPaytable() {
  paytableEl.innerHTML = SYMBOLS.map(
    (s) => `
    <div class="paytable-row">
      <span class="paytable-symbols">${s.emoji}${s.emoji}${s.emoji}</span>
      <span class="paytable-name">${s.name}</span>
      <span class="paytable-payout">×${s.payout}</span>
    </div>`
  ).join("");
}

// ====== BUBBLE BACKGROUND ======

/** Creates animated bubble particles in the background */
function createBubbles() {
  const container = document.getElementById("bubble-container");
  const bubbleCount = 20;

  for (let i = 0; i < bubbleCount; i++) {
    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const size = 10 + Math.random() * 40;
    bubble.style.width = size + "px";
    bubble.style.height = size + "px";
    bubble.style.left = Math.random() * 100 + "%";
    bubble.style.animationDuration = 6 + Math.random() * 10 + "s";
    bubble.style.animationDelay = Math.random() * 8 + "s";

    container.appendChild(bubble);
  }
}

// ====== KEYBOARD INPUT ======

/**
 * Handles keyboard shortcuts for the game.
 * - Space/Enter: Spin
 * - ArrowUp: Increase bet
 * - ArrowDown: Decrease bet
 * - M: Toggle mute
 */
function handleKeyDown(event) {
  // Don't intercept if user is typing in an input field
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    return;
  }

  switch (event.key) {
    case " ":
    case "Enter":
      event.preventDefault();
      if (!isSpinning) spin();
      break;
    case "ArrowUp":
      event.preventDefault();
      increaseBet();
      break;
    case "ArrowDown":
      event.preventDefault();
      decreaseBet();
      break;
    case "m":
    case "M":
      toggleMute();
      break;
  }
}

// ====== EVENT LISTENERS ======

/** Wires up all button click handlers and keyboard listener */
function initEventListeners() {
  spinBtn.addEventListener("click", spin);
  allInBtn.addEventListener("click", goAllIn);
  muteBtn.addEventListener("click", toggleMute);
  betUpBtn.addEventListener("click", increaseBet);
  betDownBtn.addEventListener("click", decreaseBet);
  restartBtn.addEventListener("click", restartGame);
  jackpotDismissBtn.addEventListener("click", () => {}); // handled in showJackpot
  document.addEventListener("keydown", handleKeyDown);
}

// ====== INITIALIZATION ======

/** Boots up the game: renders initial state, paytable, bubbles, and binds events */
function init() {
  renderGrid();
  renderPaytable();
  createBubbles();
  updateTokenDisplay();
  updateBetDisplay();
  updateStatsPanel();
  initEventListeners();
}

// Start the game when the DOM is ready
init();
