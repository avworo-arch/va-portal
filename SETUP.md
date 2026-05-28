# VA Referral Portal — Setup Guide

## What this is
A web portal where VA staff can look up any referral from their facility by Referral ID. Account Managers can see all facilities. No PII is stored or displayed — only Referral IDs, auth numbers, status fields, and dates.

---

## Step 1 — Supabase (Auth)

1. Go to https://supabase.com and create a free account
2. Click **New project**, name it `va-portal`, choose a strong database password, pick US East region
3. Wait ~2 minutes for it to provision
4. Go to **SQL Editor** → paste the contents of `supabase-schema.sql` → click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
6. Go to **Authentication → Settings → Email** and turn off "Confirm email" for now (re-enable before full launch)

---

## Step 2 — Snowflake Service Account

You need a read-only Snowflake account (not your personal SSO login). Ask your Snowflake admin to run:

```sql
CREATE USER va_portal_svc
  PASSWORD = 'choose-a-strong-password'
  DEFAULT_ROLE = ANALYST_FCT_DIM
  DEFAULT_WAREHOUSE = ANALYSTS_WH;

GRANT ROLE ANALYST_FCT_DIM TO USER va_portal_svc;
```

Then fill in `.env.local`:
```
SNOWFLAKE_USERNAME=va_portal_svc
SNOWFLAKE_PASSWORD=<the password above>
```

---

## Step 3 — Fill in .env.local

Open `/va-portal/.env.local` and fill in all values from Steps 1 and 2.

---

## Step 4 — Run locally

```bash
cd va-portal
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to the login page.

---

## Step 5 — Create your first user

In Supabase → **Authentication → Users** → **Invite user** → enter an email.

Then in **SQL Editor**, set their role and facility:

```sql
-- For an Account Manager (sees all facilities):
update public.user_profiles
set role = 'am', full_name = 'OJ Avworo'
where email = 'oavworo@sondermind.com';

-- For a VA staff member (sees only their facility):
update public.user_profiles
set role = 'va_staff',
    full_name = 'Jane Smith',
    facility_name = 'Manchester VA Medical Center'
where email = 'jane.smith@va.gov';
```

The `facility_name` must exactly match the `REFERRING_ORGANIZATION_ACCOUNT_NAME` values in Snowflake.

---

## Step 6 — Deploy to Railway (optional, for team access)

1. Push this folder to a GitHub repo (private)
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**
3. Add all the env vars from `.env.local` under **Variables**
4. Railway will auto-deploy on every push

Share the Railway URL with AMs and VA contacts for the pilot.

---

## Roles

| Role | Access |
|---|---|
| `va_staff` | Referrals from their assigned facility only |
| `am` | All facilities, filterable by VAMC |
| `admin` | Same as am (extend as needed) |

---

## PII Policy

No names, emails, phone numbers, birthdates, or addresses are queried, stored, or displayed anywhere in this application. All lookups are by Referral ID or Authorization Number only.
