// Mehrspieler-Trinkspiel: alle legen reihum auf denselben Zeitstrahl, bis jemand falsch liegt.
// Synchronisiert über Firebase Realtime Database, Anmeldung anonym über Firebase Auth.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const $ = (id) => document.getElementById(id);
const byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
const ALL_IDS = EVENTS.map((e) => e.id);
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const params = new URLSearchParams(location.search);

const el = {
  setup: $("setup"), lobby: $("lobby"), game: $("game"),
  configWarning: $("configWarning"), nameInput: $("nameInput"), codeInput: $("codeInput"),
  createBtn: $("createBtn"), joinBtn: $("joinBtn"), setupMsg: $("setupMsg"),
  lobbyCode: $("lobbyCode"), shareLink: $("shareLink"), copyBtn: $("copyBtn"),
  lobbyPlayers: $("lobbyPlayers"), startBtn: $("startBtn"), lobbyWait: $("lobbyWait"),
  roomInfo: $("roomInfo"), roomCodeTop: $("roomCodeTop"), roundNum: $("roundNum"),
  meter: $("meter"), beer: $("beer"), streakNum: $("streakNum"), stakeText: $("stakeText"),
  tiers: $("tiers"), nextTier: $("nextTier"), floatMsg: $("floatMsg"),
  turnBanner: $("turnBanner"), current: $("current"), mpHint: $("mpHint"), skipBtn: $("skipBtn"),
  scoreList: $("scoreList"), feedback: $("feedback"), timeline: $("timeline"),
  overlay: $("drinkOverlay"), drinkWho: $("drinkWho"), drinkSips: $("drinkSips"),
  drinkMugs: $("drinkMugs"), drinkDetail: $("drinkDetail"), nextRoundBtn: $("nextRoundBtn"),
};

let fb;            // Firebase-Funktionen + Instanzen
let uid = null;
let code = null;
let room = null;
let seenMoves = null;
let busy = false;

// ---------- Hilfsfunktionen ----------

const storage = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function show(section) {
  for (const s of [el.setup, el.lobby, el.game]) s.hidden = s !== section;
  el.roomInfo.hidden = section === el.setup;
}

function setMsg(text) { el.setupMsg.textContent = text; }

function randomCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

function playerName(id) { return room?.players?.[id]?.name || "?"; }

function normalize(r) {
  r.players = r.players || {};
  r.order = r.order || [];
  r.timeline = r.timeline || [];
  r.deck = r.deck || [];
  return r;
}

function isOnline(r, id) { return r.players?.[id]?.online !== false; }

function nextTurnIndex(r, from) {
  const n = r.order.length;
  for (let k = 1; k <= n; k++) {
    const idx = (from + k) % n;
    if (isOnline(r, r.order[idx])) return idx;
  }
  return (from + 1) % n;
}

function drawId(r) {
  r.deck = r.deck.filter((id) => byId[id]);
  if (!r.deck.length) {
    const used = new Set(r.timeline.map((t) => t.id));
    if (r.current) used.add(r.current);
    r.deck = TL.shuffle(ALL_IDS.filter((id) => !used.has(id)));
  }
  return r.deck.pop();
}

function startRound(r, turn) {
  r.timeline = [];
  r.current = null;
  r.timeline = [{ id: drawId(r), state: "start" }];
  r.current = drawId(r);
  r.streak = 0;
  r.phase = "place";
  r.turn = turn;
  r.last = { type: "round" };
  r.moves = (r.moves || 0) + 1;
}

// Ändert den Raum atomar (alle Spieler schreiben in denselben Datensatz).
async function mutate(fn) {
  if (busy) return;
  busy = true;
  try {
    await fb.runTransaction(fb.ref(fb.db, `rooms/${code}`), (r) => {
      if (!r) return r;
      return fn(normalize(r));
    });
  } catch (err) {
    console.error(err);
    el.feedback.textContent = "Verbindungsproblem – bitte nochmal versuchen.";
  } finally {
    busy = false;
  }
}

// ---------- Firebase ----------

async function initFirebase() {
  const [app, auth, db] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-database.js`),
  ]);
  const fbApp = app.initializeApp(firebaseConfig);
  const authInst = auth.getAuth(fbApp);
  const dbInst = db.getDatabase(fbApp);
  if (params.has("emulator")) {
    auth.connectAuthEmulator(authInst, "http://127.0.0.1:9099", { disableWarnings: true });
    db.connectDatabaseEmulator(dbInst, "127.0.0.1", 9000);
  }
  fb = { ...db, auth: authInst, db: dbInst, signInAnonymously: auth.signInAnonymously };
}

async function ensureAuth() {
  if (uid) return uid;
  const cred = await fb.signInAnonymously(fb.auth);
  uid = cred.user.uid;
  return uid;
}

function readName() {
  const name = el.nameInput.value.trim().slice(0, 20);
  if (!name) { setMsg("Bitte gib zuerst deinen Namen ein."); el.nameInput.focus(); return null; }
  storage.set("timeline-name", name);
  return name;
}

async function createRoom() {
  const name = readName();
  if (!name) return;
  setMsg("Raum wird erstellt …");
  try {
    await ensureAuth();
    let c = randomCode();
    for (let i = 0; i < 10 && (await fb.get(fb.ref(fb.db, `rooms/${c}`))).exists(); i++) c = randomCode();
    await fb.set(fb.ref(fb.db, `rooms/${c}`), {
      host: uid,
      createdAt: fb.serverTimestamp(),
      status: "lobby",
      players: { [uid]: { name, online: true, sips: 0 } },
      order: [uid],
      round: 0,
      moves: 0,
    });
    enterRoom(c);
  } catch (err) {
    console.error(err);
    setMsg("Raum konnte nicht erstellt werden. Ist Firebase richtig eingerichtet?");
  }
}

async function joinRoom(c) {
  const name = readName();
  if (!name) return;
  c = c.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(c)) { setMsg("Der Raumcode hat 4 Buchstaben."); return; }
  setMsg("Trete bei …");
  try {
    await ensureAuth();
    const res = await fb.runTransaction(fb.ref(fb.db, `rooms/${c}`), (r) => {
      if (!r) return r;
      normalize(r);
      const p = r.players[uid] || { sips: 0 };
      r.players[uid] = { ...p, name, online: true };
      if (!r.order.includes(uid)) r.order.push(uid);
      return r;
    });
    if (!res.snapshot.exists()) { setMsg(`Raum ${c} gibt es nicht.`); return; }
    enterRoom(c);
  } catch (err) {
    console.error(err);
    setMsg("Beitreten fehlgeschlagen. Ist Firebase richtig eingerichtet?");
  }
}

function enterRoom(c) {
  code = c;
  setMsg("");
  const url = new URL(location.href);
  url.searchParams.set("room", c);
  history.replaceState(null, "", url);

  // Anwesenheit: beim Verlassen der Seite als offline markieren
  const onlineRef = fb.ref(fb.db, `rooms/${c}/players/${uid}/online`);
  fb.onValue(fb.ref(fb.db, ".info/connected"), (snap) => {
    if (snap.val() !== true) return;
    fb.onDisconnect(onlineRef).set(false).then(() => fb.set(onlineRef, true));
  });

  fb.onValue(fb.ref(fb.db, `rooms/${c}`), (snap) => {
    room = snap.val() ? normalize(snap.val()) : null;
    render();
  });
}

// ---------- Spielaktionen ----------

function startGame() {
  mutate((r) => {
    if (r.host !== uid || r.status === "playing") return;
    r.status = "playing";
    r.round = 1;
    r.deck = TL.shuffle(ALL_IDS);
    startRound(r, Math.floor(Math.random() * r.order.length));
    return r;
  });
}

function place(index) {
  mutate((r) => {
    if (r.status !== "playing" || r.phase !== "place" || r.order[r.turn] !== uid || !byId[r.current]) return;
    const ev = byId[r.current];
    const years = r.timeline.map((t) => byId[t.id]?.year ?? 0);
    r.moves = (r.moves || 0) + 1;
    if (TL.isCorrect(years, index, ev.year)) {
      r.timeline.splice(index, 0, { id: r.current, state: "ok" });
      r.streak = (r.streak || 0) + 1;
      r.last = { type: "ok", by: uid, id: r.current, index };
      r.current = drawId(r);
      r.turn = nextTurnIndex(r, r.turn);
    } else {
      const at = TL.correctIndex(years, ev.year);
      const streak = r.streak || 0;
      const sips = TL.sipsFor(streak);
      r.timeline.splice(at, 0, { id: r.current, state: "bad" });
      r.players[uid].sips = (r.players[uid].sips || 0) + sips;
      r.last = { type: "bad", by: uid, id: r.current, index: at, sips, streak };
      r.current = null;
      r.phase = "roundOver";
    }
    return r;
  });
}

function nextRound() {
  mutate((r) => {
    if (r.phase !== "roundOver") return;
    const loser = r.order.indexOf(r.last?.by);
    r.round = (r.round || 1) + 1;
    startRound(r, nextTurnIndex(r, loser < 0 ? r.turn : loser));
    return r;
  });
}

function skipTurn() {
  mutate((r) => {
    if (r.phase !== "place" || isOnline(r, r.order[r.turn])) return;
    r.turn = nextTurnIndex(r, r.turn);
    return r;
  });
}

// ---------- Darstellung ----------

function render() {
  if (!room) {
    show(el.setup);
    setMsg("Der Raum existiert nicht mehr.");
    return;
  }
  el.roomCodeTop.textContent = code;
  if (room.status !== "playing") return renderLobby();
  show(el.game);

  const isNewMove = seenMoves !== null && room.moves !== seenMoves;
  const firstRender = seenMoves === null;
  seenMoves = room.moves;

  el.roundNum.textContent = room.round || 1;
  renderMeter(isNewMove);
  renderTurn();
  renderScores();

  const last = room.last || {};
  const items = room.timeline
    .filter((t) => byId[t.id])
    .map((t, i) => ({ event: byId[t.id], state: t.state, fresh: (isNewMove || firstRender) && i === last.index }));
  const myTurn = room.phase === "place" && room.order[room.turn] === uid;
  TL.renderTimeline(el.timeline, items, { canPlace: myTurn, onPlace: place });

  const ev = byId[last.id];
  if (last.type === "ok" && ev) {
    el.feedback.className = "feedback ok";
    el.feedback.textContent = `✔ ${playerName(last.by)} lag richtig: ${ev.title} (${TL.formatYear(ev)}) – ${ev.fact || ""}`;
  } else if (last.type === "bad" && ev) {
    el.feedback.className = "feedback bad";
    el.feedback.textContent = `✘ ${playerName(last.by)} lag falsch: ${ev.title} war ${TL.formatYear(ev)} – ${ev.fact || ""}`;
  } else {
    el.feedback.className = "feedback";
    el.feedback.textContent = `Runde ${room.round} beginnt – neuer Zeitstrahl!`;
  }

  renderOverlay(isNewMove || firstRender);
}

function renderLobby() {
  show(el.lobby);
  seenMoves = null;
  el.lobbyCode.textContent = code;
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("room", code);
  if (params.has("emulator")) url.searchParams.set("emulator", "1");
  el.shareLink.value = url.toString();
  el.lobbyPlayers.replaceChildren(...room.order.map((id) => {
    const li = document.createElement("li");
    li.textContent = playerName(id) + (id === room.host ? " 👑" : "") + (id === uid ? " (du)" : "");
    li.classList.toggle("offline", !isOnline(room, id));
    return li;
  }));
  const isHost = room.host === uid;
  el.startBtn.hidden = !isHost;
  el.lobbyWait.hidden = isHost;
}

function renderMeter(animate) {
  const streak = room.streak || 0;
  const sips = TL.sipsFor(streak);
  el.streakNum.textContent = streak;
  el.stakeText.textContent = TL.sipWord(sips);
  el.beer.style.transform = `translateY(${(1 - sips / 5) * 94}px)`;
  el.meter.dataset.tier = sips;

  el.tiers.replaceChildren(...TL.SIP_TIERS.map((t) => {
    const d = document.createElement("div");
    d.className = "tier" + (t.sips === sips ? " active" : t.sips < sips ? " done" : "");
    d.innerHTML = `<b>${t.sips}🍺</b><span>${t.to === Infinity ? `${t.from}+` : `${t.from}–${t.to}`}</span>`;
    return d;
  }));
  const next = TL.SIP_TIERS.find((t) => t.sips === sips + 1);
  el.nextTier.textContent = next
    ? `Noch ${next.from - streak} richtige bis ${TL.sipWord(next.sips)}`
    : "Maximum erreicht – jetzt wird’s ernst!";

  if (animate && room.last?.type === "ok") {
    restartAnim(el.streakNum, "bump");
    if (TL.sipsFor(streak - 1) < sips) {
      restartAnim(el.meter, "levelup");
      floatMsg(`+1 🍺  Jetzt ${TL.sipWord(sips)}!`);
    }
  }
}

function renderTurn() {
  const turnId = room.order[room.turn];
  const myTurn = turnId === uid;
  const placing = room.phase === "place";
  el.turnBanner.classList.toggle("mine", myTurn && placing);
  el.turnBanner.textContent = !placing ? "Runde vorbei" : myTurn ? "Du bist dran!" : `${playerName(turnId)} ist dran`;
  el.mpHint.textContent = placing
    ? myTurn ? "Ziehe die Karte in den Zeitstrahl oder tippe auf eine ＋-Lücke." : "Schau zu und hoffe, dass es schiefgeht 😏"
    : "";
  el.skipBtn.hidden = !(placing && !isOnline(room, turnId) && !myTurn);

  el.current.replaceChildren();
  const ev = byId[room.current];
  if (placing && ev) {
    const c = TL.cardEl(ev);
    if (myTurn) TL.makeDraggable(c, el.timeline);
    else c.classList.add("waiting");
    el.current.append(c);
  }
}

function renderScores() {
  const turnId = room.phase === "place" ? room.order[room.turn] : null;
  el.scoreList.replaceChildren(...room.order.map((id) => {
    const p = room.players[id] || {};
    const li = document.createElement("li");
    li.classList.toggle("turn", id === turnId);
    li.classList.toggle("offline", p.online === false);
    const name = document.createElement("span");
    name.textContent = (p.name || "?") + (id === uid ? " (du)" : "");
    const sips = document.createElement("b");
    sips.textContent = `${p.sips || 0} 🍺`;
    li.append(name, sips);
    return li;
  }));
}

function renderOverlay(animate) {
  const last = room.last || {};
  const visible = room.phase === "roundOver" && last.type === "bad";
  el.overlay.hidden = !visible;
  if (!visible || !animate) return;
  const ev = byId[last.id];
  const me = last.by === uid;
  el.drinkWho.textContent = me ? "Du trinkst" : `${playerName(last.by)} trinkt`;
  el.drinkSips.textContent = TL.sipWord(last.sips) + "!";
  el.drinkDetail.textContent = `${last.streak} richtige in Folge – dann ${ev ? `„${ev.title}“ (${TL.formatYear(ev)})` : "eine Karte"} falsch gelegt.`;
  el.drinkMugs.replaceChildren(...Array.from({ length: last.sips }, (_, i) => {
    const s = document.createElement("span");
    s.textContent = "🍺";
    s.style.animationDelay = `${0.35 + i * 0.18}s`;
    return s;
  }));
  restartAnim(el.overlay.firstElementChild, "shake");
}

function restartAnim(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // Animation neu starten
  node.classList.add(cls);
}

function floatMsg(text) {
  el.floatMsg.textContent = text;
  restartAnim(el.floatMsg, "show");
}

// ---------- Start ----------

async function main() {
  el.nameInput.value = storage.get("timeline-name");
  el.codeInput.value = (params.get("room") || "").toUpperCase();

  if (!firebaseConfig.apiKey) {
    el.configWarning.hidden = false;
    el.createBtn.disabled = el.joinBtn.disabled = true;
    return;
  }
  try {
    await initFirebase();
  } catch (err) {
    console.error(err);
    setMsg("Firebase konnte nicht geladen werden. Bist du online?");
    return;
  }

  el.createBtn.addEventListener("click", createRoom);
  el.joinBtn.addEventListener("click", () => joinRoom(el.codeInput.value));
  el.codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(el.codeInput.value); });
  el.startBtn.addEventListener("click", startGame);
  el.nextRoundBtn.addEventListener("click", nextRound);
  el.skipBtn.addEventListener("click", skipTurn);
  el.copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(el.shareLink.value); el.copyBtn.textContent = "Kopiert ✓"; }
    catch { el.shareLink.select(); }
  });
}

main();
