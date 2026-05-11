const MAX_UNBLOCK_MS = 15 * 60 * 1000;
const STORAGE_KEY = "unblockedUntil";
const TIME_STATS_KEY = "timeStats";
const MAX_TICK_MS = 60 * 1000;

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getTimeStats() {
  const obj = await browser.storage.local.get(TIME_STATS_KEY);
  const today = localDateKey();
  const stored = obj[TIME_STATS_KEY];
  if (!stored || stored.date !== today) {
    return { date: today, domains: {} };
  }
  return stored;
}

async function addTime(domain, ms) {
  if (!domain || typeof domain !== "string") return;
  if (!(ms > 0)) return;
  const capped = Math.min(ms, MAX_TICK_MS);
  const stats = await getTimeStats();
  stats.domains[domain] = (stats.domains[domain] || 0) + capped;
  await browser.storage.local.set({ [TIME_STATS_KEY]: stats });
}

async function getUnblockedUntil() {
  const obj = await browser.storage.local.get(STORAGE_KEY);
  return obj[STORAGE_KEY] || 0;
}

async function setUnblockedUntil(ts) {
  await browser.storage.local.set({ [STORAGE_KEY]: ts });
  broadcast(ts);
}

function broadcast(unblockedUntil) {
  browser.tabs
    .query({ url: ["*://*.instagram.com/*", "*://*.reddit.com/*"] })
    .then((tabs) => {
      for (const t of tabs) {
        browser.tabs
          .sendMessage(t.id, { type: "stateChanged", unblockedUntil })
          .catch(() => {});
      }
    });
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "getState") {
    const unblockedUntil = await getUnblockedUntil();
    return { unblockedUntil, maxMs: MAX_UNBLOCK_MS };
  }
  if (msg?.type === "grantUnblock") {
    const minutes = Math.max(1, Math.min(15, Number(msg.minutes) || 0));
    const until = Date.now() + minutes * 60 * 1000;
    await setUnblockedUntil(until);
    return { unblockedUntil: until };
  }
  if (msg?.type === "lock") {
    await setUnblockedUntil(0);
    return { unblockedUntil: 0 };
  }
  if (msg?.type === "activityTick") {
    await addTime(msg.domain, Number(msg.ms));
    return { ok: true };
  }
  if (msg?.type === "getTimeStats") {
    return await getTimeStats();
  }
});

browser.alarms?.onAlarm?.addListener?.(() => {});

async function scheduleExpiryCheck() {
  const until = await getUnblockedUntil();
  if (until && until <= Date.now()) {
    await setUnblockedUntil(0);
  }
}
setInterval(scheduleExpiryCheck, 15 * 1000);
scheduleExpiryCheck();
