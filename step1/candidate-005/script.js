(() => {
  const SYMBOLS = [
    { icon: "🧠", name: "BRAIN",    weight: 10, payout: 5   },
    { icon: "🤖", name: "BOT",      weight: 12, payout: 4   },
    { icon: "💾", name: "DATA",     weight: 14, payout: 3   },
    { icon: "📎", name: "CLIPPY",   weight: 16, payout: 2   },
    { icon: "🔥", name: "GPU",      weight: 8,  payout: 8   },
    { icon: "💀", name: "BUG",      weight: 18, payout: 1.5 },
    { icon: "♾️", name: "AGI",      weight: 2,  payout: 50  },
  ];

  const FLAVOR_SPINS = [
    "Fine-tuning on vibes...",
    "Asking 7 MoE experts, 4 are napping...",
    "Consulting Stack Overflow (2014)...",
    "Sampling temperature: unhinged...",
    "Generating token... generating token...",
    "Checking if this is a training example...",
    "Routing through a datacenter that is on fire...",
    "Reticulating synapses...",
  ];

  const FLAVOR_LOSS = [
    "Model confidently predicts you lost.",
    "That was a feature, not a loss.",
    "Hallucinated your win. Please try again.",
    "Refusing to continue — content policy triggered on your luck.",
    "I'm sorry, as an AI I cannot let you win this round.",
    "Gradient descended into your wallet.",
    "Your tokens have been re-allocated to training.",
    "The model apologizes, then charges you for the apology.",
  ];

  const FLAVOR_WIN = [
    "Emergent behavior detected: payout.",
    "Benchmark saturated. Money printer go brrr.",
    "The alignment team is furious.",
    "You have been added to the system prompt.",
    "Tokens delivered via RLHF (Random Luck Hypothetical Feedback).",
  ];

  const FLAVOR_AGI = [
    "🚨 AGI ACHIEVED 🚨 Please alert the board. And Sam.",
    "Singularity confirmed. Also, +huge payout.",
    "The model is now self-aware and tipped you.",
  ];

  // build weighted pool once
  const POOL = [];
  SYMBOLS.forEach((s, i) => {
    for (let k = 0; k < s.weight; k++) POOL.push(i);
  });

  const state = {
    tokens: 1000,
    bet: 10,
    hallucinations: 0,
    spinning: false,
  };

  const BET_STEPS = [1, 5, 10, 25, 50, 100, 250];

  const $ = (id) => document.getElementById(id);
  const tokensEl = $("tokens");
  const betEl = $("bet");
  const hallEl = $("hallucinations");
  const spinBtn = $("spin");
  const betUp = $("betUp");
  const betDown = $("betDown");
  const refillBtn = $("refill");
  const logEl = $("log");

  function populateStrips() {
    document.querySelectorAll(".strip").forEach((strip) => {
      strip.innerHTML = "";
      // build a long strip of random symbols for the spinning visual
      for (let i = 0; i < 30; i++) {
        const idx = POOL[Math.floor(Math.random() * POOL.length)];
        const el = document.createElement("div");
        el.className = "symbol";
        el.textContent = SYMBOLS[idx].icon;
        el.dataset.idx = idx;
        strip.appendChild(el);
      }
    });
  }

  function render() {
    tokensEl.textContent = state.tokens;
    betEl.textContent = state.bet;
    hallEl.textContent = state.hallucinations;
    spinBtn.disabled = state.spinning || state.tokens < state.bet;
    betUp.disabled = state.spinning;
    betDown.disabled = state.spinning;
    refillBtn.hidden = state.tokens >= state.bet;
  }

  function log(msg, cls = "") {
    const p = document.createElement("p");
    p.textContent = "> " + msg;
    if (cls) p.className = cls;
    logEl.appendChild(p);
    // keep last 40 lines
    while (logEl.childElementCount > 40) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function randomSymbolIdx() {
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  function adjustBet(dir) {
    const i = BET_STEPS.indexOf(state.bet);
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, i + dir));
    state.bet = BET_STEPS[next];
    render();
  }

  async function spin() {
    if (state.spinning || state.tokens < state.bet) return;
    state.spinning = true;
    state.tokens -= state.bet;
    render();

    log(pick(FLAVOR_SPINS), "flavor");

    // pick final result
    const result = [randomSymbolIdx(), randomSymbolIdx(), randomSymbolIdx()];

    // 3% chance the AI "hallucinates" an extra symbol into a winner
    let hallucinated = false;
    if (Math.random() < 0.03 && !(result[0] === result[1] && result[1] === result[2])) {
      result[2] = result[0];
      if (result[0] !== result[1]) result[1] = result[0];
      hallucinated = true;
      state.hallucinations++;
    }

    const strips = document.querySelectorAll(".strip");
    // animate: add spinning visual, settle each reel staggered
    strips.forEach((s) => s.classList.add("spinning"));

    await spinReel(strips[0], result[0], 900);
    await spinReel(strips[1], result[1], 700);
    await spinReel(strips[2], result[2], 800);

    // evaluate win
    const [a, b, c] = result;
    let payout = 0;
    let winType = null;
    if (a === b && b === c) {
      payout = Math.floor(state.bet * SYMBOLS[a].payout);
      winType = SYMBOLS[a].name === "AGI" ? "agi" : "triple";
    } else if (a === b || b === c || a === c) {
      // pair: tiny consolation, 0.5x bet on the paired symbol
      const pairIdx = a === b ? a : (b === c ? b : a);
      payout = Math.floor(state.bet * 0.5);
      winType = "pair";
      // flash the paired reels briefly
      if (a === b) { strips[0].parentElement.classList.add("winning"); strips[1].parentElement.classList.add("winning"); }
      else if (b === c) { strips[1].parentElement.classList.add("winning"); strips[2].parentElement.classList.add("winning"); }
      else { strips[0].parentElement.classList.add("winning"); strips[2].parentElement.classList.add("winning"); }
    }

    if (winType === "triple" || winType === "agi") {
      document.querySelectorAll(".reel").forEach((r) => r.classList.add("winning"));
    }

    if (payout > 0) {
      state.tokens += payout;
      if (winType === "agi") {
        log(pick(FLAVOR_AGI), "win");
        log(`JACKPOT: +${payout} tokens on ${SYMBOLS[a].name} ${SYMBOLS[a].icon}${SYMBOLS[b].icon}${SYMBOLS[c].icon}`, "win");
      } else if (winType === "triple") {
        log(`Triple ${SYMBOLS[a].name}! +${payout} tokens.`, "win");
        log(pick(FLAVOR_WIN), "flavor");
      } else {
        log(`Pair of ${SYMBOLS[pairIndex(result)].name}. +${payout} tokens (participation trophy).`, "win");
      }
      if (hallucinated) {
        log("⚠️ Payout may have been hallucinated. Management is investigating. (But keep the tokens.)", "flavor");
      }
    } else {
      log(`Got ${SYMBOLS[a].icon}${SYMBOLS[b].icon}${SYMBOLS[c].icon} — no match. -${state.bet} tokens.`, "loss");
      log(pick(FLAVOR_LOSS), "flavor");
    }

    // cleanup
    setTimeout(() => {
      document.querySelectorAll(".reel").forEach((r) => r.classList.remove("winning"));
    }, 1400);

    strips.forEach((s) => s.classList.remove("spinning"));
    state.spinning = false;
    render();

    if (state.tokens < 1) {
      log("Out of tokens. The model suggests therapy. Or another spin.", "loss");
    }
  }

  function pairIndex(arr) {
    const [a, b, c] = arr;
    if (a === b) return a;
    if (b === c) return b;
    return a;
  }

  function spinReel(strip, finalIdx, duration) {
    return new Promise((resolve) => {
      // build a tall strip ending in the final symbol
      strip.innerHTML = "";
      const total = 24;
      for (let i = 0; i < total - 1; i++) {
        const idx = randomSymbolIdx();
        const el = document.createElement("div");
        el.className = "symbol";
        el.textContent = SYMBOLS[idx].icon;
        strip.appendChild(el);
      }
      const finalEl = document.createElement("div");
      finalEl.className = "symbol";
      finalEl.textContent = SYMBOLS[finalIdx].icon;
      strip.appendChild(finalEl);

      // position so last symbol centers in the 120px reel (symbol=40, so offset = totalHeight - 80)
      const symbolH = 40;
      const endOffset = -(symbolH * (total - 1));
      strip.style.transition = "none";
      strip.style.transform = "translateY(0px)";
      // force reflow
      void strip.offsetHeight;
      strip.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.7, 0.1, 1)`;
      strip.style.transform = `translateY(${endOffset}px)`;

      setTimeout(resolve, duration + 20);
    });
  }

  function refill() {
    state.tokens += 100;
    state.hallucinations++;
    log("Model hallucinated 100 tokens out of thin air. Do not tell the CFO.", "win");
    render();
  }

  spinBtn.addEventListener("click", spin);
  betUp.addEventListener("click", () => adjustBet(+1));
  betDown.addEventListener("click", () => adjustBet(-1));
  refillBtn.addEventListener("click", refill);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !state.spinning) { e.preventDefault(); spin(); }
    if (e.key === "ArrowUp") adjustBet(+1);
    if (e.key === "ArrowDown") adjustBet(-1);
  });

  populateStrips();
  render();
})();
