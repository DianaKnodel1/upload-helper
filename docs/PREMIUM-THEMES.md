# Premium-Themes für den Landing Generator 4.0 — Spezifikation für Claude Code

Diese Datei ist verbindlich. Ein Theme, das sie einhält, wird ohne Code-Änderung
im Portal registriert, im Generator bearbeitbar, in der Vorschau angezeigt und
live ausgeliefert. Referenz-Implementierung: `src/landing-themes/site-16/`.

---

## 1. Ordnerstruktur

```text
src/landing-themes/site-17/          ← nächste freie Nummer (site-16 = Test-Theme)
├── meta.json                        Pflicht
├── template.html                    Pflicht
├── style.css                        Pflicht
├── script.js                        optional (nur Menü, Akkordeon, kleine Effekte)
└── assets/                          optional, Unterordner erlaubt
    ├── img/hero.jpg
    ├── img/logo-mark.svg
    └── fonts/inter-var.woff2
```

Regeln:
- Ordnername = `meta.json` → `id` (z. B. `site-17`). Nummern ≤ 15 sind belegt und dürfen nicht verändert werden.
- Datei- und Ordnernamen nur `A–Z a–z 0–9 . _ -` (keine Leerzeichen, keine Umlaute).
- Keine externen Build-Tools, kein Framework, kein npm. Reines HTML/CSS/JS.

## 2. Registrierung

Automatisch. Jeder Ordner `site-N` mit N ≥ 16, der `meta.json` + `template.html` enthält,
wird beim Build über `import.meta.glob` in `src/lib/landing-themes.ts` registriert
und erscheint bei „Neue Landing“ in der Theme-Auswahl. Assets werden beim Build von
`scripts/build-theme-assets.mjs` eingebettet (läuft automatisch bei `build`/`dev`).

## 3. meta.json (vollständiges Beispiel)

```json
{
  "id": "site-17",
  "kind": "site",
  "standard": "premium-theme-v1",
  "name": "Website-Theme 17",
  "description": "Ein Satz zur Optik (Farben, Stimmung).",
  "colors": { "primary": "#1f4e5f", "secondary": "#e0a458" },
  "pages": [
    { "id": "home", "slug": "", "title": "Startseite" },
    { "id": "faq",  "slug": "faq", "title": "FAQ" }
  ],
  "slots": [
    { "key": "logo_image",  "label": "Logo",              "type": "image",    "group": "Kopfbereich", "default": "assets/img/logo-mark.svg" },
    { "key": "brand_name",  "label": "Firmenname",        "type": "text",     "group": "Kopfbereich", "default": "Muster Digital Services" },
    { "key": "cta_label",   "label": "Bewerbungs-Button", "type": "text",     "group": "Kopfbereich", "default": "Jetzt bewerben" },
    { "key": "hero_title",  "label": "Hero: Überschrift", "type": "text",     "group": "Hero", "default": "…" },
    { "key": "hero_description", "label": "Hero: Text",   "type": "longtext", "group": "Hero", "default": "…" },
    { "key": "hero_image",  "label": "Hero: Bild",        "type": "image",    "group": "Hero", "default": "assets/img/hero.jpg" },
    { "key": "hero_secondary_link", "label": "Zweiter Button: Ziel", "type": "link", "group": "Hero", "default": "/faq" },
    { "key": "faq_question_1", "label": "FAQ 1: Frage",   "type": "text",     "group": "FAQ", "default": "…" },
    { "key": "faq_answer_1",   "label": "FAQ 1: Antwort", "type": "longtext", "group": "FAQ", "default": "…" },
    { "key": "accent_color",   "label": "Akzentfarbe",    "type": "color",    "group": "Design", "default": "#e0a458" }
  ]
}
```

Felder:
- `kind`: immer `"site"` (mehrseitig; eine Seite ist erlaubt).
- `colors`: werden bei Theme-Auswahl als Firmenfarben vorbelegt.
- `pages`: `id` muss einem `lv-page`-Block im Template entsprechen; erste Seite = Startseite (`slug: ""`).
- `slots`: **Array-Format mit explizitem `type` ist Pflicht** (keine Ableitung über Namen).

## 4. Feldtypen

| type       | Editor                         | Verwendung im Template |
|------------|--------------------------------|------------------------|
| `text`     | einzeilig                      | Überschriften, Labels, Button-Texte |
| `longtext` | mehrzeilig                     | Absätze, FAQ-Antworten |
| `textarea` | mehrzeilig (wie longtext)      | kurze Kartentexte |
| `image`    | URL-Feld + „Bild hochladen“    | `src="{{hero_image}}"` oder `style="background-image:url('{{hero_image}}')"` |
| `color`    | Farbwähler                     | `--x: {{accent_color}};` in style.css |
| `link`     | URL-Feld                       | `href="{{hero_secondary_link}}"` |

Unbekannte Typen werden als `text` behandelt — der Test schlägt dann fehl (siehe §11).

## 5. Platzhalter

Syntax: `{{slot_key}}`, nur `a–z 0–9 _`. Schlüssel = Platzhaltername.
Jeder Platzhalter in `template.html` und `style.css` muss **entweder** als Slot in `meta.json`
stehen **oder** ein System-Wert sein:

| System-Platzhalter | Inhalt |
|---|---|
| `{{page_content}}` | Pflicht, genau einmal in `<main>`: hier wird die aktuelle Unterseite eingesetzt |
| `{{seo_title}}`, `{{seo_description}}` | SEO je Seite (aus Generator) |
| `{{primary_color}}`, `{{secondary_color}}` | Firmenfarben aus Branding |
| `{{brand_name}}`, `{{firmenname}}` | Firmenname (Branding gewinnt live) |
| `{{contact_address}}`, `{{contact_email}}`, `{{contact_phone}}` | Firmendaten aus Branding |
| `{{logo_image}}` | Logo (als image-Slot definieren, s. Beispiel) |

Nicht aufgelöste Platzhalter werden in Vorschau und Live-Seite automatisch entfernt,
erscheinen also nie sichtbar — trotzdem gilt: keine undefinierten Platzhalter.

Namenskonvention: `hero_title`, `hero_description`, `hero_image`, `benefit_1_title`,
`benefit_1_text`, `faq_question_1`, `faq_answer_1`, `cta_title`, `cta_text`, `footer_claim`.

## 6. template.html (Gerüst)

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{{seo_title}}</title>
  <meta name="description" content="{{seo_description}}"/>
  <meta property="og:title" content="{{seo_title}}"/>
  <meta property="og:description" content="{{seo_description}}"/>
  <link rel="stylesheet" href="style.css"/>
</head>
<body class="t17">
  <header class="t17-header">
    <a href="/" class="t17-brand"><img src="{{logo_image}}" alt="" width="40" height="40"/>{{brand_name}}</a>
    <nav id="t17-nav">
      <!-- lv-nav:home --><a href="/">Start</a><!-- /lv-nav -->
      <!-- lv-nav:faq --><a href="/faq">FAQ</a><!-- /lv-nav -->
      <a href="#bewerbung-form" class="t17-btn">{{cta_label}}</a>
    </nav>
    <button id="t17-burger" type="button" aria-label="Menü öffnen" aria-expanded="false">…</button>
  </header>

  <main>
{{page_content}}
  </main>

  <footer class="t17-footer">
    …
    <a href="/impressum.html">Impressum</a>
    <a href="/datenschutz.html">Datenschutz</a>
  </footer>

<!-- lv-page:home -->
  <section class="t17-hero">
    <h1>{{hero_title}}</h1>
    <p>{{hero_description}}</p>
    <a href="#bewerbung-form" class="t17-btn">{{cta_label}}</a>
    <img src="{{hero_image}}" alt="…" width="1600" height="1066"/>
  </section>
  …
<!-- /lv-page -->

<!-- lv-page:faq -->
  …
<!-- /lv-page -->

<!-- lv-page:404 -->
  <section><h1>Seite nicht gefunden</h1><a href="/">Zur Startseite</a></section>
<!-- /lv-page -->

  <script src="script.js"></script>
</body>
</html>
```

Pflicht-Marker:
- `<!-- lv-page:ID --> … <!-- /lv-page -->` je Seite aus `pages` (+ optional `404`).
- `<!-- lv-nav:ID --> … <!-- /lv-nav -->` um jeden Navigationslink; deaktiviert der Admin eine Seite, verschwindet der Link.
- Header und Footer stehen **außerhalb** der `lv-page`-Blöcke (gelten für alle Seiten).

## 7. style.css (Beispiel)

```css
@font-face {
  font-family: "T17 Display";
  src: url("assets/fonts/display.woff2") format("woff2");
  font-weight: 400 800;
  font-display: swap;
}
:root { --t17-primary: {{primary_color}}; --t17-accent: {{secondary_color}}; }

/* Basisregeln IMMER in :where(), damit Komponentenklassen gewinnen */
:where(.t17) { margin: 0; font-family: "T17 Display", system-ui, sans-serif; }
:where(.t17) :where(h1, h2, h3) { line-height: 1.15; }
:where(.t17) :where(img) { max-width: 100%; display: block; }

.t17-btn { background: var(--t17-primary); color: #fff; }
.t17-hero-grid > * { min-width: 0; }   /* verhindert Überbreite durch große Bilder im Grid */

@media (max-width: 900px) { … }
@media (prefers-reduced-motion: reduce) { … }
```

Regeln:
- Alle Klassen mit eigenem Präfix (`t17-`), keine globalen Selektoren wie `button {}`, `section {}`, `.container {}`.
- Klassen `lv-*`, `lov-*`, IDs `bewerbung-form`, `lov-apply-modal`, `application-form` sind reserviert.
- Firmenfarben über `{{primary_color}}`/`{{secondary_color}}` einsetzen, damit jede Firma ihre Farben bekommt.
- Kontrast WCAG AA, auch für Buttons auf Primärfarbe.

## 8. Bilder, Logos, Schriften, Assets

- Ablage unter `assets/` (Unterordner erlaubt). Immer **relativ** referenzieren: `assets/img/hero.jpg` — nicht `/assets/…`, nicht `./assets/…`, keine `src/`-Pfade.
- CSS-Hintergründe ebenfalls relativ: `url("assets/img/pattern.svg")`.
- Austauschbare Bilder/Logos **müssen** als `image`-Slot definiert sein; der Default zeigt auf die Theme-Datei. Der Admin kann eine URL eintragen oder ein Bild hochladen.
- Formate: JPG/WebP für Fotos (≤ 400 KB, ≥ 1600 px Breite für Hero), SVG/PNG für Logos/Icons, WOFF2 für Schriften.
- Schriften lokal als WOFF2 mitliefern (kein Google-Fonts-Link nötig; Lizenz OFL o. ä. beachten).
- Keine echten Firmenlogos von Dritten (Partnerleisten, „bekannt aus“), keine Stockfoto-Wasserzeichen.
- Theme-eigene Dateinamen `logo.*` und `favicon.*` vermeiden (reserviert für Branding-Upload).

## 9. Bewerbungsbuttons und Formular

- Jeder Bewerbungs-CTA ist ein Link `<a href="#bewerbung-form" …>{{cta_label}}</a>`.
- **Kein eigenes `<form>`** und kein eigener Submit-Code. Das System hängt Bewerbungsformular,
  Modal, Validierung, Tenant-Zuordnung, Flow-Type und Danke-Seite automatisch an.
- Keine API-Adressen, Firmen-IDs, Schlüssel oder Tracking-Codes im Theme.
- Der Hinweis „Bewerbung dauert ca. 2 Minuten“ wird automatisch nach der ersten CTA-Gruppe eingefügt;
  Buttons daher in einem eigenen Container (z. B. `.t17-actions`) gruppieren.

## 10. Responsive Design

- Mobile-first, getestet bei 320, 390, 768, 1280 px; kein horizontales Scrollen.
- Mobiles Menü per Button mit `aria-expanded`, Steuerung in `script.js`.
- Touch-Ziele ≥ 44 px, Fließtext ≥ 16 px.
- Animationen dezent; `prefers-reduced-motion` respektieren. Inhalte dürfen ohne JS nicht unsichtbar sein.
- `script.js` nur Vanilla-JS, in einer IIFE, ohne externe Skripte.

## 11. Prüfen, Synchronisieren, Veröffentlichen

1. Theme-Ordner nach `src/landing-themes/site-N/` legen.
2. Test ausführen: `bunx vitest run src/test/premium-theme-standard.test.ts`
   (prüft Registrierung, Feldtypen, Platzhalter, Assets, Pflicht-Marker, CTA, Rechtslinks, Rendering jeder Seite).
3. Im Generator „Neue Landing“ → Theme wählen → Texte/Bilder anpassen → Vorschau → Speichern.
4. Deploy auf dem Portal-Server: `cd /opt/apps/portal && git fetch --all && git reset --hard origin/main && bash scripts/deploy.sh`
5. Landing-Server synchronisieren: `bash scripts/sync-landing-server.sh` (überträgt jetzt `theme-*` **und** `site-*` inkl. Asset-Unterordner)
   oder Admin → Infrastruktur → „Themes neu laden“.
6. Live-Seite prüfen: Startseite, Unterseiten, `/assets/…`-Bilder und Schrift, Bewerbungsbutton öffnet Formular.

Bestehende Themes `site-1` … `site-15` und alle `theme-*` bleiben unverändert.
