# WNP Enterprise – Admin panel setup (about 20 minutes, all free)

## What's in this folder

| File / folder | What it does |
|---|---|
| `index.html` | Your website (updated). It loads products, offers, FAQ and text from the panel, and only shows "Thank you" once the query is really saved. |
| `admin/` | The admin panel: queries, products, photos, offers, website text, alerts, team. Opens at **/admin**. |
| `api/` | The backend. It saves each query, sends a push notification to your phones, emails your team and sends the buyer a confirmation. |
| `supabase/schema.sql` | Sets up the database. You paste it into Supabase once. |
| `package.json` | Tells Vercel which libraries the backend needs. |
| `env-values.txt` | The values to paste into Vercel. Two push keys are already filled in. |

Keep your existing `images/` folder as it is. Put everything above next to it, in the same project you deploy to Vercel. Replace your old `index.html` with the new one.

---

## Step 1: Create the database (Supabase)

1. Go to **supabase.com** and sign in with Google. Click **New project**, name it `wnp-enterprise`, pick the **London** region, and set a database password (save it somewhere).
2. When the project is ready, open **SQL Editor** → **New query**. Paste the **whole** of `supabase/schema.sql` and press **Run**. You should see "Success". This also adds your current 6 box styles, 20 designs and FAQ.
3. Go to **Authentication → Sign In / Providers** and turn **OFF** "Allow new users to sign up", so strangers can't create accounts.
4. Go to **Authentication → URL Configuration**:
   - Site URL: `https://wnpenterprise.vercel.app/admin/`
   - Redirect URLs: add `https://wnpenterprise.vercel.app/admin/`
5. Create your own login: **Authentication → Users → Add user → Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
6. Give yourself admin access. Back in **SQL Editor**, run:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'mustafaimpex23@gmail.com';
   ```
   (Use the same email you used in step 5.) You only do this for yourself. Add your team later from inside the panel.
7. Go to **Project Settings → API Keys** and copy these three values (if you see "Legacy API keys", use those):
   - **Project URL** → `SUPABASE_URL`
   - **anon / public** key → `SUPABASE_ANON_KEY`
   - **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one private)

## Step 2: Gmail app password (for the emails)

The emails are sent from your WNP Gmail (`wnpenterpriseuk@gmail.com`), so buyers see the company name.

1. Sign in to that Gmail and open **myaccount.google.com → Security**. Turn on **2-Step Verification** if it's off.
2. Search for **App passwords** in the search bar at the top, create one named `WNP website` and copy the 16-letter password.

## Step 3: Add the values in Vercel

Open your project on Vercel → **Settings → Environment Variables**. Add every line from `env-values.txt` with your values filled in, then go to **Deployments** and **Redeploy** (or just push the new files).

## Step 4: Use it

1. Open **https://wnpenterprise.vercel.app/admin** and sign in.
2. **Products** → press **Import photos from website** once. This links the photos already in your `images/` folder.
3. **Alerts & Team** → turn on notifications on this device.
   - **iPhone:** open the panel in **Safari** → Share → **Add to Home Screen**. Open **WNP Admin** from the Home Screen, sign in, then turn on notifications (iPhone only allows alerts from the Home Screen app).
   - **Android / laptop (Chrome):** press **Turn on notifications** and allow. Chrome menu → **Install app** makes it a full-screen app.
4. Send a test query from your website. You should get the push alert, the email, and the query in the panel.

## Adding your team
**Alerts & Team → Add team member** (email + password). They sign in at /admin and turn on alerts on their own phone. To send them the query **emails** too, add their address to `NOTIFY_EMAILS` in Vercel, separated by commas, then redeploy.

## Good to know
- Every query is saved in the database **first**. Even if an email fails, nothing is lost.
- Changes in the panel (products, photos, offers, text) show on the website within about 15 seconds.
- If the panel ever can't be reached, the website still works using the built-in backup product list.
- Free limits: Supabase includes 1 GB of photos and 500 MB of data, and Gmail sends about 500 emails a day. That's plenty for this.
- A free Supabase project pauses after **7 days with no activity**. Website visits keep it active. If it ever pauses, press **Restore** in Supabase.
