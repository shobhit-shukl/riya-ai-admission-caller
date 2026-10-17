# Riya — AI Admission Caller

Riya is an AI voice admissions counselor. She talks to prospective students on the phone (in Hindi, English or Hinglish), and after each call this app:

1. receives Vapi's end-of-call report on `/api/vapi-webhook`,
2. reads the lead's details (name, course, marks, hostel, city, next step, hot/warm/cold) from the assistant's Vapi Structured Outputs, falling back to Gemini when none arrive,
3. saves the call to MongoDB, appends it to a Google Sheet, and merges it into the caller's **lead** (one per phone number),
4. emails the admissions team straight away if it's a **hot** lead (optional),
5. lets counselors work each lead in the admin dashboard at `/admin`: status pipeline (New → Contacted → Interested → Applied → Enrolled / Lost), follow-up dates, notes, call history with transcripts, search and filters, CSV export, and analytics,
6. can have the assistant **call leads back**, on demand or automatically when a follow-up is due (optional, see [Outbound callbacks](#outbound-callbacks)).

Riya's voice, prompt and knowledge of the university are configured in the **Vapi dashboard**, not in this repo.

## Stack

Next.js 16 (App Router) · MongoDB (Mongoose) · Google Sheets API · Gemini API · Vapi

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run create-admin -- admin@example.com 'a-strong-password' "Admin Name"
npm run dev
```

Open http://localhost:3000/admin and log in.

Without `VAPI_WEBHOOK_SECRET`, the webhook accepts unauthenticated requests **in development only**, so you can test it with curl.

## Deploying to production

1. **Set every variable from `.env.example`** in your host (e.g. Vercel). `VAPI_WEBHOOK_SECRET` is required: in production the webhook rejects all requests without it.
2. **Point Vapi at the webhook.** In the Vapi assistant, set the Server URL to `https://<your-domain>/api/vapi-webhook` and set the same secret as `VAPI_WEBHOOK_SECRET` (as the server secret, or as a Bearer-token credential).
3. **Share the Google Sheet** with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as an Editor, and make sure the tab named in `GOOGLE_SHEET_NAME` exists.
4. **Create admin accounts** with `npm run create-admin` (pointed at the production `MONGODB_URI`). There is no public sign-up. Running it again for an existing email resets the password and clears any login lockout.
5. **Check the connections** while logged in as an admin: `/api/test-mongodb`, `/api/test-sheets`, `/api/test-gemini`.
6. **Group existing calls into leads** (once, when upgrading from a version without leads): `npm run backfill-leads` against the production `MONGODB_URI`. It's safe to re-run.
7. **Make a test call** and confirm the lead appears in both the dashboard and the sheet.

## How it behaves in production

- **Webhook auth.** Requests must carry the shared secret (`x-vapi-secret` header or `Authorization: Bearer`).
- **Fast acknowledgement.** The webhook replies to Vapi immediately and processes the call afterwards (`after()`), so slow Gemini/Sheets calls never cause Vapi timeouts and retries.
- **No duplicate calls.** Each Vapi call ID is stored once (unique index); a re-delivered webhook is skipped.
- **One lead per caller.** Calls are matched to a lead by the last 10 digits of the phone number, so a repeat caller updates their existing lead (new details overwrite, blanks don't) instead of creating a new one. A "Lost" lead who calls again is reopened as "New". Calls with no phone number (web calls) each get their own lead.
- **Hot-lead alerts.** If `SMTP_HOST` and `ALERT_EMAIL_TO` are set, a "Hot" call triggers an email with the caller's details and a link to the lead. A failed email never blocks saving the lead.
- **Failure isolation.** If MongoDB is down, the lead still goes to the sheet; if Sheets fails, it's still in MongoDB. If Gemini fails or times out (10 s), the raw transcript is still saved.
- **Sheets.** Values are written as plain text (no formula execution), times are in IST, and very long transcripts are truncated in the sheet only. The full transcript is always in the dashboard.
- **Admin login.** After 5 wrong passwords an account is locked for 15 minutes.
- **Time zone.** "Today", the 7-day trend and all displayed times use IST (`lib/time.ts`).

## Outbound callbacks

The assistant can phone leads back: a **📞 Call now** button on each lead page, and (optionally) an automatic daily run that calls leads whose follow-up date has arrived. Callbacks open with a personal greeting ("Hello Priya, this is Sam from Maya Devi University, calling you back about BBA admissions…"), leave a short voicemail if nobody answers, and are filed under the same lead when they end (marked "Callback" in the call history).

It's built in but **dormant until configured** — until then the button says callbacks aren't set up. To turn it on:

1. **Get a phone number that can call your students** and import it into Vapi (**Phone Numbers → Import**, from Twilio, Vonage, Plivo or Telnyx). Vapi's free numbers are US-only. Optionally set your assistant as the number's inbound assistant too.
2. **Collect three values from Vapi:**
   - **API Keys → Private key** (`VAPI_API_KEY`)
   - **Assistants → your assistant → ID** under its name (`VAPI_ASSISTANT_ID`)
   - **Phone Numbers → the number → Phone Number ID** (`VAPI_PHONE_NUMBER_ID`)
3. **Add them in Vercel** (Project → Settings → Environment Variables; store `VAPI_API_KEY` as a *Secret*), then **Redeploy**. "Call now" now works.
4. **Test it:** open a lead with your own number and press **Call now**. When you hang up, the call appears in that lead's history.
5. **(Optional) Automatic callbacks:** add `CRON_SECRET` (a long random string) and `AUTO_CALLBACKS_ENABLED=true`, then redeploy. Every Monday–Saturday around 11 AM IST, the job calls up to `CALLBACK_BATCH_LIMIT` leads whose follow-up date is today or earlier.

Rules the automatic job follows:
- Only within `CALLBACK_HOURS` (IST, default 10–19), Monday–Saturday.
- Skips leads that are Enrolled, Lost or marked **Do not call** (checkbox on the lead page).
- At most one call per lead per day, and at most 3 attempts per follow-up date. Setting a new follow-up date starts a fresh set of attempts.
- A callback that connects (20 s or longer, not voicemail) clears the follow-up date, so the lead isn't called again.

Notes:
- **Indian calling rules.** Calling people back after they enquired is generally fine, but check TRAI/DLT requirements for automated calls with your telecom provider before enabling the automatic job at scale.
- **Cost.** Each callback is billed like any Vapi call (Vapi per-minute fee plus your carrier's rate). Voicemail detection keeps unanswered calls short.
- **More frequent runs.** Vercel's Hobby plan runs cron jobs once a day. On Pro you can change the schedule in `vercel.json` (e.g. hourly), or have any external scheduler call `GET /api/cron/callbacks` with `Authorization: Bearer <CRON_SECRET>`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run create-admin -- <email> <password> ["Name"]` | Create an admin or reset their password |
| `npm run backfill-leads` | Group existing calls into leads (one-off, safe to re-run) |
