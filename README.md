# Riya — AI Admission Caller

Riya is an AI voice admissions counselor. She talks to prospective students on the phone (in Hindi, English or Hinglish), and after each call this app:

1. receives Vapi's end-of-call report on `/api/vapi-webhook`,
2. extracts the lead's details (name, course, marks, hostel, city, next step) with Gemini,
3. saves the lead to MongoDB and appends it to a Google Sheet,
4. shows every lead, with the full transcript and analytics, in the admin dashboard at `/admin`.

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
6. **Make a test call** and confirm the lead appears in both the dashboard and the sheet.

## How it behaves in production

- **Webhook auth.** Requests must carry the shared secret (`x-vapi-secret` header or `Authorization: Bearer`).
- **Fast acknowledgement.** The webhook replies to Vapi immediately and processes the call afterwards (`after()`), so slow Gemini/Sheets calls never cause Vapi timeouts and retries.
- **No duplicate leads.** Each Vapi call ID is stored once (unique index); a re-delivered webhook is skipped.
- **Failure isolation.** If MongoDB is down, the lead still goes to the sheet; if Sheets fails, it's still in MongoDB. If Gemini fails or times out (10 s), the raw transcript is still saved.
- **Sheets.** Values are written as plain text (no formula execution), times are in IST, and very long transcripts are truncated in the sheet only. The full transcript is always in the dashboard.
- **Admin login.** After 5 wrong passwords an account is locked for 15 minutes.
- **Time zone.** "Today", the 7-day trend and all displayed times use IST (`lib/time.ts`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run create-admin -- <email> <password> ["Name"]` | Create an admin or reset their password |
