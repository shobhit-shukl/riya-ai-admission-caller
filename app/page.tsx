import Link from "next/link";
import ScrollReveal from "./ScrollReveal";
import styles from "./page.module.css";

const FEATURES = [
  {
    title: "Natural voice conversations",
    description:
      "Riya talks with prospective students in real time over the phone, powered by Vapi's voice pipeline — no scripts, no hold music.",
    icon: (
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-2.07A7 7 0 0 0 19 12h-2Z" />
    ),
  },
  {
    title: "Automatic call summaries",
    description:
      "Every call ends with a clean summary and full transcript, generated the moment Vapi fires its end-of-call-report event.",
    icon: (
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Zm0-8h4v2H8V9Z" />
    ),
  },
  {
    title: "Structured lead extraction",
    description:
      "Course interest, academic marks, hostel requirements, location, and next action are parsed out of the conversation automatically.",
    icon: (
      <path d="M4 4h16v2H4V4Zm0 7h10v2H4v-2Zm0 7h16v2H4v-2Zm12-7h4v2h-4v-2Z" />
    ),
  },
  {
    title: "Zero-touch Google Sheets sync",
    description:
      "The webhook route appends one row per call directly to your team's sheet, so the pipeline never touches a database you have to babysit.",
    icon: (
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 10v2h2v-2H8Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2ZM8 16v2h2v-2H8Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z" />
    ),
  },
];

const STEPS = [
  {
    title: "A call comes in — or wraps up",
    description:
      "A prospective student talks to Riya over the phone. When the call ends, Vapi sends an end-of-call-report webhook to your app.",
  },
  {
    title: "The webhook does the parsing",
    description:
      "app/api/vapi-webhook/route.ts reads the payload and pulls out the caller's number, call summary, and full transcript.",
  },
  {
    title: "One row lands in your sheet",
    description:
      "appendCallRecord() writes a structured row to Google Sheets in real time — ready for your admissions team to follow up.",
  },
];

const SHEET_COLUMNS = [
  "Timestamp",
  "Caller Number",
  "Interested Course",
  "Summary",
  "Academic Marks",
  "Hostel Required",
  "Location",
  "Next Action",
];

const SHEET_SAMPLE_ROW = [
  "2026-09-12 14:32",
  "+91 98xxxxxx10",
  "B.Tech CSE",
  "Asked about fees and hostel availability for the fall intake.",
  "86%",
  "Yes",
  "Pune",
  "Send fee structure",
];

export default function Home() {
  return (
    <div className={styles.page}>
      <ScrollReveal />
      <div className={styles.bgBlobOne} aria-hidden="true" />
      <div className={styles.bgBlobTwo} aria-hidden="true" />

      <header className={styles.header}>
        <a href="#top" className={styles.logo}>
          <span className={styles.logoDot} />
          Riya
        </a>
        <nav className={styles.nav}>
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#data">Data</a>
        </nav>
        <div className={styles.headerActions}>
          <a
            className={styles.navCta}
            href="https://docs.vapi.ai/server-url/events"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vapi webhook docs
          </a>
          <Link href="/admin/login" className={styles.signInButton}>
            Sign in
          </Link>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.badge}>Voice AI · Admissions</span>
            <h1 className={styles.heroTitle}>
              Riya answers admission calls —{" "}
              <span className={styles.heroAccent}>and logs every lead</span>{" "}
              automatically.
            </h1>
            <p className={styles.heroSubtitle}>
              A Vapi-powered voice agent that has a real conversation with
              prospective students, then turns it into a clean, structured
              row in Google Sheets — no manual data entry required.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.btnPrimary} href="#how-it-works">
                See how it works
              </a>
              <a className={styles.btnSecondary} href="#data">
                View captured data
              </a>
            </div>
            <div className={styles.stack}>
              <span>Next.js</span>
              <span className={styles.stackDot} aria-hidden="true" />
              <span>Vapi</span>
              <span className={styles.stackDot} aria-hidden="true" />
              <span>Google Sheets API</span>
              <span className={styles.stackDot} aria-hidden="true" />
              <span>TypeScript</span>
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.callCard}>
              <div className={styles.callCardHeader}>
                <span className={styles.liveDot} />
                <span>Live call</span>
                <span className={styles.callCardTimer}>02:14</span>
              </div>
              <div className={styles.callCardBody}>
                <p className={styles.transcriptLine}>
                  <strong>Student:</strong> Hi, I wanted to ask about the
                  B.Tech CSE program and hostel fees.
                </p>
                <p className={styles.transcriptLine}>
                  <strong>Riya:</strong> Sure! Let me walk you through the
                  intake and hostel options for this year...
                </p>
              </div>
              <div className={styles.callCardFooter}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
                </svg>
                Logged to Google Sheet
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className={styles.section}>
          <div className={styles.sectionHeading} data-reveal>
            <span className={styles.eyebrow}>Demo</span>
            <h2>See what Riya actually does</h2>
            <p>
              A quick walkthrough of the project — the voice agent, the
              webhook, and where the data ends up.
            </p>
          </div>
          <div className={styles.videoWrapper} data-reveal>
            <video
              className={styles.video}
              src="/make_a_vedeo_defining_my_proje.mp4"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.sectionHeading} data-reveal>
            <span className={styles.eyebrow}>Features</span>
            <h2>Everything from ring to record, handled</h2>
            <p>
              Riya sits between your phone line and your spreadsheet, so your
              team only ever sees finished, structured leads.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
              <div
                className={styles.featureCard}
                key={feature.title}
                data-reveal
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <div className={styles.featureIcon}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    {feature.icon}
                  </svg>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionHeading} data-reveal>
            <span className={styles.eyebrow}>How it works</span>
            <h2>Three steps, one webhook</h2>
            <p>
              The whole pipeline is a single Next.js route handler — no queue,
              no separate worker to deploy.
            </p>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li
                className={styles.stepCard}
                key={step.title}
                data-reveal
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <span className={styles.stepIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="data" className={styles.section}>
          <div className={styles.sectionHeading} data-reveal>
            <span className={styles.eyebrow}>Data</span>
            <h2>What lands in your sheet</h2>
            <p>
              Every processed call appends one row with these columns —
              matching the fields <code className={styles.code}>
                appendCallRecord
              </code>{" "}
              writes today.
            </p>
          </div>
          <div className={styles.sheetWrapper} data-reveal>
            <table className={styles.sheetTable}>
              <thead>
                <tr>
                  {SHEET_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {SHEET_SAMPLE_ROW.map((cell, index) => (
                    <td key={SHEET_COLUMNS[index]}>{cell}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.ctaBanner} data-reveal>
          <h2>Plug Riya into your own call flow</h2>
          <p>
            Point a Vapi assistant&apos;s server URL at{" "}
            <code className={styles.code}>/api/vapi-webhook</code> and every
            finished call starts writing itself into your sheet.
          </p>
          <a
            className={styles.btnOnAccent}
            href="https://docs.vapi.ai/server-url/events"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the Vapi webhook docs
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Built with Next.js and the Vapi webhook API.</span>
        <div className={styles.footerLinks}>
          <a
            href="https://docs.vapi.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vapi
          </a>
          <a
            href="https://developers.google.com/sheets/api"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Sheets API
          </a>
        </div>
      </footer>
    </div>
  );
}
