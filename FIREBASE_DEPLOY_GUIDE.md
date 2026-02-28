# myfynzo — Firebase Setup & Deployment Guide
## 100% Web Console — No Terminal Required

> **Your workflow:** Edit files → Upload to GitHub (web) → Cloudflare auto-deploys the frontend.
> Firebase managed entirely via the web console at https://console.firebase.google.com

---

## Table of Contents

1. [Deployment Order (Critical)](#1-deployment-order-critical)
2. [Step 1: Deploy Firestore Security Rules](#2-step-1-deploy-firestore-security-rules)
3. [Step 2: Create/Update Admin Whitelist](#3-step-2-createupdate-admin-whitelist)
4. [Step 3: Create API Keys Document](#4-step-3-create-api-keys-document)
5. [Step 4: Get Your Free API Keys](#5-step-4-get-your-free-api-keys)
6. [Step 5: Restrict Your Firebase API Key](#6-step-5-restrict-your-firebase-api-key)
7. [Step 6: Enable Firebase App Check](#7-step-6-enable-firebase-app-check)
8. [Step 7: Upload to GitHub & Cloudflare Env Vars](#8-step-7-upload-to-github--cloudflare-env-vars)
9. [Step 8: Seed Tax Rules (In-App)](#9-step-8-seed-tax-rules-in-app)
10. [Cloud Functions (Optional — Needs Terminal)](#10-cloud-functions-optional--needs-terminal)
11. [What the Firestore Database Should Look Like](#11-what-the-firestore-database-should-look-like)
12. [Verification Checklist](#12-verification-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Deployment Order (Critical)

Do things in this exact order to avoid breaking the live app:

```
Step 1 → Firestore Rules       (Firebase Console)
Step 2 → Admin Whitelist        (Firebase Console)
Step 3 → API Keys Document      (Firebase Console)
Step 4 → Get API Keys           (Twelve Data + Anthropic websites)
Step 5 → Restrict Firebase Key  (Google Cloud Console)
Step 6 → App Check              (Firebase Console)
Step 7 → Upload Code + Env Vars (GitHub + Cloudflare)
Step 8 → Seed Tax Rules         (Inside your app)
```

**Why this order matters:** The new Firestore rules block client writes to `market_prices`.
If you upload the new code *before* deploying Cloud Functions, price fetching will temporarily
rely on cached data until functions are deployed. This is safe — prices just won't refresh
until functions are live.

---

## 2. Step 1: Deploy Firestore Security Rules

### What changed and why:
| Rule | Before | After | Why |
|------|--------|-------|-----|
| `market_prices` | Any user could write | Read-only for clients | Prevents fake price injection |
| `system/admin_whitelist` | Any user could read | Only admins can read | Hid admin emails from all users |
| `users/{uid}` tier field | User could change | User cannot change own tier | Prevents subscription bypass |

### How to deploy:

1. Go to **https://console.firebase.google.com** → select **myfynzo**
2. Left sidebar → **Firestore Database** → click the **Rules** tab
3. **Select all** the existing rules and **delete** them
4. **Copy-paste** the entire contents of `firestore.rules` from the zip file
5. Click **Publish**
6. You should see a green "Rules published" confirmation

### What the rules look like (summary):
```
users/{userId}        → Only that user can read/write their own data
                      → Users CANNOT change their own 'tier' field
market_prices/{sym}   → Any auth user can READ; write: false (Cloud Functions only)
system/admin_whitelist → Only admins can read (not all users)
system/{other}        → Any auth user can read; only admins can write
tax_rules/{country}   → Any auth user can read; only admins can write
Default               → Everything else denied
```

---

## 3. Step 2: Create/Update Admin Whitelist

This tells the app who the admin is. You probably already have this from before, but let's verify it's correct.

1. Go to **Firestore Database** → click the **Data** tab
2. Find the `system` collection (or click **+ Start collection** if it doesn't exist)
   - Collection ID: `system`
3. Find or create the document `admin_whitelist`
   - Document ID: `admin_whitelist`
4. Make sure it has these fields:

| Field name | Type | Value |
|-----------|------|-------|
| `uids` | array | Your Firebase Auth UID (see below how to find it) |
| `emails` | array | Your email address |

### How to find your UID:
1. Firebase Console → left sidebar → **Authentication** → **Users** tab
2. Find your email in the list
3. Copy the long string in the **User UID** column (looks like `a1b2C3d4E5f6...`)
4. Paste it as a string element in the `uids` array

**Screenshot guide:**
```
Firestore → system → admin_whitelist

uids: (array)
  0: "a1b2C3d4E5f6G7h8I9j0..."    ← your UID

emails: (array)
  0: "you@example.com"              ← your email
```

---

## 4. Step 3: Create API Keys Document

This is where the app stores API keys for external services (stock prices, AI advisor).

1. Go to **Firestore Database** → **Data** tab
2. Click the `system` collection
3. Click **+ Add document**
4. Document ID: `api_keys`
5. Add these fields (leave blank for now, we'll fill them in Step 4):

| Field name | Type | Value |
|-----------|------|-------|
| `twelveData` | string | *(empty for now)* |
| `anthropicKey` | string | *(empty for now)* |

6. Click **Save**

Your `system` collection should now have 2-3 documents:
```
system/
  ├── admin_whitelist
  ├── api_keys          ← you just created this
  └── exchange_rates    ← may already exist from before
```

---

## 5. Step 4: Get Your Free API Keys

You need two API keys. Both have free tiers that are sufficient for personal/beta use.

### 4a. Twelve Data API Key (Stock & ETF Prices)

1. Go to **https://twelvedata.com**
2. Click **Sign Up** (top right) → create a free account
3. After signup, go to **Dashboard** → you'll see your API key
4. Copy the API key

**Free tier:** 800 API calls/day, 8 calls/minute — enough for ~100 investments refreshing every 15 minutes.

**Now save it in Firestore:**
1. Firebase Console → Firestore → `system` → `api_keys`
2. Click the pencil icon next to `twelveData`
3. Paste your API key → click **Update**

### 4b. Anthropic API Key (myfynzo Pulse AI Advisor)

This powers the AI financial advisor feature (Premium only).

1. Go to **https://console.anthropic.com**
2. Click **Sign Up** → create an account
3. Go to **API Keys** → click **Create Key**
4. Name it `myfynzo-pulse` → click **Create**
5. **Copy the key immediately** — Anthropic only shows it once!

**Pricing:** Pay-per-use. Claude Sonnet costs ~$3 per million input tokens. With the 30-message daily limit, a typical Premium user costs ~$0.10-0.30/month.

**Now save it in Firestore:**
1. Firebase Console → Firestore → `system` → `api_keys`
2. Click the pencil icon next to `anthropicKey`
3. Paste your Anthropic key → click **Update**

### After Step 4, your `api_keys` document should look like:
```
system/api_keys:
  twelveData: "your_twelve_data_key_here"
  anthropicKey: "sk-ant-api03-your_anthropic_key_here"
```

### What about the other keys (tinkApiKey, plaidClientId, plaidSecret)?

These are for **future** features (bank account connections via Open Banking). Leave them empty for now. The app doesn't use them yet.

---

## 6. Step 5: Restrict Your Firebase API Key

Your Firebase API key is visible in the browser (this is normal for Firebase). But you should restrict it so only your domain can use it.

1. Go to **https://console.cloud.google.com**
2. Top bar → make sure **myfynzo** project is selected
3. Left sidebar → **APIs & Services** → **Credentials**
4. Under **API Keys**, find **Browser key (auto created by Firebase)**
5. Click on it to edit

### Application restrictions:
1. Select **HTTP referrers (web sites)**
2. Click **Add an item** and add these:
   ```
   myfynzo.com/*
   www.myfynzo.com/*
   *.myfynzo.pages.dev/*
   localhost:*
   ```
3. Click **Done**

### API restrictions:
1. Select **Restrict key**
2. Check only these APIs:
   - Firebase Auth API
   - Cloud Firestore API
   - Firebase Installations API
   - Firebase Cloud Messaging API
   - Identity Toolkit API
   - Token Service API
3. Click **Save**

This means even if someone finds your API key, they can only use it from your domain and only for Firebase services.

---

## 7. Step 6: Enable Firebase App Check (Recommended)

App Check adds another layer — it verifies that requests to Firebase actually come from your real app, not from scripts or tools.

1. Firebase Console → left sidebar → **App Check**
2. Click on your **Web app**
3. Choose provider: **reCAPTCHA Enterprise** (recommended) or **reCAPTCHA v3**
4. If using reCAPTCHA Enterprise:
   - Go to https://console.cloud.google.com → **Security** → **reCAPTCHA Enterprise**
   - Click **Create Key** → type: Website → add your domains
   - Copy the site key
   - Back in Firebase App Check → paste the site key
5. Click **Save**
6. Under **APIs** tab, click **Enforce** for:
   - Cloud Firestore
   - Authentication
   - Cloud Functions (if deployed)

**Note:** Don't enforce until you've verified the app works with App Check registered but not enforced. Enforcing too early can lock you out.

---

## 8. Step 7: Upload to GitHub & Cloudflare Env Vars

### 7a. Upload files to GitHub

Go to your GitHub repo web interface → upload all files from the zip, replacing existing ones.

**New files to create/upload:**

| File | Location | Purpose |
|------|----------|---------|
| `.env.example` | Root | Template for env vars |
| `.gitignore` | Root | Replaces old `gitignore` (renamed) |
| `FIREBASE_DEPLOY_GUIDE.md` | Root | This guide |
| `src/vite-env.d.ts` | `src/` | TypeScript env var types |
| `src/App.tsx` | `src/` | Updated with error boundaries + lazy loading |
| `src/types/financial.ts` | `src/types/` | TypeScript interfaces |
| `src/components/ErrorBoundary.tsx` | `src/components/` | Crash recovery |
| `src/components/CookieConsent.tsx` | `src/components/` | GDPR cookie banner |
| `src/components/RegulatoryDisclaimer.tsx` | `src/components/` | SEBI/BaFin disclaimers |
| `src/pages/Impressum.tsx` | `src/pages/` | German legal notice |
| `src/pages/PrivacyPolicy.tsx` | `src/pages/` | Privacy policy |
| `src/services/logger.ts` | `src/services/` | Error logging |
| `src/services/dataExport.ts` | `src/services/` | GDPR data export |

**Modified files to replace:**

| File | What changed |
|------|-------------|
| `src/firebase/config.ts` | Now reads from env vars + offline persistence |
| `src/constants/tiers.ts` | Single source of truth for all pricing |
| `src/context/UserProfileContext.tsx` | Admin check via custom claims + unified pricing |
| `src/hooks/useAdmin.ts` | Custom claims first, Firestore fallback |
| `src/components/GermanTaxCalculator.tsx` | Updated to 2025 tax values |
| `src/components/Paywall.tsx` | Fixed imports |
| `src/services/marketDataService.ts` | Removed client writes to market_prices |
| `src/pages/LandingPageExtended.tsx` | Pricing from tiers.ts |
| `firestore.rules` | Hardened security rules |
| `firebase.json` | Fixed functions source path |
| `firebase-functions/src/index.ts` | New functions + hardened existing ones |

**File to DELETE:**

| File | Why |
|------|-----|
| `src/firebase/auth.ts` | Uses wrong Firebase SDK version — was never imported |
| `gitignore` (no dot) | Renamed to `.gitignore` (with dot) |

**Do NOT upload:** `.env`, `.env.local`, `node_modules/`, `dist/`

### 7b. Set Environment Variables in Cloudflare Pages

1. Go to **https://dash.cloudflare.com**
2. Left sidebar → **Workers & Pages** → click your **myfynzo** project
3. Go to **Settings** → **Environment variables**
4. Add each variable for **Production** environment:

| Variable name | Value |
|--------------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBIXXj5B2bvmwIwbFOQIAgkxJGpwqCDwrY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `myfynzo.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `myfynzo` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `myfynzo.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `722972966832` |
| `VITE_FIREBASE_APP_ID` | `1:722972966832:web:f31a649d8d75fee2f32075` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-HXZKYF3EEX` |
| `VITE_ENABLE_COUPLES_TIER` | `false` |

5. Click **Save**
6. Go to **Deployments** → click **Retry deployment** on the latest one (so it picks up the new env vars)

---

## 9. Step 8: Seed Tax Rules (In-App)

After the app deploys with the new code:

1. Open **https://www.myfynzo.com** and sign in with your admin account
2. Click **Admin** in the sidebar
3. Go to the **Tax Rules** tab
4. Click **"Seed All to Firestore"**

This writes tax rules for Germany (2025), India (2025-26), US (2025), and Canada (2025) into Firestore.

---

## 10. Cloud Functions (Optional — Needs Terminal)

Cloud Functions are the **one piece that can't be done from a web console**. They require the Firebase CLI (command line tool) to deploy.

### What happens WITHOUT Cloud Functions:
- ✅ App works fine
- ✅ Stock prices still load (directly from browser via Twelve Data)
- ✅ Exchange rates still load (from free API)
- ❌ API keys are in Firestore (readable by auth users via system/api_keys)
- ❌ No auto-refresh of exchange rates
- ❌ No auto-cleanup of deleted user data
- ❌ No myfynzo Pulse AI advisor (this REQUIRES Cloud Functions)
- ❌ No daily admin stats aggregation

### What happens WITH Cloud Functions:
- ✅ API keys stay server-side (never in browser)
- ✅ Exchange rates auto-refresh every 6 hours
- ✅ myfynzo Pulse AI advisor works
- ✅ User deletion triggers automatic full data cleanup
- ✅ Admin stats pre-computed daily (faster admin panel)
- ✅ Pulse conversation history auto-deleted after 90 days

### If you want to deploy Cloud Functions:

**Prerequisites:**
- Node.js installed on your computer (download from https://nodejs.org)
- Firebase Blaze plan (pay-as-you-go — typically €0-5/month for low usage)

**One-time setup (5 minutes):**
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Log in to Firebase
firebase login
# (Opens browser → sign in with your Google account)

# Set the active project
firebase use myfynzo
```

**Deploy the functions:**
```bash
# Navigate to the functions folder
cd firebase-functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Go back to project root
cd ..

# Deploy functions only
firebase deploy --only functions
```

**Verify in Firebase Console:**
1. Go to Firebase Console → **Functions** in the left sidebar
2. You should see 12 functions listed:
   - `refreshExchangeRates` (scheduled)
   - `fetchPrice` (callable)
   - `fetchPrices` (callable)
   - `seedTaxRules` (callable)
   - `listUsers` (callable)
   - `onUserCreate` (auth trigger)
   - `onUserDelete` (auth trigger)
   - `saveApiKeys` (callable)
   - `setAdminClaim` (callable)
   - `fynzoPulse` (callable)
   - `aggregateAdminStats` (scheduled)
   - `cleanupPulseHistory` (scheduled)

### Setting Admin Custom Claims (after deploying functions):

This is the recommended way to mark someone as admin (more secure than Firestore whitelist):

```bash
firebase functions:shell
```
Then type:
```
setAdminClaim({ uid: "YOUR_UID_HERE", admin: true })
```

After this, sign out and sign back in — the admin tab will appear via custom claims.

**The Firestore whitelist still works as a fallback**, so if you don't deploy functions, admin access still works via the `system/admin_whitelist` document.

### If you absolutely can't use a terminal:

Ask someone technical to do the `firebase deploy --only functions` step once. After the initial deployment, functions run automatically and never need redeployment unless you change the code.

Alternatively, you can use **Google Cloud Shell** (web-based terminal):
1. Go to https://console.cloud.google.com
2. Click the **>_** icon in the top-right to open Cloud Shell
3. Run the commands above in that web terminal

---

## 11. What the Firestore Database Should Look Like

After completing all steps, your Firestore should contain:

```
system/
  ├── admin_whitelist          ← Step 2
  │     uids: ["your-uid"]
  │     emails: ["you@email.com"]
  │
  ├── api_keys                 ← Steps 3-4
  │     twelveData: "abc123..."
  │     anthropicKey: "sk-ant-..."
  │
  ├── exchange_rates           ← Auto-created when app loads
  │     rates: { USD: 1.08, GBP: 0.86, INR: 90.5, ... }
  │     base: "EUR"
  │     updatedAt: (timestamp)
  │
  └── admin_stats              ← Auto-created by Cloud Function (if deployed)
        totalUsers: 5
        premiumUsers: 1
        ...

tax_rules/
  ├── DE/2025/data             ← Step 8
  ├── IN/2025/data
  ├── US/2025/data
  └── CA/2025/data

market_prices/
  └── AAPL                     ← Auto-created when viewing investments
  └── MSFT
  └── MF:120716                ← Indian mutual funds

users/
  └── {uid}/
      ├── email, country, tier, ...
      ├── investments/
      ├── goals/
      ├── debts/
      ├── lifestyleBasket/
      ├── monthlyInvestments/
      ├── cashSavings/
      ├── physicalAssets/
      ├── scenarios/
      ├── anti_portfolio/
      ├── projections/
      ├── pulse_history/        ← AI chat logs (Premium)
      └── pulse_usage/          ← Daily rate limiting
```

---

## 12. Verification Checklist

After completing all steps, verify:

### Basic functionality
- [ ] App loads at myfynzo.com without blank screen
- [ ] Login works (email + Google)
- [ ] Dashboard shows financial data
- [ ] Cookie consent banner appears on first visit

### New pages
- [ ] Footer has "Privacy Policy" and "Impressum" links
- [ ] `/privacy` page loads
- [ ] `/impressum` page loads
- [ ] Error boundary shows "Something went wrong" instead of white screen (test by adding a typo to a component in dev)

### Security
- [ ] Admin tab visible only for your admin account
- [ ] Non-admin users cannot see the Admin tab
- [ ] German tax calculator shows "2025" values (Grundfreibetrag: €12,084)

### API Keys (test in app)
- [ ] Add an investment with a ticker (e.g., "AAPL") → live price should load
- [ ] If you have Anthropic key: Premium user can open Pulse AI and get a response
- [ ] Exchange rates show in Settings card

### Legal
- [ ] **BEFORE going public:** Fill in real company details in `Impressum.tsx`
- [ ] **BEFORE going public:** Review Privacy Policy with a lawyer

---

## 13. Troubleshooting

### "Permission denied" errors in console
→ Your Firestore rules are deployed but your user doesn't match the rules. Check:
  - Are you signed in?
  - Is your UID in `system/admin_whitelist.uids`?
  - Did you publish the rules (not just edit)?

### Stock prices not loading
→ Check Firestore `system/api_keys` → `twelveData` field:
  - Is it empty? Get a key from twelvedata.com
  - Is the key correct? Try opening `https://api.twelvedata.com/quote?symbol=AAPL&apikey=YOUR_KEY` in a browser

### App shows blank white screen
→ Most likely an environment variable is missing. Check:
  - Cloudflare Pages → Settings → Environment variables → all `VITE_*` vars are set
  - Redeploy after setting vars (Deployments → Retry deployment)

### Admin tab doesn't appear
→ Check that `system/admin_whitelist` exists and your UID is in the `uids` array. Sign out and sign back in.

### "Firebase App not initialized" error
→ The `VITE_FIREBASE_API_KEY` variable is empty or missing. Check your Cloudflare env vars.

### myfynzo Pulse says "AI service not configured"
→ The `anthropicKey` field in `system/api_keys` is empty. Add your Anthropic key (Step 4b).
→ Also requires Cloud Functions to be deployed (Step 10).
