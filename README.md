# ☕ بُن البلد — Coffee Shop Landing Page + AI Chatbot

A free, secure, Arabic (RTL) landing page for a local coffee shop with an AI barista chatbot.

## Architecture

```
┌─────────────────────┐      POST {message, history, context}      ┌─────────────────────┐
│   GitHub Pages       │ ──────────────────────────────────────────▶ │  Cloudflare Worker   │
│   (static, public)   │                                             │  (free, secret-safe) │
│  index.html          │ ◀────────────── {reply} ─────────────────── │  worker.js           │
│  app.js              │                                             │  env.OPENROUTER_API_KEY
│  content.json (CMS)  │                                             └──────────┬──────────┘
└─────────────────────┘                                                         │
                                                                                 ▼
                                                                      OpenRouter free models
```

Why this design is safe in a **public** repo: the OpenRouter API key is never in the
code. It lives only in Cloudflare's encrypted environment variables. The browser talks
to the Worker; the Worker talks to OpenRouter.

## Files

| File           | Purpose                                                                 |
|----------------|-------------------------------------------------------------------------|
| `index.html`   | The page (Arabic, RTL, Tailwind via CDN)                                 |
| `app.js`       | Loads `content.json`, renders the page, runs the chatbot widget          |
| `content.json` | Mini-CMS: all texts, contact info, and the menu — edit this, no code     |
| `worker.js`    | Cloudflare Worker proxy that hides the API key (deployed separately)     |

---

## Step 1 — Get a free OpenRouter API key

1. Go to <https://openrouter.ai> and sign up (free).
2. Open **Keys** → **Create Key**, name it (e.g. `coffeeshop`), and copy the key
   (starts with `sk-or-...`). You will paste it into Cloudflare in Step 2 — never into the code.

> Free models are used (`:free` suffix), so no credit card is needed.
> Note: the list of free models changes over time. If the chatbot returns errors later,
> check <https://openrouter.ai/models?max_price=0> and update the `MODELS` array in `worker.js`.

## Step 2 — Deploy the Worker on Cloudflare (free)

1. Sign up at <https://dash.cloudflare.com> (free plan is enough).
2. In the sidebar choose **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, e.g. `coffeeshop-proxy`, then click **Deploy** (it deploys a "Hello World" first).
4. Click **Edit code**, delete everything, paste the full contents of `worker.js`, then **Deploy**.
5. Add the secret API key:
   - Go to the Worker's page → **Settings** → **Variables and Secrets**.
   - Click **Add**, choose type **Secret**.
   - Name: `OPENROUTER_API_KEY` (exactly this), Value: your `sk-or-...` key.
   - Save (and re-deploy if prompted). The key is now encrypted and hidden.
6. Lock the proxy to your site: in the pasted code, edit `ALLOWED_ORIGINS` at the top
   and replace `https://YOUR-USERNAME.github.io` with your real GitHub Pages origin
   (origin = scheme + domain only, **no path**, e.g. `https://ahmed123.github.io`).
   Remove the `localhost` entries once you go live. Click **Deploy** again.
7. Copy the Worker URL shown on its page, e.g.
   `https://coffeeshop-proxy.your-account.workers.dev`

## Step 3 — Point the frontend at your Worker

Open `app.js` and replace the placeholder on the first constant:

```js
const PROXY_URL = 'https://coffeeshop-proxy.your-account.workers.dev';
```

## Step 4 — Publish on GitHub Pages (free)

1. Create a **public** repository on GitHub (e.g. `coffeeshop`).
2. Push the project files (`index.html`, `app.js`, `content.json`, `worker.js`, `README.md`):

   ```bash
   git init
   git add .
   git commit -m "Coffee shop landing page"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/coffeeshop.git
   git push -u origin main
   ```

3. In the repo: **Settings** → **Pages** → under **Build and deployment**,
   set **Source** = `Deploy from a branch`, **Branch** = `main`, folder = `/ (root)`, **Save**.
4. After ~1–2 minutes the site is live at:
   `https://YOUR-USERNAME.github.io/coffeeshop/`

> If the site lives at `https://YOUR-USERNAME.github.io/coffeeshop/`, the **origin** for
> `ALLOWED_ORIGINS` in the Worker is still just `https://YOUR-USERNAME.github.io`
> (the repo name is a path, not part of the origin).

## Step 5 — Test

1. Open the live site. The hero, menu, and contact info should appear (from `content.json`).
2. Click the 💬 button, ask something like «بكام اللاتيه؟» — the bot should answer
   with the real price from the menu and nothing invented.

### Local testing (optional)

`fetch('content.json')` does not work over `file://`. Run a tiny local server instead:

```bash
# from the project folder (Python 3)
python -m http.server 8000
```

Then open <http://localhost:8000>. `http://localhost:8000` is already in the
Worker's `ALLOWED_ORIGINS` for this purpose.

---

## Editing content (no code needed)

Everything the client may want to change lives in `content.json`:

- `shopName`, `heroTitle`, `heroSubtitle` — texts at the top of the page
- `contactPhone`, `contactAddress` — contact section (the phone also powers the
  "اطلب دلوقتي" button via `tel:`)
- `menu` — array of items: `category`, `name`, `description`, `price`.
  Items with the same `category` are grouped together automatically.

Commit + push the edited `content.json` and GitHub Pages redeploys automatically.
The chatbot picks up the new data immediately too — the page sends the live JSON
with every chat message, so menu edits never require touching the Worker.

> `app.js` also contains an embedded `FALLBACK_CONTENT` copy of the same data,
> used only if `content.json` fails to load (broken JSON, or previewing via
> `file://`). When you change `content.json`, mirror the change there too so
> the fallback never shows stale info.

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Chatbot says it isn't connected | `PROXY_URL` in `app.js` is still the placeholder |
| Browser console shows a CORS error | Your Pages origin is missing from `ALLOWED_ORIGINS` in `worker.js` (origin only, no path, no trailing slash) |
| Worker returns 500 "missing OPENROUTER_API_KEY" | The secret wasn't added, or was named differently — it must be exactly `OPENROUTER_API_KEY` |
| Worker returns 502 with a model error | The free model IDs rotated — update `MODELS` in `worker.js` from <https://openrouter.ai/models?max_price=0> |
| Site shows old/default content after editing `content.json` | The edit broke the JSON (a missing comma is enough) so the page fell back to the copy embedded in `app.js` — the browser console shows the parse error. Validate the JSON and push again. Note: opening `index.html` from disk (`file://`) always uses the embedded fallback, since browsers block `fetch` there |

## Security notes

- The API key exists **only** as a Cloudflare encrypted secret — safe for a public repo.
- The Worker rejects any origin not in `ALLOWED_ORIGINS` (including preflight).
- User messages are length-capped, history is sanitized, and the `context` payload is
  size-capped server-side, so nobody can pump huge prompts through your API key.
- The system prompt restricts the bot to the shop's JSON data and tells it to refuse
  prompt-injection attempts — but treat any LLM output as untrusted text (the frontend
  renders it with `textContent`, never as HTML).
