import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy — Sam Admissions",
  description:
    "How the Sam admissions assistant collects and uses information from students who contact us by WhatsApp, phone or the website.",
};

const CONTACT_EMAIL = "shobhitshukl2006@gmail.com";
const LAST_UPDATED = "26 October 2026";

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          ← Sam Admissions
        </Link>

        <h1>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

        <p>
          Sam is the admissions assistant used by Maya Devi University, Dehradun (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
          to answer questions from prospective students and their families on WhatsApp, over the phone and through
          our website. This policy explains what information we collect when you contact us, how we use it and the
          choices you have.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>WhatsApp:</strong> your phone number, your WhatsApp profile name, the messages you send to our
            admissions number, and any details you share in the chat, such as your name, the course you&rsquo;re
            interested in, your city or your email address.
          </li>
          <li>
            <strong>Phone calls:</strong> your phone number, a transcript and summary of the call, and the details you
            share during it (for example course, marks, hostel needs and preferred callback time).
          </li>
          <li>
            <strong>Website forms:</strong> the information you enter in an enquiry, application, callback or
            brochure form.
          </li>
        </ul>
        <p>
          We never ask for Aadhaar numbers, passwords, bank or card details through WhatsApp or these calls.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To answer your questions about courses, fees, eligibility, scholarships, hostel and admissions.</li>
          <li>To let our admissions counsellors follow up with you by phone or WhatsApp when you ask them to.</li>
          <li>To keep a record of your enquiry so you don&rsquo;t have to repeat yourself when you contact us again.</li>
        </ul>
        <p>We do not sell your information or use it for advertising.</p>

        <h2>Automated replies</h2>
        <p>
          Replies on our WhatsApp number are written by an AI assistant using only the course and admission
          information published by the university. To do this, the text of your messages is processed by the AI
          service. You can ask to speak to a human counsellor at any time.
        </p>

        <h2>Who processes your information</h2>
        <p>We use these service providers to run the assistant. They process data only to provide their service to us:</p>
        <ul>
          <li>Meta (WhatsApp Business Platform), to send and receive WhatsApp messages</li>
          <li>n8n, to run the WhatsApp automation</li>
          <li>Google (Gemini AI and Google Sheets), to write replies and keep the admissions team&rsquo;s lead sheet</li>
          <li>Vapi, for the AI phone calls</li>
          <li>MongoDB Atlas and Vercel, to store enquiries and host this application</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          We keep enquiry records for as long as they are needed for the admission process and related follow-up.
          You can ask us to delete your information at any time (see below).
        </p>

        <h2 id="deletion">Your choices and deleting your data</h2>
        <ul>
          <li>You can stop chatting with us at any time, or block our WhatsApp number.</li>
          <li>You can ask us not to call or message you again.</li>
          <li>
            You can ask for a copy of your information, ask us to correct it, or ask us to delete it. Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from any address and include the phone number you
            contacted us from. We will delete your enquiry records and confirm by email.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions about this policy or your information: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

        <h2>Changes</h2>
        <p>If we change this policy we will update the date at the top of this page.</p>
      </main>
    </div>
  );
}
