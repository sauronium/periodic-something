# Periodic Table Lab

An interactive periodic table drawn like a lab notebook. Explore all 118 elements with 3D and hand-drawn
atom models, orbital clouds, crystal lattices, spectra, isotopes and isobars, periodic trends, chemistry
tools and quizzes. Every element also has its own page with a written profile.

**Live site:** https://periodic-something.rinsedsoap.xyz

Built with [Astro](https://astro.build). Pages are pre-rendered static HTML; a single server route handles the
contact form.

---

## Features

### The table
- All 118 elements as paper index-card tiles, sized so the whole table and its controls fit on one screen.
- **Colour by** category, state at temperature, block, electronegativity, atomic mass, radius, density,
  melting/boiling point, discovery year, ionization energy, electron affinity, crust and body abundance, or main hazard.
- **Hover card** for every tile: mass, state, melting/boiling points, electronegativity, density, configuration.
- **Temperature slider** (0–6000 K): tiles flash when elements melt, boil, freeze or condense, live
  solid/liquid/gas counts, and markers for the selected element's melting and boiling points.
- Search by name, symbol or atomic number; arrow keys move around the grid.

### Element simulation
- **Four views:** Bohr atom, orbital clouds, crystal lattice (which melts and boils with the temperature), and
  light (emission spectrum and flame-test colour).
- **Two drawing styles:** a shaded 3D model (three.js) or pencil **scribbles** on graph paper with wobbly lines
  and handwritten annotations.
- **Full-screen mode**, auto-rotate, drag to turn, scroll to zoom, and save the drawing as a PNG.
- **Ions:** add or remove electrons, or pick a common ion; the configuration and Lewis dots update.
- **Isotopes and decay:** change the neutron count, see whether the nucleus is stable, and watch it decay
  (α, β⁻, β⁺) into a new element.
- **Build-up animation** that adds electrons one at a time in filling order.

### Element details
- Key properties, electron configuration, orbital box diagram, shells, Lewis dots and hazard badges.
- A phase strip showing the solid, liquid and gas ranges (click or drag it to set the temperature).
- Isotope and isobar chips, and a personal sticky note for each element.

### Isotopes and isobars
- A **chart of nuclides** (protons against neutrons), in close-up or for the whole table, with the selected
  element's isotopes along a row and its isobars along a diagonal.
- Separate **isotope** and **isobar** tables with stability and decay products.
- **Side-by-side 3D comparison** of any two nuclei, highlighting extra neutrons, protons and electrons, with a
  table of every difference and an explanation of how they're related (isotopes, isobars, decay chain).

### Notebook pages
- **Trends:** hand-drawn charts of a property against atomic number.
- **States:** solid/liquid/gas ranges of every element; drag to change the temperature.
- **Molar mass:** formula parser with brackets and hydrates, grams ⇄ moles ⇄ particles, and empirical/molecular
  formulas from percentages.
- **Equations:** balances chemical equations, with atom-count and mass checks.
- **Compare:** up to four pinned elements side by side, with their atoms drawn to scale.
- **Quiz:** find-the-element questions, a 60-second timed mode and spaced-repetition flashcards.
- **Timeline:** watch the table fill in from ancient times to 2010.
- **Print:** flashcards, a blank-table worksheet or the current element's page.

### And also
- Paper and chalkboard themes, a pencil/highlighter tool for drawing on the table and simulation, optional
  pencil sounds, tooltips on every control, shareable links that restore the exact view, and a preloader that
  spins a random element's 3D atom.
- **118 element pages** (`/elements/iron/` …) with data-driven articles, facts, related elements and the lab
  opened on that element, plus an `/elements/` index.
- **Contact form** that emails submissions and sends the visitor a confirmation, with spam protection.
- Responsive down to phone width, keyboard accessible, and respects reduced-motion settings.

---

## Tech stack

| Library | Used for |
| --- | --- |
| [Astro](https://astro.build) 7 | Site framework, static page generation, the `/api/contact/` server route |
| [@astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/) | Node server adapter for the contact route |
| [three.js](https://threejs.org) r128 | 3D atoms, orbitals, lattices, nuclide comparison and the preloader |
| [Nodemailer](https://nodemailer.com) | Sending contact form email |
| [Fontsource](https://fontsource.org) | Self-hosted Caveat, Patrick Hand and Courier Prime fonts |
| [sharp](https://sharp.pixelplumbing.com) | Build-time share images and PNG icons |

The hand-drawn renderer, charts, chemistry tools and quiz are written in plain JavaScript on the Canvas 2D,
WebGL and Web Audio APIs. Element data (properties, isotopes, spectra, abundances) lives in `src/lib/elements.js`.

---

## Getting started

Requires Node.js 20.6 or newer.

```bash
npm install
npm run dev          # http://localhost:4321
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Generate share images and icons, then build into `dist/` |
| `npm run preview` | Serve the built site locally (contact form included) |
| `npm start` | Run the built site in production, loading `.env` |
| `npm run og` | Regenerate only the share images and icons |
| `npm run setup:wasi` | Windows with Smart App Control only, see below |

### Environment variables

The contact form reads its settings from a `.env` file (see `.env.example`). These are server-only and are
never bundled into the site. `SITE_URL` optionally overrides the site's domain, e.g. for a staging build.

### Windows: "An Application Control policy has blocked this file"

With Smart App Control turned on, two of Astro's native modules can be blocked. Run `npm run setup:wasi` once
after `npm install` to add their WebAssembly builds, which Astro then uses automatically.

---

## Deploying

Every page is pre-rendered; only the contact form runs on the server, so the site needs a Node host:

```bash
npm ci && npm run build
npm start            # serves dist/ on PORT (default 4321)
```

Run it behind a reverse proxy or on a platform such as Render, Railway or a VPS, and point the domain at it.
For Vercel or Netlify, swap `@astrojs/node` in `astro.config.mjs` for that platform's adapter and set the
environment variables in its dashboard.

---

## Project structure

```
src/
  config/site.js            site name, domain, email, GitHub link, data date
  lib/elements.js           element data and chemistry helpers (build time and browser)
  lib/content.js            writes each element page's article from the data
  scripts/lab.js            the lab: 3D + hand-drawn renderer and the notebook interface
  scripts/nuccompare.js     side-by-side nucleus comparison
  scripts/preloader.js      random element preloader
  scripts/contact.js        contact popup
  scripts/tooltips.js       tooltips
  components/               header, table, controls, panel, notebook, logo, footer ...
  layouts/BaseLayout.astro  page shell
  pages/
    index.astro             the lab
    elements/index.astro    index of all 118 elements
    elements/[slug].astro   one page per element
    api/contact.js          contact form email (server route)
    404.astro
scripts/generate-og.mjs     share images and icons
Periodic Table Lab.html     original single-file version (works offline, not part of the build)
```

---

## Notes

- Ionization energies, electron affinities, abundances and hazards are rounded reference values; properties of
  elements 104–118 are predictions. Isotope stability and decay modes use a simplified model.
- Notes, drawings, flashcard progress and settings are saved in the visitor's browser.
- Questions or corrections: talk@rinsedsoap.xyz
