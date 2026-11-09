# SynthID Remover

**Live:** https://abdul97233.github.io/synthid-remover/

A **free, privacy-first** web app for analyzing AI-generation indicators in media and
cleaning embedded metadata — images (JPG, PNG, WebP), audio (MP3, WAV) and video (MP4, MOV).
Everything runs **100% locally in your browser**.

> **Your files never leave your device. All processing happens locally in your browser.
> No uploads, no tracking, no storage.**

---

## ⚠️ Honest scope (read this first)

An AI-watermark tool that misleads its users is worse than no tool, so this app is
explicit about what is technically possible:

| Capability | Status |
| --- | --- |
| Detect **metadata evidence** of AI generation (C2PA / Content Credentials, IPTC `digitalSourceType`, generator tags like “Made with Google AI”, Stable Diffusion prompts, etc.) | ✅ Works locally, real evidence from the actual file bytes |
| Report detection status honestly (`indicators found` / `no indicators found` / `cannot be determined — why`) | ✅ Always |
| Show a confidence score | ✅ Only when a method provides one — metadata inspection does not, so none is invented |
| Remove/strip metadata (EXIF, XMP, IPTC, ID3, container boxes) losslessly | ✅ Works locally |
| **Detect pixel-level / audio-level SynthID** | ❌ Impossible locally — invisible watermarks never appear in metadata; only [Google's official SynthID Detector](https://deepmind.google/models/synthid/#synthid-detector) can verify them |
| **Remove SynthID watermarks** | ❌ **No verified method exists.** This app will never claim a watermark was removed because metadata was cleaned |

The app is *named* SynthID Remover, but every screen reinforces the boundary:
metadata cleaning ≠ watermark removal. For an authoritative watermark verdict, use
Google's official detector or [Content Credentials Verify](https://verify.contentauthenticity.org/)
— these open in a new tab; this app never sends your file anywhere.

---

## Privacy by architecture

- **No backend at all** — a static site; there is no upload endpoint, no database, no storage.
- **No accounts / login**, no payment, no ads, no analytics, no cookies (only a local
  theme preference in `localStorage`).
- Files are read from disk into browser memory, processed **in a Web Worker**, and released
  when finished (object URLs revoked, buffers dropped).
- Works fully offline after first load.
- 100% free, MIT licensed, open source.

## Features

- **Simple mode (default)** — drop files, metadata is removed automatically, then download one file or everything as a single ZIP. Shows what was removed (AI tags, Content Credentials, location, device info). One-tap **Share** on phones.
- **Advanced mode** — the full inspection workspace below, plus optional auto-clean, output naming (`photo-cleaned.jpg` or `photo.jpg`) and a JSON report export. Your mode choice is remembered.
- **Labs (experimental) — direct access at `#/labs`** (also in the header, the phone bar and the footer): drop a JPEG/PNG, it is cleaned automatically, then add tags. The same tool can be switched on inside Advanced mode. **Add metadata** — write your own EXIF tags (make, model, lens, software, author, copyright, description, date taken) into cleaned JPEG/PNG copies losslessly, with device presets (Ray-Ban Meta glasses, iPhone, Pixel, Galaxy, Canon, Sony, Fujifilm, DJI, GoPro). These are user-chosen labels, not provenance: no C2PA is added and pixels/watermarks are untouched.
- **Works offline / installable** — a service worker caches the site itself (never your files).
- **SynthID analysis** — chunked, case-insensitive byte scan for documented markers
  (C2PA/JUMBF, Content Credentials, IPTC digital source types, generator tags) plus
  decoded EXIF/XMP/IPTC inspection for images. Three-state honest verdicts, evidence
  snippets shown, no fabricated confidence.
- **Metadata cleaner** — *lossless* removal by rebuilding the container:
  - **JPEG**: drops APP1–APP15 (EXIF/XMP/C2PA-JUMBF/IPTC) & COM segments; keeps ICC for color accuracy.
  - **PNG**: rebuilds chunks, dropping `tEXt/zTXt/iTXt/eXIf` and trailing bytes; keeps IDAT, APNG and HDR chunks.
  - **WebP**: strips `EXIF`/`XMP` RIFF chunks (top-level *and* nested inside `ANMF` frames).
  - **MP3**: removes ID3v2/v1 and APEv2 tags; the MPEG audio bytes are copied untouched.
  - **WAV**: drops `LIST/INFO`, `bext`, `iXML`, `ID3`, junk; sample data copied bit-for-bit.
  - **MP4/MOV**: rebuilds `moov`/`trak` dropping `udta`/`meta`/`uuid` boxes, removes
    top-level metadata/padding boxes, rewires `stco`/`co64` chunk offsets when needed,
    and **validates the rebuilt file by fully re-parsing it** (refuses unsafe output,
    rejects fragmented `moof` MP4s).
  - Optional **canvas re-encode** fallback for images (clearly labeled lossy; bakes EXIF orientation).
- **Media information** — size, format, dimensions, duration, MIME and a full byte-structure
  report (segments/chunks/boxes/frames).
- **Preview & compare** — original vs. cleaned side-by-side with size delta and the
  itemized removal list. Original files are never modified.
- **Batch processing** — queue many files; each is processed independently in the worker
  with its own progress and results.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion (UI only) · Lucide icons ·
exifr (EXIF/XMP/IPTC parsing, lazy-loaded) · Canvas API · Web Workers.

**Deliberately not bundled:** ffmpeg.wasm (~30 MB, needs special CORS headers for
SharedArrayBuffer) — the hand-written container parsers above strip metadata losslessly
at a fraction of the size and with strict output validation. There is also no third-party
cloud API of any kind; the only outbound links are to *official third-party verification
tools* (Google SynthID Detector, Content Credentials Verify), which are plain `<a>` links
the user may choose to open (nothing is ever sent by this app).

## Getting started

```bash
npm install
npm run dev      # local dev server → http://localhost:5173
npm run build    # type-checks (tsc) then builds static files into dist/
npm run preview  # serves the production build locally
```

Node.js ≥ 18. No environment variables, no API keys, nothing to configure.

## Deployment (free hosting)

### GitHub Pages (automatic)

1. Push this folder as its **own** GitHub repository (default branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site to
   `https://<user>.github.io/<repo>/`.

The workflow sets `SITE_URL` (used for the canonical URL, Open Graph image, sitemap and
`robots.txt`) and `VITE_REPO_URL` (the GitHub link in the UI) automatically. Using a custom
domain? Add a repository variable `SITE_URL` (e.g. `https://example.com/`) and a `public/CNAME` file.

Asset paths are relative and routing is hash-based, so it works from any sub-path with no
404 tricks; `.nojekyll` is emitted automatically.

### Other hosts

- **Cloudflare Pages:** build `npm run build`, output `dist`, env `SITE_URL=https://your.domain/`.
- **Vercel / Netlify:** same build command and output; set `SITE_URL` as an environment variable.

### SEO and security built in

Descriptive title/description, Open Graph + Twitter card (1200×630 `og-image.png`), JSON-LD
`WebApplication` data, canonical URL, `sitemap.xml`, `robots.txt`, web app manifest and icons,
a no-JavaScript fallback, and a strict Content-Security-Policy whose `connect-src 'self'`
means the browser itself blocks any attempt to upload a file elsewhere.

## Project structure

```
src/
├── components/
│   ├── landing/     # Hero, Features, HowItWorks, Privacy, SynthID-honesty, FAQ
│   ├── layout/      # Header (nav + theme toggle), Footer
│   ├── ui/          # Button, Card, Badge, Tabs, Spinner, icons
│   └── workspace/   # Dropzone, FileCard, FileDetail, Analysis/Metadata/Clean/Compare panels
├── hooks/           # useMediaProcessor (pipeline), useTheme, useObjectUrl
├── lib/             # constants, format helpers, router, metadata, probe, validation
├── parsers/         # jpeg / png / webp / mp3 / wav / mp4 container parsers + byte scanner
├── pages/           # HomePage (landing), WorkspacePage (tool)
├── types/           # Shared types + worker protocol
├── workers/         # processor.worker.ts — all heavy byte work off the UI thread
└── styles/          # Tailwind theme (zinc + indigo/violet), Inter variable font (self-hosted)
```

## Formatter/parser details (what “cleaning” means per format)

- **JFIF/ICC is preserved** on JPEG and ICC profiles on PNG/WebP so colors don't shift;
  everything else that stores data about the file (not in it) is removed.
- EXIF **Orientation** is preserved in the original and *reported* — lossless stripping
  removes the tag, so the app warns and offers a canvas re-encode that bakes orientation in.
- The MP4 cleaner refuses files it cannot prove safe: fragmented (`moof`) MP4s and any
  output that fails full re-parse validation are never produced.
- If a container cannot be parsed, the app degrades gracefully: analysis still scans raw
  bytes, and you get a clear error instead of a fake success.

## License

MIT — see [LICENSE](LICENSE). All dependencies are MIT/ISC/OFL-compatible
(permissive, distribution-friendly).

*Not affiliated with Google. SynthID is a technology of Google DeepMind.*
