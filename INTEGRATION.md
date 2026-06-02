# Analytics Integration Guide

Instructions for integrating an app with the **Apps Monitoring** analytics service.
Read this fully before writing code.

---

## 1. What you are integrating

A central service that records **events** (e.g. `first_open`, `video_exported`) and
**session duration** (how long a user stays in the app). Your app sends lightweight
HTTP requests; the service stores and aggregates them.

You do **not** need a database, SDK, or auth flow. Just HTTP.

---

## 2. What you need before starting

| Thing | Where it comes from |
|---|---|
| **Base URL** | The deployed service, e.g. `https://analytics.example.com` |
| **API key** | One per app. The admin creates it in the dashboard and gives it to you. Looks like `app_3f9c1a...` |

> The API key identifies which app the events belong to. Treat it as a public
> client token (it ships inside the app). It only grants event *write*, never read.

---

## 3. Two IDs you must generate in the app

These are created **client-side**. The service never assigns them.

### `uid` — anonymous user id (persistent)
- One per install/user. **Persist it forever** (localStorage, Keychain, SharedPreferences, file).
- Generate once with a UUID. Reuse on every launch.
- Lets the service count unique users (DAU/MAU) and build per-user funnels.
- Do **not** put emails/names here. Keep it anonymous.

### `sid` — session id (per app-launch)
- New UUID **each time the app starts** (or resumes from background after a long gap).
- Used to measure session duration via heartbeats.

```js
// Pseudocode for both
const uid = persisted("uid") ?? persist("uid", uuid()); // survives restarts
const sid = uuid();                                      // fresh per launch
```

---

## 4. Endpoints

Base path is `/api`. All responses are JSON `{ "ok": true, ... }`.

### 4.1 Single event — `GET /api/e`
Fire-and-forget. Easiest. Use for most events.

```
GET /api/e?key=APP_KEY&event=EVENT_NAME&uid=UID&session=SID&<extra props>
```

Example:
```
GET /api/e?key=app_xxx&event=video_exported&uid=u123&session=s456&format=mp4&duration=30
```

### 4.2 Single event — `POST /api/e`
Same as above with a JSON body. Use when props are rich/nested.

```http
POST /api/e
Authorization: Bearer APP_KEY
Content-Type: application/json

{ "event": "video_exported", "uid": "u123", "session": "s456", "format": "mp4", "duration": 30 }
```

### 4.3 Batch — `POST /api/batch`
Send many events in one request. Use to flush a queue (saves battery/network on mobile). Max **500** per call.

```http
POST /api/batch
Authorization: Bearer APP_KEY
Content-Type: application/json

{ "events": [
  { "event": "open",           "uid": "u123", "session": "s456" },
  { "event": "video_exported", "uid": "u123", "session": "s456", "format": "webm" }
] }
```
Response: `{ "ok": true, "accepted": 2, "rejected": 0 }`

### 4.4 Heartbeat — `GET /api/hb`
Measures session duration. Call **every 15–30 seconds while the app is open/foreground**.

```
GET /api/hb?key=APP_KEY&session=SID&uid=UID
```
Response: `{ "ok": true, "durationMs": 161000, "pings": 9 }`

> Session duration = time between first and last heartbeat for that `sid`.
> Stop sending heartbeats when the app goes to background; resume on foreground.

---

## 5. Field reference

| Field | Where | Required | Notes |
|---|---|---|---|
| `key` / `Authorization: Bearer` / `X-Api-Key` | query or header | **yes** | The app's API key |
| `event` | query/body | **yes** (events) | Event name. snake_case. |
| `uid` | query/body | recommended | Persistent anonymous user id |
| `session` (alias `sid`) | query/body | recommended | Per-launch session id |
| `ts` | query/body | optional | Client timestamp. Epoch ms, epoch s, or ISO string. Server stamps its own time regardless. |
| *anything else* | query/body | optional | Stored as event **props** (JSON). e.g. `format`, `duration`, `plan`. |

Reserved keys (not stored as props): `key, apikey, event, e, uid, session, sid, ts, clientTs`.

### Geo props (recommended)
Send these as props so the dashboard can break down by country/language/timezone:

| Prop | Format | Example | How to get it |
|---|---|---|---|
| `country` | ISO 3166-1 alpha-2 | `US` | IP geo, locale region, or store country |
| `lang` | BCP-47 / ISO 639 | `en` | device/browser language |
| `tz` | IANA timezone | `America/New_York` | `Intl.DateTimeFormat().resolvedOptions().timeZone` |

```
GET /api/e?key=APP_KEY&event=app_open&uid=UID&session=SID&country=US&tz=America%2FNew_York&lang=en
```
Send them on `app_open` (at least). The dashboard shows top countries, top languages,
a per-user flag, and the user's latest country/lang/tz. URL-encode `tz` (the `/`).

---

## 6. Auth — three ways to send the key

Pick one:
- Query: `?key=app_xxx`
- Header: `Authorization: Bearer app_xxx`
- Header: `X-Api-Key: app_xxx`

Invalid/missing key → `401 {"ok":false,"error":"invalid api key"}`.

---

## 7. Event naming rules

- `snake_case`, lowercase, verb_noun. Examples: `first_open`, `video_exported`, `purchase_completed`, `share_clicked`.
- Keep names stable — renaming splits your charts.
- Put variable detail in **props**, not the name. Good: `video_exported` + `{format:"mp4"}`. Bad: `video_exported_mp4`.

### Standard events to send
| Event | When |
|---|---|
| `first_open` | First ever launch on this install (gate behind a persisted flag). |
| `app_open` | Every launch/foreground. |
| `video_exported` | Each export (+ props: `format`, `duration`, `resolution`). |
| *(your domain events)* | Any meaningful action. |

---

## 8. Reference implementation (JS/TS — web or React Native)

```ts
const ANALYTICS = {
  base: "https://analytics.example.com/api",
  key: "app_xxx", // the API key the admin gave you
};

// --- ids ---
function uuid() { return crypto.randomUUID(); }
const uid = (localStorage.uid ??= uuid());     // persistent
const sid = uuid();                            // per launch

// --- track ---
export function track(event: string, props: Record<string, string | number> = {}) {
  const qs = new URLSearchParams({ key: ANALYTICS.key, event, uid, session: sid });
  for (const [k, v] of Object.entries(props)) qs.set(k, String(v));
  // keepalive lets it survive page unload
  fetch(`${ANALYTICS.base}/e?${qs}`, { keepalive: true }).catch(() => {});
}

// --- first open (once per install) ---
if (!localStorage.firstOpenSent) {
  track("first_open");
  localStorage.firstOpenSent = "1";
}
track("app_open");

// --- heartbeat (session time) ---
let hb: ReturnType<typeof setInterval>;
function startHeartbeat() {
  stopHeartbeat();
  const ping = () =>
    fetch(`${ANALYTICS.base}/hb?key=${ANALYTICS.key}&session=${sid}&uid=${uid}`,
      { keepalive: true }).catch(() => {});
  ping();
  hb = setInterval(ping, 20_000); // every 20s
}
function stopHeartbeat() { if (hb) clearInterval(hb); }

startHeartbeat();
document.addEventListener("visibilitychange", () =>
  document.hidden ? stopHeartbeat() : startHeartbeat());

// --- usage ---
track("video_exported", { format: "mp4", duration: 30 });
```

### Batching variant (mobile, save requests)
```ts
const queue: object[] = [];
export function trackQueued(event: string, props = {}) {
  queue.push({ event, uid, session: sid, ...props });
}
async function flush() {
  if (!queue.length) return;
  const events = queue.splice(0, 500);
  await fetch(`${ANALYTICS.base}/batch`, {
    method: "POST",
    headers: { authorization: `Bearer ${ANALYTICS.key}`, "content-type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => queue.unshift(...events)); // re-queue on failure
}
setInterval(flush, 30_000);
```

---

## 9. Other platforms

### Swift (iOS)
```swift
func track(_ event: String, props: [String: String] = [:]) {
    var c = URLComponents(string: "https://analytics.example.com/api/e")!
    c.queryItems = [.init(name: "key", value: apiKey),
                    .init(name: "event", value: event),
                    .init(name: "uid", value: uid),
                    .init(name: "session", value: sid)]
                 + props.map { URLQueryItem(name: $0.key, value: $0.value) }
    URLSession.shared.dataTask(with: c.url!).resume()
}
```

### Kotlin (Android)
```kotlin
fun track(event: String, props: Map<String, String> = emptyMap()) {
    val q = buildString {
        append("key=$apiKey&event=$event&uid=$uid&session=$sid")
        props.forEach { (k, v) -> append("&$k=$v") }
    }
    Thread { URL("https://analytics.example.com/api/e?$q").readText() }.start()
}
```

### curl (testing)
```bash
curl "https://analytics.example.com/api/e?key=app_xxx&event=first_open&uid=u1&session=s1"
```

---

## 10. Rules / best practices

1. **Never block the UI** on an analytics request. Fire-and-forget; ignore failures.
2. **Persist `uid`** across launches. A new `uid` every launch inflates user counts.
3. **New `sid` per launch.** Reusing one merges sessions and breaks duration.
4. **Send `first_open` once** — gate behind a persisted flag.
5. **Heartbeat only while foregrounded.** Stop on background, resume on foreground.
6. **No PII** in `uid`, event names, or props. Keep it anonymous.
7. Keep event names **stable and `snake_case`**; variable data goes in props.
8. Mobile: prefer **batching** + heartbeat over a request per event.

---

## 11. Quick checklist

- [ ] Base URL + API key wired in (key not hardcoded in a public repo if avoidable).
- [ ] Persistent `uid` generated and stored.
- [ ] Per-launch `sid` generated.
- [ ] `first_open` sent once; `app_open` each launch.
- [ ] Domain events instrumented with useful props.
- [ ] Heartbeat loop running (20s) and paused on background.
- [ ] Verified events appear in the dashboard.
