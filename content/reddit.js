(() => {
  const HEADER_TEXTS = [
    "recommended",
    "recommended communities",
    "communities you might like",
    "trending today",
    "popular communities",
    "more posts you may like",
    "more posts from",
  ];

  function applyUnblockClass(unblockedUntil) {
    const root = document.documentElement;
    if (!root) return;
    if (unblockedUntil && unblockedUntil > Date.now()) {
      root.classList.add("productivity-unblocked");
    } else {
      root.classList.remove("productivity-unblocked");
    }
  }

  function applyPageClass() {
    const root = document.documentElement;
    if (!root) return;
    const path = location.pathname.toLowerCase();
    const isListing = /^\/r\/[^\/]+(?:\/(?:hot|new|top|rising|controversial)\/?)?\/?$/.test(path);
    root.classList.toggle("productivity-page-listing", isListing);
  }

  function textMatchesHeader(node) {
    const t = (node.textContent || "").trim().toLowerCase();
    if (!t || t.length > 80) return false;
    return HEADER_TEXTS.some((s) => t === s || t.startsWith(s));
  }

  function tagSidebarAndSections(root) {
    const headers = root.querySelectorAll
      ? root.querySelectorAll(
          "h1, h2, h3, h4, faceplate-tracker, [slot='title']"
        )
      : [];
    for (const h of headers) {
      if (!textMatchesHeader(h)) continue;
      // Walk up to nearest section/aside/container and tag it.
      let n = h;
      let depth = 0;
      while (n && n !== document.body && depth < 8) {
        const tag = n.tagName;
        if (
          tag === "SECTION" ||
          tag === "ASIDE" ||
          tag === "FACEPLATE-TRACKER" ||
          n.getAttribute?.("data-testid")?.includes("recommend")
        ) {
          n.dataset.productivity = "hide";
          break;
        }
        n = n.parentElement;
        depth++;
      }
      // Fallback: tag a parent that looks like a card.
      if (n && !n.dataset?.productivity) {
        const parent = h.closest("div, section, aside");
        if (parent) parent.dataset.productivity = "hide";
      }
    }
  }

  function tagRecommendedPosts(root) {
    if (!root.querySelectorAll) return;
    // Posts with a "Promoted" or "Recommended" pill.
    const posts = root.querySelectorAll("shreddit-post, article");
    for (const p of posts) {
      if (p.dataset.productivity) continue;
      if (p.hasAttribute("recommendation-source")) {
        p.dataset.productivity = "hide";
        continue;
      }
      const pill = p.querySelector("[data-testid='post-flair']");
      if (pill && /recommended|promoted/i.test(pill.textContent || "")) {
        p.dataset.productivity = "hide";
      }
    }
  }

  function sweep(root = document) {
    try {
      tagSidebarAndSections(root);
      tagRecommendedPosts(root);
    } catch {}
  }

  function startObserver() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) sweep(n);
        }
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        applyPageClass();
        sweep();
      }
    }, 500);
  }

  function init() {
    applyPageClass();
    sweep();
    startObserver();
  }
  if (document.body) init();
  else
    document.addEventListener("DOMContentLoaded", init, { once: true });

  browser.runtime.sendMessage({ type: "getState" }).then((res) => {
    if (res) applyUnblockClass(res.unblockedUntil);
  });
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "stateChanged") applyUnblockClass(msg.unblockedUntil);
  });
})();
