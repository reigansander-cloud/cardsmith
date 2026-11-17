# Moving CardSmith off Base44

The app now runs as a static site on **GitHub Pages**. Its data, logins, live
updates and file uploads are on **Supabase** (free plan). Do these steps in
order. Plan on about an hour, most of it clicking through dashboards.

> **Order matters:** export your data from Base44 (step 4) *before* you swap
> the old site for the redirect (step 8).

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**
   (Free plan is fine). Pick a region near you and save the database password
   somewhere.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql` and
   click **Run**. It should finish with "Success. No rows returned". (Running
   it again later is safe.)
3. Go to **Project Settings → API**. Keep this tab open; you'll need:
   - the **Project URL**
   - the **anon / publishable** key (safe to publish; it goes into the website)
   - the **service_role / secret** key (private; only for the import script)

## 2. Set up logins

In **Authentication**:

1. **Sign In / Providers → Email**: leave it on, with **Confirm email** on.
2. **Emails → Confirm signup** template: the sign-up screen asks for a
   6-digit code, so the email has to include it. Replace the body with
   something like:
   ```html
   <h2>Your CardSmith code</h2>
   <p>Enter this code to finish creating your account: <strong>{{ .Token }}</strong></p>
   ```
   Also check that **Email OTP length** (under Sign In / Providers → Email) is **6**.
3. **URL Configuration**:
   - **Site URL**: your new site, e.g. `https://YOUR-NAME.github.io/cardsmith/`
   - **Redirect URLs**: add `https://YOUR-NAME.github.io/cardsmith/**` and
     `http://localhost:5173/**`
4. *(Optional) Google sign-in*: **Sign In / Providers → Google**. Follow the
   instructions there to create a Google OAuth client and paste its ID and
   secret.
5. *(Recommended once real people use it)*: Supabase's built-in email
   sender only allows a few emails per hour. Under **Emails → SMTP settings**
   you can plug in a free sender (Resend, Brevo, …) so sign-up codes and
   password resets don't get held up.

**Passwords don't carry over from Base44** (Base44 never hands them out).
Returning players sign in with Google, or click *Create one* and use the
**same email** as before. They automatically get their old account back:
same id, decks, comments and play preferences. The login page tells them
this.

## 3. Put the code on GitHub and turn on Pages

1. Create a new GitHub repository (e.g. `cardsmith`) and push this folder to
   its `main` branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → Variables** tab →
   **New repository variable**, twice:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
4. **Actions** tab → *Deploy to GitHub Pages* → **Run workflow** (it also runs
   on every push to `main`). After about a minute the site is at
   `https://YOUR-NAME.github.io/cardsmith/`.

The workflow works out the sub-path from the repo name. If you use a custom
domain, add a `public/CNAME` file with the domain in it (or set a `BASE_PATH`
variable to `/`).

## 4. Export your data from Base44

1. Open the **old** site and log in as an admin.
2. Open the browser console (F12 → Console), paste all of
   `migration/export-from-base44.js` and press Enter.
3. It lists each table and then downloads `cardsmith-export.json`. Move that
   file into this project's `migration/` folder. It's in `.gitignore`, so it
   won't be committed.

## 5. Import it into Supabase

On your computer, in this folder:

1. Create `migration/.env` (also git-ignored) containing:
   ```
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=the-service_role-secret-key
   ```
2. Run:
   ```
   npm install
   npm run import-data
   ```
   This keeps every record's id and dates, so all links between folders,
   entries, decks and games stay intact. It also copies every file you
   uploaded on Base44 into Supabase storage and updates the links. It's safe
   to run again, for example after a fresh export just before switching over.

## 6. Move the built-in images off Base44

A few images and a font are hard-coded in the source and still load from
Base44's servers (cost icons, banners, the Caesar Dressing font). Run:

```
npm run localize-assets
```

Then commit and push the changed files. GitHub rebuilds the site.

## 7. Try it

Open the new site, create an account with your own email (or Google), and
check your folders, decks and rules. Then play a quick Play Clans game with
two browser windows (one of them private/incognito, as a second user).

To run it on your computer instead: copy `.env.example` to `.env.local`, fill
in the two values and run `npm run dev`.

## 8. Point the old site at the new one

In the **old Base44 project**, replace `src/App.jsx` with
`base44-redirect/App.jsx` and set `NEW_SITE` at the top. Anyone opening an
old link is taken to the same page on the new site.

---

## Good to know

- **Free plan pausing:** a free Supabase project is paused after about a week
  with no activity. You restore it with one click in the dashboard, or avoid
  it with the Pro plan.
- **Who can see what:** same as before. Anyone signed in can read and edit
  everything, and signed-out visitors see nothing. Each person can only
  change their own profile; admins can change anyone's. The first person to
  sign in to an empty project becomes an admin. To make someone else an admin,
  open **Table Editor → records**, find their `User` row and set
  `"role": "admin"` in its data.
- **Where things live:** every Base44 table is still there under the same
  name, as rows in one `records` table (column `entity`). The old field
  descriptions are in `docs/entities/`.
