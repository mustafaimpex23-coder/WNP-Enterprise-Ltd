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

---

# Update 2 – multi-page website, blog, reviews, pages

## One step you must do (2 minutes)

Supabase → **SQL Editor** → **New query** → paste the whole of `supabase/update-2-multipage.sql` → **Run**.
It adds the Blog, Reviews and Pages tables, the new settings (USA address, phone, booking link, Google codes),
the new product fields (specifications, sizes, Google description, photo descriptions), 11 starting pages,
7 more FAQ answers and 6 blog drafts. It is safe to run twice.

Until you run it, the website still works (products, quote form, FAQ), but the new pages and the
Content tab in the panel show a message asking for this update.

## What changed

- The website is now about 20 separate pages, sent as finished HTML so Google and AI tools can read them:
  Home, one page per box style, Rigid Boxes, Perfume Boxes, Get a Quote, Samples, About, Shipping, FAQ,
  Blog + posts, Reviews, UK / USA / Canada pages, Privacy (Terms and Returns once you publish them).
- `sitemap.xml` and `robots.txt` are made automatically (AI crawlers are allowed).
- Preview links from Vercel are hidden from Google; only the real address is indexed.
- Admin panel → **Content** tab: Blog, Reviews, Pages and Offers.
- Marking a query **Won** offers to send the buyer a one-time review link (by email if Gmail is set up,
  or on WhatsApp). Customer reviews wait for your approval.
- Products now have: full description, specifications, popular sizes (shown in cm and inches),
  a Google description, and a description under each photo.
- Photos uploaded in the panel are saved as smaller WebP files when the browser supports it.
- Google Analytics: paste your ID (G-XXXXXXX) in Website → Google. A cookie notice then appears,
  and Analytics only runs after the visitor accepts.
- Search Console: paste the verification code (or the whole meta tag) in Website → Google.

## Drafts waiting for your details

- Pages **Terms** and **Returns** (Content → Pages): fill the [square brackets], remove the DRAFT line, publish.
- FAQ **How long does production take?** and **Do you ship to the USA and Canada with duties paid?**
  (Website → FAQ): add your numbers, then switch them on.
- 6 blog posts (Content → Blog): read, adjust, publish.

---

# Update 3 – letterheads, job cards and invoices

Run `supabase/update-3-letterheads.sql` once in Supabase → SQL Editor (safe to run twice).

- Admin panel → **Content → Letterheads & invoices**: make a Quotation, Job Card, Proforma Invoice or
  Invoice on the **UK (WNP Enterprise Ltd)** or **USA (Providers LLC)** letterhead. Numbers are automatic
  (WNP-Q-2026-001, PRV-INV-2026-004 …).
- Open any query and press **Create quotation / job card / invoice**: the customer, box and size are filled
  in, and US / Canadian buyers get the USA letterhead and dollars automatically.
- **PDF** downloads it, **Share** sends it straight to WhatsApp from a phone, **Email** sends it to the
  customer with the PDF attached (needs the Gmail app password in Vercel).
- Blank **UK letterhead** / **USA letterhead** PDFs for letters.
- Company names, USA email/phone, default terms and payment details: Website → Contact / Letterheads.
- The website footer and contact section now say "In the UK we operate as WNP Enterprise Ltd" and
  "In the USA we operate as Providers LLC" next to each address.
