# Shared Shopping List — GitHub Pages + Google Sheets + Apps Script

This project gives you a shared shopping list with:
- static frontend for GitHub Pages
- Google Sheets as the live data source
- Google Apps Script as the secure write layer
- no API keys or secrets hardcoded in the repository

## What you get
- `index.html`, `styles.css`, `app.js` — the static app
- `apps-script/Code.gs` — full Apps Script backend
- `apps-script/appsscript.json` — Apps Script manifest
- `seed-items.csv` — optional seed data from your current list

## Security model
This repo contains **no secret values**.
Recommended setup:
1. deploy the frontend on a public GitHub repo / GitHub Pages
2. store a shared passphrase in **Apps Script Script Properties**
3. each user types that passphrase into the app once and it stays only in local browser storage

That means:
- public code is safe
- no secret is exposed in the repo
- write access is blocked unless the correct secret is provided

## Step 1 — Create the Google Sheet
1. Create a new Google Sheet
2. Name one sheet `ShoppingList`
3. Put these headers in row 1 exactly:

`rowId | name | quantity | category | notes | purchased | createdAt | updatedAt`

You can also import rows from `seed-items.csv`, but **only into the columns `name, quantity, category, notes`** if you are doing it manually.

## Step 2 — Create Apps Script
1. Open the Google Sheet
2. Go to `Extensions` → `Apps Script`
3. Replace the default `Code.gs` with the contents of `apps-script/Code.gs`
4. Open project settings and enable the `appsscript.json` manifest if needed
5. Replace the manifest with the contents of `apps-script/appsscript.json`

## Step 3 — Add Script Properties
In Apps Script:
1. Go to `Project Settings`
2. Add Script Properties:
   - `SHEET_NAME` = `ShoppingList`
   - `LIST_SHARED_SECRET` = choose-your-own-secret

The secret is optional, but strongly recommended.

## Step 4 — Deploy the Apps Script as a Web App
1. Click `Deploy` → `New deployment`
2. Type: `Web app`
3. Description: `shopping-list-api`
4. Execute as: `Me`
5. Who has access: `Anyone`
6. Deploy
7. Copy the generated Web App URL

If you later change the script, create a new deployment version or redeploy.

## Step 5 — Publish the static app to GitHub Pages
1. Create a public GitHub repo
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
3. In GitHub repo settings, enable GitHub Pages from the main branch root
4. Open the site URL
5. Paste the Apps Script Web App URL into the app settings
6. Enter the shared secret
7. Save settings

## How the frontend works
The frontend calls the Apps Script URL with these actions:
- `list`
- `add`
- `update`
- `toggle`
- `delete`

The write secret is **not** embedded in code.
Each user enters it in the UI.

## Optional: seed the sheet with your current list
Fastest way:
1. Open `seed-items.csv`
2. Copy the data rows
3. Paste them into the Google Sheet under columns:
   - `name`
   - `quantity`
   - `category`
   - `notes`
4. Then either:
   - fill `rowId`, `purchased`, `createdAt`, `updatedAt` manually, or
   - easier: use the app UI to add items fresh

If you want automatic seeding from CSV directly into the correct schema, I can add an Apps Script importer too.

## Collaboration behavior
- both of you see the same live list because the data lives in Google Sheets
- changes are synchronous after refresh
- if you want near-live updates, you can add auto-refresh every few seconds in `app.js`

## Nice next upgrades
- auto-refresh every 5–10 seconds
- category grouping
- user attribution (who checked what)
- archive / restore
- mobile-first PWA installable app
# reshima
