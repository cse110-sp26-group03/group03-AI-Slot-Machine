/* ============================================================
   DEEP SEA TOKEN SLOTS — APP.JS
   AI-themed aquarium slot machine with a 3x3 grid
   ============================================================ */

// ─────────────────────────────────────────────
// SYMBOL DEFINITIONS
// Each symbol has a name, emoji, and rarity weight.
// Lower weight = rarer = higher payout.
// ─────────────────────────────────────────────
const SYMBOL_REGISTRY = [
  { name: "Octopus Oracle",    emoji: "🐙", weight: 20, payout: 2   },
  { name: "Shark GPT",         emoji: "🦈", weight: 16, payout: 3   },
  { name: "Pufferfish Prompt", emoji: "🐡", weight: 14, payout: 4   },
  { name: "Jellyfish Jailbreak", emoji: "🪼", weight: 12, payout: 5 },
  { name: "Tropical Transformer", emoji: "🐠", weight: 10, payout: 7 },
  { name: "Squid Sequence",    emoji: "🦑", weight: 8,  payout: 10  },
  { name: "Goldfish Memory",   emoji: "🐟", weight: 6,  payout: 15  },
  { name: "Lobster LLM",       emoji: "🦞", weight: 4,  payout: 25  },
  { name: "Whale AGI",         emoji: "🐋", weight: 2,  payout: 100 },
];

// AI-flavored win messages shown on various match types
const WIN_QUIPS = [
  "The model is confident in this output!",
  "Hallucination successful — tokens generated!",
  "Attention heads aligned perfectly!",
  "Your prompt engineering paid off!",
  "Temperature: hot. Output: profitable.",
  "Context window: full of winnings!",
  "The training data was on your side!",
  "RLHF rewarded you handsomely!",
  "Top-k sampling in your favor!",
  "Beam search found the golden path!",
];

// Messages shown on a losing spin
const LOSE_QUIPS = [
  "Model output: garbage tokens.",
  "The AI politely declined to pay you.",
  "Inference failed. No tokens for you.",
  "Your prompt was too vague. Loss incurred.",
  "Catastrophic forgetting of your bet.",
  "Rate limited. Tokens consumed.",
  "The model is not sure about this one.",
  "Output truncated. Funds not found.",
  "Safety filter blocked your winnings.",
  "Embedding drift detected. Bet lost.",
];

// ─────────────────────────────────────────────
// AUDIO ENGINE
// Generates all sounds procedurally using the Web Audio API.
// No external audio files needed.
// ─────────────────────────────────────────────
const AudioEngine = {
  audioContext: null,
  isMuted: false,

  /** Initialize the AudioContext (must be triggered by user gesture) */
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  /** Play a tone with given frequency, duration, and waveform type */
  playTone(frequency, duration, type = "sine", volume = 0.15) {
    if (this.isMuted || !this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  },

  /** Bubbly click sound for spinning reels */
  playSpinTick() {
    this.playTone(600 + Math.random() * 400, 0.06, "sine", 0.08);
  },

  /** Ascending chime for landing a reel */
  playReelLand(reelIndex) {
    const baseFreq = 400 + reelIndex * 150;
    this.playTone(baseFreq, 0.2, "triangle", 0.12);
  },

  /** Happy ascending arpeggio for a win */
  playWin() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, "triangle", 0.15), i * 100);
    });
  },

  /** Descending sad tones for a loss */
  playLose() {
    this.playTone(300, 0.3, "sawtooth", 0.06);
    setTimeout(() => this.playTone(220, 0.4, "sawtooth", 0.05), 150);
  },

  /** Grand jackpot fanfare */
  playJackpot() {
    const fanfare = [523, 659, 784, 1047, 1319, 1568];
    fanfare.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.5, "triangle", 0.18), i * 120);
    });
    // Extra shimmer
    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => this.playTone(1200 + Math.random() * 600, 0.2, "sine", 0.08), i * 80);
      }
    }, 700);
  },

  /** Flat buzz for game over */
  playGameOver() {
    this.playTone(150, 0.6, "sawtooth", 0.1);
    setTimeout(() => this.playTone(100, 0.8, "sawtooth", 0.08), 300);
  },

  /** Toggle mute state, returns new state */
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
};

// ─────────────────────────────────────────────
// GAME STATE
// Central object holding all mutable game data.
// ─────────────────────────────────────────────
const gameState = {
  tokenBalance: 1000,
  currentBet: 10,
  isSpinning: false,
  totalSpins: 0,
  totalWins: 0,
  biggestWin: 0,
  totalTokensWon: 0,
  totalTokensLost: 0,
  spinHistory: [],         // Array of { symbols, resultText, isWin }
  currentGrid: [],         // 3x3 array of symbol objects
};

// ─────────────────────────────────────────────
// DOM REFERENCES
// Cached references to frequently accessed elements.
// ─────────────────────────────────────────────
const DOM = {
  reelGrid:        document.getElementById("reel-grid"),
  tokenBalance:    document.getElementById("token-balance"),
  betInput:        document.getElementById("bet-input"),
  spinButton:      document.getElementById("spin-btn"),
  allInButton:     document.getElementById("allin-btn"),
  muteButton:      document.getElementById("mute-btn"),
  restartButton:   document.getElementById("restart-btn"),
  betUpButton:     document.getElementById("bet-up-btn"),
  betDownButton:   document.getElementById("bet-down-btn"),
  winMessage:      document.getElementById("win-message"),
  jackpotOverlay:  document.getElementById("jackpot-overlay"),
  jackpotAmount:   document.getElementById("jackpot-amount"),
  jackpotDismiss:  document.getElementById("jackpot-dismiss-btn"),
  jackpotBubbles:  document.getElementById("jackpot-bubbles"),
  gameoverOverlay: document.getElementById("gameover-overlay"),
  gameoverRestart: document.getElementById("gameover-restart-btn"),
  historyList:     document.getElementById("history-list"),
  statTotalSpins:  document.getElementById("stat-total-spins"),
  statWinRate:     document.getElementById("stat-win-rate"),
  statBiggestWin:  document.getElementById("stat-biggest-win"),
  statTotalWon:    document.getElementById("stat-total-won"),
  statTotalLost:   document.getElementById("stat-total-lost"),
  statNet:         document.getElementById("stat-net"),
};

// ─────────────────────────────────────────────
// WEIGHTED RANDOM SYMBOL PICKER
// Selects a symbol based on its rarity weight.
// Higher weight = more common.
// ─────────────────────────────────────────────
function pickRandomSymbol() {
  const totalWeight = SYMBOL_REGISTRY.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const symbol of SYMBOL_REGISTRY) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol;
  }
  return SYMBOL_REGISTRY[0]; // Fallback
}

// ─────────────────────────────────────────────
// GRID GENERATION
// Fills the 3x3 grid with randomly chosen symbols.
// ─────────────────────────────────────────────
function generateNewGrid() {
  const grid = [];
  for (let row = 0; row < 3; row++) {
    const rowSymbols = [];
    for (let col = 0; col < 3; col++) {
      rowSymbols.push(pickRandomSymbol());
    }
    grid.push(rowSymbols);
  }
  return grid;
}

// ─────────────────────────────────────────────
// WIN DETECTION
// Checks all possible winning lines in the 3x3 grid:
//   - 3 horizontal rows
//   - 3 vertical columns
//   - 2 diagonals
// Returns an array of { cells, symbol, payout } for each winning line.
// ─────────────────────────────────────────────
function detectWinningLines(grid) {
  const winningLines = [];

  // Define all 8 possible lines as coordinate arrays
  const lineDefinitions = [
    // Rows
    [[0,0],[0,1],[0,2]],
    [[1,0],[1,1],[1,2]],
    [[2,0],[2,1],[2,2]],
    // Columns
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    // Diagonals
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];

  for (const line of lineDefinitions) {
    const symbols = line.map(([r, c]) => grid[r][c]);
    // Check if all three symbols on this line match
    if (symbols[0].emoji === symbols[1].emoji && symbols[1].emoji === symbols[2].emoji) {
      winningLines.push({
        cells: line,
        symbol: symbols[0],
        payout: symbols[0].payout,
      });
    }
  }

  return winningLines;
}

// ─────────────────────────────────────────────
// DISPLAY UPDATE FUNCTIONS
// Methods to sync the DOM with the current game state.
// ─────────────────────────────────────────────

/** Update the token balance display with optional animation */
function updateBalanceDisplay(animationClass = null) {
  DOM.tokenBalance.textContent = gameState.tokenBalance.toLocaleString();
  if (animationClass) {
    DOM.tokenBalance.classList.remove("pulse-up", "pulse-down");
    // Force reflow to restart animation
    void DOM.tokenBalance.offsetWidth;
    DOM.tokenBalance.classList.add(animationClass);
    setTimeout(() => DOM.tokenBalance.classList.remove(animationClass), 600);
  }
}

/** Render the 3x3 grid of symbols into the DOM */
function renderGrid(grid) {
  const cells = DOM.reelGrid.querySelectorAll(".reel-cell");
  cells.forEach((cell) => {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const symbolSpan = cell.querySelector(".symbol");
    symbolSpan.textContent = grid[row][col].emoji;
    // Clear any previous winning highlights
    cell.classList.remove("winner", "spinning");
  });
}

/** Highlight the cells that are part of a winning line */
function highlightWinningCells(winningLines) {
  const cells = DOM.reelGrid.querySelectorAll(".reel-cell");
  const winningCoords = new Set();
  for (const line of winningLines) {
    for (const [r, c] of line.cells) {
      winningCoords.add(`${r},${c}`);
    }
  }
  cells.forEach((cell) => {
    const key = `${cell.dataset.row},${cell.dataset.col}`;
    if (winningCoords.has(key)) {
      cell.classList.add("winner");
    }
  });
}

/** Show a win or loss message below the grid */
function showResultMessage(text, isWin) {
  DOM.winMessage.textContent = text;
  DOM.winMessage.className = "win-message " + (isWin ? "win" : "lose");
}

/** Update the statistics panel */
function updateStatsDisplay() {
  DOM.statTotalSpins.textContent = gameState.totalSpins;
  const winRate = gameState.totalSpins > 0
    ? ((gameState.totalWins / gameState.totalSpins) * 100).toFixed(1) + "%"
    : "0%";
  DOM.statWinRate.textContent = winRate;
  DOM.statBiggestWin.textContent = gameState.biggestWin.toLocaleString();
  DOM.statTotalWon.textContent = gameState.totalTokensWon.toLocaleString();
  DOM.statTotalLost.textContent = gameState.totalTokensLost.toLocaleString();
  const net = gameState.totalTokensWon - gameState.totalTokensLost;
  DOM.statNet.textContent = (net >= 0 ? "+" : "") + net.toLocaleString();
  DOM.statNet.style.color = net >= 0 ? "var(--seaweed-green)" : "var(--coral-pink)";
}

// ─────────────────────────────────────────────
// SPIN HISTORY
// Records each spin result and renders it in the history panel.
// ─────────────────────────────────────────────

/** Add a spin result to the history log */
function addHistoryEntry(grid, resultText, isWin, amount) {
  // Get the middle row symbols for a compact display
  const displaySymbols = grid[1].map(s => s.emoji).join(" ");

  const entry = { displaySymbols, resultText, isWin, amount };
  gameState.spinHistory.unshift(entry); // Most recent first

  // Cap history at 50 entries
  if (gameState.spinHistory.length > 50) {
    gameState.spinHistory.pop();
  }

  renderHistory();
}

/** Render the full history list from state */
function renderHistory() {
  if (gameState.spinHistory.length === 0) {
    DOM.historyList.innerHTML = '<p class="history-empty">No inferences yet. Spin to generate outputs!</p>';
    return;
  }

  DOM.historyList.innerHTML = gameState.spinHistory.map((entry) => {
    const entryClass = entry.isWin ? "entry-win" : "entry-lose";
    const resultClass = entry.isWin ? "result-positive" : "result-negative";
    const sign = entry.isWin ? "+" : "-";
    return `
      <div class="history-entry ${entryClass}">
        <span class="history-symbols">${entry.displaySymbols}</span>
        <span class="history-result ${resultClass}">${sign}${entry.amount.toLocaleString()}</span>
      </div>
    `;
  }).join("");
}

// ─────────────────────────────────────────────
// JACKPOT ANIMATION
// Full-screen celebration for hitting the top-tier prize.
// ─────────────────────────────────────────────

/** Show the jackpot overlay with animated bubbles */
function showJackpotAnimation(winAmount) {
  DOM.jackpotAmount.textContent = `+${winAmount.toLocaleString()} TOKENS`;

  // Spawn golden celebration bubbles
  DOM.jackpotBubbles.innerHTML = "";
  for (let i = 0; i < 20; i++) {
    const bubble = document.createElement("div");
    bubble.className = "jackpot-bubble";
    const size = 10 + Math.random() * 30;
    bubble.style.width = size + "px";
    bubble.style.height = size + "px";
    bubble.style.left = Math.random() * 100 + "%";
    bubble.style.animationDelay = Math.random() * 2 + "s";
    bubble.style.animationDuration = 2 + Math.random() * 2 + "s";
    DOM.jackpotBubbles.appendChild(bubble);
  }

  DOM.jackpotOverlay.classList.remove("hidden");
  AudioEngine.playJackpot();
}

/** Hide the jackpot overlay */
function hideJackpotAnimation() {
  DOM.jackpotOverlay.classList.add("hidden");
}

// ─────────────────────────────────────────────
// GAME OVER
// Shown when the player runs out of tokens.
// ─────────────────────────────────────────────

/** Display the game over screen */
function showGameOver() {
  DOM.gameoverOverlay.classList.remove("hidden");
  AudioEngine.playGameOver();
}

/** Hide game over and reset the game */
function hideGameOverAndRestart() {
  DOM.gameoverOverlay.classList.add("hidden");
  resetGame();
}

// ─────────────────────────────────────────────
// CORE SPIN LOGIC
// The main game loop for a single spin.
// ─────────────────────────────────────────────

/** Validate and clamp the current bet to a legal range */
function validateBet() {
  let bet = parseInt(DOM.betInput.value) || 1;
  bet = Math.max(1, Math.min(bet, gameState.tokenBalance));
  DOM.betInput.value = bet;
  gameState.currentBet = bet;
  return bet;
}

/** Execute a full spin sequence with animation */
async function executeSpin() {
  if (gameState.isSpinning) return;
  if (gameState.tokenBalance <= 0) {
    showGameOver();
    return;
  }

  AudioEngine.init();
  const bet = validateBet();

  if (bet > gameState.tokenBalance) {
    showResultMessage("Insufficient tokens. Lower your bet!", false);
    return;
  }

  // Lock the UI during spin
  gameState.isSpinning = true;
  DOM.spinButton.disabled = true;
  DOM.allInButton.disabled = true;
  DOM.winMessage.classList.add("hidden");

  // Deduct the bet
  gameState.tokenBalance -= bet;
  updateBalanceDisplay("pulse-down");

  // Run the spinning animation across all 9 cells
  await animateSpinSequence();

  // Generate final results
  const finalGrid = generateNewGrid();
  gameState.currentGrid = finalGrid;

  // Render the final grid
  renderGrid(finalGrid);

  // Check for wins
  const winningLines = detectWinningLines(finalGrid);
  gameState.totalSpins++;

  if (winningLines.length > 0) {
    // Calculate total payout from all winning lines
    const totalMultiplier = winningLines.reduce((sum, line) => sum + line.payout, 0);
    const winAmount = bet * totalMultiplier;

    gameState.tokenBalance += winAmount;
    gameState.totalWins++;
    gameState.totalTokensWon += winAmount;
    if (winAmount > gameState.biggestWin) {
      gameState.biggestWin = winAmount;
    }

    // Highlight winning cells
    highlightWinningCells(winningLines);

    // Check if this qualifies as a jackpot (Whale AGI match or payout >= 50x bet)
    const isJackpot = winningLines.some(line => line.symbol.emoji === "🐋") || totalMultiplier >= 50;

    if (isJackpot) {
      showJackpotAnimation(winAmount);
    } else {
      AudioEngine.playWin();
    }

    const quip = WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)];
    showResultMessage(`+${winAmount.toLocaleString()} tokens! ${quip}`, true);
    updateBalanceDisplay("pulse-up");
    addHistoryEntry(finalGrid, quip, true, winAmount);
  } else {
    // Loss
    gameState.totalTokensLost += bet;
    AudioEngine.playLose();
    const quip = LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)];
    showResultMessage(`-${bet.toLocaleString()} tokens. ${quip}`, false);
    addHistoryEntry(finalGrid, quip, false, bet);
  }

  // Update stats
  updateStatsDisplay();

  // Unlock the UI
  gameState.isSpinning = false;
  DOM.spinButton.disabled = false;
  DOM.allInButton.disabled = false;

  // Check for game over
  if (gameState.tokenBalance <= 0) {
    setTimeout(() => showGameOver(), 1200);
  }
}

// ─────────────────────────────────────────────
// SPIN ANIMATION
// Rapidly cycles random symbols in each cell,
// then stops column by column for a dramatic reveal.
// ─────────────────────────────────────────────

/** Animate the spinning reels with staggered column stops */
function animateSpinSequence() {
  return new Promise((resolve) => {
    const cells = DOM.reelGrid.querySelectorAll(".reel-cell");
    const intervalIds = [];

    // Start all cells spinning with random symbols
    cells.forEach((cell) => {
      cell.classList.add("spinning");
      const symbolSpan = cell.querySelector(".symbol");
      const intervalId = setInterval(() => {
        const randomSymbol = SYMBOL_REGISTRY[Math.floor(Math.random() * SYMBOL_REGISTRY.length)];
        symbolSpan.textContent = randomSymbol.emoji;
        AudioEngine.playSpinTick();
      }, 100);
      intervalIds.push(intervalId);
    });

    // Stop columns one at a time (left to right) for suspense
    const stopDelays = [600, 1100, 1600]; // ms delay before each column stops

    stopDelays.forEach((delay, colIndex) => {
      setTimeout(() => {
        // Stop the 3 cells in this column
        for (let row = 0; row < 3; row++) {
          const cellIndex = row * 3 + colIndex;
          clearInterval(intervalIds[cellIndex]);
          cells[cellIndex].classList.remove("spinning");
        }
        AudioEngine.playReelLand(colIndex);

        // Resolve after the last column stops
        if (colIndex === 2) {
          setTimeout(resolve, 200);
        }
      }, delay);
    });
  });
}

// ─────────────────────────────────────────────
// GAME RESET
// Restores all state to initial values.
// ─────────────────────────────────────────────
function resetGame() {
  gameState.tokenBalance = 1000;
  gameState.currentBet = 10;
  gameState.isSpinning = false;
  gameState.totalSpins = 0;
  gameState.totalWins = 0;
  gameState.biggestWin = 0;
  gameState.totalTokensWon = 0;
  gameState.totalTokensLost = 0;
  gameState.spinHistory = [];
  gameState.currentGrid = [];

  DOM.betInput.value = 10;
  DOM.winMessage.classList.add("hidden");
  updateBalanceDisplay();
  updateStatsDisplay();
  renderHistory();

  // Reset grid to random initial symbols
  const initialGrid = generateNewGrid();
  gameState.currentGrid = initialGrid;
  renderGrid(initialGrid);
}

// ─────────────────────────────────────────────
// EVENT LISTENERS
// Wire up all buttons and keyboard controls.
// ─────────────────────────────────────────────

/** Spin button click */
DOM.spinButton.addEventListener("click", executeSpin);

/** All-In button: set bet to full balance, then spin */
DOM.allInButton.addEventListener("click", () => {
  if (gameState.isSpinning || gameState.tokenBalance <= 0) return;
  DOM.betInput.value = gameState.tokenBalance;
  gameState.currentBet = gameState.tokenBalance;
  executeSpin();
});

/** Mute toggle button */
DOM.muteButton.addEventListener("click", () => {
  AudioEngine.init();
  const nowMuted = AudioEngine.toggleMute();
  DOM.muteButton.textContent = nowMuted ? "🔇 Sound Off" : "🔊 Sound On";
});

/** Restart button */
DOM.restartButton.addEventListener("click", () => {
  resetGame();
});

/** Game over restart button */
DOM.gameoverRestart.addEventListener("click", hideGameOverAndRestart);

/** Jackpot dismiss button */
DOM.jackpotDismiss.addEventListener("click", hideJackpotAnimation);

/** Bet increase/decrease buttons */
DOM.betUpButton.addEventListener("click", () => {
  const current = parseInt(DOM.betInput.value) || 1;
  const step = getBetStep(current);
  DOM.betInput.value = Math.min(current + step, gameState.tokenBalance);
  gameState.currentBet = parseInt(DOM.betInput.value);
});

DOM.betDownButton.addEventListener("click", () => {
  const current = parseInt(DOM.betInput.value) || 1;
  const step = getBetStep(current);
  DOM.betInput.value = Math.max(1, current - step);
  gameState.currentBet = parseInt(DOM.betInput.value);
});

/** Determine bet adjustment step size based on current bet value */
function getBetStep(currentBet) {
  if (currentBet >= 500) return 50;
  if (currentBet >= 100) return 25;
  if (currentBet >= 50) return 10;
  return 5;
}

/** Bet input change handler */
DOM.betInput.addEventListener("change", () => {
  validateBet();
});

/** Keyboard controls for convenience */
document.addEventListener("keydown", (event) => {
  // Don't capture keystrokes when typing in the bet input
  if (document.activeElement === DOM.betInput) {
    // But still allow arrow keys for bet adjustment
    if (event.key === "ArrowUp") {
      event.preventDefault();
      DOM.betUpButton.click();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      DOM.betDownButton.click();
    }
    return;
  }

  switch (event.key) {
    case " ":       // Spacebar = spin
    case "Enter":
      event.preventDefault();
      executeSpin();
      break;
    case "ArrowUp":   // Increase bet
      event.preventDefault();
      DOM.betUpButton.click();
      break;
    case "ArrowDown": // Decrease bet
      event.preventDefault();
      DOM.betDownButton.click();
      break;
    case "m":         // Toggle mute
    case "M":
      DOM.muteButton.click();
      break;
    case "r":         // Restart
    case "R":
      resetGame();
      break;
  }
});

// ─────────────────────────────────────────────
// INITIALIZATION
// Set up the initial game state on page load.
// ─────────────────────────────────────────────
(function initializeGame() {
  const initialGrid = generateNewGrid();
  gameState.currentGrid = initialGrid;
  renderGrid(initialGrid);
  updateBalanceDisplay();
  updateStatsDisplay();
})();
