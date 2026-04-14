/**
 * TokenBurner 3000 — AI Slot Machine
 * Vanilla JS, Web Audio API for sound, no dependencies.
 */

const SYMBOLS = ['🤖', '🧠', '💰', '🔥', '👁️', '📉'];

const PAYOUTS = {
  '🤖🤖🤖': { mult: 12, name: 'Singularity',      msg: 'The machines have become self-aware. They want a raise.' },
  '🧠🧠🧠': { mult: 8,  name: 'AGI Achieved',      msg: 'Congratulations! AGI is here. It wants to play slots too.' },
  '💰💰💰': { mult: 6,  name: 'Series B Funding',   msg: 'Investors loved your AI-powered toaster pitch!' },
  '🔥🔥🔥': { mult: 5,  name: 'Datacenter Fire',    msg: 'Your GPUs caught fire, but the insurance payout is huge!' },
  '👁️👁️👁️': { mult: 4,  name: 'Sentience Scare',   msg: 'The model blinked. PR is handling it.' },
  '📉📉📉': { mult: 3,  name: 'Stock Crash',        msg: 'NVIDIA down 40%. You shorted it. Galaxy brain.' },
};

const LOSE_MSGS = [
  'Token budget exceeded. Output: nothing useful.',
  'The model confidently generated the wrong answer.',
  'Your inference cost more than the output was worth.',
  'Congratulations, you just funded 0.003 seconds of training.',
  'The AI considered your request and chose violence.',
  'Prompt too ambiguous. Tokens vaporized.',
  'Model response: "As a slot machine, I cannot..."',
  'Your tokens were used to train a model that replaces you.',
  'Error: wallet_underflow. Tokens sent to /dev/null.',
  'The AI thanks you for your donation to compute.',
  'Output was perfect in the benchmark. Useless in prod.',
  'Latency: 200ms. Value delivered: 0ms.',
  'The model hallucinated a win. You still lost.',
  'Rate limited by reality.',
  'Your tokens have been redistributed to larger models.',
];

const PAIR_MSGS = [
  'Partial match — like AI that\'s "almost" ready for production.',
  'Two out of three. Close enough for a demo day.',
  'The model got it partly right. Ship it before anyone notices.',
  'Partial inference complete. Results may vary.',
  '67% accuracy — publish the paper!',
];

// State
let balance = 1000;
let bet = 50;
let spinning = false;
let totalWasted = 0;
let spinCount = 0;
const BET_STEP = 25;
const MIN_BET = 25;
const MAX_BET = 500;
const startTime = Date.now();

// DOM
const balanceEl = document.getElementById('balance');
const costEl = document.getElementById('cost');
const tempEl = document.getElementById('temperature');
const betDisplayEl = document.getElementById('bet-display-val');
const spinBtn = document.getElementById('spin-btn');
const betUpBtn = document.getElementById('bet-up');
const betDownBtn = document.getElementById('bet-down');
const messageEl = document.getElementById('message');
const logEntriesEl = document.getElementById('log-entries');
const uptimeEl = document.getElementById('uptime');
const totalWastedEl = document.getElementById('total-wasted');
const reelEls = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2'),
];
const reelBoxes = document.querySelectorAll('.reel-box');

// Web Audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, duration, type = 'square', gain = 0.06) {
  ensureAudio();
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

function sfxTick() {
  playTone(250 + Math.random() * 300, 0.04, 'square', 0.03);
}

function sfxLand(i) {
  playTone(350 + i * 120, 0.12, 'triangle', 0.06);
}

function sfxWin() {
  [440, 554, 659, 880].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.18, 'sine', 0.09), i * 80);
  });
}

function sfxLose() {
  playTone(180, 0.25, 'sawtooth', 0.04);
  setTimeout(() => playTone(120, 0.35, 'sawtooth', 0.03), 120);
}

function sfxBroke() {
  [300, 250, 200, 150].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.05), i * 150);
  });
}

// Helpers
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSymbol() {
  return pick(SYMBOLS);
}

function updateUI() {
  balanceEl.textContent = balance;
  costEl.textContent = bet;
  betDisplayEl.textContent = bet;
  totalWastedEl.textContent = totalWasted;

  // Simulate temperature rising with losses
  const temp = Math.min(2.0, 0.7 + (spinCount * 0.02));
  tempEl.textContent = temp.toFixed(1);

  if (bet > balance && balance > 0) {
    bet = Math.max(MIN_BET, Math.floor(balance / BET_STEP) * BET_STEP);
    if (bet > balance) bet = balance;
    costEl.textContent = bet;
    betDisplayEl.textContent = bet;
  }

  spinBtn.disabled = spinning || balance < MIN_BET;
  betDownBtn.disabled = spinning || bet <= MIN_BET;
  betUpBtn.disabled = spinning || bet >= MAX_BET || bet + BET_STEP > balance;
}

function setOutput(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'output-text ' + type;
}

function flashBalance(type) {
  balanceEl.classList.add('flash-' + type);
  setTimeout(() => balanceEl.classList.remove('flash-' + type), 600);
}

function addLog(text, type) {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + (type || '');
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  entry.textContent = `[${ts}] ${text}`;
  logEntriesEl.appendChild(entry);

  // Keep last 5
  while (logEntriesEl.children.length > 5) {
    logEntriesEl.removeChild(logEntriesEl.firstChild);
  }

  // Dim older entries
  const kids = logEntriesEl.children;
  for (let i = 0; i < kids.length - 1; i++) {
    kids[i].classList.add('dimmed');
  }
}

// Uptime counter
setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  uptimeEl.textContent = `${m}:${s}`;
}, 1000);

// Reel animation
function buildStrip(finalSymbol) {
  const strip = [];
  for (let i = 0; i < 8; i++) {
    strip.push(randomSymbol());
  }
  strip.push(finalSymbol);
  return strip;
}

function animateReel(reelEl, finalSymbol, delay) {
  return new Promise(resolve => {
    const strip = buildStrip(finalSymbol);

    reelEl.innerHTML = '';
    strip.forEach(sym => {
      const div = document.createElement('div');
      div.className = 'reel-symbol';
      div.textContent = sym;
      reelEl.appendChild(div);
    });

    reelEl.classList.add('spinning');
    const tickId = setInterval(sfxTick, 90);

    setTimeout(() => {
      clearInterval(tickId);
      reelEl.classList.remove('spinning');

      reelEl.innerHTML = '';
      const finalDiv = document.createElement('div');
      finalDiv.className = 'reel-symbol';
      finalDiv.textContent = finalSymbol;
      reelEl.appendChild(finalDiv);

      reelEl.classList.add('landing');
      sfxLand(reelEls.indexOf(reelEl));
      setTimeout(() => reelEl.classList.remove('landing'), 250);
      resolve();
    }, 700 + delay);
  });
}

// Evaluate spin
function evaluate(results) {
  const key = results.join('');

  if (PAYOUTS[key]) {
    return { type: 'win', mult: PAYOUTS[key].mult, msg: PAYOUTS[key].msg, name: PAYOUTS[key].name };
  }

  if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
    return { type: 'win', mult: 1.5, msg: pick(PAIR_MSGS), name: 'Partial Match' };
  }

  return { type: 'lose', mult: 0, msg: pick(LOSE_MSGS), name: 'Miss' };
}

// Spin
async function spin() {
  if (spinning || balance < bet) return;
  spinning = true;
  spinCount++;

  balance -= bet;
  updateUI();
  setOutput('Generating response...', '');
  spinBtn.textContent = '> generating...';
  spinBtn.classList.add('running');

  reelBoxes.forEach(b => b.classList.remove('matched'));

  const results = [randomSymbol(), randomSymbol(), randomSymbol()];

  await Promise.all(
    reelEls.map((el, i) => animateReel(el, results[i], i * 350))
  );

  spinBtn.textContent = '> model.generate()';
  spinBtn.classList.remove('running');

  const outcome = evaluate(results);

  if (outcome.type === 'win') {
    const winnings = Math.floor(bet * outcome.mult);
    balance += winnings;
    flashBalance('win');
    sfxWin();
    setOutput(`+${winnings} tokens — ${outcome.msg}`, 'win');
    addLog(`WIN ${outcome.name}: +${winnings} tokens (${outcome.mult}x)`, 'win-log');

    if (outcome.mult > 2) {
      reelBoxes.forEach(b => b.classList.add('matched'));
    }
  } else {
    totalWasted += bet;
    flashBalance('lose');
    sfxLose();
    setOutput(outcome.msg, 'lose');
    addLog(`LOSS: -${bet} tokens. ${results.join(' ')}`, 'lose-log');
  }

  if (balance < MIN_BET) {
    setTimeout(() => {
      sfxBroke();
      setOutput('FATAL: OutOfTokensError — Requesting emergency compute budget...', 'broke');
      addLog('CRITICAL: balance depleted. Restarting inference engine...', 'lose-log');
      setTimeout(() => {
        balance = 1000;
        bet = 50;
        spinCount = 0;
        totalWasted = 0;
        updateUI();
        setOutput('Emergency funding approved. 1000 tokens loaded. The VCs bought it again.', 'win');
        addLog('RESTORED: 1000 tokens via Series C funding round', 'win-log');
      }, 3000);
    }, 1500);
  }

  spinning = false;
  updateUI();
}

// Events
spinBtn.addEventListener('click', spin);

betUpBtn.addEventListener('click', () => {
  if (bet + BET_STEP <= MAX_BET && bet + BET_STEP <= balance) {
    bet += BET_STEP;
    updateUI();
  }
});

betDownBtn.addEventListener('click', () => {
  if (bet - BET_STEP >= MIN_BET) {
    bet -= BET_STEP;
    updateUI();
  }
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !spinning) {
    e.preventDefault();
    spin();
  }
});

// Init
updateUI();
setOutput('Awaiting inference request...', '');
