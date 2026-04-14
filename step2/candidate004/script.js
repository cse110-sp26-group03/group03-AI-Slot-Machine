(() => {
  'use strict';

  // === SYMBOLS ===
  const SYMBOLS = [
    { emoji: '\u{1F916}', name: 'Robot',         weight: 20, multiplier: 2,   pair: 1,   desc: 'Basic inference unit. Will do your homework for $0.002.' },
    { emoji: '\u{1F9E0}', name: 'Brain',         weight: 18, multiplier: 3,   pair: 1.5, desc: 'Emergent reasoning detected! (citation needed)' },
    { emoji: '\u{1F4A1}', name: 'Lightbulb',     weight: 16, multiplier: 4,   pair: 1.5, desc: '"Innovation" — an LLM confidently rephrasing your idea.' },
    { emoji: '\u{1F525}', name: 'GPU Fire',      weight: 14, multiplier: 5,   pair: 2,   desc: 'Your cloud bill after leaving training on overnight.' },
    { emoji: '\u{1F4B0}', name: 'VC Money',      weight: 10, multiplier: 8,   pair: 3,   desc: 'Series B secured. Product still just a ChatGPT wrapper.' },
    { emoji: '\u{1F680}', name: 'Rocket',        weight: 8,  multiplier: 12,  pair: 4,   desc: 'To the moon! (Rocket fueled by investor tears.)' },
    { emoji: '\u{1F47E}', name: 'AGI',           weight: 5,  multiplier: 25,  pair: 8,   desc: 'Artificial General Intelligence. ETA: 5 years (since 1965).' },
    { emoji: '\u{1F916}\u200D\u{2728}', name: 'Hallucination', weight: 9, multiplier: 15, pair: 5, desc: 'Confidently wrong. Cited 3 papers that don\'t exist.' },
  ];

  // Fix hallucination emoji if rendering is poor — fallback to simple combo
  SYMBOLS[7].emoji = '\u{1F4AB}';

  // Build weighted pool
  const POOL = [];
  SYMBOLS.forEach((s, i) => {
    for (let w = 0; w < s.weight; w++) POOL.push(i);
  });

  // === STATE ===
  let balance = 1000;
  let bet = 10;
  let spinning = false;
  let muted = false;
  let totalSpins = 0;
  let totalWins = 0;
  let peakBalance = 1000;
  let consecutiveSpins = 0;
  let temperature = 0;
  const history = [];

  // === DOM REFS ===
  const $ = (sel) => document.querySelector(sel);
  const balanceEl = $('#balance');
  const betEl = $('#bet-amount');
  const spinBtn = $('#spin-btn');
  const muteBtn = $('#mute-btn');
  const statSpins = $('#stat-spins');
  const statWinrate = $('#stat-winrate');
  const statPeak = $('#stat-peak');
  const tempBar = $('#temp-bar');
  const tempValue = $('#temp-value');
  const historyLog = $('#history-log');
  const paytableToggle = $('#paytable-toggle');
  const paytableContent = $('#paytable-content');
  const paytableArrow = $('#paytable-arrow');
  const paytableTable = $('#paytable');
  const bankruptOverlay = $('#bankrupt-overlay');
  const bankruptMsg = $('#bankrupt-msg');
  const restartBtn = $('#restart-btn');
  const particleCanvas = $('#particle-canvas');
  const ctx = particleCanvas.getContext('2d');

  // === AUDIO ENGINE ===
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type = 'square', volume = 0.12) {
    if (muted) return;
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function sfxTick() { playTone(800 + Math.random() * 400, 0.04, 'square', 0.06); }

  function sfxLand() { playTone(200, 0.15, 'triangle', 0.15); }

  function sfxWin() {
    [0, 100, 200, 300].forEach((delay, i) => {
      setTimeout(() => playTone(400 + i * 150, 0.2, 'square', 0.1), delay);
    });
  }

  function sfxLose() { playTone(150, 0.3, 'sawtooth', 0.08); }

  function sfxBankrupt() {
    [0, 150, 300, 450, 600].forEach((delay, i) => {
      setTimeout(() => playTone(400 - i * 60, 0.3, 'sawtooth', 0.12), delay);
    });
  }

  // === PARTICLES ===
  const particles = [];

  function resizeCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function updateParticles() {
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (particles.length > 0) requestAnimationFrame(updateParticles);
  }

  function emitWinParticles() {
    const slotRect = document.querySelector('.slot-machine').getBoundingClientRect();
    const cx = slotRect.left + slotRect.width / 2;
    const cy = slotRect.top + slotRect.height / 2;
    const colors = ['#00ff41', '#00cc33', '#66ff88', '#aaffaa', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      spawnParticles(cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 60, 1, colors[i % colors.length]);
    }
    requestAnimationFrame(updateParticles);
  }

  // === REEL RENDERING ===
  function getRandomSymbolIndex() {
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  function buildReelCells(count) {
    const cells = [];
    for (let i = 0; i < count; i++) cells.push(getRandomSymbolIndex());
    return cells;
  }

  function renderReelStrip(reelEl, symbolIndices) {
    const strip = reelEl.querySelector('.reel-strip');
    strip.innerHTML = '';
    symbolIndices.forEach(idx => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.textContent = SYMBOLS[idx].emoji;
      strip.appendChild(cell);
    });
    return strip;
  }

  // Initialize reels with random visible symbols
  function initReels() {
    for (let r = 0; r < 3; r++) {
      const reelEl = document.getElementById(`reel-${r}`);
      const indices = buildReelCells(3);
      renderReelStrip(reelEl, indices);
    }
  }

  // === SPINNING ===
  function spin() {
    if (spinning || balance < bet) return;

    spinning = true;
    spinBtn.disabled = true;
    balance -= bet;
    updateBalance();

    consecutiveSpins++;
    temperature = Math.min(2.0, temperature + 0.08 + Math.random() * 0.05);
    updateTemperature();

    const results = [getRandomSymbolIndex(), getRandomSymbolIndex(), getRandomSymbolIndex()];
    const reelDurations = [600, 900, 1200]; // stagger stop times
    const ticksPerReel = [12, 18, 24];

    for (let r = 0; r < 3; r++) {
      animateReel(r, results[r], ticksPerReel[r], reelDurations[r]);
    }

    // After all reels stop
    setTimeout(() => {
      evaluateResult(results);
      spinning = false;
      spinBtn.disabled = false;
      totalSpins++;
      updateStats();

      // Cool down temperature slowly when idle
      clearTimeout(window._tempCooldown);
      window._tempCooldown = setTimeout(() => {
        const cool = setInterval(() => {
          if (spinning) { clearInterval(cool); return; }
          temperature = Math.max(0, temperature - 0.02);
          updateTemperature();
          if (temperature <= 0) clearInterval(cool);
        }, 200);
      }, 3000);
    }, reelDurations[2] + 400);
  }

  function animateReel(reelIndex, finalSymbol, ticks, duration) {
    const reelEl = document.getElementById(`reel-${reelIndex}`);
    const interval = duration / ticks;
    let count = 0;

    const timer = setInterval(() => {
      count++;
      if (count >= ticks) {
        clearInterval(timer);
        // Final state: show prev, final, next
        const prev = getRandomSymbolIndex();
        const next = getRandomSymbolIndex();
        const strip = renderReelStrip(reelEl, [prev, finalSymbol, next]);
        sfxLand();
        strip.classList.add('bounce');
        setTimeout(() => strip.classList.remove('bounce'), 350);
        return;
      }
      // Random tick
      const indices = buildReelCells(3);
      renderReelStrip(reelEl, indices);
      sfxTick();
    }, interval);
  }

  function evaluateResult(results) {
    const [a, b, c] = results;
    let payout = 0;
    let matchType = '';

    if (a === b && b === c) {
      // Triple match
      payout = bet * SYMBOLS[a].multiplier;
      matchType = 'TRIPLE';
    } else if (a === b || b === c || a === c) {
      // Pair match
      const paired = a === b ? a : (b === c ? b : a);
      payout = bet * SYMBOLS[paired].pair;
      matchType = 'PAIR';
    }

    if (payout > 0) {
      balance += payout;
      totalWins++;
      sfxWin();
      emitWinParticles();
      document.querySelector('.slot-machine').classList.add('win-flash');
      setTimeout(() => document.querySelector('.slot-machine').classList.remove('win-flash'), 1200);
    } else {
      sfxLose();
    }

    if (balance > peakBalance) peakBalance = balance;
    updateBalance();
    addHistory(results, payout, matchType);

    if (balance <= 0) {
      setTimeout(showBankrupt, 800);
    }
  }

  // === UI UPDATES ===
  function updateBalance() {
    balanceEl.textContent = balance;
  }

  function updateStats() {
    statSpins.textContent = totalSpins;
    statWinrate.textContent = totalSpins > 0 ? (totalWins / totalSpins * 100).toFixed(1) + '%' : '0.0%';
    statPeak.textContent = peakBalance;
  }

  function updateTemperature() {
    const pct = (temperature / 2.0) * 100;
    tempBar.style.width = pct + '%';
    tempBar.className = 'temp-bar' + (temperature > 1.4 ? ' hot' : temperature > 0.7 ? ' warm' : '');
    tempValue.textContent = temperature.toFixed(2);
  }

  function addHistory(results, payout, matchType) {
    const symbols = results.map(i => SYMBOLS[i].emoji).join(' ');
    const label = payout > 0
      ? `${symbols} → +${payout} [${matchType}]`
      : `${symbols} → -${bet}`;
    const li = document.createElement('li');
    li.textContent = label;
    li.className = payout > 0 ? 'win' : 'lose';
    historyLog.prepend(li);
    history.unshift({ results, payout });
    // Keep last 10
    while (historyLog.children.length > 10) historyLog.removeChild(historyLog.lastChild);
    if (history.length > 10) history.length = 10;
  }

  // === BANKRUPT ===
  const BANKRUPT_MSGS = [
    'ERROR 402: Insufficient tokens. Your model has been deprecated.',
    'Training complete. Final loss: everything.',
    'Your token budget has been hallucinated out of existence.',
    'SIGKILL received. Process "your_finances" terminated.',
    'Model collapsed. Reward signal: 0. Try fine-tuning your life choices.',
    'Out of tokens. Even GPT-2 had a bigger budget than you.',
    'Bankrupt! But an AI startup will pivot this into a "feature."',
    'Exception: WalletUnderflowError — balance cannot be negative in this economy.',
  ];

  function showBankrupt() {
    sfxBankrupt();
    bankruptMsg.textContent = BANKRUPT_MSGS[Math.floor(Math.random() * BANKRUPT_MSGS.length)];
    bankruptOverlay.classList.remove('hidden');
  }

  function restart() {
    balance = 1000;
    bet = 10;
    totalSpins = 0;
    totalWins = 0;
    peakBalance = 1000;
    consecutiveSpins = 0;
    temperature = 0;
    history.length = 0;
    historyLog.innerHTML = '';
    updateBalance();
    updateStats();
    updateTemperature();
    betEl.textContent = bet;
    bankruptOverlay.classList.add('hidden');
    initReels();
  }

  // === PAYTABLE ===
  function buildPaytable() {
    let html = '<tr><th>Sym</th><th>Name</th><th>3x</th><th>2x</th><th class="desc-col">Notes</th></tr>';
    SYMBOLS.forEach(s => {
      html += `<tr>
        <td class="sym-col">${s.emoji}</td>
        <td>${s.name}</td>
        <td>${s.multiplier}x</td>
        <td>${s.pair}x</td>
        <td class="desc-col">${s.desc}</td>
      </tr>`;
    });
    paytableTable.innerHTML = html;
  }

  // === BET CONTROLS ===
  const BET_STEPS = [5, 10, 25, 50, 100, 250, 500];

  function changeBet(dir) {
    const idx = BET_STEPS.indexOf(bet);
    const next = idx + dir;
    if (next >= 0 && next < BET_STEPS.length) {
      bet = BET_STEPS[next];
      betEl.textContent = bet;
    }
  }

  // === EVENT BINDINGS ===
  spinBtn.addEventListener('click', spin);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !spinning && !bankruptOverlay.classList.contains('hidden') === false) {
      e.preventDefault();
      spin();
    }
  });

  $('#bet-down').addEventListener('click', () => changeBet(-1));
  $('#bet-up').addEventListener('click', () => changeBet(1));

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
  });

  paytableToggle.addEventListener('click', () => {
    const hidden = paytableContent.classList.toggle('hidden');
    paytableArrow.textContent = hidden ? '\u25B6' : '\u25BC';
  });

  restartBtn.addEventListener('click', restart);

  // === INIT ===
  buildPaytable();
  initReels();
})();
