# Riya — AI Admission Caller

Riya is an AI voice admissions counselor. She talks to prospective students on the phone (in Hindi, English or Hinglish), and after each call this app:

1. receives Vapi's end-of-call report on `/api/vapi-webhook`,
2. reads the lead's details (name, course, marks, hostel, city, next step, hot/warm/cold) from the assistant's Vapi Structured Outputs, falling back to Gemini when none arrive,
3. saves the call to MongoDB, appends it to a Google Sheet, and merges it into the caller's **lead** (one per phone number),
4. emails the admissions team straight away if it's a **hot** lead (optional),
5. lets counselors work each lead in the admin dashboard at `/admin`: status pipeline (New → Contacted → Interested → Applied → Enrolled / Lost), follow-up dates, notes, call history with transcripts, search and filters, CSV export, and analytics,
6. can have the assistant **call leads back**, on demand or automatically when a follow-up is due (optional, see [Outbound callbacks](#outbound-callbacks)),
7. lets admins **upload a call list** (Excel/CSV of names and numbers) and have the assistant call each student with one click (see [Call list](#call-list)),
8. collects **enquiries from the university website** into **Admin → Website leads** (see [Website leads](#website-leads)),
9. runs a **WhatsApp bot** (n8n + WhatsApp Cloud API) that answers students from the courses and admission info managed in **Admin → Courses**, and saves interested students as leads (see [WhatsApp bot](#whatsapp-bot)).

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

1. **Get a phone number that can call your students** and import it into Vapi (**Phone Numbers → Create Phone Number → Import Twilio**, or Telnyx, Vonage and other supported providers). Vapi's free numbers can only receive calls, so they can't be used for callbacks. With Twilio, also allow India under *Voice → Settings → Geo permissions*, or calls to +91 numbers are blocked.
2. **In Vapi, open the number and, under Inbound Settings, choose Sam as the Assistant**, so students who call the number back reach Sam (their calls are filed as leads like any other). Calls Riya places use their own opening line ("Hello Priya, this is Sam… calling you back"). If Sam's prompt assumes the student called in, add a line such as *"Sometimes you are the one calling the student back; never thank them for calling in that case."*
3. **Collect three values from Vapi:**
   - **API Keys → Private key** (`VAPI_API_KEY`)
   - **Assistants → your assistant → ID** under its name (`VAPI_ASSISTANT_ID`)
   - **Phone Numbers → the number → Phone Number ID** (`VAPI_PHONE_NUMBER_ID`), the ID, not the number itself
4. **Add them in Vercel** (Project → Settings → Environment Variables; store `VAPI_API_KEY` as a *Secret*), then **Redeploy**.
5. **Open Admin → Calling setup.** It checks every setting live against Vapi (key accepted, assistant and number found, number active and assigned to Sam, Sam's Server URL pointing at this app, webhook secret set) and says exactly what to fix. Nothing is called while checking.
6. **Test it:** on the same page, enter your own mobile and press **Call my phone**. Talk to Sam, hang up, and the call appears under **Leads** a minute later.
7. **(Optional) Automatic callbacks:** add `CRON_SECRET` (a long random string) and `AUTO_CALLBACKS_ENABLED=true`, then redeploy. Every Monday–Saturday around 11 AM IST, the job calls up to `CALLBACK_BATCH_LIMIT` leads whose follow-up date is today or earlier.

**Unanswered calls.** When a call Riya places isn't answered (no answer, busy, voicemail), it stays in the lead's call history and the lead, Call list row or Website lead shows *Last call: No answer* (or *Line busy*, *Went to voicemail*). It doesn't create a lead, isn't added to the Google Sheet and doesn't run extraction.

Rules the automatic job follows:
- Only within `CALLBACK_HOURS` (IST, default 10–19), Monday–Saturday.
- Skips leads that are Enrolled, Lost or marked **Do not call** (checkbox on the lead page).
- At most one call per lead per day, and at most 3 attempts per follow-up date. Setting a new follow-up date starts a fresh set of attempts.
- A callback that connects (20 s or longer, not voicemail) clears the follow-up date, so the lead isn't called again.
- If Vapi itself fails (rejected key, outage, rate limit), the run stops at the first failure and that lead gets its attempt back, so one setup problem can't use up everyone's attempts. The error shows on the lead page and in the Vercel logs.
- Each run stops starting new calls after about 40 seconds (to stay inside Vercel's time limit); leads left over are called on the next run.

Notes:
- **Indian calling rules.** Calling people back after they enquired is generally fine, but check TRAI/DLT requirements for automated calls with your telecom provider before enabling the automatic job at scale.
- **Cost.** Each callback is billed like any Vapi call (Vapi per-minute fee plus your carrier's rate). Voicemail detection keeps unanswered calls short.
- **More frequent runs.** Vercel's Hobby plan runs cron jobs once a day. On Pro you can change the schedule in `vercel.json` (e.g. hourly), or have any external scheduler call `GET /api/cron/callbacks` with `Authorization: Bearer <CRON_SECRET>`.

## Call list

**Admin → Call list** lets you upload students who haven't called yet (e.g. from a school fair or an enquiry form) and have the assistant call them.

- **Upload** an Excel `.xlsx` or `.csv` file (up to 1 MB / 5,000 rows) with a **Name** and a **Phone** column, plus an optional **Course** column that personalises the call. Common headers are recognised ("Student Name", "Mobile No.", "Contact Number", "Course Interested"…); files without headers work too. **Download sample file** on the page shows the format. Old `.xls` files: open in Excel and *Save As* `.xlsx`.
- Rows without a valid number are skipped and listed by row number. Each phone number appears once: uploading it again updates the name/course instead of adding a duplicate.
- **📞 Call** on a row has the assistant ring that student with an introduction ("Hello Diya, this is Sam from Maya Devi University, Dehradun. I'm calling about our B.Tech CSE programme…"). The row shows Called / Failed, and once the call ends it links to the **Lead** created from the conversation.
- Calling uses the same Vapi setup as [Outbound callbacks](#outbound-callbacks) — until that's configured, you can upload and manage the list but the Call buttons are disabled.
- **Indian calling rules:** these are first calls to people who may not have contacted you. Make sure you have their consent and check TRAI/DND rules for promotional calls with your telecom provider.

## Website leads

Enquiry / apply / callback / brochure forms on the university website are forwarded here and listed under **Admin → Website leads**: search and filter by status, form and course; set a status (New → Contacted → Converted / Closed); see the message, page and campaign; **📞 Call** the student (uses the [Outbound callbacks](#outbound-callbacks) setup); and jump to the call **Lead** once Sam has spoken to them. Repeat enquiries from the same number are flagged (×2, ×3…).

**Connecting a website:** set the same long random string as `WEBSITE_LEADS_SECRET` here and in the website's backend, then have the backend (never the browser) send each submission:

```http
POST https://<this-app>/api/website-leads
Authorization: Bearer <WEBSITE_LEADS_SECRET>
Content-Type: application/json

{
  "externalId": "website-enquiry-id",      // makes retries safe (optional)
  "name": "Priya Sharma",                  // required
  "phone": "+91 98765 43210",              // required
  "email": "priya@example.com",
  "course": "BBA",
  "city": "Dehradun",
  "message": "Is hostel available?",
  "formType": "enquiry",                   // enquiry | apply | callback | brochure | contact
  "sourcePage": "/programs/bba",
  "utmSource": "google", "utmMedium": "cpc", "utmCampaign": "admissions-2026",
  "submittedAt": "2026-10-20T10:15:00Z"
}
```

Responses: `201 {id}` created, `200 {id, duplicate: true}` already received (same `externalId`), `400 {errors}` invalid, `401` wrong secret.

## WhatsApp bot

Students message your WhatsApp Business number and an AI assistant replies, in English, Hindi or Hinglish, about courses, fees, eligibility, scholarships, hostel and the admission process. It runs as an **n8n workflow** ([`n8n/whatsapp-admissions-bot.json`](n8n/whatsapp-admissions-bot.json)) on the official **WhatsApp Cloud API**. Everything it knows comes from this app.

**Admin → Courses** is where you manage it:
- **Courses**: name, level, department, duration, fees, eligibility, selection process, seats, description, application and brochure links. Untick *Admissions open* to have the bot say admissions are closed; untick *Show to students* to hide a course from the bot.
- **Admission info**: process, documents, important dates, scholarships, hostel, contact details, application link and anything else. The bot answers **only** from this page. For anything missing it offers a counsellor call instead of guessing.

Edits reach the bot from its next reply, with no redeploy and no change in n8n.

What students get:
- "Hi", "Namaste", "menu" and similar greetings show a welcome message with three buttons: **Courses & fees**, **How to apply**, **Call me back**.
- Any other text goes to the AI (Google Gemini, free tier), which remembers the last few messages of each chat, keeps replies short, and shares apply/brochure links.
- Voice notes, images and stickers get a polite "please type your question".

What your team gets:
- When a student shares their name, course, city or email, or asks for a call, they appear under **Admin → Website leads** with form **WhatsApp**, one per number, with a one-line summary of what they want. **📞 Call** has Sam phone them, and once they've spoken they link to the call **Lead**.
- A student asking for a counsellor is marked **🙋 Wants a call** and, if [hot-lead alerts](#how-it-behaves-in-production) are set up, the team gets one email. The badge clears when you call them or move the enquiry past *New*.

### Setting it up

You need a Meta Business account, a phone number that is **not** already registered on the WhatsApp or WhatsApp Business app (or remove it from the app first), an [n8n Cloud](https://n8n.io) workspace and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (the same kind of key as `GEMINI_API_KEY`).

1. **This app:** set `BOT_API_SECRET` (a long random string) in Vercel and redeploy. Add your courses and admission info under **Admin → Courses**.
2. **Meta app:** at [developers.facebook.com](https://developers.facebook.com) → *My Apps → Create app* → *Business* type, then add the **WhatsApp** product. Under *WhatsApp → API Setup*, add your phone number and verify it. (The free test number works too, but only for up to 5 recipient numbers you add there.)
3. **Permanent access token:** in [Business Settings](https://business.facebook.com/settings) → *Users → System users*, add an *Admin* system user, assign it your app and WhatsApp account, then *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`. (The token on the API Setup page expires after 24 hours.)
4. **n8n credentials** (*Overview → Credentials → Create*):
   - **WhatsApp API**: the access token, plus the *WhatsApp Business Account ID* from API Setup.
   - **WhatsApp OAuth API** (for the trigger): *Client ID* = App ID, *Client Secret* = App secret (*App settings → Basic*).
   - **Header Auth**: Name `Authorization`, Value `Bearer <BOT_API_SECRET>`.
   - **Google Gemini(PaLM) API**: your Gemini API key (leave the host as is).
5. **Import the workflow:** *Create workflow → ⋯ → Import from file* → `n8n/whatsapp-admissions-bot.json`. Open **Read message** and set `RIYA_URL` to this app's address. Pick the credentials on each node: WhatsApp OAuth on the trigger; WhatsApp API on *Send menu*, *Show typing*, *Send reply*, *Send sorry* and *Ask to type*; Header Auth on *Get courses* and *save_student_details*; Google Gemini on *Gemini*.
6. **Activate** the workflow. n8n registers its webhook with your Meta app automatically. A Meta app can only send messages to one webhook, so don't activate a second WhatsApp Trigger on the same app.
7. **Test:** send "Hi" to the number from your phone. You should get the menu, then try a question like "BBA fees kitni hai?" and "please call me".
8. **Go live:** in Meta, complete *Business verification*, get your display name approved, and switch the app to *Live*.

Notes:
- **Cost.** Replies to a student who messaged you within the last 24 hours are free on WhatsApp's side, and Gemini's free tier costs nothing. Messaging students first (follow-ups, reminders) needs Meta-approved templates and is billed by Meta. The bot doesn't do that.
- **Model.** The workflow uses `gemini-3.6-flash` on Gemini's free tier. Two limits apply. The free tier has per-minute and per-day request limits; if many students message at once, some get the "Sorry, try again" reply. On the free tier, Google may also use the conversations to improve its products. If either matters, enable billing on the same key; nothing in n8n changes. To use another model, change it on the **Gemini** node.
- **Memory** is n8n's in-memory chat buffer (last 12 messages per number). It resets if n8n restarts, which is fine for admission chats. Swap in the Postgres or Redis chat memory node if you want it to persist.

API used by the workflow (both need `Authorization: Bearer <BOT_API_SECRET>`; without the secret they reject everything in production):
- `GET /api/bot/knowledge` → `{ institutionName, text, courses, updatedAt }`, where `text` is the active courses and admission info as plain text for the AI.
- `POST /api/bot/leads` with `{ phone*, name, course, city, email, message, wantsCallback }` → `201 {id}` new, `200 {id}` updated, `400 {errors}`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run create-admin -- <email> <password> ["Name"]` | Create an admin or reset their password |
| `npm run backfill-leads` | Group existing calls into leads (one-off, safe to re-run) |
