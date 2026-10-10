/*
 * On Seeing — engine.
 *
 * Deck:     hand-written cards are shuffled per theme with a per-visit seed.
 *           Each paragraph is a "hand": a few cards from one theme with
 *           freshly generated sentences shuffled in among them.
 * Printer:  fragments are struck onto the sheet a character at a time,
 *           paced by the voice when it is on, by a reading pace when it is not.
 * Voice:    the browser's own speech synthesis, preferring a female voice.
 *
 * URL options: ?seed=1234  replay an edition
 *              ?voice=Aria prefer a voice whose name contains this text
 *              ?rate=0.9   speaking rate
 */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const { cards, grammar, templates } = window.CORPUS;

  /* ------------------------------------------------------------ randomness */

  const seed = (() => {
    const fromUrl = parseInt(params.get("seed"), 10);
    if (Number.isFinite(fromUrl)) return fromUrl >>> 0;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  })();

  // mulberry32: small, fast, and good enough for shuffling a deck.
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo, hi) => lo + random() * (hi - lo);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  /* ------------------------------------------------------------------ deck */

  const themes = Object.keys(cards);
  const piles = {};
  const refill = (theme) => { piles[theme] = shuffle(cards[theme]); };
  themes.forEach(refill);

  const draw = (theme) => {
    if (!piles[theme].length) refill(theme);
    return piles[theme].pop();
  };

  /* --------------------------------------------------------------- grammar */

  const recent = [];
  const RECENT_LIMIT = 400;

  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  const generate = () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const used = {};
      const text = pick(templates).replace(/\{(\w+?)(\d?)(\.lower)?\}/g, (_, key, n, lower) => {
        // "virtue2" draws from "virtue" but never repeats "virtue".
        const taken = used[key] || (used[key] = []);
        let value;
        do { value = pick(grammar[key]); } while (taken.includes(value) && taken.length < grammar[key].length);
        taken.push(value);
        return lower ? lowerFirst(value) : value;
      });
      if (!recent.includes(text)) {
        remember(text);
        return text;
      }
    }
    return draw(pick(themes));
  };

  const remember = (text) => {
    recent.push(text);
    if (recent.length > RECENT_LIMIT) recent.shift();
  };

  let lastTheme = null;
  const dealHand = () => {
    let theme;
    do { theme = pick(themes); } while (theme === lastTheme && themes.length > 1);
    lastTheme = theme;

    const hand = [];
    const cardCount = 2 + Math.floor(random() * 3);   // 2–4 cards
    const madeCount = Math.floor(random() * 3);       // 0–2 generated
    for (let i = 0; i < cardCount; i++) hand.push(draw(theme));
    for (let i = 0; i < madeCount; i++) hand.push(generate());
    // Keep a card first so each paragraph opens on its theme.
    return [hand[0], ...shuffle(hand.slice(1))];
  };

  /* ----------------------------------------------------------------- voice */

  const synth = window.speechSynthesis || null;
  const rate = Math.min(2, Math.max(0.5, parseFloat(params.get("rate")) || 0.9));

  const FEMALE = [
    "aria", "jenny", "sonia", "libby", "emma", "ava", "michelle", "natasha",
    "clara", "samantha", "allison", "susan", "zoe", "serena", "kate", "moira",
    "tessa", "fiona", "karen", "victoria", "veena", "zira", "hazel",
    "google uk english female", "google us english", "female", "woman",
  ];
  const MALE = /\b(male|man|daniel|alex|fred|david|mark|guy|ryan|thomas|george|arthur|oliver|aaron|rishi|google uk english male)\b/i;

  let voice = null;
  const chooseVoice = () => {
    if (!synth) return;
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return;
    const wanted = (params.get("voice") || "").toLowerCase();
    const score = (v) => {
      const name = v.name.toLowerCase();
      if (wanted && name.includes(wanted)) return 1000;
      let s = 0;
      const i = FEMALE.findIndex((f) => name.includes(f));
      if (i >= 0) s += 100 - i;
      if (MALE.test(name) && !/female/i.test(name)) s -= 200;
      if (/natural|neural|premium|enhanced/i.test(name)) s += 40;
      if (/en[-_](gb|us)/i.test(v.lang)) s += 5;
      return s;
    };
    voice = voices.slice().sort((a, b) => score(b) - score(a))[0];
    updateColophon();
  };
  if (synth) {
    chooseVoice();
    synth.addEventListener?.("voiceschanged", chooseVoice);
  }

  let listening = false;
  let utterance = null;      // held globally so Chrome does not collect it mid-sentence
  let spokenCps = 13 * rate; // characters per second, recalibrated as we listen

  // Speak `text`; `onWord(i)` receives offsets into `text` as words are spoken.
  const speak = (text, onWord) => new Promise((resolve) => {
    if (!synth || !listening) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = rate;
    u.pitch = 1;
    u.volume = 1;
    const started = performance.now();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      const seconds = (performance.now() - started) / 1000;
      if (ok && seconds > 1) spokenCps = spokenCps * 0.7 + (text.length / seconds) * 0.3;
      resolve(ok);
    };
    u.onboundary = (e) => { if (e.name === "word" || e.name === undefined) onWord(e.charIndex + (e.charLength || 1)); };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    // Some engines never fire onend; never let the reading stall on that.
    const watchdog = setTimeout(() => finish(false), (text.length / Math.max(spokenCps, 6)) * 2000 + 4000);
    utterance = u;
    synth.speak(u);
  });

  /* --------------------------------------------------------------- printer */

  const stream = document.getElementById("stream");
  const sheet = document.getElementById("sheet");
  const READ_CPS = 15;      // silent reading pace
  const STRIKE_CPS = 42;    // fastest the head will type to catch up with the voice

  let paragraph = null;
  const newParagraph = () => {
    paragraph = document.createElement("p");
    stream.appendChild(paragraph);
  };

  // Lay out a fragment's characters invisibly so the line breaks never jump,
  // then strike them in one by one.
  const typeset = (text) => {
    const frag = document.createElement("span");
    const chars = [];
    if (paragraph.childNodes.length) frag.appendChild(document.createTextNode(" "));
    text.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        frag.appendChild(document.createTextNode(" "));
        chars.push(null);
        return;
      }
      const word = document.createElement("span");
      word.style.whiteSpace = "nowrap";
      for (const ch of token) {
        const c = document.createElement("span");
        c.textContent = ch;
        c.style.visibility = "hidden";
        word.appendChild(c);
        chars.push(c);
      }
      frag.appendChild(word);
    });
    paragraph.appendChild(frag);
    return { frag, chars };
  };

  const strike = (c) => {
    if (!c) return;
    c.style.visibility = "";
    c.className = "fresh";
  };

  // Once a fragment is fully struck, collapse its spans back to plain text.
  const settle = (frag, text) => {
    setTimeout(() => {
      frag.textContent = (frag.firstChild?.nodeType === 3 ? " " : "") + text;
    }, 1000);
  };

  let head = null;
  const showHead = (on) => {
    if (on && !head) {
      head = document.createElement("span");
      head.className = "head";
    }
    if (on) paragraph.appendChild(head);
    else head?.remove();
  };

  /* ------------------------------------------------------------- scrolling */

  let offset = null;
  const BASELINE = 0.68; // the line being printed sits about two thirds down

  const follow = (instant) => {
    const end = paragraph ? paragraph.offsetTop + paragraph.offsetHeight : 0;
    const target = Math.round(window.innerHeight * BASELINE - end);
    if (target === offset) return;
    offset = target;
    if (instant) {
      stream.style.transition = "none";
      stream.style.transform = `translateY(${offset}px)`;
      void stream.offsetHeight;
      stream.style.transition = "";
    } else {
      stream.style.transform = `translateY(${offset}px)`;
    }
  };

  // Paragraphs that have drifted well above the sheet are torn off, so the
  // page can run for hours without growing.
  const prune = () => {
    let removed = false;
    while (stream.children.length > 2) {
      const first = stream.firstElementChild;
      const bottom = offset + first.offsetTop + first.offsetHeight;
      if (bottom > -window.innerHeight * 0.5) break;
      first.remove();
      removed = true;
    }
    if (removed) {
      // Removing from the top shrinks the stream; shift without animating
      // so nothing on screen moves.
      offset = null;
      follow(true);
    }
  };

  window.addEventListener("resize", () => { offset = null; follow(true); });

  /* ----------------------------------------------------------------- reading */

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

  const printFragment = async (text) => {
    showHead(false);
    const { frag, chars } = typeset(text);
    follow();

    let shown = 0;          // characters struck so far
    let heard = -1;         // furthest character the voice has reached (-1: no boundary events)
    let speaking = null;    // pending speech promise
    let speechOffset = 0;   // where in `text` the current utterance began
    let speechDone = false;
    let spokenFrom = 0;     // when the utterance started
    let last = performance.now();
    let budget = 0;
    let lastHeight = stream.offsetHeight;

    const startSpeech = () => {
      // Start from the beginning of the word the head is in.
      speechOffset = text.lastIndexOf(" ", Math.max(0, shown - 1)) + 1;
      if (shown === 0) speechOffset = 0;
      spokenFrom = performance.now();
      speechDone = false;
      heard = -1;
      speaking = speak(text.slice(speechOffset), (i) => { heard = speechOffset + i; })
        .then(() => { speechDone = true; });
    };

    if (listening) startSpeech();

    while (shown < chars.length || (speaking && !speechDone)) {
      await frame();
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      if (listening && !speaking) startSpeech();
      if (!listening && speaking && !speechDone) { synth?.cancel(); speechDone = true; }

      let target;
      if (speaking && !speechDone) {
        // Follow the voice: by its word boundaries when the engine reports
        // them, otherwise by an estimate of its pace.
        const estimate = speechOffset + ((now - spokenFrom) / 1000) * spokenCps;
        target = heard >= 0 ? Math.max(heard, Math.min(estimate, heard + 6)) : estimate;
        target = Math.min(target, chars.length - 1);
        budget += dt * STRIKE_CPS;
      } else if (speaking && speechDone) {
        target = chars.length;
        budget += dt * STRIKE_CPS;
      } else {
        target = chars.length;
        budget += dt * READ_CPS;
      }

      while (shown < target && budget >= 1) {
        strike(chars[shown++]);
        budget -= 1;
      }
      if (shown >= target) budget = Math.min(budget, 1);

      const h = stream.offsetHeight;
      if (h !== lastHeight) { lastHeight = h; follow(); }
    }

    settle(frag, text);
    showHead(true);
    return Boolean(speaking);
  };

  const run = async () => {
    newParagraph();
    follow(true);
    await wait(900);
    for (;;) {
      const hand = dealHand();
      for (let i = 0; i < hand.length; i++) {
        const spoke = await printFragment(hand[i]);
        const last = i === hand.length - 1;
        await wait(spoke ? between(350, 900) : between(1100, 2200));
        if (last) await wait(between(1400, 2600));
      }
      showHead(false);
      newParagraph();
      follow();
      prune();
    }
  };

  /* -------------------------------------------------------------- controls */

  const listenButton = document.getElementById("listen");
  const colophon = document.getElementById("colophon");

  function updateColophon() {
    const edition = String(seed % 1e8).padStart(8, "0").replace(/(\d{4})(\d{4})/, "$1 $2");
    const who = listening && voice ? ` · ${voice.name.replace(/^(Microsoft|Google)\s+/, "").replace(/\s*\(.*\)$/, "")}` : "";
    colophon.textContent = `edition ${edition}${who}`;
  }

  let wakeLock = null;
  const holdScreen = async () => {
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* not permitted */ }
  };
  document.addEventListener("visibilitychange", () => {
    // The browser drops the lock whenever the tab is hidden.
    if (document.visibilityState === "visible" && listening) holdScreen();
  });

  const setListening = (on) => {
    if (on && !synth) {
      listenButton.querySelector(".label").textContent = "no voice in this browser";
      return;
    }
    listening = on;
    listenButton.setAttribute("aria-pressed", String(on));
    listenButton.querySelector(".label").textContent = on ? "listening" : "listen";
    if (on) {
      chooseVoice();
      holdScreen();
    } else {
      synth?.cancel();
      wakeLock?.release?.();
      wakeLock = null;
    }
    updateColophon();
  };

  listenButton.addEventListener("click", (e) => {
    e.stopPropagation();
    setListening(!listening);
  });
  // The first touch anywhere on the sheet opens the voice; browsers will not
  // let a page speak before someone has touched it.
  sheet.addEventListener("click", () => { if (!listening) setListening(true); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") setListening(!listening);
  });

  updateColophon();
  (document.fonts?.ready || Promise.resolve()).then(run);
})();
