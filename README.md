# Zeitstrahl – Das Geschichtsspiel

Ordne Ereignisse aus der Menschheitsgeschichte richtig auf dem Zeitstrahl ein.
Jede Karte zeigt oben ein Bild und darunter die Bezeichnung – das Jahr bleibt verborgen,
bis die Karte gelegt wurde.

## Spielen

`index.html` im Browser öffnen – fertig. Es gibt keinen Build-Schritt und keine Abhängigkeiten.
Online spielen über **GitHub Pages**: *Settings → Pages → Branch auswählen → Save*.

## Regeln

- Am Anfang liegt eine Karte mit Jahreszahl auf dem Zeitstrahl.
- Ziehe die neue Karte in eine Lücke (oder tippe auf eine **＋**-Lücke, z. B. am Handy).
- Richtig → +1 Punkt. Falsch → 1 Leben weg, und die Karte wird an der richtigen Stelle (rot) eingefügt.
- Nach 3 Fehlern oder wenn alle Karten gespielt sind, ist das Spiel vorbei. Der Rekord wird im Browser gespeichert.
- Rundengröße: 10, 20 oder alle Karten.

## Mehrspieler – das Trinkspiel 🍻

`multiplayer.html` (oder oben im Spiel auf **🍻 Mehrspieler** klicken):

1. Name eingeben → **Neuen Raum erstellen**. Code oder Link an die anderen schicken.
2. Die anderen geben den Code ein (oder öffnen den Link) → **Beitreten**.
3. Der Host (👑) startet das Spiel.
4. Reihum legt jeder eine Karte auf **denselben** Zeitstrahl. Es gibt keine Leben:
   Wer falsch legt, trinkt – abhängig davon, wie viele Karten davor in Folge richtig lagen:

   | richtige in Folge | Schlücke |
   |-------------------|----------|
   | 0–3               | 1        |
   | 4–6               | 2        |
   | 7–9               | 3        |
   | 10–11             | 4        |
   | ab 12             | 5        |

5. Danach startet eine neue Runde mit frischem Zeitstrahl; der Nächste nach dem Verlierer beginnt.
   Das Schluck-Konto zählt mit. Ist ein Spieler offline, kann er übersprungen werden.

### Firebase einrichten (einmalig, kostenlos)

1. Auf <https://console.firebase.google.com> ein Projekt anlegen (Google Analytics ist nicht nötig).
2. **Build → Authentication → Get started → Sign-in method → Anonym** aktivieren.
3. **Build → Realtime Database → Datenbank erstellen** (Standort z. B. `europe-west1`, im *gesperrten Modus* starten).
   Unter **Regeln** den Inhalt von `database.rules.json` einfügen und veröffentlichen.
4. **Projekteinstellungen → Allgemein → Meine Apps → Web-App hinzufügen (`</>`)**.
   Die angezeigte `firebaseConfig` in `firebase-config.js` eintragen (inkl. `databaseURL`).
5. Committen & pushen – fertig. Die Konfiguration ist nicht geheim; Zugriff haben nur angemeldete Spieler.

Zum lokalen Testen ohne echtes Projekt: Firebase-Emulatoren starten
(`firebase emulators:start --only database,auth --project demo-timeline`) und
`multiplayer.html?emulator=1` öffnen.

## Dateien

| Datei        | Inhalt                                                     |
|--------------|------------------------------------------------------------|
| `events.js`  | Liste aller Ereignisse (Titel, Jahr, Bild, kurze Info) – gilt für **beide** Modi |
| `img/`       | Ein Bild pro Ereignis (selbst gezeichnete SVGs)             |
| `common.js`  | Gemeinsame Bausteine: Karten, Zeitstrahl, Schluck-Regel     |
| `game.js`    | Einzelspieler-Logik                                        |
| `multiplayer.html` / `multiplayer.js` | Mehrspieler-Trinkspiel                  |
| `firebase-config.js` | Firebase-Projektdaten (selbst eintragen)            |
| `database.rules.json` | Sicherheitsregeln für die Realtime Database        |
| `style.css`  | Aussehen                                                   |

## Neue Ereignisse hinzufügen

In `events.js` einen Eintrag ergänzen:

```js
{ id: "beispiel", title: "Mein Ereignis", year: 1234, approx: false, image: "img/beispiel.webp", fact: "Kurze Info." },
```

Neue Ereignisse erscheinen automatisch im Einzel- **und** Mehrspieler-Modus.
Jahre vor Christus werden negativ angegeben (`-753`); mit `approx: true` erscheint „ca.“ vor dem Jahr.

## Wie viele Ereignisse – und wie groß dürfen Bilder sein?

GitHub empfiehlt Repositories **unter 1 GB** und blockt einzelne Dateien **über 100 MB**;
GitHub Pages-Seiten dürfen höchstens 1 GB groß sein. Entscheidend ist also die Größe pro Bild:

| Bildformat                                 | pro Bild   | 60 Ereignisse | 200 Ereignisse |
|--------------------------------------------|------------|---------------|----------------|
| SVG-Illustration (wie jetzt)               | 1–4 KB     | ~0,25 MB      | ~0,8 MB        |
| Foto als WebP, 480×300 px, Qualität ~75    | 20–40 KB   | ~2 MB         | ~8 MB          |
| Foto als JPG in Originalgröße (Handy/Wiki) | 2–5 MB     | ~200 MB ❌    | ~700 MB ❌     |

**Empfehlung:** 50–100 Ereignisse, Bilder vorher auf ca. 480 px Breite verkleinern und als WebP
(oder JPG mit ~75 % Qualität) speichern. Dann bleibt das ganze Spiel unter 5 MB und lädt auch am
Handy schnell. Selbst mehrere hundert Ereignisse wären so problemlos möglich.

Beispiel mit ImageMagick:

```bash
magick original.jpg -resize 480x300^ -gravity center -extent 480x300 -quality 75 img/beispiel.webp
```

Bei echten Fotos auf die Lizenz achten – z. B. Bilder von Wikimedia Commons (gemeinfrei oder CC-BY/CC-BY-SA)
und die Quelle angeben.
