# TokenPilot

**The AI launch team for token founders on Robinhood Chain.**

A founder briefs their project (concept, name, website, X, community links, visual assets, roadmap, audience, goals). TokenPilot runs a deep analysis and spins up a dedicated AI operating system around the token: six agents (Strategy, Brand, Growth, Social, Launch, Market Intelligence) working in a live command center.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Marketing site: liquid-glass UI, star-field hero, scroll-driven dashboard tilt, word-by-word statement reveal, sticky lifecycle section |
| `app.html` | The product: 4-step brief → animated deep analysis → command center |
| `brand.html` | Brand guidelines: logo, palette, type, material, voice |

## The command center

- **Overview**: launch readiness score, 8-dimension analysis, daily priorities checklist, agent feed, gaps to close
- **Six agent workspaces**: positioning, pillars, taglines, website copy, funnels, campaigns, KPI targets, a 14-day X calendar, threads, reply playbook, a T-30 → T+30 launch playbook, announcement, creator brief, competitor map, trends, opportunities, decision memos and a risk radar. Every block has a copy button.
- **Ask your team**: chat that routes each question to the right agent
- **Launch simulator**: bull, base and bear community-growth projections (illustrative only)
- **Performance**: daily check-ins feed a learning loop that changes the recommendations
- **Settings**: connect Claude, edit the brief, export everything as JSON

### Live AI (optional)

Out of the box, everything runs on the built-in engine (`assets/js/engine.js`), which generates outputs from the brief. To get live reasoning in chat and one-click **Regenerate with Claude** on every agent, paste a Claude API key in **Settings**. The key is stored only in the browser and calls go directly to the Anthropic API. For production, proxy those calls through your own backend (see `assets/js/ai.js`).

## Brand

- **Mark:** "Polaris". It is a four-point guiding star with a token orbit that passes behind and in front of it (`assets/img/logo-mark.svg`, `logo.svg`).
- **Palette:** Void `#05050B` · Graphite `#12121E` · Indigo `#6E5BFF` · Ultraviolet `#8B7BFF` · Lavender `#C9C2FF` · Signal `#3BE8C8`
- **Type:** Inter Tight (display), Inter (body), JetBrains Mono (data)
- **Liquid glass:** `assets/js/liquid-glass.js` renders a per-element displacement map so glass panes refract what is behind them, as a lens would (Chromium). Other browsers get frosted glass.

## Run locally

Static site with no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Deploy anywhere static: Vercel, Netlify, GitHub Pages, Cloudflare Pages.

> Pricing and sample metrics on the marketing site are placeholders. TokenPilot is not affiliated with Robinhood. Nothing it produces is financial advice.
