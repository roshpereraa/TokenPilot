/* ==========================================================================
   Optional live AI: connect a Claude API key in Settings and agents answer
   chat and regenerate deliverables with the Claude Messages API.

   The key is stored only in this browser. For production, route calls
   through your own backend instead of calling the API from the browser.
   ========================================================================== */
(function (global) {
  "use strict";

  var KEY = "tp.ai";
  var MODELS = [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — fast" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 — deepest" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — lightest" }
  ];

  var AGENTS = {
    strategy: "the Strategy Agent. You synthesise every signal into clear, ranked decisions and daily priorities. You coordinate the other agents.",
    brand: "the Brand Agent. You own visual identity, narrative, positioning, messaging, voice and website copy.",
    growth: "the Growth Agent. You design community and acquisition strategies: funnels, quests, referral loops, partnerships, KPIs.",
    social: "the Social Agent. You plan and draft X content: posts, threads, replies, campaigns and viral moments. Write ready-to-post copy.",
    launch: "the Launch Agent. You build pre-launch, launch-day and post-launch playbooks, announcements and creator/outreach briefs.",
    intel: "the Market Intelligence Agent. You analyse competitors, trends, narratives, sentiment and emerging opportunities. Be explicit that you have no live data feed and reason from the brief and your general knowledge."
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ }
  }

  function connected() { return !!load().key; }

  function systemPrompt(agent, out) {
    var n = out.n;
    var brief = {
      name: n.name, ticker: "$" + n.ticker, category: n.C.label, concept: n.concept, oneLiner: n.oneLiner,
      website: n.website, x: n.handle ? "@" + n.handle : "", telegram: n.telegram, discord: n.discord,
      followers: n.followers, communitySize: n.community, audience: n.audience, roadmap: n.roadmap,
      goals: n.goals, brandVibe: n.vibe, launchDate: n.launchDate
    };
    return [
      "You are part of PilotPad, an AI launch team for a token launching on Robinhood Chain. You are " + (AGENTS[agent] || AGENTS.strategy),
      "Your teammates: Strategy, Brand, Growth, Social, Launch and Market Intelligence agents. All of you share the project memory below.",
      "",
      "PROJECT BRIEF:",
      JSON.stringify(brief, null, 2),
      "",
      "CURRENT POSITIONING: " + out.brand.positioning,
      "LAUNCH READINESS: " + out.analysis.overall + "/100 — " + out.analysis.verdict + ". Weakest dimension: " + out.analysis.weakest.label + ".",
      "",
      "Rules: Be specific to this project, practical and concise. Use short markdown (headings, bullets, bold). Never give financial advice, price predictions or promises of returns. Never suggest deceptive tactics, undisclosed paid promotion, fake engagement or market manipulation."
    ].join("\n");
  }

  function ask(agent, out, messages) {
    var cfg = load();
    if (!cfg.key) return Promise.reject(new Error("No API key connected."));
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: cfg.model || MODELS[0].id,
        max_tokens: 1600,
        system: systemPrompt(agent, out),
        messages: messages
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error && data.error.message) || ("Request failed (" + res.status + ")"));
        return (data.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("\n");
      });
    });
  }

  global.TPAI = { MODELS: MODELS, load: load, save: save, connected: connected, ask: ask };
})(window);
