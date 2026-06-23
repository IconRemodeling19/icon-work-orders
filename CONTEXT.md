# icon-work-orders — Context & Handoff

> **Purpose of this file:** Onboard a fresh session (human or AI) with zero prior knowledge of this app. Read top to bottom before making changes. Generated **June 19, 2026** directly from the live `main` branch — values below are read from real code, not memory. Update this file in the same commit whenever the app changes materially.

---

## 1. App identity

- **Name:** icon-work-orders (browser title: "Icon Remodeling Group - Work Orders")
- **Owner:** Rob Ross, Icon Remodeling Group Inc. — residential & commercial remodeling contractor, Pleasantville, NY (Westchester County).
- **Live URL:** https://icon-work-orders.vercel.app
- **GitHub:** org `IconRemodeling19`, repo `icon-work-orders` (public). `package.json` version `2.0.0`.
- **What it is:** The field-and-office work-order system in daily use by Icon's crews. Office/manager users create and dispatch work orders and sub (subcontractor) orders; field crews view their assignments, capture photos, and file daily logs; the app prints professional work-order documents and shares sub orders via public links. It is a **live legacy app** slated to be absorbed into the unified `icon-ops` platform later — maintain it, don't expand it.

## 2. Tech stack

- **Framework:** React 18, bootstrapped with **Create React App (`react-scripts`)** — **not Vite.** Build script: `GENERATE_SOURCEMAP=false react-scripts build`.
- **Database/backend:** Firebase **Realtime Database** + **Storage** + **Auth** (anonymous) + optional **Cloud Messaging (FCM)**. Firebase project **`icon-work-orders`** (Blaze plan; shared with `icon-command-center`).
  - `databaseURL`: `https://icon-work-orders-default-rtdb.firebaseio.com`
  - `storageBucket`: `icon-work-orders.firebasestorage.app`
- **Auth model:** `signInAnonymously` on load. RTDB/Storage rules require `auth != null`; the anon session satisfies that. **Exception:** `subOrders/{orderId}` is intentionally public-readable so subcontractor share links work for unauthenticated visitors — writes still require auth. Rules live in `/firebase.rules.json` and `/storage.rules` (pasted manually into the Firebase Console).
- **Serverless (Vercel `/api`):** `api/anthropic.js` proxies Anthropic so the API key stays server-side (`ANTHROPIC_API_KEY`); `api/send-email.js` handles email. `functions/index.js` is a Firebase Cloud Function for FCM push.
- **Maps:** Google Maps JS API for address autocomplete. **⚠ The Maps key is hardcoded in `src/App.js` (client source). Confirm it is HTTP-referrer-restricted in Google Cloud Console.**
- **Hosting/deploy:** Vercel, auto-deploy on push to `main` (~60s). `vercel.json` sets security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`) and long-cache for `/static/*`.
- **PWA:** `public/sw.js` service worker + `public/firebase-messaging-sw.js`.
- **Env vars:** `ANTHROPIC_API_KEY` (server only — set in Vercel, never client-exposed). No client `.env` is committed.

## 3. Complete color system

**There are two coexisting design eras in this app. Both are documented so the next editor doesn't mistake one for a bug.**

### 3A — Live theme (the current `t` object in `src/App.js`) — use this for new work
| Token | Hex | Use |
|---|---|---|
| `bg` | `#0a0a0f` | app background |
| `card` | `#1a1f2e` | cards/panels |
| `nav` | `#0a0a0f` | nav/chrome |
| `line` | `#3d4557` | borders |
| `text` | `#ffffff` | primary text |
| `muted` | `#a0aec0` | secondary text |
| `blue` | `#0077C8` | brand blue / primary action |
| `green` | `#4ADE80` | success/positive |
| `amber` | `#F59E0B` | warnings/budgets |
| `danger` / `red` | `#E8192C` | brand red / destructive |
| `purple` | `#A78BFA` | field-ops secondary accent |
| `cyan` | `#22D3EE` | highlights/codes |
| `inputBg` | `#0a0a0f` | input fields |
| `tag` | `#3d4557` | tag chips |

This matches the icon-ops dark-chrome palette — the apps are converging on it.

### 3B — Legacy "Copilot-inspired" palette (still live in attachment cards + comments)
`bg #0D0F1A` · `cards #131929` · `sidebar #161D2E` · `borders #1E2845` · `text #F0F4FF` · `muted #4A5A7A` / `#8B96B0` · `blue accent #4F7FFF`. Present in the dark variant of `AttachmentCard`. Migrate toward §3A when touching these surfaces.

### 3C — Light / print palette (customer-facing `WorkOrderDoc` + light `AttachmentCard`)
`bg #F2F4F6` · `border #D6D9DE` · `text #1F2329` · `muted #5F6670` · `button #0077C8` (white text) · notice block `bg #FFF8E6` / `border #E6C57A` / `text #7A5A00`. This is the printed-document surface — keep it light and clean.

### Buttons / type
- `primaryBtn`: background `#0077C8`, white text, glow `box-shadow: 0 0 20px rgba(0,119,200,.25)`.
- `ghostBtn`: transparent, `1.5px solid #3d4557` border, muted text.
- **Font (app):** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. **Font (printed `WorkOrderDoc`):** `'DM Sans', sans-serif`.

## 4. Layout architecture

- **Single-file monolith:** essentially all UI and logic live in `src/App.js` (~3,900 lines). A handful of feature modules are split out (see §6).
- **Chrome = dark, printed/exported doc = light.** The in-app experience is the dark theme (§3A); `WorkOrderDoc` and the light attachment cards render the white/print surface (§3C) for professional output and PDF printing.
- **Gate:** `AppGate` wraps the app and enforces PIN auth before rendering. Auth grant is cached in `localStorage` under key `wo-auth-granted` (`AUTH_KEY`).
- **Views:** manager/office view, crew view, and field-ops view, switched by role after PIN entry. Icons are inline SVG components (`PlusIcon`, `TrashIcon`, `CameraIcon`, etc.) defined near the top of `App.js`.

## 5. Current state

- **Live and in active daily use by field crews.** Stable.
- Built: PIN-protected manager/office views, crew view, field-ops view, job access codes, photo capture, work-order + sub-order creation, sub share links (public-read), archive + auto-expire, professional printable `WorkOrderDoc`, materials requests with AI-generated material lists, daily field log, FCM push notifications.
- In progress / converging: design migration toward the icon-ops palette (§3A is done in the core theme; §3B legacy colors remain in attachment surfaces).
- Planned: absorption into `icon-ops` (this app's features move into the unified platform over time).

## 6. Key files

| File | Controls |
|---|---|
| `src/App.js` (~3,900 ln) | The whole app: theme `t`, auth gate, all views, work orders, sub orders, field log, icons. |
| `src/MaterialsRequestForm.js` | Materials request capture form. |
| `src/MaterialsManagerPanel.js` | Office-side review/finalize of materials requests. |
| `src/AIControls.js` | AI settings/controls UI. |
| `src/aiClient.js` | Client wrapper that calls the `/api/anthropic` proxy. |
| `src/MiniCalendar.js` | Small calendar/date UI. |
| `src/fileUpload.js` | Storage upload helper. |
| `src/Skeletons.js` | Loading skeletons. |
| `src/ErrorBoundary.js` | Top-level error boundary. |
| `api/anthropic.js` | Server-side Anthropic proxy (keeps key off the client). |
| `api/send-email.js` | Email sending endpoint. |
| `functions/index.js` | Firebase Cloud Function for FCM push. |
| `firebase.rules.json` / `storage.rules` | DB + Storage security rules (applied manually in console). |
| `public/sw.js`, `public/firebase-messaging-sw.js` | Service worker + FCM worker. |

### Firebase RTDB data model (paths in use)
`jobs` · `jobs/{jobId}/paintColors` · `subOrders` (+ `subOrders/{id}`) · `materialsRequests` (+ per-request `aiGeneratedList`, `aiProcessedAt`, `status`, `finalizedAt`) · `fieldLogs` · `dailySummaries` · `activityLog` · `punchlist` · `recurringTemplates` · `jobDocs/{jobName}` · `memberPhones` · `notificationTokens` (+ `/{token}`) · `settings/ai` · `settings/aiMaterials` · `settings/crewPin` · `settings/managerPin`.

### Team / role constants (top of `App.js`)
- `ALL_MEMBERS`: Luis, Azael, Oswaldo, Andres, Vicente, Gabriel, Geovanny.
- `FIELD_LOG_CREW`: Gabriel, Azael, Luis, Oswaldo, Vicente.
- `FIELD_OPS_MEMBERS`: Joe, Bryan.
- `DEFAULT_CREWS`: Crew 1–5.
- `DEFAULT_PIN = "1234"` (manager) and `DEFAULT_CREW_PIN = "5678"` (crew) are **fallback defaults only** — the live PINs are stored in `settings/managerPin` and `settings/crewPin` in RTDB.

## 7. Design rules & patterns

1. **Output complete files.** When editing `App.js`, return the whole file unless a snippet is explicitly requested — it's a monolith and partial diffs are error-prone.
2. **Never break:** the anonymous-auth flow, the `AppGate`/PIN system, the `localStorage` `wo-auth-granted` key, FCM token handling, or any `settings/*` PIN paths.
3. **`subOrders/{orderId}` must stay public-readable** — sub share links depend on it. Don't tighten that rule without replacing the share mechanism.
4. **New UI uses the §3A live theme**, not the §3B legacy navy. Light/print surfaces use §3C.
5. **Backtick caution:** template literals in `App.js` are extensive. The GitHub web editor / Chrome extension can strip backticks — prefer full-file paste from Claude Code for template-literal-heavy edits.
6. **AI calls go through `/api/anthropic`** (via `aiClient.js`) — never put the Anthropic key in client code.
7. **Standing workflow:** edits via Claude Code CLI or GitHub web editor; `git pull --rebase` before pushing; never `--force`; one build-verified change per commit; Node even-numbered LTS. Push to `main` is run manually in a terminal.
8. **Open security item:** HTTP-referrer-restrict the Google Maps key in Google Cloud Console (see §2).
