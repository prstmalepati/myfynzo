# myfynzo v2 — Setup Guide

> **Your workflow:** Edit files locally → Upload to GitHub (web) → Auto-deploys. Firebase and Cloudflare managed via web consoles.

---

## What Changed in This Version

### New Pages
- **Account** (`/account`) — Profile, address, subscription plans (Free/Premium), billing & payments
- **Security & Privacy** (`/security`) — Security status, data inventory, GDPR rights, third-party audit
- **Admin** (`/admin`) — User management, tax rule seeding, market price monitor, system config

### Updated Pages
- **Dashboard** — Trust strip footer linking to Security page
- **Login** — Trust signals below form (AES-256, EU data, GDPR badges)
- **Settings** — Stripped to preferences only (currency, language, notifications). Personal info moved to Account
- **Investments** — Import button + 18-broker CSV import wizard
- **Sidebar** — Clickable Account section, Security nav item, conditional Admin tab

### New Backend
- **Firestore rules v2** — Admin whitelist, field validation, anti-escalation
- **Cloud Functions** (8 functions) — Market data, exchange rates, admin ops, user lifecycle
- **Broker import service** — CSV parser for Scalable Capital, Trade Republic, IBKR, Coinbase, etc.

---

## Step 1: Fix the .env File (Local)

Your current `.env` has markdown backticks in it which breaks everything.

**Delete your current `.env` file** and create a new one with this exact content (no backticks, no extra characters):

```
VITE_FIREBASE_API_KEY=AIzaSyBIXXj5B2bvmwIwbFOQIAgkxJGpwqCDwrY
VITE_FIREBASE_AUTH_DOMAIN=myfynzo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=myfynzo
VITE_FIREBASE_STORAGE_BUCKET=myfynzo.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=722972966832
VITE_FIREBASE_APP_ID=1:722972966832:web:f31a649d8d75fee2f32075
VITE_FIREBASE_MEASUREMENT_ID=G-HXZKYF3EEX
```

**Then edit `src/firebase/config.ts`** — replace the hardcoded values with environment variables:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

**Important:** Make sure `.env` is listed in your `.gitignore` so it never gets uploaded to GitHub.

---

## Step 2: Upload Files to GitHub (Web)

Go to your GitHub repo → upload all files from the zip, replacing existing ones.

**New files** (these don't exist yet — create/upload them):

| File | Location |
|------|----------|
| `firebase.json` | Root |
| `firestore.rules` | Root |
| `firestore.indexes.json` | Root |
| `.env.example` | Root |
| `SECURITY.md` | Root |
| `functions/package.json` | `functions/` |
| `functions/tsconfig.json` | `functions/` |
| `functions/src/index.ts` | `functions/src/` |
| `src/pages/Account.tsx` | `src/pages/` |
| `src/pages/SecurityPrivacy.tsx` | `src/pages/` |
| `src/pages/Admin.tsx` | `src/pages/` |
| `src/components/BrokerImportModal.tsx` | `src/components/` |
| `src/components/TrustCenter.tsx` | `src/components/` |
| `src/services/brokerImportService.ts` | `src/services/` |
| `src/services/cloudFunctions.ts` | `src/services/` |
| `src/hooks/useAdmin.ts` | `src/hooks/` |

**Updated files** (replace existing with new version):

| File |
|------|
| `src/App.tsx` |
| `src/pages/Dashboard.tsx` |
| `src/pages/Login.tsx` |
| `src/pages/Settings.tsx` |
| `src/pages/Investments.tsx` |
| `src/components/SidebarLayout.tsx` |
| `src/services/marketDataService.ts` |

If your GitHub Pages auto-deploys from `main`, the frontend goes live after upload.

**Do NOT upload:** `.env` (keep local only), `node_modules/`, `dist/`

---

## Step 3: Firebase Console — Deploy Security Rules

1. Go to **https://console.firebase.google.com** → select **myfynzo**
2. Left sidebar → **Firestore Database** → click **Rules** tab
3. **Delete all existing rules** in the editor
4. **Paste the entire contents** of `firestore.rules` from the zip
5. Click **Publish**

What the new rules enforce:
- Users can only read/write their own data at `users/{uid}`
- `market_prices` writes are validated (correct field types, symbol max 20 chars)
- `system/*` and `tax_rules/*` writable only by admin UIDs
- Users cannot write `role` or `isAdmin` to their own profile
- Everything requires authentication — no anonymous access

---

## Step 4: Firebase Console — Create Admin Whitelist

1. Go to **Firestore Database** → click **+ Start collection** (or find existing `system` collection)
2. **Collection ID:** `system`
3. **Document ID:** `admin_whitelist`
4. Click **Add field** and create:

| Field name | Type | Value |
|-----------|------|-------|
| `uids` | array | Click + to add your Firebase Auth UID as a string |
| `emails` | array | Click + to add your email as a string |

**To find your UID:**
- Firebase Console → left sidebar → **Authentication** → **Users** tab
- Find your email row → copy the value in the **User UID** column

After saving this, log into myfynzo — the **Admin** tab appears in your sidebar.

---

## Step 5: In Your App — Seed Tax Rules

1. Open myfynzo and log in with your admin account
2. Click **Admin** in the sidebar
3. Go to the **Tax Rules** tab
4. Click **"Seed All to Firestore"**

This writes 4 documents to Firestore:
- `tax_rules/DE/2025/data` — German tax brackets, solidarity surcharge, church tax
- `tax_rules/US/2025/data` — US federal brackets, Social Security, Medicare
- `tax_rules/CA/2025/data` — Canadian federal + provincial, CPP, EI
- `tax_rules/IN/2025/data` — Indian Old/New regime, Section 87A rebate

---

## Step 6: Firebase Console — Set Market Data API Key

**Option A: Via your app**
1. Admin → **System Config** tab → Enter your Twelve Data API key → Save

**Option B: Via Firebase Console directly**
1. Firestore Database → `system` collection
2. Click **+ Add document** → Document ID: `api_keys`
3. Add field: `twelveData` (type: string) → paste your API key

**Get your free API key:**
1. Go to https://twelvedata.com
2. Sign up (free)
3. Dashboard → copy your API key
4. Free tier gives you 800 requests/day — enough for personal use

---

## Step 7: Cloudflare Pages — Hosting Setup

If you're using Cloudflare Pages for hosting (recommended over GitHub Pages):

### 7a. Create Cloudflare Pages project

1. Go to **https://dash.cloudflare.com**
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** tab
3. Click **Connect to Git** → select your myfynzo GitHub repo
4. Build settings:

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |

5. Click **Environment variables** → add each one:

| Variable name | Value |
|--------------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBIXXj5B2bvmwIwbFOQIAgkxJGpwqCDwrY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `myfynzo.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `myfynzo` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `myfynzo.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `722972966832` |
| `VITE_FIREBASE_APP_ID` | `1:722972966832:web:f31a649d8d75fee2f32075` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-HXZKYF3EEX` |

6. Click **Save and Deploy**

### 7b. Point myfynzo.com to Cloudflare Pages

1. Cloudflare dashboard → select **myfynzo.com** domain → **DNS** → **Records**
2. Add or update:

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| CNAME | `@` | `myfynzo.pages.dev` | Proxied (orange cloud) |
| CNAME | `www` | `myfynzo.pages.dev` | Proxied (orange cloud) |

3. Go back to **Workers & Pages** → your project → **Custom domains** → **Set up a custom domain**
4. Enter `myfynzo.com` → Follow prompts
5. SSL is automatic — no action needed

### 7c. SPA routing fix

For single-page app routing (so `/dashboard`, `/account` etc. don't return 404):

1. In your project root, the file `public/_redirects` should contain:
```
/* /index.html 200
```
This file is already included in the zip.

---

## Cloud Functions (Optional)

Cloud Functions need the Firebase **Blaze plan** (pay-as-you-go, typically €0-5/month). Without them, the app still works — market data fetches directly from the browser.

### Why you'd want them:
- API keys stay server-side (never in browser bundle)
- Exchange rates auto-refresh every 6 hours
- New users auto-get a profile on signup
- Account deletion auto-cleans ALL data (GDPR)

### How to deploy:

This is the **one part that needs a terminal**. If you have Node.js installed:

```
npm install -g firebase-tools
firebase login
firebase use myfynzo
cd functions
npm install
cd ..
firebase deploy --only functions
```

**If you don't want to use a terminal:** Skip this entirely. The app works without Cloud Functions. The `marketDataService.ts` automatically falls back to direct browser fetching.

### What the 8 functions do:

| Function | When it runs | What it does |
|----------|-------------|-------------|
| `refreshExchangeRates` | Every 6 hours (auto) | Updates currency rates in Firestore |
| `fetchPrice` | When app requests a price | Fetches stock price server-side |
| `fetchPrices` | When app requests multiple prices | Batch fetch up to 10 symbols |
| `seedTaxRules` | When admin clicks "Seed" | Writes tax rules to Firestore |
| `listUsers` | When admin views Users tab | Lists all users for admin panel |
| `saveApiKeys` | When admin saves API keys | Stores API keys securely |
| `onUserCreate` | When someone signs up | Creates default profile automatically |
| `onUserDelete` | When someone deletes account | Deletes ALL their data (GDPR) |

---

## Verification Checklist

After completing steps 1–7, open your app and check:

- [ ] App loads without errors
- [ ] Login works (email + Google)
- [ ] Dashboard shows portfolio value + trust strip at bottom
- [ ] Click your name (bottom of sidebar) → **Account** page opens
  - [ ] Profile tab: can edit name, phone, address
  - [ ] Subscription tab: shows Free vs Premium comparison
  - [ ] Billing tab: shows payment methods (empty for now)
- [ ] **Settings** has preferences only (currency, language, notifications — no personal info form)
- [ ] **Security & Privacy** page loads from sidebar shield icon
  - [ ] Security checklist shows green checks
  - [ ] "Your Data" tab shows record counts
  - [ ] "Download My Data" button downloads a JSON file
- [ ] **Admin** tab visible in sidebar (only for your account)
  - [ ] Tax Rules tab → "Seed to Firestore" button works
  - [ ] Users tab lists registered users
- [ ] **Investments** → "Import" button opens broker selection modal
- [ ] Exchange rates load in Settings card (shows LIVE badge)

---

## Firestore After Setup

Your Firestore should contain these collections:

```
system/
  ├── admin_whitelist     ← Step 4
  ├── api_keys            ← Step 6
  └── exchange_rates      ← Auto-created when app loads

tax_rules/
  ├── DE/2025/data        ← Step 5
  ├── US/2025/data        ← Step 5
  ├── CA/2025/data        ← Step 5
  └── IN/2025/data        ← Step 5

market_prices/
  └── (auto-populated when investments with tickers are viewed)

users/
  └── {your-uid}/
      ├── (profile data)
      ├── investments/
      ├── goals/
      └── ...
```

---

## Still TODO (Not in This Version)

| Item | Priority | Notes |
|------|----------|-------|
| Impressum page | **Must have** | German TMG §5 — legally required before public launch |
| Privacy Policy | **Must have** | GDPR Art. 13 — use iubenda.com template + lawyer review |
| Terms of Service | **Must have** | Include financial disclaimer |
| Cookie consent banner | **Must have** | Required before adding any analytics |
| Sentry error tracking | High | Know when something breaks in production |
| Tax calculator unit tests | High | Highest-risk code — wrong numbers = user trust destroyed |
| PostHog analytics | Medium | Understand what features people use |
| Stripe payments | Medium | Billing UI is built, needs Stripe backend |
| Password reset page | Low | Firebase Auth supports it, needs UI |
| OG meta tags | Low | For social media sharing when someone shares a link |
