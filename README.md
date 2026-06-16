# Procurement Co-Pilot · TransformationX

A configurable AI workbench for procurement buyers — 8 modules across the full sourcing lifecycle, powered by Claude.

## Deploy to Vercel in 5 steps

### Prerequisites
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free)
- An [Anthropic API key](https://console.anthropic.com) (add credits — ~$5 for extensive use)

---

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Procurement Co-Pilot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/procurement-copilot.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `procurement-copilot` repo
4. Framework will auto-detect as **Create React App** — leave all settings as default
5. Click **Deploy** — but STOP before the first deploy succeeds, you need the API key first

### Step 3 — Add your Anthropic API key

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `REACT_APP_ANTHROPIC_API_KEY`
   - **Value:** your API key from [console.anthropic.com](https://console.anthropic.com)
   - **Environments:** check Production, Preview, Development
3. Click **Save**

### Step 4 — Redeploy

Go to **Deployments** → click the three dots on the latest deploy → **Redeploy**

### Step 5 — Done

Your app is live at `https://procurement-copilot-[your-username].vercel.app`

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env.local
# Edit .env.local and paste your key

# 3. Run
npm start
# Opens at http://localhost:3000
```

---

## The 8 modules

| # | Module | What it does |
|---|--------|-------------|
| 01 | RFP Generator | PR in → complete RFP package in your template |
| 02 | Technical Evaluation | Score bids against criteria, audit-ready |
| 03 | Commercial Evaluation | Weighted scoring with local content / IKTVA |
| 04 | Award Brief | Board-ready recommendation pack |
| 05 | Policy Checker | Clause-level answers from your policy manual |
| 06 | Category Strategy | 7-lever analysis + live web market intelligence |
| 07 | Contract Drafting | Terms in → draft + risk flags, your clause library |
| 08 | Contract Management | Live register → alerts, performance, renewals |

## Configuration (makes every output yours)

- **📐 Templates** — paste your RFP, award, contract and category strategy templates once
- **📚 Knowledge Base** — paste your procurement policy, DOA matrix, local-content rules
- **⚙️ Setup** — customise your category taxonomy to match your spend cube

---

Built by TransformationX · TX Hackathon 2026
