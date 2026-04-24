import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import fs from "fs/promises";
import path from "path";

const app = new Hono<{ Bindings: HttpBindings }>();

const portalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jim Newman Portal</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #20201d;
        --muted: #6e695f;
        --paper: #f5f0e7;
        --panel: #fffaf0;
        --line: rgba(32, 32, 29, 0.16);
        --green: #2e5d4f;
        --green-dark: #173c33;
        --gold: #b8893a;
        --clay: #b75d3f;
        font-family: Georgia, "Times New Roman", serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(115deg, rgba(46, 93, 79, 0.12), transparent 42%),
          radial-gradient(circle at 82% 10%, rgba(184, 137, 58, 0.18), transparent 28%),
          var(--paper);
        color: var(--ink);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0.34;
        background-image:
          linear-gradient(rgba(32, 32, 29, 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(32, 32, 29, 0.035) 1px, transparent 1px);
        background-size: 36px 36px;
      }

      a {
        color: inherit;
      }

      .shell {
        width: min(1160px, calc(100% - 36px));
        margin: 0 auto;
        padding: 24px 0 56px;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 14px 0 28px;
        font-family: "Trebuchet MS", Verdana, sans-serif;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .mark {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 2px solid var(--ink);
        background: var(--green);
        color: #fff7e8;
        box-shadow: 5px 5px 0 var(--gold);
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .nav-links a,
      .small-button {
        min-height: 38px;
        padding: 10px 13px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 250, 240, 0.62);
        font: 700 12px/1 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.06em;
        text-decoration: none;
        text-transform: uppercase;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
        gap: 28px;
        align-items: stretch;
      }

      .headline {
        min-height: 560px;
        padding: clamp(34px, 6vw, 72px);
        border: 1px solid var(--line);
        background:
          linear-gradient(135deg, rgba(255, 250, 240, 0.94), rgba(245, 240, 231, 0.78)),
          linear-gradient(90deg, transparent 0 78%, rgba(183, 93, 63, 0.12) 78% 100%);
        position: relative;
        overflow: hidden;
      }

      .headline::after {
        content: "JM";
        position: absolute;
        right: -24px;
        bottom: -62px;
        color: rgba(32, 32, 29, 0.055);
        font: 900 clamp(150px, 23vw, 320px)/0.8 Georgia, serif;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 22px;
        color: var(--green-dark);
        font: 800 12px/1 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 46px;
        height: 2px;
        background: var(--clay);
      }

      h1 {
        max-width: 760px;
        margin: 0;
        font-size: clamp(48px, 8vw, 118px);
        line-height: 0.88;
        letter-spacing: 0;
      }

      .lead {
        max-width: 620px;
        margin: 30px 0 0;
        color: var(--muted);
        font: 20px/1.55 "Trebuchet MS", Verdana, sans-serif;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 38px;
      }

      .button {
        display: inline-flex;
        min-height: 52px;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 15px 20px;
        border: 2px solid var(--ink);
        border-radius: 0;
        background: var(--ink);
        color: #fff7e8;
        cursor: pointer;
        font: 800 13px/1 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.08em;
        text-decoration: none;
        text-transform: uppercase;
        transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }

      .button:hover,
      .button:focus-visible {
        box-shadow: 6px 6px 0 var(--gold);
        transform: translate(-2px, -2px);
      }

      .button.secondary {
        background: transparent;
        color: var(--ink);
      }

      .card-preview {
        align-self: end;
        min-height: 560px;
        padding: 24px;
        border: 1px solid var(--line);
        background: var(--green-dark);
        color: #fff7e8;
        display: grid;
        align-content: space-between;
        position: relative;
        overflow: hidden;
      }

      .card-preview::before {
        content: "";
        position: absolute;
        inset: 18px;
        border: 1px solid rgba(255, 247, 232, 0.26);
      }

      .fan-card {
        position: relative;
        z-index: 1;
        margin-top: 82px;
        padding: 26px;
        min-height: 244px;
        border: 1px solid rgba(255, 247, 232, 0.35);
        background:
          linear-gradient(145deg, rgba(184, 137, 58, 0.32), transparent 42%),
          rgba(255, 247, 232, 0.08);
        box-shadow: 14px 18px 0 rgba(0, 0, 0, 0.18);
      }

      .fan-card strong {
        display: block;
        font-size: 34px;
        line-height: 0.95;
      }

      .fan-card span {
        display: block;
        margin-top: 74px;
        font: 800 13px/1 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.14em;
      }

      .status-strip {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 12px;
        font: 14px/1.45 "Trebuchet MS", Verdana, sans-serif;
      }

      .status-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid rgba(255, 247, 232, 0.24);
        padding-top: 12px;
      }

      .section {
        display: grid;
        grid-template-columns: 0.8fr 1.2fr;
        gap: 28px;
        margin-top: 28px;
        align-items: start;
      }

      .section-copy {
        padding: 30px 0;
      }

      .section-copy h2 {
        margin: 0;
        font-size: clamp(34px, 5vw, 68px);
        line-height: 0.94;
      }

      .section-copy p {
        color: var(--muted);
        font: 18px/1.55 "Trebuchet MS", Verdana, sans-serif;
      }

      .form-panel {
        border: 1px solid var(--line);
        background: rgba(255, 250, 240, 0.9);
        padding: clamp(20px, 3vw, 34px);
      }

      form {
        display: grid;
        gap: 16px;
      }

      .fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      label {
        display: grid;
        gap: 7px;
        color: var(--green-dark);
        font: 800 12px/1.2 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      label.full {
        grid-column: 1 / -1;
      }

      input,
      textarea {
        width: 100%;
        min-height: 48px;
        border: 1px solid rgba(32, 32, 29, 0.24);
        border-radius: 0;
        background: #fffdf8;
        color: var(--ink);
        font: 16px/1.35 "Trebuchet MS", Verdana, sans-serif;
        padding: 12px;
      }

      textarea {
        min-height: 94px;
        resize: vertical;
      }

      input:focus,
      textarea:focus {
        outline: 3px solid rgba(184, 137, 58, 0.34);
        border-color: var(--gold);
      }

      input[type="file"] {
        padding: 10px;
      }

      .notice {
        min-height: 48px;
        border: 1px solid var(--line);
        padding: 13px 14px;
        color: var(--muted);
        background: rgba(46, 93, 79, 0.06);
        font: 15px/1.4 "Trebuchet MS", Verdana, sans-serif;
      }

      .notice.success {
        color: var(--green-dark);
        border-color: rgba(46, 93, 79, 0.38);
        background: rgba(46, 93, 79, 0.12);
      }

      .notice.error {
        color: #7f2f24;
        border-color: rgba(183, 93, 63, 0.45);
        background: rgba(183, 93, 63, 0.1);
      }

      .steps {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr 1fr;
        gap: 12px;
        margin-top: 28px;
      }

      .step {
        border-top: 3px solid var(--ink);
        padding: 16px 0 0;
        font: 16px/1.45 "Trebuchet MS", Verdana, sans-serif;
      }

      .step b {
        display: block;
        margin-bottom: 8px;
        font: 800 12px/1 "Trebuchet MS", Verdana, sans-serif;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      @media (max-width: 860px) {
        .nav,
        .nav-links {
          align-items: flex-start;
          flex-direction: column;
        }

        .hero,
        .section,
        .steps,
        .fields {
          grid-template-columns: 1fr;
        }

        .headline,
        .card-preview {
          min-height: auto;
        }

        .fan-card {
          margin-top: 24px;
        }

        h1 {
          font-size: clamp(46px, 17vw, 78px);
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <nav class="nav" aria-label="Primary">
        <div class="brand"><span class="mark">JM</span><span>Jim Newman Portal</span></div>
        <div class="nav-links">
          <a href="#register">Register</a>
          <a href="/api/trpc/ping">System Check</a>
        </div>
      </nav>

      <section class="hero" aria-labelledby="portal-title">
        <div class="headline">
          <p class="eyebrow">Official fan access desk</p>
          <h1 id="portal-title">Jim Newman Portal</h1>
          <p class="lead">A focused intake portal for fan registration, verification review, and Bronze Fan Card activation.</p>
          <div class="hero-actions">
            <a class="button" href="#register">Start Registration</a>
            <a class="button secondary" href="/api/trpc/ping">Check API</a>
          </div>
        </div>

        <aside class="card-preview" aria-label="Bronze Fan Card preview">
          <div class="fan-card">
            <strong>Bronze<br />Fan Card</strong>
            <span>JM-XXXX-XXXX</span>
          </div>
          <div class="status-strip">
            <div class="status-row"><span>Registration</span><b>Open</b></div>
            <div class="status-row"><span>Verification</span><b>Required</b></div>
            <div class="status-row"><span>Activation</span><b>After approval</b></div>
          </div>
        </aside>
      </section>

      <section class="section" id="register" aria-labelledby="register-title">
        <div class="section-copy">
          <h2 id="register-title">Register for access.</h2>
          <p>Submit the details needed to create a Jim Newman fan profile. Approved registrations receive an activated card after review.</p>
          <div class="steps" aria-label="Portal process">
            <div class="step"><b>01 Apply</b>Enter profile and contact details.</div>
            <div class="step"><b>02 Review</b>Documents are checked by the admin desk.</div>
            <div class="step"><b>03 Activate</b>The fan card is activated after approval.</div>
          </div>
        </div>

        <div class="form-panel">
          <form id="fan-form">
            <div class="fields">
              <label>
                Full name
                <input name="fullName" autocomplete="name" required minlength="2" maxlength="100" />
              </label>
              <label>
                Instagram username
                <input name="instagramUsername" autocomplete="username" required maxlength="50" />
              </label>
              <label>
                Email
                <input type="email" name="email" autocomplete="email" required />
              </label>
              <label>
                Phone
                <input name="phone" autocomplete="tel" required minlength="5" maxlength="20" />
              </label>
              <label>
                Date of birth
                <input type="date" name="dateOfBirth" required />
              </label>
              <label>
                ID document
                <input type="file" name="idDocument" accept="image/png,image/jpeg" />
              </label>
              <label class="full">
                Address
                <textarea name="address" autocomplete="street-address" required minlength="5"></textarea>
              </label>
              <label class="full">
                Face capture
                <input type="file" name="faceCapture" accept="image/png,image/jpeg" />
              </label>
            </div>
            <div class="notice" id="form-status" role="status">Ready to submit a Jim Newman fan registration.</div>
            <button class="button" type="submit">Submit Registration</button>
          </form>
        </div>
      </section>
    </main>

    <script>
      const form = document.querySelector("#fan-form");
      const statusBox = document.querySelector("#form-status");

      function setStatus(message, type) {
        statusBox.textContent = message;
        statusBox.className = "notice" + (type ? " " + type : "");
      }

      function fileToBase64(file) {
        if (!file) return Promise.resolve(undefined);
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsDataURL(file);
        });
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;
        setStatus("Submitting registration...", "");

        try {
          const data = new FormData(form);
          const idDocument = await fileToBase64(data.get("idDocument"));
          const faceCapture = await fileToBase64(data.get("faceCapture"));
          const payload = {
            fullName: String(data.get("fullName") || ""),
            instagramUsername: String(data.get("instagramUsername") || ""),
            email: String(data.get("email") || ""),
            phone: String(data.get("phone") || ""),
            dateOfBirth: String(data.get("dateOfBirth") || ""),
            address: String(data.get("address") || ""),
            idDocument,
            faceCapture,
          };

          const response = await fetch("/api/trpc/fan.register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ json: payload }),
          });

          const result = await response.json();
          if (!response.ok || result.error) {
            throw new Error(result.error && result.error.message ? result.error.message : "Registration failed");
          }

          const fanId = result.result && result.result.data && result.result.data.json
            ? result.result.data.json.fanId
            : "assigned";
          form.reset();
          setStatus("Registration submitted. Fan ID: " + fanId, "success");
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Registration failed", "error");
        } finally {
          submitButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`;

app.get("/", (c) => c.html(portalHtml));
app.get("/portal", (c) => c.html(portalHtml));
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/uploads/*", async (c) => {
  const filePath = path.join(process.cwd(), c.req.path);
  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".pdf": "application/pdf",
    }[ext] || "application/octet-stream";
    return new Response(file, { headers: { "Content-Type": contentType } });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
