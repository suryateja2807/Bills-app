# Bills — GST Invoice & Quotation Maker

A free, local, no-signup web app for creating and customizing **GST tax invoices** and **sales quotations**. Everything runs in the browser — no backend, no database, no account. Drafts are saved to your browser's `localStorage`, and finished documents export straight to PDF.

**Live demo:** enable GitHub Pages (see below) and it'll be at `https://<your-username>.github.io/<repo-name>/`

## Features

- Toggle between **Tax Invoice** and **Quotation** — labels, numbering, and fields adjust automatically
- Seller & buyer details, including GSTIN and state (for GST purposes)
- Automatic **CGST/SGST vs IGST** split based on whether seller and buyer states match
- Multiple line items with HSN/SAC code, quantity, rate, and per-item GST slab (0/0.25/3/5/12/18/28%)
- Discount (flat or %), shipping/other charges, notes, terms & conditions, bank details
- Logo upload
- Live preview styled as a real printable document
- Amount automatically spelled out in words
- **Download as PDF** (via jsPDF + html2canvas, loaded from CDN)
- **Send it**: one click downloads the PDF and opens a pre-filled email (or WhatsApp message) so you just drag the PDF in and hit send — plus a "copy summary" button for pasting anywhere
- **Save/load draft** locally in your browser — nothing leaves your machine
- Fully responsive, works on mobile

## Tech

Plain **HTML / CSS / JavaScript** — no framework, no build step, no `npm install`. Two third-party libraries are loaded from a CDN only when you click "Download PDF":

- [jsPDF](https://github.com/parallax/jsPDF)
- [html2canvas](https://github.com/niklasvh/html2canvas)

## Run it locally

Just open `index.html` in a browser. Or serve it (recommended, so the fonts/CDN scripts behave the same as in production):

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push this folder to a new GitHub repository.
2. Go to **Settings → Pages** in your repo.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save. Your app will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Sign-in setup (Firebase Authentication — email/password + Google)

The app now shows a real sign-in screen — email/password and "Continue with Google" — instead of a shared passcode. Each person creates their own account with their own password; nobody can see or reset anyone else's.

**This requires a one-time, free setup on your part** (about 10 minutes):

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (free "Spark" plan — no credit card needed).
2. In your project, go to **Build → Authentication → Get started**.
3. Under **Sign-in method**, enable:
   - **Email/Password**
   - **Google** (it'll ask for a support email — use your own)
4. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **`</>`** (web) icon → register an app (any nickname) → it'll show a `firebaseConfig` object.
5. Copy that object's values into `FIREBASE_CONFIG` near the top of `script.js`, replacing the placeholder `"YOUR_API_KEY"` etc.
6. Still in the Firebase console, go to **Authentication → Settings → Authorized domains** and add your GitHub Pages domain (e.g. `suryateja2807.github.io`) — Google sign-in will fail without this step.
7. Commit and push all 4 files — GitHub Pages redeploys automatically.

**Is this "safe to expose publicly"?** Yes — the `FIREBASE_CONFIG` values (API key, project ID, etc.) are meant to be public; they identify your project, they don't grant access on their own. Firebase controls actual access with its own security rules, separate from this config being visible in your source code.

**What Firebase does and doesn't give you:** real per-person accounts, password reset emails (Firebase handles this automatically if you enable it in the console), and Google login. It does **not** give you an admin dashboard of "who generated which bill" inside this app — that would need a database layer on top, which is a bigger addition. For now, everyone who signs in gets the same tool; sign-in controls *who can get in*, not what they can do once inside.

**For genuine stronger access control on top of this** (e.g. only letting specific pre-approved emails in, not anyone who signs up): that needs a small addition — either a Firestore database with an "allowed users" list checked after login, or Firebase's built-in email allow-list features. Ask if you want this built next.

## Customizing

- **Colors / fonts** — all design tokens are CSS variables at the top of `style.css` (`:root`), so re-theming is a matter of changing a handful of hex values and font names.
- **GST slabs** — edit the `GST_SLABS` array in `script.js`.
- **States list** — edit `INDIAN_STATES` in `script.js` if you need union territory codes updated or want to localize for a different country's tax system.
- **Currency** — the currency dropdown in the form (`#currency`) can be extended with more options.

## Limitations / notes

- This is a document generator, not accounting software — it doesn't file GST returns, validate GSTIN checksums, or maintain a ledger of past invoices beyond the single locally-saved draft.
- PDF export renders the on-screen preview to an image and places it in the PDF — this keeps styling pixel-perfect but means the PDF text isn't selectable. If you need selectable text, printing the preview instead (`Ctrl/Cmd + P`) and choosing "Save as PDF" from the browser's print dialog is an alternative — the print stylesheet in `style.css` already hides the editor panel for that case.
- No data is sent anywhere. All calculations and storage happen entirely client-side.

## License

MIT — do whatever you'd like with it.
