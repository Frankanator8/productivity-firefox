(() => {
  const IDLE_MS = 30 * 1000;
  const TICK_MS = 1000;
  const FLUSH_MS = 5 * 1000;

  const host = (location.hostname || "").toLowerCase();
  if (!host) return;
  const domain = host.startsWith("www.") ? host.slice(4) : host;

  let lastInputAt = Date.now();
  let accumulatedMs = 0;

  function isVisible() {
    return document.visibilityState === "visible";
  }

  function onActivity() {
    lastInputAt = Date.now();
  }

  for (const evt of ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"]) {
    document.addEventListener(evt, onActivity, { passive: true, capture: true });
  }

  setInterval(() => {
    if (isVisible() && Date.now() - lastInputAt < IDLE_MS) {
      accumulatedMs += TICK_MS;
    }
  }, TICK_MS);

  function flush() {
    if (accumulatedMs <= 0) return;
    const ms = accumulatedMs;
    accumulatedMs = 0;
    browser.runtime
      .sendMessage({ type: "activityTick", domain, ms })
      .catch(() => {});
  }

  setInterval(flush, FLUSH_MS);
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (!isVisible()) flush();
  });
})();
