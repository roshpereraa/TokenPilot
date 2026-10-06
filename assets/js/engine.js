/* ==========================================================================
   PilotPad engine — analysis + agent deliverables from a project brief.

   Runs fully in the browser. Every output is derived from the founder's
   brief, the project's category and launch timing. When a Claude API key is
   connected (see ai.js), agents can also regenerate any deliverable live.
   ========================================================================== */
(function (global) {
  "use strict";

  /* ---------- Seeded randomness so outputs are stable per project ---------- */
  function hash(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(n));
  }

  /* ---------- Category knowledge ---------- */
  var CATEGORIES = {
    ai: {
      label: "AI & Agents", noun: "AI-native token", timing: 88,
      benefit: ["puts real intelligence in holders' hands", "turns AI agents into a shared, ownable network", "makes on-chain AI useful for everyday traders"],
      diff: ["ships a working product before it ships a chart", "makes every agent action verifiable on-chain", "gives holders a direct say in what the agents build next"],
      comps: [
        { name: "Agent-launchpad tokens", threat: "High", win: "Out-ship them: show a live agent doing real work every week." },
        { name: "AI-character meme tokens", threat: "Medium", win: "Borrow their personality, beat them on substance and utility." },
        { name: "AI infra & compute tokens", threat: "Low", win: "Position as the consumer layer they power, not a rival." }
      ],
      trends: ["Autonomous agents with wallets", "Verifiable AI outputs", "AI x social trading", "Agent-to-agent economies"],
      words: ["signal", "copilot", "intelligence", "autonomy", "edge"],
      memes: ["the agent that never sleeps", "touch grass, the bot's got it", "AI summer"]
    },
    meme: {
      label: "Meme & Culture", noun: "culture coin", timing: 88,
      benefit: ["turns an inside joke into a movement", "gives its community a flag to rally behind", "makes holding feel like belonging"],
      diff: ["is built around a character people actually want to share", "rewards creators, not just early holders", "runs on daily rituals, not one-off hype"],
      comps: [
        { name: "Animal-mascot meme coins", threat: "High", win: "Own a sharper, more specific joke and a richer lore." },
        { name: "Celebrity & personality tokens", threat: "Medium", win: "Make the community the celebrity — UGC over endorsements." },
        { name: "Ecosystem mascot tokens", threat: "Medium", win: "Become an unofficial voice of Solana culture early." }
      ],
      trends: ["Lore-driven memes", "Creator-reward mechanics", "Chain-native mascots", "Community-run raids"],
      words: ["vibe", "lore", "frens", "ritual", "send"],
      memes: ["wagmi but make it lore", "the chart is a character", "community > cabal"]
    },
    defi: {
      label: "DeFi", noun: "DeFi protocol token", timing: 72,
      benefit: ["makes yield and liquidity simple for retail", "turns complex strategies into one tap", "gives users transparent, on-chain control of their money"],
      diff: ["designs for first-time DeFi users from day one", "publishes every risk parameter in plain language", "aligns token utility with real protocol usage"],
      comps: [
        { name: "Established DEX & lending tokens", threat: "High", win: "Win on UX and retail onboarding, not TVL." },
        { name: "New-chain incentive farms", threat: "Medium", win: "Show durable usage beyond emissions." },
        { name: "Aggregators", threat: "Low", win: "Integrate with them — become a default route." }
      ],
      trends: ["Retail-friendly DeFi UX", "Real yield over emissions", "Tokenized-asset collateral", "Intent-based execution"],
      words: ["yield", "liquidity", "simple", "transparent", "control"],
      memes: ["DeFi your mum could use", "APY with receipts", "no PhD required"]
    },
    rwa: {
      label: "Real-World Assets", noun: "tokenized-asset network", timing: 80,
      benefit: ["brings real-world markets on-chain for everyone", "makes traditional assets programmable and global", "bridges brokerage-grade assets with on-chain freedom"],
      diff: ["is built for Solana's fast, low-fee, retail-heavy markets", "treats compliance and transparency as features", "makes ownership composable across DeFi"],
      comps: [
        { name: "Tokenized-treasury protocols", threat: "High", win: "Focus on access and experience for retail, not institutions." },
        { name: "Tokenized-equity platforms", threat: "Medium", win: "Differentiate on composability and community." },
        { name: "RWA infra tokens", threat: "Low", win: "Partner and co-market rather than compete." }
      ],
      trends: ["Tokenized stocks & ETFs", "24/7 markets", "RWA as DeFi collateral", "Retail on-chain onboarding"],
      words: ["access", "ownership", "markets", "programmable", "global"],
      memes: ["Wall Street, but it never closes", "own the market, not just a ticker", "markets for the many"]
    },
    gaming: {
      label: "Gaming & Social", noun: "player-owned economy", timing: 68,
      benefit: ["makes playing and owning the same thing", "turns a community into a playable world", "rewards players for the fun they create"],
      diff: ["leads with gameplay, not tokenomics", "lets players shape the roadmap in-game", "keeps the economy sustainable by design"],
      comps: [
        { name: "Play-to-earn veterans", threat: "Medium", win: "Lead with fun-first messaging; distance from P2E baggage." },
        { name: "On-chain social apps", threat: "Medium", win: "Make your community feel like a game, not a feed." },
        { name: "Web2 games adding tokens", threat: "Low", win: "Out-community them; they can't match crypto-native culture." }
      ],
      trends: ["Fun-first web3 games", "Social quests", "Player-owned items", "Mini-apps & casual play"],
      words: ["play", "quest", "guild", "world", "level up"],
      memes: ["touch grass in-game", "gg, no re-entrancy", "the grind is the point"]
    },
    infra: {
      label: "Infrastructure", noun: "infrastructure token", timing: 64,
      benefit: ["makes building on Solana faster and safer", "powers the apps everyone else uses", "turns developer experience into a moat"],
      diff: ["is obsessed with developer experience", "proves reliability with public metrics", "aligns token value with network usage"],
      comps: [
        { name: "Multi-chain infra providers", threat: "High", win: "Be the best native option, with chain-specific features." },
        { name: "Ecosystem grants projects", threat: "Low", win: "Collaborate; become their default stack." },
        { name: "Centralized dev platforms", threat: "Medium", win: "Lean into decentralization and ownership." }
      ],
      trends: ["Chain abstraction", "Account abstraction UX", "Verifiable compute", "Developer incentives"],
      words: ["build", "ship", "reliable", "fast", "stack"],
      memes: ["infra is the new meta", "ship it, it's on-chain", "uptime is a feature"]
    }
  };

  var VIBES = {
    bold: { traits: ["Confident", "Direct", "High-conviction"], do: "Make clear claims and back them with proof.", dont: "Hedge every sentence or sound apologetic." },
    playful: { traits: ["Witty", "Warm", "Meme-literate"], do: "Use humour and inside jokes that reward regulars.", dont: "Punch down or let jokes replace substance." },
    premium: { traits: ["Refined", "Calm", "Precise"], do: "Say less, show more. Let design carry the message.", dont: "Use hype words, rocket emojis or ALL CAPS." },
    technical: { traits: ["Expert", "Transparent", "Builder-first"], do: "Share real numbers, diagrams and changelogs.", dont: "Hide behind jargon — explain it once, simply." },
    cultural: { traits: ["Native", "Inclusive", "Irreverent"], do: "Speak the community's language and amplify members.", dont: "Chase every trend that isn't on-brand." },
    mysterious: { traits: ["Intriguing", "Minimal", "Cinematic"], do: "Tease, reveal in chapters, reward the curious.", dont: "Be vague when people need real answers." }
  };

  var GOALS = {
    community: "Build a founding community",
    narrative: "Own a narrative",
    launch: "A strong launch day",
    holders: "Grow holders after launch",
    creators: "Creator & KOL reach",
    partners: "Ecosystem partnerships",
    brand: "Long-term brand"
  };

  /* ---------- Normalise a brief ---------- */
  function normalise(p) {
    var name = (p.name || "Untitled").trim();
    var ticker = (p.ticker || name.replace(/[^A-Za-z]/g, "").slice(0, 5)).toUpperCase().replace(/^\$/, "");
    var cat = CATEGORIES[p.category] ? p.category : "ai";
    var handle = (p.x || "").trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "").replace(/^@/, "").replace(/\/.*/, "");
    return {
      raw: p,
      name: name,
      ticker: ticker,
      cat: cat,
      C: CATEGORIES[cat],
      concept: (p.concept || "").trim(),
      oneLiner: (p.oneLiner || "").trim(),
      website: (p.website || "").trim(),
      handle: handle,
      telegram: (p.telegram || "").trim(),
      discord: (p.discord || "").trim(),
      followers: parseInt(p.followers, 10) || 0,
      community: parseInt(p.communitySize, 10) || 0,
      audience: (p.audience || "").trim(),
      roadmap: (p.roadmap || "").trim(),
      goals: (p.goals && p.goals.length ? p.goals : ["community", "launch"]),
      vibe: VIBES[p.vibe] ? p.vibe : "bold",
      colors: (p.colors && p.colors.length ? p.colors : null),
      logo: p.logo || null,
      launchDate: p.launchDate || null
    };
  }

  function daysToLaunch(n) {
    if (!n.launchDate) return null;
    var d = new Date(n.launchDate + "T12:00:00");
    var today = new Date(); today.setHours(12, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function audienceLabel(n) {
    if (n.audience) {
      var first = n.audience.split(/[.\n;]/)[0].trim();
      if (first.length > 4 && first.length < 90) return first.charAt(0).toLowerCase() + first.slice(1);
    }
    return { ai: "retail traders who want an edge without the noise", meme: "crypto-native culture lovers who want to belong to something", defi: "first-time DeFi users who want control without complexity", rwa: "everyday investors who want 24/7 access to real markets", gaming: "players who want to own what they help create", infra: "builders shipping on Solana" }[n.cat];
  }

  /* ---------- Analysis ---------- */
  function analyse(p) {
    var n = normalise(p);
    var r = rng(hash(n.name + n.cat));
    var len = function (s) { return (s || "").length; };

    var dims = [
      { key: "narrative", label: "Narrative", score: 38 + Math.min(len(n.concept), 280) / 280 * 34 + (n.oneLiner ? 14 : 0) + (n.roadmap ? 6 : 0) },
      { key: "brand", label: "Brand", score: 34 + (n.logo ? 22 : 0) + (n.raw.colors && n.raw.colors.length ? 14 : 0) + (n.raw.vibe ? 12 : 0) + (n.name.length <= 10 ? 8 : 2) },
      { key: "competitors", label: "Competitive edge", score: 46 + Math.min(len(n.concept), 300) / 300 * 22 + r() * 12 },
      { key: "market", label: "Market timing", score: n.C.timing - 6 + r() * 10 },
      { key: "social", label: "Social presence", score: 22 + (n.handle ? 28 : 0) + (n.website ? 16 : 0) + Math.min(n.followers, 20000) / 20000 * 30 },
      { key: "community", label: "Community", score: 20 + (n.telegram ? 18 : 0) + (n.discord ? 18 : 0) + Math.min(n.community, 10000) / 10000 * 36 },
      { key: "audience", label: "Audience psychology", score: 34 + Math.min(len(n.audience), 240) / 240 * 48 + (n.raw.vibe ? 6 : 0) },
      { key: "positioning", label: "Positioning", score: 0 }
    ];
    dims[7].score = (dims[0].score + dims[2].score + dims[6].score) / 3 + n.goals.length * 2;
    dims.forEach(function (d) { d.score = Math.round(clamp(d.score, 12, 97)); });

    var overall = Math.round(dims.reduce(function (a, d) { return a + d.score; }, 0) / dims.length);

    var gaps = [];
    if (!n.handle) gaps.push({ dim: "social", text: "Add your X account so Social and Intel can benchmark your presence." });
    if (!n.website) gaps.push({ dim: "social", text: "Add a website — Brand will draft copy for it either way." });
    if (!n.telegram && !n.discord) gaps.push({ dim: "community", text: "Connect a Telegram or Discord to unlock community planning." });
    if (len(n.audience) < 40) gaps.push({ dim: "audience", text: "Describe your target audience in more depth to sharpen messaging." });
    if (len(n.roadmap) < 40) gaps.push({ dim: "narrative", text: "Share a roadmap so the narrative can promise what you'll deliver." });
    if (!n.logo) gaps.push({ dim: "brand", text: "Upload a logo so Brand can build the visual system around it." });
    if (!n.launchDate) gaps.push({ dim: "launch", text: "Set a target launch date so Launch can schedule the playbook." });

    var strengths = dims.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 2);
    var weakest = dims.slice().sort(function (a, b) { return a.score - b.score; })[0];

    return {
      overall: overall,
      dims: dims,
      gaps: gaps,
      strengths: strengths,
      weakest: weakest,
      verdict: overall >= 75 ? "Launch-ready foundations" : overall >= 58 ? "Strong concept, gaps to close" : "Early — build before you launch"
    };
  }

  /* ---------- Brand Agent ---------- */
  function brand(n, r) {
    var aud = audienceLabel(n);
    var benefit = pick(r, n.C.benefit);
    var diff = pick(r, n.C.diff);
    var comp = n.C.comps[0].name.toLowerCase();
    var w = shuffle(r, n.C.words);
    var V = VIBES[n.vibe];

    var positioning = "For " + aud + ", " + n.name + " is the " + n.C.noun + " that " + benefit + ". Unlike " + comp + ", " + n.name + " " + diff + ".";

    var pillars = [
      { title: cap(w[0]) + " for everyone", text: "Why " + n.name + " exists: " + (n.oneLiner || n.concept.split(".")[0] || benefit) + ". Lead with the problem your audience feels every day." },
      { title: "Proof over promises", text: "Every claim is backed by something people can see — a demo, a metric, a shipped feature. " + (n.roadmap ? "Anchor it to the roadmap milestones." : "Publish a public roadmap to make this pillar credible.") },
      { title: "Owned by the " + pick(r, ["community", "believers", "early pilots", "builders"]), text: "Holders aren't an audience, they're the team. Every campaign gives them a role, a voice and a reason to bring someone in." }
    ];

    var tagA = cap(w[1]) + " that works for you.";
    var taglines = shuffle(r, [
      tagA,
      "The " + w[0] + " layer of Solana.",
      "Built different. Built on-chain.",
      cap(n.ticker.toLowerCase()) + " — " + pick(r, n.C.memes) + ".",
      "From " + w[2] + " to everyone.",
      "Your " + w[4] + ", on-chain.",
      "Less noise. More " + w[0] + "."
    ]).slice(0, 5);

    var palette = n.colors ? n.colors.slice(0, 3) : [];
    var defaults = { ai: ["#6E5BFF", "#3BE8C8", "#0B0B14"], meme: ["#FFB547", "#FF6B8B", "#141018"], defi: ["#3B82F6", "#22D3EE", "#08101C"], rwa: ["#2EE6A0", "#E8F0EA", "#06120D"], gaming: ["#FF4D8D", "#8B5CF6", "#100A18"], infra: ["#A3E635", "#E5E7EB", "#0A0F0A"] }[n.cat];
    while (palette.length < 3) palette.push(defaults[palette.length]);

    return {
      positioning: positioning,
      pillars: pillars,
      voice: { traits: V.traits, do: V.do, dont: V.dont },
      taglines: taglines,
      website: {
        headline: pick(r, [tagA, "The " + w[0] + " your " + (n.cat === "infra" ? "stack" : "portfolio") + " was missing.", n.name + ": " + benefit.replace(/^\w/, function (c) { return c.toUpperCase(); }) + "."]),
        subhead: (n.oneLiner || n.concept || benefit).replace(/[.!?]?$/, ".") + " Built natively on Solana.",
        features: [
          { t: cap(w[0]) + ", not noise", d: "Everything " + n.name + " does is designed to make " + aud.split(" who ")[0] + " better off — and to prove it." },
          { t: "Transparent by default", d: "Open roadmap, public metrics and a community that sees decisions before they ship." },
          { t: "Owned together", d: "$" + n.ticker + " holders shape what comes next, from campaigns to product priorities." }
        ],
        cta: pick(r, ["Join the founding community", "Get early access", "Become a Founding Pilot", "Join the movement"])
      },
      visual: {
        palette: palette,
        type: pick(r, ["Inter Tight + JetBrains Mono — precise, modern, product-led", "Space Grotesk + Inter — technical with personality", "Satoshi + IBM Plex Mono — clean, confident, crypto-native"]),
        logo: "A single-weight geometric mark that reads at 16px, works in one colour and animates simply. Pair it with a tight wordmark; avoid coins, rockets and generic chart arrows."
      }
    };
  }

  /* ---------- Growth Agent ---------- */
  function growth(n, r) {
    var base = Math.max(n.followers, 300);
    var cBase = Math.max(n.community, 150);
    var funnel = [
      { stage: "Discover", tactic: "Narrative threads, creator collabs and ecosystem raids across Solana", kpi: "Impressions / week" },
      { stage: "Join", tactic: (n.discord ? "Discord" : n.telegram ? "Telegram" : "A community hub") + " with a 60-second onboarding quest and clear roles", kpi: "Join rate from X" },
      { stage: "Engage", tactic: "Daily rituals: alpha drops, polls, " + pick(r, ["meme contests", "build-in-public updates", "AMA clips", "lore chapters"]), kpi: "Daily active members" },
      { stage: "Advocate", tactic: "Referral quests, creator rewards and an ambassador tier for top contributors", kpi: "Referred joins" }
    ];
    var campaigns = shuffle(r, [
      { name: "Founding Pilots", mech: "Invite 3 friends to unlock an early-supporter role and a name in the launch post.", dur: "14 days", target: "+" + fmt(cBase * 1.5) + " members" },
      { name: "Proof Week", mech: "Seven days, seven proofs — one demo, metric or milestone shipped publicly every day.", dur: "7 days", target: "+" + fmt(base * 0.4) + " followers" },
      { name: "Lore Drop", mech: "Serialized story chapters; the community votes on what happens next.", dur: "21 days", target: "3× engagement rate" },
      { name: "Creator Circle", mech: "Brief 10–20 aligned creators with an embargoed preview and an exclusive asset pack.", dur: "10 days", target: fmt(base * 8) + " reach" },
      { name: "Chain Raid", mech: "Coordinated, positive presence in Solana ecosystem conversations.", dur: "Ongoing", target: "Top-3 share of voice" }
    ]).slice(0, 3);
    var channels = [
      { ch: "X (Twitter)", pri: "Primary", why: "Where narratives form and spread — your launch stage." },
      { ch: n.discord ? "Discord" : "Telegram", pri: "Primary", why: "Where followers become a community." },
      { ch: "Creators & KOLs", pri: "High", why: "Borrowed trust; brief them on story, not price." },
      { ch: "Ecosystem partners", pri: "Medium", why: "Co-marketing with projects across Solana." },
      { ch: "Spaces & AMAs", pri: "Medium", why: "Founder voice builds conviction faster than posts." }
    ];
    var kpis = [
      { when: "Pre-launch (T-30)", followers: fmt(base * 1.4), community: fmt(cBase * 1.8), engagement: "4%+" },
      { when: "Launch day", followers: fmt(base * 2.6), community: fmt(cBase * 3.4), engagement: "6%+" },
      { when: "Post-launch (T+30)", followers: fmt(base * 4.2), community: fmt(cBase * 5.5), engagement: "5%+" }
    ];
    return { funnel: funnel, campaigns: campaigns, channels: channels, kpis: kpis };
  }

  /* ---------- Social Agent ---------- */
  function social(n, r) {
    var tag = "$" + n.ticker;
    var w = n.C.words;
    var formats = ["Thread", "Post", "Meme", "Poll", "Space", "Clip", "Post"];
    var offset = Math.floor(r() * 3);
    var hooks = [
      "Most people get " + w[0] + " wrong. Here's what " + n.name + " does differently 🧵",
      "We're building " + n.name + " in public. Today's update ↓",
      "What would you do with " + w[0] + " that never sleeps?",
      "Solana is about to get a lot more interesting.",
      "gm to everyone early to " + tag,
      "Poll: what should " + n.name + " ship first?",
      "The 3 problems " + n.name + " exists to solve:",
      "Behind the scenes: how we designed " + n.name,
      "Founder AMA tonight — bring your hardest questions.",
      "Chapter 1 of the " + n.name + " story.",
      "Proof, not promises: here's a live look at what we've built.",
      "If you've been here since day one, this one's for you.",
      "Why we chose Solana (and why it matters for you).",
      "One week to go. Here's everything you need to know."
    ];
    var calendar = [];
    for (var d = 0; d < 14; d++) {
      calendar.push({ day: d + 1, format: d === 4 || d === 11 ? "Space" : formats[(d + offset) % 7] === "Space" ? "Thread" : formats[(d + offset) % 7], hook: hooks[d], time: pick(r, ["14:00", "16:00", "18:00", "21:00"]) + " UTC" });
    }
    var posts = [
      n.name + " started with a simple question: why doesn't " + w[0] + " work for normal people?\n\nSo we're fixing it — on Solana, in public, with you.\n\nFollow along. " + tag,
      "Not financial advice. Just a better " + w[4] + ".\n\n" + (n.oneLiner || "Something new is coming to Solana.") + "\n\nEarly pilots get the best seat. 👇",
      "3 things you'll never see from " + n.name + ":\n\n× Empty promises\n× Hidden roadmaps\n× Ghosted communities\n\n3 things you will:\n✓ Weekly proof\n✓ Open decisions\n✓ Holders first"
    ];
    var thread = [
      "1/ " + n.name + " in one sentence: " + (n.oneLiner || n.concept.split(".")[0] || "the " + n.C.noun + " Solana has been waiting for") + ".\n\nHere's the full story 🧵",
      "2/ The problem: " + audienceLabel(n) + " are stuck with tools that weren't built for them.",
      "3/ Our answer: " + n.name + " " + pick(r, n.C.benefit) + ". No jargon. No gatekeeping.",
      "4/ What's next: " + (n.roadmap ? n.roadmap.split(/\n|\. /)[0] : "a public roadmap, shipped in chapters") + ".",
      "5/ Want in early? Join the community, grab a Founding Pilot role and help shape " + tag + ". Link below."
    ];
    var replies = [
      { trigger: "\"Wen launch?\"", reply: "Soon — and you'll hear it here first. Turn on notifications and join the community for the early-pilot window 🛫" },
      { trigger: "\"Is this a rug?\"", reply: "Fair question in this market. Everything we ship is public: roadmap, team updates and progress. Ask us anything in the AMA." },
      { trigger: "Comparisons to rivals", reply: "Respect to everyone building. We're focused on one thing: " + pick(r, n.C.diff) + "." },
      { trigger: "Praise & support", reply: "This is why we build. Welcome aboard, pilot — grab your role in the community 💜" },
      { trigger: "FUD / bad-faith", reply: "Don't engage directly. Reply once with facts and a link, then let the community and the work speak." }
    ];
    var viral = [
      { idea: "\"" + cap(pick(r, n.C.memes)) + "\" meme template", why: "Low-effort remixable format the community can own." },
      { idea: "Live build stream countdown", why: "Turns the final 24h into an event people tune into." },
      { idea: "Holder name wall", why: "Everyone who joins early appears in the launch visual — instant shares." },
      { idea: "Contrarian take thread", why: "A sharp, defensible opinion about " + n.C.trends[0].toLowerCase() + " invites quote-tweets." }
    ];
    return { calendar: calendar, posts: posts, thread: thread, replies: replies, viral: viral };
  }

  /* ---------- Launch Agent ---------- */
  function launch(n, r) {
    var tag = "$" + n.ticker;
    var phases = [
      { name: "Pre-launch", window: "T-30 → T-8", items: ["Lock narrative, positioning and visual identity", "Open community with onboarding quest and roles", "Start daily content cadence on X", "Shortlist and brief 10–20 aligned creators", "Publish roadmap and team/transparency page"] },
      { name: "Final week", window: "T-7 → T-1", items: ["Announce launch date with a cinematic teaser", "Run Founding Pilots referral sprint", "Host founder AMA / X Space", "Pre-write launch-day posts, replies and FAQs", "Dry-run launch-day runbook with the team"] },
      { name: "Launch day", window: "T-0", items: ["T-60m · Final teaser and pinned post", "T-0 · Official announcement + creator wave", "T+30m · Community celebration and holder shout-outs", "T+2h · Live AMA and reply sprint", "T+6h · Recap thread with early milestones"] },
      { name: "Post-launch", window: "T+1 → T+30", items: ["Daily recap and proof posts for 7 days", "Weekly community call and roadmap update", "Second creator wave with new angle", "Ecosystem partnership announcements", "Retro: double down on what worked"] }
    ];
    var announcement = "It's here. 🛫\n\n" + n.name + " (" + tag + ") is live on Solana.\n\n" + (n.oneLiner || pick(r, n.C.benefit).replace(/^\w/, function (c) { return c.toUpperCase(); }) + ".") + "\n\nThank you to every early pilot who believed before there was anything to see. This is day one.\n\n→ " + (n.website || "link in bio");
    var brief = {
      summary: n.name + " is a " + n.C.noun + " launching on Solana. " + (n.concept ? n.concept.split(".").slice(0, 2).join(".") + "." : ""),
      audience: audienceLabel(n),
      messages: ["What it is, in your own words", "Why it matters to your audience", "What's genuinely new about it"],
      avoid: ["Price predictions or financial promises", "Copy-pasted scripts", "Undisclosed paid promotion — always disclose"],
      assets: "Logo pack, 3 visuals, 30s demo clip, one-pager"
    };
    var risks = [
      { risk: "Launch-day technical issue", plan: "Pre-written holding statement; one source of truth pinned on X." },
      { risk: "Coordinated FUD", plan: "Respond once with facts, then let proof posts and community voices lead." },
      { risk: "Competitor launches same week", plan: "Don't react — reframe with a contrast thread and double down on your narrative." },
      { risk: "Low early engagement", plan: "Activate creator wave two and a community quest within 24h." }
    ];
    return { phases: phases, announcement: announcement, brief: brief, risks: risks };
  }

  /* ---------- Market Intelligence Agent ---------- */
  function intel(n, r) {
    var trends = n.C.trends.map(function (t, i) {
      return { name: t, momentum: Math.round(48 + r() * 46 - i * 6), fit: i === 0 ? "Strong" : pick(r, ["Strong", "Moderate", "Moderate", "Emerging"]) };
    }).sort(function (a, b) { return b.momentum - a.momentum; });
    var sentiment = n.handle
      ? { score: Math.round(55 + r() * 30), note: "Modeled from your brief and category baseline for @" + n.handle + ". Connect live X data for real-time sentiment." }
      : { score: null, note: "Add your X account to enable sentiment tracking." };
    var opportunities = shuffle(r, [
      "Be first to own \"" + trends[0].name + "\" on Solana before larger players arrive.",
      "Ecosystem attention is high — partner with 2–3 complementary projects for a joint campaign.",
      "Competitors under-invest in education; a weekly explainer series is an open lane.",
      "Creators in the " + n.C.label + " niche are looking for fresh stories — offer an exclusive preview.",
      "Your audience responds to proof; a public metrics page differentiates immediately."
    ]).slice(0, 3);
    var watch = [
      "Mentions of " + n.C.label + " tokens on Solana",
      "Launch announcements from the competitor archetypes above",
      "Sentiment shifts around " + trends[0].name.toLowerCase(),
      "Creator conversations mentioning $" + n.ticker
    ];
    return { comps: n.C.comps, trends: trends, sentiment: sentiment, opportunities: opportunities, watch: watch };
  }

  /* ---------- Strategy Agent ---------- */
  function strategy(n, r, a) {
    var days = daysToLaunch(n);
    var phase = days === null ? "Pre-launch (no date set)" : days > 7 ? "Pre-launch" : days > 0 ? "Final week" : days === 0 ? "Launch day" : "Post-launch";
    var pri = [];
    if (a.gaps.length) pri.push(a.gaps[0].text.replace(/ so .*$/, "").replace(/\.$/, ""));
    if (days === null) pri.push("Set a target launch date");
    if (days !== null && days > 7) pri.push("Approve narrative pillars and taglines from Brand");
    if (days !== null && days > 7) pri.push("Publish today's thread from the Social calendar");
    if (days !== null && days <= 7 && days > 0) pri.push("Run the launch-day dry run");
    if (days !== null && days <= 7 && days > 0) pri.push("Send embargoed creator briefs");
    if (days === 0) pri.push("Execute the launch-day runbook");
    if (days !== null && days < 0) pri.push("Post today's proof update and recap");
    pri.push("Brief 3 creators from the Creator Circle shortlist");
    pri.push("Reply to the top 20 conversations about " + n.C.label);
    pri = pri.slice(0, 5);

    var decisions = [
      { q: "Which narrative do we lead with?", rec: "Lead with \"" + brand(n, rng(hash(n.name + "b"))).taglines[0] + "\" — it scores highest on clarity for " + audienceLabel(n).split(" who ")[0] + "." },
      { q: "Where should the community live?", rec: n.discord ? "Discord for depth, with an X-first funnel. Keep Telegram for announcements only." : n.telegram ? "Telegram now for speed; add Discord when you need roles and quests." : "Start with Telegram for speed; add Discord before launch for quests and roles." },
      { q: "How much to spend on creators?", rec: "Fewer, aligned creators over many paid shills. Start with 10 and measure referred joins." }
    ];
    var risks = [
      { r: a.weakest.label + " is your weakest dimension (" + a.weakest.score + ")", m: "Prioritise it this week; it caps everything else." },
      { r: "Narrative drift across channels", m: "Every agent pulls from one positioning statement — approve it first." },
      { r: "Launching into a crowded week", m: "Intel will flag competing launches; keep a 48h flex window." }
    ];
    return { phase: phase, days: days, priorities: pri, decisions: decisions, risks: risks, focus: a.weakest.label };
  }

  /* ---------- Build everything ---------- */
  function build(p, salt) {
    var n = normalise(p);
    var s = salt || 0;
    var a = analyse(p);
    return {
      n: n,
      analysis: a,
      brand: brand(n, rng(hash(n.name + "brand" + s))),
      growth: growth(n, rng(hash(n.name + "growth" + s))),
      social: social(n, rng(hash(n.name + "social" + s))),
      launch: launch(n, rng(hash(n.name + "launch" + s))),
      intel: intel(n, rng(hash(n.name + "intel" + s))),
      strategy: strategy(n, rng(hash(n.name + "strategy" + s)), a)
    };
  }

  /* ---------- Simulator (illustrative model) ---------- */
  function simulate(o) {
    // o: { community, cadence (posts/wk), creators, narrative (0-100), days }
    var days = o.days || 30;
    var scenarios = { bear: 0.55, base: 1, bull: 1.65 };
    var out = {};
    Object.keys(scenarios).forEach(function (k) {
      var m = scenarios[k];
      var pts = [];
      var c = o.community;
      for (var d = 0; d <= days; d++) {
        var organic = c * (0.004 + o.cadence * 0.0011) * (o.narrative / 70);
        var creator = o.creators * 38 * (o.narrative / 80) * (d === 0 ? 4 : d < 4 ? 1.6 : 0.6);
        var decay = d > 10 ? 0.985 : 1;
        c = c * decay + (organic + creator) * m;
        pts.push(Math.round(c));
      }
      out[k] = pts;
    });
    var base = out.base;
    return {
      series: out,
      reach: Math.round(base[days] * (6 + o.cadence * 0.9)),
      community: base[days],
      peakDay: 0
    };
  }

  /* ---------- Learning loop: adapt to logged performance ---------- */
  function adapt(log, n) {
    if (!log || log.length < 2) return [];
    var a = log[log.length - 2], b = log[log.length - 1];
    var recs = [];
    var dF = b.followers - a.followers;
    var dE = (b.engagement || 0) - (a.engagement || 0);
    var dC = b.members - a.members;
    if (dE < -0.3) recs.push({ agent: "social", text: "Engagement dipped " + Math.abs(dE).toFixed(1) + "pts. Shift the mix toward educational threads and polls; cut low-effort posts for 3 days." });
    if (dE >= 0.5) recs.push({ agent: "social", text: "Engagement up " + dE.toFixed(1) + "pts — double down on the format that drove it and repost the top performer as a clip." });
    if (dF > 0 && dC <= 0) recs.push({ agent: "growth", text: "Followers are growing but community isn't. Add a clear CTA and onboarding quest to every post this week." });
    if (dC > 0 && dC > dF * 0.3) recs.push({ agent: "growth", text: "Strong follower→member conversion. Launch a referral quest now to compound it." });
    if (dF <= 0) recs.push({ agent: "strategy", text: "Follower growth stalled. Activate a creator wave and schedule a founder Space within 48h." });
    if (!recs.length) recs.push({ agent: "strategy", text: "Steady progress. Hold the plan; Intel will flag if the market shifts." });
    return recs;
  }

  global.TPEngine = {
    CATEGORIES: CATEGORIES, VIBES: VIBES, GOALS: GOALS,
    analyse: analyse, build: build, simulate: simulate, adapt: adapt,
    normalise: normalise, daysToLaunch: daysToLaunch, audienceLabel: audienceLabel, fmt: fmt
  };
})(window);
