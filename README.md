# Photo Selector

Share a Google Drive photo shoot with a client as a mobile-friendly gallery. They tap the photos they want edited and submit. The picks are copied into a **"Selected photos by client"** folder inside your Drive folder, ready for Photoshop.

## How it works

1. **Admin** (`/admin`): create a client, paste the Drive folder link, and get a private share link.
2. **Client** (`/g/<token>`): browses the photos (2 or 4 columns on mobile, an automatic grid on desktop), taps ♥ to select, and submits.
3. On submit, the selected photos are copied to `<your folder>/Selected photos by client` in Drive. The admin page also lists the file names and shows thumbnails.
4. After editing, send the finals back however you like. Payments and a "final delivery" step are not built yet.

Clients never see Drive URLs. All images are proxied through the app, using your Google account.

## Setup

### 1. Google OAuth client (one-time)

1. Go to <https://console.cloud.google.com/> and create or pick a project.
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **OAuth consent screen**: user type *External*, add yourself as a **Test user**.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Add the authorized redirect URI `http://localhost:3000/api/google/callback`. Add your production URL's callback too once you deploy.
5. Copy the client ID and secret.

The app requests the `drive` scope because it has to read folders you created elsewhere and write the "Selected photos by client" folder.

### 2. Configure and run

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Open <http://localhost:3000/admin>, sign in with `ADMIN_PASSWORD`, click **Connect Google Drive**, then **+ New client**.

Data (clients, selections, the Google token) is stored in `data/app.db`. Back it up and keep it private.

## Notes

- Only image files in the folder are shown (JPEG, PNG, HEIC and similar). RAW files that Drive can't thumbnail won't appear.
- Subfolders inside the client folder are ignored.
- "Delete client" removes the share link and record only. Nothing in Drive is touched.
- "Reopen for client" lets a submitted client change their picks. Submitting again re-copies; photos already in the Selected folder are skipped.
- Submitting copies files while the client waits. For very large selections, host this somewhere without a short request timeout (a normal Node host or VPS).
