# Captain Certificate Engine

Upload a CSV, get one Cityflo **Certificate of Excellence** per row back as a single ZIP.

Everything runs in the browser — no server, no upload, nothing leaves the machine. Drop it on
GitHub Pages and the whole ops team can use it from a link.

## How to use it

1. Open the page and unlock it (see **Access**).
2. Drop a CSV anywhere on the window.
3. Confirm the column mapping — headers are auto-detected, and each row's own
   value is shown under the picker so a wrong column is obvious at a glance.
4. Flick through every captain with `←` / `→` before committing to a run; click
   the sheet to see it at actual size.
6. Pick formats and quality, then **Generate** (or `⌘⏎`). The ZIP downloads, and
   a summary reports how many were made, how many files, how big, and which rows
   were skipped.

The interface is a two-pane press room: controls on the left, the certificate lit
on a dark stage on the right, because print judgements are easier against ink than
against more paper. On a phone the sheet sits on top with the controls beneath and
the generate button pinned to the bottom.

### CSV

Header row, then one row per captain. The format is shown on the page itself, with
`template.csv` and a filled-in example downloadable from there.

```csv
name,tag,achievement
Ravi Kumar,Punctuality Pro,100% on-time across 62 trips this month
Sunil Yadav,Elite Captain,perfect 100 out of 100 with zero commuter complaints
```

Three fields drive the output; everything else on the certificate is fixed artwork.

| Field | Required | Notes |
|---|---|---|
| Name | yes | Rows with no name are skipped and reported |
| Tag | no | 1–2 words. Takes the award block's display line — upright Fraunces, ink, 17pt. Casing is used as given |
| Achievement | no | One short sentence, printed below the tag. Wraps to two lines, shrinks if very long. With no tag it moves up into the display line, in the .ai's italic |

Header names are matched loosely (`captain_name`, `name`, `captain`, `tag`, `badge`,
`achievement`, `citation`, `reason`, …). Anything unusual you remap in the UI.

### Output

ZIP contains `pdf/Certificate - <Name>.pdf` and `png/Certificate - <Name>.png`.
Duplicate names get ` (2)`, ` (3)`, … Page is A4 landscape, 841.92 × 594.96 pt — the exact
page size of the source Illustrator file.

Quality picker sets the render resolution: Print 300 dpi (~1.5 MB/certificate),
Standard 200 dpi (default, ~700 KB), Light 150 dpi. Above roughly 200 rows, split the CSV —
the whole ZIP is built in memory.

## Access

The page opens behind a passcode (`js/gate.js`): a mobile number plus a 4-digit
code, held as a PBKDF2 hash rather than in plain text, with the unlock remembered
in `localStorage` — append `?lock` to the URL to sign out again.

It is a speed bump, not access control: the check runs client-side on a public
static page, so it stops strangers who find the link, not anyone determined.
[HOSTING.md](HOSTING.md) covers the real gate (Cloudflare Access, free).

## Hosting

Currently on GitHub Pages (public). To put it behind a login for the ops team
only, see [HOSTING.md](HOSTING.md) — Cloudflare Pages + Access, free, email
one-time PIN. A passcode inside the page cannot restrict a static public site.

### GitHub Pages

```bash
git init && git add -A && git commit -m "Captain certificate engine"
git branch -M main
git remote add origin git@github.com:<user>/captain-certificate-engine.git
git push -u origin main
```

Then **Settings → Pages → Source: deploy from branch → `main` / root**. The site is fully
static (`.nojekyll` is already there so the `js/` folder is served as-is).

Local run — needs a server, because the page uses ES modules:

```bash
python3 -m http.server 8899
```

## How the template is reproduced

All text in `captain-certificate-v2.ai` / `.pdf` is outlined (converted to paths), so the
artwork cannot be filled in directly. It was rebuilt instead:

- **Background** (`js/background.js`) — paper, both Mumbai street-map panels and the inner
  hairline frame, extracted as vectors straight out of the .ai. Pixel-identical to the source.
- **Logo** (`js/logo.js`) — the same 929 × 301 PNG the .ai embeds.
- **Type** (`js/certificate.js`) — re-typeset in the original fonts. Every size, baseline,
  letter-spacing and rule position was measured off the source file, then checked against a
  300 dpi render of it: all runs land within ~1 pt (0.35 mm).
- **Colour** — the artwork's near-black is printed in the Cityflo brand navy
  (`#00253f`, design system P-300), with P-200 `#2b4a60` for secondary text. Gold
  and the hairline rules stay exactly as the .ai has them.
- **Fonts** — Fraunces (`opsz` pinned to 72, weights 400 / 500 italic / 600 italic) and
  Archivo (400 / 600), SIL OFL 1.1, subset to Latin and embedded as base64 woff2 so the
  output is identical offline and on any machine.

Differences from the .ai, all deliberate:

- **The tag.** The source's award block has one display line; the tag takes it, upright in ink.
  The achievement then prints where the .ai's fixed citation paragraph sat. With no tag the
  achievement moves up into the display line, in the .ai's own italic.
- **The citation paragraph is gone.** "Through unwavering punctuality…" was generic filler
  competing with the real achievement, so the achievement occupies that block instead.
- **The date prints above its rule**, not below the label — that is the space you would sign
  in, and the whole signature block sits 14pt lower to leave room for a pen.
- **The name's flanking rules and diamonds never drop away.** A long name pushes the diamonds
  outward and shortens the rules; only when the diamonds run out of travel does the type
  shrink (down to 16pt). Colour and style stay as the source has them.

### Things worth knowing if you edit it

- `L` in `js/certificate.js` holds every coordinate; `T` holds every type spec. Both are in
  PDF points on the 841.92 × 594.96 page.
- The date and `CITYFLO OPERATIONS` sub-labels use the design's own pale `#d8c39a`. If a
  printed date needs to read stronger, change `C.rule` to `C.inkSoft` in the signature block.
- `test/compare.html?ph=1` renders the template with the .ai's placeholder text — that's what
  the measurements were verified against. `test/print.html` prints it as real vector text.

## Files

```
index.html            UI
app.css               UI styles
js/app.js             CSV parse, render loop, ZIP, download
js/gate.js            passcode gate (hashed; a speed bump, see HOSTING.md)
js/certificate.js     the template: geometry, type, SVG builder, rasteriser
js/background.js      background artwork extracted from the .ai
js/logo.js            Cityflo wordmark
js/fonts.js           embedded Fraunces + Archivo subsets
vendor/               PapaParse, JSZip, jsPDF
template.csv          blank CSV with just the headers
sample-captains.csv   filled-in example input
```

Fonts are Fraunces and Archivo, both SIL Open Font License 1.1.
