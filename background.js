const MAX_UNBLOCK_MS = 15 * 60 * 1000;
const STORAGE_KEY = "unblockedUntil";

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
