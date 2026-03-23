# NoteFlow — AI SOAP Note Generator

A micro-SaaS for therapists. Generates professional SOAP notes from session summaries.
Powered by Google Gemini Flash (free tier). Deployed on Vercel (free tier).

**Cost to run: $0/month until you scale.**

---

## Project Structure

```
noteflow/
├── api/
│   └── generate.js      ← Vercel serverless function (backend)
├── public/
│   └── index.html       ← Frontend (what users see)
├── vercel.json          ← Vercel routing config
├── package.json
└── .env.example         ← Copy to .env.local for local dev
```

---

## Deploy in 10 Minutes

### Step 1 — Get your free Gemini API key
1. Go to https://aistudio.google.com/apikey
2. Sign in with Google
3. Click "Create API Key"
4. Copy the key (starts with `AIza...`)

### Step 2 — Deploy to Vercel
1. Go to https://vercel.com and sign up (free)
2. Click "Add New Project"
3. Choose "Import from Git" OR drag-and-drop this folder (use Vercel CLI)

**Easiest way (no Git needed):**
```bash
npm install -g vercel
cd noteflow
vercel
```
Follow the prompts. Choose defaults for everything.

### Step 3 — Add your API key to Vercel
1. In your Vercel dashboard, open your project
2. Go to Settings → Environment Variables
3. Add: `GEMINI_API_KEY` = your key from Step 1
4. Click Save, then go to Deployments → Redeploy

### Step 4 — Test it
Visit your Vercel URL. Enter a session summary. Click Generate. Done.

---

## Local Development

```bash
cp .env.example .env.local
# Add your GEMINI_API_KEY to .env.local

npm install -g vercel
vercel dev
# Visit http://localhost:3000
```

---

## Adding Stripe Payments (next step)

1. Create a Stripe account at https://stripe.com
2. Create a Product: $39/month subscription
3. Get your Payment Link URL
4. Replace the `alert('Coming soon...')` lines in index.html with:
   `window.location.href = 'https://buy.stripe.com/YOUR_LINK'`

For user accounts + gating: add Clerk.com (free tier, drop-in auth).

---

## Costs at Scale

| Users | Notes/month | Gemini cost | Vercel cost | Your revenue |
|-------|------------|-------------|-------------|--------------|
| 10    | ~300       | $0 (free)   | $0 (free)   | $390/mo      |
| 100   | ~3,000     | $0 (free)   | $0 (free)   | $3,900/mo    |
| 500+  | ~15,000    | ~$1–2       | $20/mo      | $19,500/mo   |

Gemini free tier: 1,500 requests/day = 45,000/month. You won't hit this for a long time.

---

## Getting Customers

1. Post in r/therapists: "I built a free SOAP note generator — roast it"
2. Join "Therapists in Private Practice" Facebook group (70k members)
3. Cold email 50 solo practitioners from Psychology Today directory
4. Target: 10 paying users in 60 days = $390/mo recurring
