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
  let timeline = [];  // { event, state: "start" | "ok" | "bad", fresh }
  let current = null;
  let score = 0;
  let lives = START_LIVES;
  let locked = false;

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  };

  function newGame() {
    el.dialog.open && el.dialog.close();
    const size = Number(el.roundSize.value);
    const all = TL.shuffle(EVENTS);
    const n = size > 0 ? Math.min(size + 1, all.length) : all.length; // +1 Startkarte
    deck = all.slice(0, n);
    timeline = [{ event: deck.shift(), state: "start" }];
    score = 0;
    lives = START_LIVES;
    locked = false;
    setFeedback("", "");
    current = deck.shift() || null;
    render();
  }

  function place(index) {
    if (!current || locked) return;
    const e = current;
    const years = timeline.map((t) => t.event.year);
    let insertAt = index;
    let state;
    if (TL.isCorrect(years, index, e.year)) {
      score++;
      state = "ok";
      setFeedback(`✔ Richtig! ${e.title} (${TL.formatYear(e)}) – ${e.fact || ""}`, "ok");
    } else {
      lives--;
      state = "bad";
      insertAt = TL.correctIndex(years, e.year);
      setFeedback(`✘ Leider falsch! ${e.title} (${TL.formatYear(e)}) – ${e.fact || ""}`, "bad");
    }
    timeline.forEach((t) => (t.fresh = false));
    timeline.splice(insertAt, 0, { event: e, state, fresh: true });
    current = deck.shift() || null;
    render();

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

  function render() {
    el.score.textContent = score;
    el.lives.textContent = "❤️".repeat(Math.max(lives, 0)) + "🤍".repeat(START_LIVES - Math.max(lives, 0));
    el.left.textContent = deck.length + (current ? 1 : 0);
    el.best.textContent = storage.get("timeline-best", 0);

    el.current.replaceChildren();
    if (current && !locked) {
      const c = TL.cardEl(current);
      TL.makeDraggable(c, el.timeline);
      el.current.append(c);
    }

    TL.renderTimeline(el.timeline, timeline, { canPlace: !!current && !locked, onPlace: place });
    timeline.forEach((t) => (t.fresh = false));
  }

  el.newGame.addEventListener("click", newGame);
  el.again.addEventListener("click", newGame);
  el.roundSize.addEventListener("change", newGame);
  newGame();
})();
