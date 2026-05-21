(() => {
  const SUGGESTED_RE =
    /^\s*(suggested(\s+(for\s+you|posts?|reels?|accounts?))?|popular\s+reels?|recommended)\s*$/i;

  let sweepScheduled = false;
  let pendingScrollComp = new Map();

  function findScrollContainer(el) {
    let n = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      const style = getComputedStyle(n);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) {
        return n;
      }
      n = n.parentElement;
    }
    return window;
  }

  function markHide(el) {
    if (el.dataset.productivity) return;
    const rect = el.getBoundingClientRect();
    el.dataset.productivity = "hide";
    let delta = 0;
    if (rect.bottom <= 0) {
      delta = rect.height;
    } else if (rect.top < 0 && rect.bottom > 0) {
      delta = -rect.top;
    }
    if (delta > 0) {
      const container = findScrollContainer(el);
      pendingScrollComp.set(container, (pendingScrollComp.get(container) || 0) + delta);
    }
  }

  function flushScrollComp() {
    for (const [container, delta] of pendingScrollComp) {
      if (delta <= 0) continue;
      if (container === window) {
        window.scrollBy(0, -delta);
      } else {
        container.scrollTop -= delta;
      }
    }
    pendingScrollComp.clear();
  }

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
    const path = location.pathname;
    root.classList.toggle("productivity-page-explore", path.startsWith("/explore"));
    root.classList.toggle("productivity-page-reels", path.startsWith("/reels"));
  }

  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return t.trim();
  }

  function isSuggestedLabel(el) {
    const t = ownText(el);
    return t.length > 0 && t.length < 40 && SUGGESTED_RE.test(t);
  }

  function nearestAncestor(el, predicate, max = 12) {
    let n = el;
    let depth = 0;
    while (n && n !== document.body && depth < max) {
      if (predicate(n)) return n;
      n = n.parentElement;
      depth++;
    }
    return null;
  }

  function tagFeedArticlesByAria() {
    for (const a of document.querySelectorAll("article")) {
      if (a.dataset.productivity) continue;
      const aria = (a.getAttribute("aria-label") || "").toLowerCase();
      if (/suggest|recommend/.test(aria)) markHide(a);
    }
  }

  // An article with a "Follow" button is for an account the user doesn't
  // follow — i.e. a recommendation.
  function tagFeedArticlesByFollowButton() {
    for (const a of document.querySelectorAll("article")) {
      if (a.dataset.productivity) continue;
      for (const b of a.querySelectorAll("[role='button'], button")) {
        const t = ownText(b);
        if (t === "Follow" || t === "Follow back") {
          markHide(a);
          break;
        }
      }
    }
  }

  function tagFromLabels() {
    for (const el of document.querySelectorAll("span, div, h1, h2, h3, h4")) {
      if (!isSuggestedLabel(el)) continue;
      if (el.closest("[data-productivity='hide']")) continue;

      const article = nearestAncestor(el, (n) => n.tagName === "ARTICLE");
      if (article) {
        markHide(article);
        continue;
      }

      // Walk up until we find an ancestor that contains multiple profile
      // links (header + user list together).
      const block = nearestAncestor(
        el,
        (n) =>
          n.querySelectorAll("a[role='link'], a[href^='/']").length >= 3,
        10
      );
      if (block) markHide(block);
    }
  }

  function sweep() {
    try {
      tagFeedArticlesByAria();
      tagFeedArticlesByFollowButton();
      tagFromLabels();
    } catch {}
    flushScrollComp();
  }

  function startObserver() {
    const obs = new MutationObserver(() => {
      if (sweepScheduled) return;
      sweepScheduled = true;
      requestAnimationFrame(() => {
        sweepScheduled = false;
        sweep();
      });
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
  else document.addEventListener("DOMContentLoaded", init, { once: true });

  browser.runtime.sendMessage({ type: "getState" }).then((res) => {
    if (res) applyUnblockClass(res.unblockedUntil);
  });
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "stateChanged") applyUnblockClass(msg.unblockedUntil);
  });
})();
