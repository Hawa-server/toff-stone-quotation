# Toff Stone Quotation

An installable app (PWA) for making glazing quotations on a laptop or an Android phone. It works offline once installed.

- **Company details** (name, phone, WhatsApp, email, location, logo, terms) are typed once and saved on the device.
- **Client details**, then:
  - **Glass:** one card. Each glass (description and size unit: mm, cm, inches or feet) goes to one or more places ("where it goes", e.g. Bathroom), and each place has its own sizes: width × height, quantity and the owner's own price. **+ Add size** adds a size to that place; **+ Add where it goes** adds another place for that glass; **+ Add another glass** adds the next glass.
  - **Accessories:** cards added with **+ Add accessory**: code, description, qty, per (pcs, pairs, length…), rate
- Labour, discount (% or GH₵), deposit and balance.
- **View quotation** shows the quotation sheet; **Print / Save PDF** prints it on A4 or saves it as a PDF.
- **Send on WhatsApp** sends the quotation as a picture through the phone's share menu (on a laptop it saves the picture and opens the client's chat). **Save as picture** just saves it.
- **Save quotation** keeps it in **Saved**, where it can be searched, opened again or deleted.

## Files

| File | What it does |
|---|---|
| `index.html` | The page: forms, quotation sheet, saved list |
| `styles.css` | How it looks, including the print layout |
| `app.js` | All the logic: cards, totals in pesewas, the sheet, saving, WhatsApp |
| `manifest.webmanifest` | Name, colours and icons, so it can be installed |
| `sw.js` | Service worker: keeps a copy of the app on the device so it opens offline |
| `icons/` | The Toff Stone logo (`logo.png`, `mark.png`) and the app icons made from it |

No build step and no server code: it's plain HTML, CSS and JavaScript.

## Put it online (free, with Vercel)

A PWA must be served over **https** to be installable, so it needs hosting. Vercel's free plan is enough.

**Option A: drag and drop**
1. Sign in at vercel.com.
2. Add New → Project → deploy the `toffstone-quotation` folder (or use the Vercel CLI: `npx vercel` inside the folder).
3. Vercel gives you an address like `toffstone-quotation.vercel.app`.

**Option B: from GitHub (better for updates)**
1. Create a GitHub repository and push this folder to it.
2. In Vercel: Add New → Project → import the repository. Framework preset: **Other**. No build command, output directory `.`
3. Every push to `main` updates the app.

## Install it

- **Android (Chrome):** open the address, then tap **Install app** in the app (or the ⋮ menu → **Install app** / **Add to Home screen**).
- **Laptop (Chrome or Edge):** open the address, then click **Install app** in the app, or the install icon at the right of the address bar.

After installing, it opens like a normal app, and works without internet.

## Updating the app

1. Change the files.
2. In `sw.js`, raise `VERSION` (for example `tsq-v1` → `tsq-v2`). Without this, devices keep the old copy.
3. Deploy again. Devices pick up the new version the next time the app opens with internet.

## Good to know

- Quotations are saved **on each device separately**. A quotation saved on the phone doesn't appear on the laptop. (Syncing between devices would need a backend and a login; it can be added later.)
- Clearing the browser's data for the site deletes the saved quotations. Anything important should also be saved as a PDF or sent on WhatsApp.
- Money is worked out in pesewas (whole numbers), so totals don't pick up rounding errors.
- Test locally with any static server, for example `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.
