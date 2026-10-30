-- =====================================================================
-- WNP Enterprise – UPDATE 2: multi-page site, blog, reviews, pages
-- Run ONCE in Supabase > SQL Editor > New query > paste all > Run.
-- Safe to run again (it skips anything that already exists).
-- =====================================================================

-- 1) Extra product + design fields -----------------------------------
alter table public.products add column if not exists specs text;            -- one spec per line
alter table public.products add column if not exists sizes text;            -- one size per line, in cm: 8 x 8 x 14
alter table public.products add column if not exists meta_description text; -- Google description (~150 characters)
alter table public.products add column if not exists image_alts text[] not null default '{}';
alter table public.designs  add column if not exists image_alts text[] not null default '{}';

-- 2) Pages (About, Shipping, Terms, country pages ...) ----------------
create table if not exists public.pages (
  slug             text primary key,
  title            text not null,
  nav_label        text,
  meta_description text,
  body             text,              -- written in simple Markdown
  is_published     boolean not null default true,
  sort_order       integer not null default 0,
  updated_at       timestamptz not null default now()
);

-- 3) Blog posts --------------------------------------------------------
create table if not exists public.blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  title            text not null,
  excerpt          text,
  body             text,              -- simple Markdown
  cover_image      text,
  cover_alt        text,
  category         text,
  product_slugs    text[] not null default '{}',   -- related box styles
  meta_description text,
  is_published     boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists blog_posts_pub_idx on public.blog_posts (is_published, published_at desc);

-- 4) Reviews -------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  brand         text,
  country       text,
  rating        integer not null default 5 check (rating between 1 and 5),
  text          text not null,
  photo         text,
  product_slug  text,
  source        text not null default 'admin',  -- 'admin' or 'customer'
  query_id      uuid,
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reviews_pub_idx on public.reviews (is_published, created_at desc);

-- Review request links sent to buyers after an order is won
create table if not exists public.review_requests (
  token       text primary key,
  query_id    uuid,
  name        text,
  email       text,
  product     text,
  product_slug text,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

-- updated_at triggers
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();
drop trigger if exists blog_touch on public.blog_posts;
create trigger blog_touch before update on public.blog_posts for each row execute function public.touch_updated_at();
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

-- 5) Security rules -----------------------------------------------------
alter table public.pages           enable row level security;
alter table public.blog_posts      enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_requests enable row level security;

drop policy if exists "public read pages"  on public.pages;
create policy "public read pages"  on public.pages for select using (is_published or public.is_admin());
drop policy if exists "admins write pages" on public.pages;
create policy "admins write pages" on public.pages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read posts"  on public.blog_posts;
create policy "public read posts"  on public.blog_posts for select using (is_published or public.is_admin());
drop policy if exists "admins write posts" on public.blog_posts;
create policy "admins write posts" on public.blog_posts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read reviews"  on public.reviews;
create policy "public read reviews"  on public.reviews for select using (is_published or public.is_admin());
drop policy if exists "admins write reviews" on public.reviews;
create policy "admins write reviews" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- review_requests: only admins can see them; the website API uses the service key
drop policy if exists "admins read requests" on public.review_requests;
create policy "admins read requests" on public.review_requests for select using (public.is_admin());

-- 6) New website settings -----------------------------------------------
update public.site_settings set label = 'UK address' where key = 'address';
insert into public.site_settings (key, label, grp, sort_order, value) values
  ('us_address',       'USA address',                                   'Contact', 4,  '2335 Broadway, Astoria, NY 11106, United States'),
  ('phone',            'Phone number to show (empty = WhatsApp number)', 'Contact', 5,  ''),
  ('booking_url',      'Call booking link, e.g. Calendly (empty = hidden)', 'Contact', 6, ''),
  ('ga_id',            'Google Analytics ID (G-XXXXXXX, empty = off)',  'Google',  40, ''),
  ('gsc_verification', 'Google Search Console verification code',        'Google',  41, '')
on conflict (key) do nothing;

-- New main heading, as the review suggests (only if it is still the old one)
update public.site_settings
   set value = 'Custom Luxury Rigid Boxes and *Perfume Packaging*'
 where key = 'hero_title' and (value is null or value = '' or value = 'Packaging that makes your brand feel *premium*');

-- 7) Starting pages ---------------------------------------------------------
insert into public.pages (slug, title, nav_label, meta_description, sort_order, is_published, body) values
('rigid-boxes', 'Custom Rigid Boxes', 'Rigid Boxes',
 'Custom rigid boxes made to your size, colour and logo, from 50 pieces. Magnetic, drawer, lid and base, book-style and display boxes.', 1, true,
$b$Rigid boxes are strong, premium boxes made from thick board wrapped in printed or textured paper. They do not fold flat, which is why they feel solid in the hand and protect what is inside.

Every box we make is built to your size, colour and logo finish, from **50 pieces per design**.

## Why brands choose rigid boxes

- **Strength:** thick board keeps its shape in transit and on the shelf.
- **Premium feel:** wrapped paper, foil and embossing make the first impression.
- **Reusable:** customers keep rigid boxes, so your brand stays in their home.

Choose a box style below to see its designs.$b$),

('perfume-boxes', 'Perfume Boxes', 'Perfume Boxes',
 'Custom perfume boxes with inserts made for your bottle. Magnetic, double-door and lid and base styles, from 50 pieces.', 2, true,
$b$A perfume box has one job: make the bottle look as good as it smells. We build each box around your bottle, with an insert that holds it firmly and a finish that matches your brand.

## What we can add

- Foam, card or velvet inserts cut to your bottle's shape
- Satin or velvet lining for a luxury unboxing
- Gold or silver foil, embossing, debossing and spot UV
- Windows so the bottle shows without opening

Minimum order is **50 pieces per design**. Pick a style below, or send us your bottle size and we will suggest the best fit.$b$),

('samples', 'Order a Paid Sample', 'Samples',
 'Order a paid sample of any custom rigid box to check the size, quality and finish before your bulk order.', 3, true,
$b$Want to check the quality, size and finish before a full order? Order a paid sample of any box style.

## How samples work

1. Tell us the box style, your size and the finishes you want.
2. We confirm the sample price and shipping cost before you pay.
3. We make the sample and send it to you.
4. Once you’re satisfied, we’ll move forward with your bulk order.

## Good to know

- Sample price depends on size, style and finishes, and is higher per piece than bulk because it is made individually.
- Sample shipping is charged separately, based on your country.
- Minimum bulk order after the sample is **50 pieces**. The higher your quantity, the lower the price per box.$b$),

('about', 'About WNP Enterprise', 'About',
 'WNP Enterprise Ltd is a UK-registered company supplying custom luxury rigid boxes to perfume, beauty, gift and retail brands.', 4, true,
$b$WNP Enterprise Ltd is a UK-registered company (Company No. 16012866) supplying custom luxury rigid boxes and perfume packaging to brands in the UK, USA, Canada and Europe.

We work with perfume houses, beauty and gift brands, and small businesses launching their first product. Our low minimum of **50 pieces per design** means a new brand can have premium packaging without ordering thousands of boxes.

## How we work

- **One point of contact** from your first message to delivery.
- **Made to your size:** every box is built around your product.
- **Checked before it ships:** we confirm the design with you first, and paid samples are available if you want to see it in hand.

## Our offices

We have offices in the United Kingdom and the United States. You will find both addresses at the bottom of every page.$b$),

('shipping', 'Shipping & Delivery', 'Shipping',
 'Delivery of custom rigid boxes to the UK, USA, Canada and Europe. What is included in your quote, and how samples are shipped.', 5, true,
$b$We deliver custom boxes to the **United Kingdom, the United States, Canada and Europe**.

## Bulk orders

Delivery to your door is included in every bulk quote. Your quote shows the production time and the delivery time for your country before you confirm.

## Samples

Sample shipping is charged separately, based on your country. We confirm the cost before you pay.

## United States and Canada

Your quote states whether import duties and taxes are included, so there are no surprises when the boxes arrive. Box sizes can be given in inches or centimetres.

## Packing

Every order is export-packed in strong outer cartons so the boxes arrive in the same condition they left.$b$),

('uk', 'Custom Rigid Boxes UK', null,
 'Custom luxury rigid boxes and perfume boxes for UK brands, from 50 pieces. UK-registered company in Wolverhampton.', 10, true,
$b$WNP Enterprise Ltd is a UK-registered company based in Wolverhampton, supplying custom rigid boxes and perfume packaging to brands across England, Scotland, Wales and Northern Ireland.

## Why UK brands work with us

- **Low minimum:** from 50 pieces per design.
- **Made to your size:** magnetic, drawer, lid and base, book-style and display boxes.
- **Premium finishes:** gold foil, embossing, spot UV, soft-touch and velvet inserts.
- **Delivered to your door:** included in every bulk quote.

Send your box size, colours and quantity and we will reply within 24 hours.$b$),

('usa', 'Custom Rigid Boxes USA', null,
 'Custom luxury rigid boxes and perfume boxes for US brands, from 50 pieces. Office in Astoria, New York.', 11, true,
$b$We supply custom rigid boxes and perfume packaging to brands across the United States, with an office in Astoria, New York.

## Why US brands work with us

- **Low minimum:** from 50 pieces per design, ideal for indie perfume and beauty launches.
- **Made to your size:** give us your measurements in inches and we build the box around your product.
- **Premium finishes:** gold foil, embossing, spot UV, soft-touch and custom foam or velvet inserts in the color you choose.
- **Clear delivery terms:** your quote states the delivery time and whether import duties are included.

Send your box size, colors and quantity and we will reply within 24 hours.$b$),

('canada', 'Custom Rigid Boxes Canada', null,
 'Custom luxury rigid boxes and perfume boxes for Canadian brands, from 50 pieces, delivered across Canada.', 12, true,
$b$We supply custom rigid boxes and perfume packaging to brands across Canada, from Toronto and Montreal to Vancouver.

## Why Canadian brands work with us

- **Low minimum:** from 50 pieces per design.
- **Made to your size:** in inches or centimeters, built around your product.
- **Premium finishes:** gold foil, embossing, spot UV, soft-touch and custom inserts in the color you choose.
- **Clear delivery terms:** your quote states the delivery time and whether import duties are included.

Send your box size, colors and quantity and we will reply within 24 hours.$b$),

('privacy', 'Privacy Policy', 'Privacy',
 'How WNP Enterprise Ltd collects, uses and protects the details you send through this website.', 20, true,
$b$## Who we are

WNP Enterprise Ltd, registered in England & Wales (Company No. 16012866), Unit 5, Industrial Estate, Wednesfield Way, Well Lane, Wolverhampton WV11 1XP, United Kingdom.

## What we collect

When you send a quote, sample, review or contact form, we collect your name, email, contact number (if given), company or brand, country, and the box details you write. We also record the page you sent it from and your approximate location (country and city), so we can reply in the right way.

## Why we use it

- To reply to your enquiry and send you a quote.
- To process and deliver your sample or order.
- To keep business and accounting records.

We do not sell your details to anyone.

## Who handles it

Your messages are stored in our own enquiry system, hosted by Supabase and Vercel, and emailed to our team. If you contact us on WhatsApp, WhatsApp's privacy policy also applies. We share delivery details with couriers only when you place an order.

## Cookies and analytics

If we turn on Google Analytics, it only runs after you accept it in the cookie notice. It tells us which pages are visited, without identifying you.

## How long we keep it

Enquiries that do not become orders are kept for up to 2 years. Order records are kept for as long as the law requires for business records.

## Your rights

You can ask to see, correct or delete your details, or ask us to stop contacting you, by emailing us.

- **UK and Europe:** you can complain to the UK Information Commissioner's Office at ico.org.uk.
- **United States:** residents of states with privacy laws, such as California, have the right to know, delete and correct their data, and to opt out of any sale of it. We do not sell personal data.
- **Canada:** we handle personal information in line with PIPEDA. You can contact the Office of the Privacy Commissioner of Canada if you have concerns.$b$),

('terms', 'Terms of Sale', 'Terms',
 'Terms of sale for custom rigid box orders from WNP Enterprise Ltd.', 21, false,
$b$DRAFT – please check every line and add your own payment and production terms before publishing.

## Quotes

Every quote is based on the size, materials, finishes and quantity you send. The final price is confirmed in writing before you pay.

## Design approval

We send the design for your approval before production. Production starts only after you approve it in writing.

## Payment

[Your payment terms: deposit, balance, accepted methods.]

## Production and delivery

The production and delivery times are given in your quote. Delivery is included in bulk quotes; sample shipping is charged separately.

## Custom products

Because every box is made to your design, orders cannot be cancelled once production has started.$b$),

('returns', 'Returns & Damaged Goods', 'Returns',
 'What happens if your custom boxes arrive damaged or do not match the approved design.', 22, false,
$b$DRAFT – please check and complete before publishing.

## If something is wrong

If your boxes arrive damaged, or do not match the design you approved, tell us within [X] days of delivery with photos of the boxes and the outer carton.

## What we do

[What you offer: a reprint of the affected boxes, a partial refund, etc.]

## Custom products

Because every box is made to your own design, we cannot accept returns for a change of mind.$b$)
on conflict (slug) do nothing;

-- 8) More FAQ answers (direct answer first). The two that need your own
--    numbers are added HIDDEN – fill them in and switch them on in the panel.
insert into public.faqs (question, answer, sort_order, is_active)
select v.q, v.a, v.s, v.act from (values
 ('What is a rigid box?',
  'A rigid box is a premium box made from thick board wrapped in printed or textured paper. Unlike a folding carton, it does not fold flat, so it feels solid, protects the product and is often kept by the customer.', 10, true),
 ('Can you make a box for my exact bottle size?',
  'Yes. Every box is made to your size. Send us the height, width and depth of your bottle (in cm or inches), and we build the box and insert around it.', 11, true),
 ('Which finishes can I choose?',
  'You can choose gold or silver foil, embossing, debossing, spot UV, soft-touch lamination, textured or leatherette paper, satin or velvet lining, and foam or card inserts. Finishes can be combined on one box.', 12, true),
 ('What file format do you need for my logo?',
  'A vector file (AI, EPS, SVG or PDF) is best. If you only have a PNG or JPG, send the largest size you have and we will check it before production.', 13, true),
 ('How do paid samples work?',
  'You tell us the box style, size and finishes, we confirm the sample price and shipping before you pay, then we make and send the sample. Once you’re satisfied, we’ll move forward with your bulk order.', 14, true),
 ('How long does production take?',
  'DRAFT – add your numbers: production takes about [X] working days after you approve the design, plus [Y] days for delivery to the UK, USA or Canada.', 15, false),
 ('Do you ship to the USA and Canada with duties paid?',
  'DRAFT – add your answer: yes/no, and what the buyer pays on arrival.', 16, false)
) as v(q, a, s, act)
where not exists (select 1 from public.faqs f where f.question = v.q);

-- 9) Blog drafts (hidden until you publish them in the panel) -------------
insert into public.blog_posts (slug, title, category, excerpt, meta_description, product_slugs, is_published, body) values
('magnetic-box-vs-drawer-box', 'Magnetic box vs drawer box: which is right for your perfume?', 'Box styles',
 'Two of the most popular luxury box styles, compared on unboxing, protection, shelf look and fit for perfume.',
 'Magnetic flip-top box or sliding drawer box for your perfume? A plain comparison of unboxing, protection and shelf look.',
 array['magnetic-flip-top-perfume-box','drawer-box'], false,
$b$Both styles are rigid, premium and made to your size. The difference is how the box opens, and that changes how your customer feels the first time they hold it.

## Magnetic flip-top box

The lid is attached and closes with hidden magnets. It opens with a soft click.

- **Best for:** a single bottle that should look tall and elegant.
- **Unboxing:** one smooth movement, lid up, bottle revealed.
- **Shelf look:** clean front with no visible opening.

## Sliding drawer box

A tray slides out of an outer sleeve, often with a ribbon pull.

- **Best for:** gift sets, a bottle with a sample vial, or several items.
- **Unboxing:** slower and more playful, good for gifting.
- **Shelf look:** the sleeve can carry a different colour or print from the tray.

## Which one to choose

Choose a **magnetic flip-top** for a single hero bottle where the bottle is the star. Choose a **drawer box** when you are packing a set or want a gift-style reveal. Both can take foam, card or velvet inserts cut to your bottle.

Not sure? Send us your bottle size and how you sell it (shelf, online, gift) and we will suggest the best fit.$b$),

('foil-vs-embossing-vs-spot-uv', 'Foil vs embossing vs spot UV: what each finish looks like', 'Finishes',
 'A simple guide to the three most popular logo finishes on luxury boxes, and when to use each.',
 'Gold foil, embossing or spot UV? What each logo finish looks like on a rigid box and when to use it.',
 '{}', false,
$b$Your logo finish is often the first thing a customer touches. Here is what each option does.

## Foil stamping

A thin metallic layer is pressed onto the paper with heat. Gold, silver, rose gold and holographic are common.

- **Looks:** shiny and eye-catching, especially on dark boxes.
- **Use it for:** logos, brand names and fine lines.

## Embossing and debossing

The paper is pressed so the logo stands up (embossing) or sinks in (debossing).

- **Looks:** subtle and tactile, with no extra colour needed.
- **Use it for:** a quiet, high-end look, or combined with foil for depth.

## Spot UV

A clear, glossy coating is printed on selected areas.

- **Looks:** a shine that catches the light against a matte background.
- **Use it for:** patterns, logos and details on soft-touch or matte boxes.

## Combining finishes

The most premium boxes often combine two: **foil + embossing** on the logo, or **spot UV** on a pattern with a foiled name. Tell us the look you want and we will suggest the right mix.$b$),

('how-to-measure-your-bottle-for-a-custom-box', 'How to measure your bottle for a custom box', 'Guides',
 'Three measurements and two tips, so your custom box and insert fit your bottle perfectly.',
 'How to measure a perfume bottle for a custom rigid box and insert: height, width, depth and the cap.',
 array['magnetic-flip-top-perfume-box','double-door-perfume-box'], false,
$b$A box that fits well feels expensive. A box that rattles feels cheap. Here is how to measure so we get it right first time.

## The three measurements

1. **Height:** from the base to the top of the cap.
2. **Width:** the widest point from side to side.
3. **Depth:** the widest point from front to back.

Measure in centimetres or inches, whichever you prefer. We work in both.

## Two tips

- **Measure the cap too.** Many caps are wider than the bottle neck, and the insert needs room for it.
- **Send a photo with a ruler next to the bottle.** It helps us shape the insert cut-out.

## What happens next

We add the right space for the insert and the board thickness, and confirm the outer box size with you before production. If you order a paid sample, you can check the fit in hand.$b$),

('rigid-box-vs-folding-carton', 'Rigid box vs folding carton for a small perfume brand', 'Guides',
 'When a rigid box is worth it for a small brand, and when a folding carton is enough.',
 'Rigid box or folding carton for a small perfume brand? Strength, feel, storage and when each makes sense.',
 '{}', false,
$b$Both are common for perfume. They are built very differently.

## Folding carton

Thin printed card that folds flat, like most supermarket packaging.

- Light and flat to store.
- Good for large runs where packaging cost must stay low.
- Feels lighter in the hand.

## Rigid box

Thick board wrapped in paper. It never folds flat.

- Feels solid and premium the moment it is picked up.
- Protects the bottle better in transit.
- Customers often keep it, so your brand stays in their home.

## Which makes sense for a small brand

If your perfume is a **premium or gift product**, the box is part of what the customer pays for, and a rigid box usually earns its place. With a **minimum of 50 pieces**, you can test a rigid box on a first launch without ordering thousands.

A paid sample is the easiest way to decide: hold it next to your bottle and see how it feels.$b$),

('what-artwork-files-to-send', 'What artwork files to send for your custom box', 'Guides',
 'Which file types work best for logos and print, and how to prepare them.',
 'Which artwork files to send for a custom rigid box: vector logos, PDF, colours and how to prepare them.',
 '{}', false,
$b$Good files mean a sharp logo and no delays. Here is what to send.

## Best: vector files

**AI, EPS, SVG or PDF** made from vector artwork. They scale to any size without going blurry, which matters for foil and embossing.

## Also fine: large image files

A **PNG or JPG** works if it is large and sharp. Send the biggest version you have; we will check it and tell you if it will print cleanly.

## Colours

If your brand has exact colours, send the **Pantone** reference or the colour codes. For foil, just tell us the foil colour (gold, silver, rose gold and so on).

## Fonts

Convert text to outlines, or send the font files, so the lettering stays exactly as designed.

## Not sure?

Send what you have. We check every file before production and send you the design for approval first.$b$),

('perfume-launch-packaging-plan', 'Launching a perfume with 50 to 200 boxes: a step-by-step plan', 'Guides',
 'A simple plan for small brands: from bottle size to finished boxes.',
 'A step-by-step packaging plan for a small perfume launch of 50 to 200 boxes: style, finishes, sample and order.',
 array['magnetic-flip-top-perfume-box','double-door-perfume-box','book-style-box'], false,
$b$A small launch does not need a big packaging order. Here is the plan we suggest for 50 to 200 boxes.

## 1. Fix your bottle

Choose your bottle and cap first. The box is built around them, so measure height, width and depth including the cap.

## 2. Pick a box style

- **Magnetic flip-top** for a single hero bottle.
- **Double-door** for a dramatic reveal.
- **Book-style** for a gift feel.

## 3. Choose one or two finishes

A dark box with a **gold foil** logo is a classic that works for most brands. Add **embossing** for depth if you want it.

## 4. Order a paid sample

Check the fit, colour and finish in your hands before the full run.

## 5. Approve the design and order

We send the final design for approval, then produce and deliver your boxes. Re-order the same design later at any quantity from 50.

Ready to start? Send us your bottle size and quantity through Get a Quote.$b$)
on conflict (slug) do nothing;
