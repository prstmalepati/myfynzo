# myfynzo — Data Security & Architecture

## Data Model

All user data is stored in Firebase Firestore under `users/{uid}/` with strict
per-user isolation enforced by Firestore Security Rules.

### Per-User Collections (private to each user)

```
users/{uid}/                    ← Profile (name, email, country, currency, locale)
users/{uid}/investments/{id}    ← Stocks, ETFs, crypto holdings
users/{uid}/goals/{id}          ← Financial goals with targets/progress
users/{uid}/lifestyleBasket/{id}← Luxury inflation tracking items
users/{uid}/anti_portfolio/{id} ← Missed investment opportunities
users/{uid}/scenarios/{id}      ← What-if scenario branches
```

**Rule:** `request.auth.uid == userId` — users can ONLY read/write their own data.

### Shared Collections (read-only for users)

```
market_prices/{symbol}          ← Cached stock/ETF/crypto prices (shared cache)
tax_rules/{country}/{year}/data ← Tax brackets, deductions, rates
system/exchange_rates           ← Live currency exchange rates
system/api_keys                 ← Twelve Data, Tink, Plaid keys (admin-only)
system/admin_whitelist          ← Admin UIDs and emails
```

**Rule:** Authenticated users can read. Only Cloud Functions (admin SDK) or
whitelisted admins can write.

---

## Two-Phase Security Architecture

### Phase A: Immediate (deployed now)

Firestore Security Rules enforce:

1. **User isolation** — `request.auth.uid == userId` on all user paths
2. **Field validation** on `market_prices` — only expected fields, capped size
3. **Admin write gate** — `system/*` and `tax_rules/*` writable only by UIDs
   listed in `system/admin_whitelist`
4. **Anti-escalation** — users cannot write `role` or `isAdmin` fields to
   their own profile
5. **No anonymous access** — every rule requires `request.auth != null`

### Phase B: Production (Cloud Functions)

Cloud Functions handle all shared writes server-side:

| Function | Trigger | What it does |
|---|---|---|
| `refreshExchangeRates` | Scheduled (every 6h) | Fetches rates, writes to `system/exchange_rates` |
| `fetchPrice` | Callable | Fetches stock price via Twelve Data, caches in `market_prices` |
| `fetchPrices` | Callable | Batch fetch up to 10 symbols |
| `seedTaxRules` | Callable (admin) | Writes tax rules to Firestore |
| `listUsers` | Callable (admin) | Returns all user profiles |
| `saveApiKeys` | Callable (admin) | Securely stores API keys |
| `onUserCreate` | Auth trigger | Creates default profile on signup |
| `onUserDelete` | Auth trigger | Deletes all user data on account deletion |

**Client code tries Cloud Functions first, falls back to direct Firestore for
development/when functions aren't deployed.**

---

## Setup Instructions

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Create Admin Whitelist

In Firebase Console → Firestore → Create document:

- **Path:** `system/admin_whitelist`
- **Fields:**
  - `uids` (array): `["your-firebase-auth-uid"]`
  - `emails` (array): `["your@email.com"]`

To find your UID: Firebase Console → Authentication → Users → copy UID.

### 3. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

**Note:** Cloud Functions require the Blaze (pay-as-you-go) plan. The free
Spark plan does not support Cloud Functions. For development, the app works
without functions — it falls back to direct client writes where rules allow.

### 4. Set API Keys

Either via Firebase Console:
- `system/api_keys` → `twelveData: "your-api-key"`

Or via the Admin panel in the app (after deploying Cloud Functions):
- Admin → System Config → Edit Twelve Data API Key

### 5. Seed Tax Rules

Via Admin panel → Tax Rules → "Seed All to Firestore"

Or via Cloud Function:
```bash
firebase functions:shell
> seedTaxRules({ rules: [...] })
```

---

## What Happens When a User Deletes Their Account

The `onUserDelete` Cloud Function automatically:

1. Deletes all sub-collections (investments, goals, lifestyle basket, etc.)
2. Deletes the user profile document
3. Logs the cleanup

This ensures GDPR "right to erasure" compliance.

---

## Security Checklist

- [x] All user data paths include `{uid}` — no cross-user access possible
- [x] Firestore rules enforce `request.auth.uid == userId`
- [x] Shared collections have field-level validation
- [x] Admin operations gated by whitelist document
- [x] Users cannot self-assign admin/role fields
- [x] API keys stored server-side, never exposed to client bundle
- [x] Cloud Functions use admin SDK (bypasses rules) for shared writes
- [x] User deletion triggers automatic data cleanup
- [x] No anonymous/unauthenticated access to any collection
- [x] Firebase Auth handles passwords — app never sees or stores credentials
- [ ] Enable App Check (recommended for production)
- [ ] Enable Firestore audit logging
- [ ] Rate-limit Cloud Functions with Firebase App Check
