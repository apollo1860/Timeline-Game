(() => {
  const START_LIVES = 3;
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $("score"), lives: $("lives"), left: $("left"), best: $("best"),
    current: $("current"), timeline: $("timeline"), feedback: $("feedback"),
    roundSize: $("roundSize"), newGame: $("newGame"),
    dialog: $("gameOver"), goTitle: $("goTitle"), goText: $("goText"), again: $("again"),
  };

  let deck = [];      // noch zu spielende Karten
  let timeline = [];  // { event, state: "start" | "ok" | "bad" }
  let current = null;
  let score = 0;
  let lives = START_LIVES;
  let locked = false;

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  };

  function formatYear(e) {
    const y = e.year < 0 ? `${Math.abs(e.year).toLocaleString("de-DE")} v. Chr.` : String(e.year);
    return (e.approx ? "ca. " : "") + y;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cardEl(e, { showYear, state } = {}) {
    const c = document.createElement("div");
    c.className = "card" + (state && state !== "start" ? " " + state : "");
    const img = document.createElement("img");
    img.src = e.image;
    img.alt = e.title;
    img.loading = "lazy";
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = e.title;
    const y = document.createElement("div");
    y.className = "year";
    y.textContent = showYear ? formatYear(e) : "?";
    c.append(img, t, y);
    return c;
  }

  function newGame() {
    el.dialog.open && el.dialog.close();
    const size = Number(el.roundSize.value);
    const all = shuffle(EVENTS);
    const n = size > 0 ? Math.min(size + 1, all.length) : all.length; // +1 Startkarte
    deck = all.slice(0, n);
    timeline = [{ event: deck.shift(), state: "start" }];
    score = 0;
    lives = START_LIVES;
    locked = false;
    setFeedback("", "");
    draw();
    render();
  }

  function draw() {
    current = deck.shift() || null;
  }

  function isCorrect(index, year) {
    const prev = timeline[index - 1];
    const next = timeline[index];
    return (!prev || prev.event.year <= year) && (!next || year <= next.event.year);
  }

  function correctIndex(year) {
    const i = timeline.findIndex((t) => t.event.year > year);
    return i === -1 ? timeline.length : i;
  }

  function place(index) {
    if (!current || locked) return;
    const e = current;
    let insertAt = index;
    let state;
    if (isCorrect(index, e.year)) {
      score++;
      state = "ok";
      setFeedback(`✔ Richtig! ${e.title} (${formatYear(e)}) – ${e.fact || ""}`, "ok");
    } else {
      lives--;
      state = "bad";
      insertAt = correctIndex(e.year);
      setFeedback(`✘ Leider falsch! ${e.title} (${formatYear(e)}) – ${e.fact || ""}`, "bad");
    }
    timeline.splice(insertAt, 0, { event: e, state, fresh: true });
    draw();
    render(insertAt);
    timeline.forEach((t) => (t.fresh = false));

    if (lives <= 0 || !current) endGame();
  }

  function endGame() {
    locked = true;
    const best = storage.get("timeline-best", 0);
    const isRecord = score > best;
    if (isRecord) storage.set("timeline-best", score);
    render();
    el.best.textContent = Math.max(best, score);
    el.goTitle.textContent = lives > 0 ? "Geschafft! 🎉" : "Keine Leben mehr";
    el.goText.textContent = `Du hast ${score} Karte${score === 1 ? "" : "n"} richtig eingeordnet.` +
      (isRecord ? " Neuer Rekord! 🏆" : ` Dein Rekord: ${best}.`);
    setTimeout(() => el.dialog.showModal(), 900);
  }

  function setFeedback(text, cls) {
    el.feedback.textContent = text;
    el.feedback.className = "feedback " + cls;
  }

  function render(focusIndex) {
    el.score.textContent = score;
    el.lives.textContent = "❤️".repeat(Math.max(lives, 0)) + "🤍".repeat(START_LIVES - Math.max(lives, 0));
    el.left.textContent = deck.length + (current ? 1 : 0);
    el.best.textContent = storage.get("timeline-best", 0);

    // aktuelle Karte
    el.current.replaceChildren();
    if (current && !locked) {
      const c = cardEl(current);
      c.draggable = true;
      c.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", current.id);
        ev.dataTransfer.effectAllowed = "move";
        el.timeline.classList.add("dragging");
      });
      c.addEventListener("dragend", () => el.timeline.classList.remove("dragging"));
      el.current.append(c);
    }

    // Zeitstrahl mit Lücken
    const frag = document.createDocumentFragment();
    let focusEl = null;
    for (let i = 0; i <= timeline.length; i++) {
      frag.append(gapEl(i));
      if (i < timeline.length) {
        const t = timeline[i];
        const c = cardEl(t.event, { showYear: true, state: t.state });
        if (t.fresh) { c.classList.add("new"); focusEl = c; }
        c.title = t.event.fact || "";
        frag.append(c);
      }
    }
    el.timeline.replaceChildren(frag);
    if (focusEl && focusIndex !== undefined) {
      focusEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  function gapEl(index) {
    const g = document.createElement("button");
    g.type = "button";
    g.className = "gap";
    g.textContent = "＋";
    g.setAttribute("aria-label", "Karte hier einordnen");
    g.disabled = !current || locked;
    g.addEventListener("click", () => place(index));
    g.addEventListener("dragover", (ev) => { ev.preventDefault(); g.classList.add("over"); });
    g.addEventListener("dragleave", () => g.classList.remove("over"));
    g.addEventListener("drop", (ev) => {
      ev.preventDefault();
      el.timeline.classList.remove("dragging");
      place(index);
    });
    return g;
  }

  el.newGame.addEventListener("click", newGame);
  el.again.addEventListener("click", newGame);
  el.roundSize.addEventListener("change", newGame);
  newGame();
})();
