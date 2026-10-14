# Photo Selector

Share a Google Drive photo shoot with a client as a mobile-friendly gallery. They tap the photos they want edited and submit. The picks are copied into a **"Selected photos by client"** folder inside your Drive folder, ready for Photoshop.

## How it works

1. **Admin** (`/admin`): create a client, paste the Drive folder link, and get a private share link.
2. **Client** (`/g/<token>`): browses the photos (2 or 4 columns on mobile, an automatic grid on desktop), taps ♥ to select, and submits.
3. The admin page shows the picks as thumbnails (click one to open it in Drive) with a "Copy file names" button. With the optional OAuth connection (below), the picks are also copied into `<your folder>/Selected photos by client` in Drive.
4. After editing, send the finals back however you like. Payments and a "final delivery" step are not built yet.

Clients never see Drive URLs. All images are proxied through the app.

## Setup

### 1. Google API key (simplest, public-link mode)

1. Go to <https://console.cloud.google.com/> and create or pick a project.
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **Credentials → Create credentials → API key.** Optionally restrict it to the Google Drive API.
4. Put it in `GOOGLE_API_KEY`.

In Drive, set each client folder's sharing to **Anyone with the link → Viewer**. The app can then list and show the photos, but it can't write to your Drive, so picks are kept in the app.

### 1b. Optional: Google OAuth (private folders + copy into Drive)

1. In the same project: **OAuth consent screen**: user type *External*, add yourself as a **Test user** (publish to *In production* when deployed, or the login expires after 7 days).
2. **Credentials → Create credentials → OAuth client ID → Web application.** Add the redirect URI `<APP_URL>/api/google/callback`.
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, then click **Connect Google Drive** in the admin.

This asks for the `drive` scope so it can read private folders and write "Selected photos by client". Once connected it takes over from the API key.

### 2. Configure and run

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Open <http://localhost:3000/admin>, sign in with `ADMIN_PASSWORD`, click **Connect Google Drive**, then **+ New client**.

Data (clients, selections, the Google token) is stored in Postgres via `DATABASE_URL`; tables are created automatically on first use. Keep the connection string private.

For local development use any Postgres (for example `postgres://postgres:postgres@localhost:5432/photos`, with `PGSSLMODE=disable` for non-local hosts without SSL).

## Deploying to Render

1. Create a free Postgres database (Neon or Supabase free tiers don't expire; Render's free Postgres does after 30 days) and copy its connection string.
2. New → Blueprint in Render, select this repo, and fill in `DATABASE_URL`, `ADMIN_PASSWORD`, `GOOGLE_API_KEY`, `APP_URL`. (OAuth variables are optional.)
3. Share each client folder as *Anyone with the link* and create the client in `<APP_URL>/admin`.

## Notes

- Only image files in the folder are shown (JPEG, PNG, HEIC and similar). RAW files that Drive can't thumbnail won't appear.
- Subfolders inside the client folder are ignored.
- "Delete client" removes the share link and record only. Nothing in Drive is touched.
- "Reopen for client" lets a submitted client change their picks. Submitting again re-copies; photos already in the Selected folder are skipped.
- Submitting copies files while the client waits. For very large selections, host this somewhere without a short request timeout (a normal Node host or VPS).
