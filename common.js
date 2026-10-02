// Gemeinsame Bausteine für Einzel- und Mehrspieler (beide nutzen dieselbe events.js).
const TL = (() => {
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

  // Liegt `year` zwischen den Nachbarn an Position `index`? (gleiche Jahre zählen als richtig)
  function isCorrect(years, index, year) {
    const prev = years[index - 1];
    const next = years[index];
    return (prev === undefined || prev <= year) && (next === undefined || year <= next);
  }

  function correctIndex(years, year) {
    const i = years.findIndex((y) => y > year);
    return i === -1 ? years.length : i;
  }

  // Trinkspiel-Regel: Anzahl richtiger Karten in Folge → Schlücke bei einem Fehler
  const SIP_TIERS = [
    { from: 0, to: 3, sips: 1 },
    { from: 4, to: 6, sips: 2 },
    { from: 7, to: 9, sips: 3 },
    { from: 10, to: 11, sips: 4 },
    { from: 12, to: Infinity, sips: 5 },
  ];
  function sipsFor(streak) {
    return SIP_TIERS.find((t) => streak >= t.from && streak <= t.to).sips;
  }
  function sipWord(n) {
    return n === 1 ? "1 Schluck" : `${n} Schlücke`;
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

  function makeDraggable(card, timelineEl) {
    card.draggable = true;
    card.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", "card");
      ev.dataTransfer.effectAllowed = "move";
      timelineEl.classList.add("dragging");
    });
    card.addEventListener("dragend", () => timelineEl.classList.remove("dragging"));
  }

  // items: [{ event, state, fresh }]
  function renderTimeline(container, items, { canPlace, onPlace }) {
    const frag = document.createDocumentFragment();
    let focusEl = null;
    const gap = (index) => {
      const g = document.createElement("button");
      g.type = "button";
      g.className = "gap";
      g.textContent = "＋";
      g.setAttribute("aria-label", "Karte hier einordnen");
      g.disabled = !canPlace;
      g.addEventListener("click", () => onPlace(index));
      g.addEventListener("dragover", (ev) => { ev.preventDefault(); g.classList.add("over"); });
      g.addEventListener("dragleave", () => g.classList.remove("over"));
      g.addEventListener("drop", (ev) => {
        ev.preventDefault();
        container.classList.remove("dragging");
        onPlace(index);
      });
      return g;
    };
    items.forEach((t, i) => {
      frag.append(gap(i));
      const c = cardEl(t.event, { showYear: true, state: t.state });
      c.title = t.event.fact || "";
      if (t.fresh) { c.classList.add("new"); focusEl = c; }
      frag.append(c);
    });
    frag.append(gap(items.length));
    container.replaceChildren(frag);
    if (focusEl) focusEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return { formatYear, shuffle, isCorrect, correctIndex, SIP_TIERS, sipsFor, sipWord, cardEl, makeDraggable, renderTimeline };
})();
