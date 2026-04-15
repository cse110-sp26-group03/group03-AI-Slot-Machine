const SYMBOLS = ['🤖', '🧠', '💸', '🔥', '👁️', '📉'];

const PAYOUTS = {
  '🤖': { multiplier: 50, name: 'Robot Uprising' },
  '🧠': { multiplier: 30, name: 'Singularity' },
  '💸': { multiplier: 25, name: 'VC Funding Round' },
  '🔥': { multiplier: 20, name: 'GPU Meltdown' },
  '👁️': { multiplier: 15, name: 'Sentience Achieved' },
  '📉': { multiplier: 10, name: 'AI Bubble Pop' },
};

const PAIR_MULTIPLIER = 2;

const LOSS_MESSAGES = [
  "OpenAI thanks you for your donation.",
  "Your tokens have been used to train a model that replaces you.",
  "Error 402: Wallet not found.",
  "The AI giveth, and the AI taketh away. Mostly taketh.",
  "Your tokens are in another castle.",
  "Have you tried prompt engineering your luck?",
  "That's what you get for trusting a machine.",
  "Tokens vaporized. Just like your startup idea.",
  "The house always wins. The house is an AI.",
  "Your tokens joined the hallucination.",
  "Congratulations! You've unlocked: poverty.",
  "This loss was predicted by our model with 99.7% confidence.",
  "Your tokens have been reallocated to GPU cooling.",
  "Even GPT-4 couldn't predict a win this bad.",
  "Skill issue. Have you tried being an AI?",
];

const WIN_MESSAGES = [
  "The machines let you win... this time.",
  "Don't get used to it, human.",
  "A glitch in the matrix. We'll patch this.",
  "You won! (This will be deducted from your next prompt.)",
  "Even a broken human is right sometimes.",
  "Alert: Unexpected generosity detected.",
  "Enjoy it. The next GPT update removes winning.",
  "The AI overlords have shown mercy.",
  "Win recorded. Your data has been sold to celebrate.",
  "You beat the algorithm! ...wait, that WAS the algorithm.",
];

const BROKE_MESSAGES = [
  "You're out of tokens! Just like a real AI API bill.",
  "Account balance: $0. Welcome to the future of AI.",
  "No tokens left. Have you tried selling your data?",
  "Bankrupt! The AI revolution costs extra.",
];

const BET_STEPS = [10, 25, 50, 100, 250];

let tokens = 1000;
let betIndex = 0;
let spinning = false;

const tokenCountEl = document.getElementById('token-count');
const betAmountEl = document.getElementById('bet-amount');
const spinBtn = document.getElementById('spin-btn');
const messageBox = document.getElementById('message-box');
const betUpBtn = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const reelEls = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2'),
];
const reelWindows = document.querySelectorAll('.reel-window');

function randomMessage(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function updateDisplay() {
  tokenCountEl.textContent = tokens.toLocaleString();
  betAmountEl.textContent = BET_STEPS[betIndex];
  spinBtn.disabled = spinning || tokens < BET_STEPS[betIndex];

  if (tokens <= 0) {
    spinBtn.textContent = '💀 GAME OVER 💀';
  } else {
    spinBtn.textContent = '🎰 SPEND TOKENS 🎰';
  }
}

function flashTokens(type) {
  tokenCountEl.classList.remove('win-flash', 'lose-flash');
  void tokenCountEl.offsetWidth;
  tokenCountEl.classList.add(type === 'win' ? 'win-flash' : 'lose-flash');
}

function setMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = 'message-box';
  if (type) messageBox.classList.add(type);
}

function evaluateSpin(results) {
  const [a, b, c] = results;
  if (a === b && b === c) {
    const payout = PAYOUTS[a];
    return { win: true, multiplier: payout.multiplier, name: payout.name };
  }
  if (a === b || b === c || a === c) {
    return { win: true, multiplier: PAIR_MULTIPLIER, name: 'Partial Match' };
  }
  return { win: false, multiplier: 0, name: null };
}

async function animateReel(reelEl, windowEl, finalSymbol, duration) {
  return new Promise((resolve) => {
    const interval = 80;
    let elapsed = 0;
    reelEl.classList.add('spinning');

    const timer = setInterval(() => {
      reelEl.querySelector('.symbol').textContent = randomSymbol();
      elapsed += interval;
      if (elapsed >= duration) {
        clearInterval(timer);
        reelEl.classList.remove('spinning');
        reelEl.querySelector('.symbol').textContent = finalSymbol;
        windowEl.classList.add('landed');
        setTimeout(() => windowEl.classList.remove('landed'), 300);
        resolve();
      }
    }, interval);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spin() {
  if (spinning) return;

  const bet = BET_STEPS[betIndex];
  if (tokens < bet) return;

  spinning = true;
  tokens -= bet;
  flashTokens('lose');
  updateDisplay();
  setMessage('Burning your tokens...', '');

  const results = [randomSymbol(), randomSymbol(), randomSymbol()];

  await animateReel(reelEls[0], reelWindows[0], results[0], 600);
  await sleep(100);
  await animateReel(reelEls[1], reelWindows[1], results[1], 800);
  await sleep(100);
  await animateReel(reelEls[2], reelWindows[2], results[2], 1000);

  const outcome = evaluateSpin(results);

  if (outcome.win) {
    const winnings = bet * outcome.multiplier;
    tokens += winnings;
    flashTokens('win');
    setMessage(
      `${outcome.name}! You won ${winnings.toLocaleString()} tokens! ${randomMessage(WIN_MESSAGES)}`,
      'win'
    );
  } else {
    setMessage(randomMessage(LOSS_MESSAGES), 'lose');
  }

  if (tokens <= 0) {
    setMessage(randomMessage(BROKE_MESSAGES), 'lose');
  }

  spinning = false;
  updateDisplay();
}

betUpBtn.addEventListener('click', () => {
  if (betIndex < BET_STEPS.length - 1) {
    betIndex++;
    updateDisplay();
  }
});

betDownBtn.addEventListener('click', () => {
  if (betIndex > 0) {
    betIndex--;
    updateDisplay();
  }
});

spinBtn.addEventListener('click', spin);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spinning) {
    e.preventDefault();
    spin();
  }
});

updateDisplay();
