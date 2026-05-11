# productivity-firefox

Firefox extension that hides the recommendation surfaces on Instagram and Reddit while leaving the rest of each site usable. Unblocking requires solving 10 two-digit additions and lasts up to 15 minutes. Also tracks **active time per site** for today, so you can see where the day went.

## Why

Instagram and Reddit's recommendation surfaces are the highest-friction part of those sites to ignore — they're tuned to pull you out of whatever you came to do. This extension hides them and gates re-enable behind a small arithmetic task, so you don't unblock on autopilot.

The time tracker is a separate, complementary lever: it counts only active time (input within the last 30 seconds) and resets at local midnight, so the per-site numbers in the popup reflect how much of *today* you've actually spent on each site.

## What it hides

**Instagram**
- "Suggested for you" / "Suggested posts" articles in the home feed
- Right-rail "Suggested for you" user list
- `/explore/` and `/reels/` main content
- "Suggested for you" carousel on profile pages

**Reddit**
- Recommendation post cards (`shreddit-post[recommendation-source]`, `[data-testid="post-recommendation"]`)
- "Recommended Communities", "Trending today", "Communities you might like" sidebar widgets
- "More posts you may like" section under comment threads
- `/r/popular` and `/r/all` post feeds

## What it leaves alone

Subscribed subreddits, profiles, DMs, comments, notifications, and search-with-query are untouched.

## What it tracks

Per-site active time for the current local day, shown in the popup:

- "Active" means an input event (`mousemove`, `mousedown`, `keydown`, `scroll`, `wheel`, `touchstart`) arrived within the last 30 seconds. After 30 seconds of no input, counting pauses until the next input.
- Counting also pauses when the tab is hidden (`document.visibilityState !== "visible"`).
- Totals reset at local midnight.
- The popup lists the top 6 sites for today, sorted by time descending, and refreshes every 5 seconds while open.

## How it works

### Hiding recommendations

Content scripts run at `document_start` on Instagram and Reddit and tag recommendation elements via stable signals (`aria-label`, `data-testid`, attributes like `recommendation-source`) with a `data-productivity="hide"` attribute. A small CSS rule hides anything tagged this way **unless** `<html>` has the class `productivity-unblocked`. A `MutationObserver` re-runs the tag pass as the page mutates, so SPA navigation and lazy-loaded content stay covered.

Unblock state lives in `browser.storage.local` and is owned by [background.js](background.js), which:

- Caps any single unblock window at 15 minutes.
- Broadcasts state changes to all open Instagram/Reddit tabs, so toggling from the popup is reflected live — no reload needed.
- Polls every 15 seconds to expire stale unblock timestamps.

### Tracking active time

A third content script, [content/time-tracker.js](content/time-tracker.js), runs at `document_idle` on every site (`<all_urls>`, top frame only). It maintains a `lastInputAt` timestamp, ticks once per second when the tab is visible and the last input was within 30 seconds, and flushes accumulated milliseconds to the background every 5 seconds (plus on `pagehide` and on `visibilitychange` to hidden). The background stores per-domain totals under `timeStats` in `browser.storage.local` along with a `YYYY-MM-DD` date stamp; the first access after local midnight returns an empty object, so today's slate starts fresh.

Domain key is `location.hostname` with a leading `www.` stripped. Other subdomains are kept distinct (`old.reddit.com` and `www.reddit.com` show as separate rows).

## Install

### From source (temporary, for development)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this directory.
4. The extension stays loaded until you restart Firefox.

### From addons.mozilla.org

Not yet published. See **Packaging & publishing to AMO** below for the build flow.

## Use

- Click the toolbar icon to see status (Blocked / Unblocked).
- Click **Unblock…** → solve 10 two-digit additions → choose a duration (1, 5, 10, or 15 min).
- Click **Lock now** to end an unblock window early.
- The **Time spent today** section at the bottom of the popup shows per-site active time, refreshed every 5 seconds while open.

State changes apply live to all open Instagram/Reddit tabs — no reload needed.

## Packaging & publishing to AMO

The standard tool is Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```sh
npm install -g web-ext

# Run from the project root.
web-ext lint                 # validate manifest + content scripts
web-ext run                  # launch a temporary Firefox profile with the extension loaded
web-ext build                # produces web-ext-artifacts/*.zip
```

Submit the resulting `.zip` either:

- **Manually**, at <https://addons.mozilla.org/developers/addon/submit/>, or
- **Via the API**, using `web-ext sign --api-key=... --api-secret=...`. Get keys at <https://addons.mozilla.org/developers/addon/api/key/>. This produces a signed `.xpi` you can self-host.

**Before your first AMO submission**, change the extension ID in [manifest.json](manifest.json):

```json
"browser_specific_settings": {
  "gecko": {
    "id": "productivity@local"
  }
}
```

`productivity@local` is fine for local development, but AMO requires a stable, owned identifier — typically an email-style ID at a domain you control (e.g. `productivity@yourdomain.example`).

## Selector fragility

Both Instagram and Reddit obfuscate their CSS class names and reorganize the DOM frequently. The content scripts prefer stable signals (`aria-label`, `data-testid`, attribute names like `recommendation-source`) and fall back to text-content matching inside a `MutationObserver`. Expect occasional breakage when either site redesigns. The selectors live in [content/instagram.js](content/instagram.js), [content/instagram.css](content/instagram.css), [content/reddit.js](content/reddit.js), [content/reddit.css](content/reddit.css).

## Privacy

- No network requests. No telemetry. No analytics. Everything stays in `browser.storage.local`.
- Two API permissions are requested:
  - `storage` — remember the unblock timestamp and today's per-site time totals.
  - `tabs` — send state-change messages to open Instagram/Reddit tabs when the unblock state flips.
- Host permissions are `<all_urls>`. This is required because the time tracker is a content script that runs on every site to listen for input events. The tracker only records *which domain* you were active on and *how long*; it does not read page content, URLs (beyond hostname), forms, cookies, or any other site data. Totals reset at local midnight and never leave the browser.

## Development layout

```
.
├── manifest.json          MV3 manifest, host permissions, content-script registration
├── background.js          Unblock-state store, 15-min cap, tab broadcaster, time-stats store
├── content/
│   ├── instagram.js       Tag suggested articles / right-rail user list / explore / reels
│   ├── instagram.css      Hide-rules gated on the productivity-unblocked class
│   ├── reddit.js          Tag recommended posts, sidebar widgets, listing feeds
│   ├── reddit.css         Static attribute-based hide rules + listing-page rules
│   └── time-tracker.js    All-urls content script: per-site active-time detection
├── popup/
│   ├── popup.html         Markup for locked / unblocked / gauntlet / duration views + time-stats
│   ├── popup.js           View switching, gauntlet logic, runtime messaging, time-stats fetch
│   └── popup.css          Dark popup styling
├── icons/
│   └── icon.svg           Placeholder toolbar/action icon (replace as you like)
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## License

MIT — see [LICENSE](LICENSE).
