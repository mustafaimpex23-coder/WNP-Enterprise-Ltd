-- =====================================================================
-- WNP Enterprise – Queries backend
-- Paste this whole file into Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- 1) Every query / order request from the website -----------------------
create table if not exists public.queries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  request_type  text,                 -- 'enquiry' | 'order' | 'quote' ...
  product       text,                 -- e.g. Magnetic Flip-Top Perfume Box – Foam Insert
  quantity      integer,
  box_size      text,
  details       text,                 -- colours, finishes, deadline ...

  name          text not null,
  email         text not null,
  phone         text,
  company       text,
  country       text,

  page_url      text,                 -- page the form was sent from
  referrer      text,                 -- where the visitor came from (Google, LinkedIn ...)
  ip            text,
  ip_country    text,                 -- detected by Vercel
  ip_city       text,
  user_agent    text,

  status        text not null default 'new'
                check (status in ('new','contacted','quoted','won','lost','spam')),
  notes         text,
  email_sent    boolean not null default false,
  push_sent     integer not null default 0
);

create index if not exists queries_created_idx on public.queries (created_at desc);
create index if not exists queries_status_idx  on public.queries (status);
create index if not exists queries_email_idx   on public.queries (lower(email));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists queries_touch on public.queries;
create trigger queries_touch before update on public.queries
for each row execute function public.touch_updated_at();

-- 2) Who is allowed into the admin panel --------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3) Phones / laptops that receive push notifications -------------------
create table if not exists public.push_subscriptions (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  device     text,
  created_at timestamptz not null default now()
);

-- 4) Security: only admins can read/edit. The website API writes using
--    the service-role key, which bypasses these rules.
alter table public.queries            enable row level security;
alter table public.admins             enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "admins read queries"   on public.queries;
drop policy if exists "admins update queries" on public.queries;
drop policy if exists "admins delete queries" on public.queries;
create policy "admins read queries"   on public.queries for select using (public.is_admin());
create policy "admins update queries" on public.queries for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete queries" on public.queries for delete using (public.is_admin());

drop policy if exists "admins see admins" on public.admins;
create policy "admins see admins" on public.admins for select using (public.is_admin());

drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions for all
  using (user_id = auth.uid() and public.is_admin())
  with check (user_id = auth.uid() and public.is_admin());

-- 5) Live updates in the panel (new query appears without refresh)
do $$
begin
  alter publication supabase_realtime add table public.queries;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- WEBSITE CONTENT (edited from the admin panel, read by the website)
-- =====================================================================

-- Box styles, e.g. "Magnetic Flip-Top Perfume Box"
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text,                    -- Perfume boxes, Gift boxes ...
  short_desc  text,
  description text,
  min_order   integer default 50,
  badge       text,                    -- "Best seller", "New" ...
  images      text[] not null default '{}',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Designs inside a box style, e.g. "Design 2 – Foam Insert Flip-Top"
create table if not exists public.designs (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  name        text not null,
  description text,
  tags        text[] not null default '{}',   -- Foam insert, Extra protection
  images      text[] not null default '{}',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists designs_product_idx on public.designs (product_id, sort_order);

-- Offers / banners shown on the website
create table if not exists public.offers (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  text        text,
  image       text,
  cta_label   text,
  cta_link    text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Any website text / setting: phone, whatsapp, hero title, about ...
create table if not exists public.site_settings (
  key         text primary key,
  value       text,
  label       text,
  grp         text default 'General',
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs for each row execute function public.touch_updated_at();
drop trigger if exists offers_touch on public.offers;
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.site_settings;
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

alter table public.products      enable row level security;
alter table public.designs       enable row level security;
alter table public.offers        enable row level security;
alter table public.site_settings enable row level security;

-- Public (website visitors) can only READ active content
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select using (is_active or public.is_admin());
drop policy if exists "public read designs" on public.designs;
create policy "public read designs" on public.designs for select using (is_active or public.is_admin());
drop policy if exists "public read offers" on public.offers;
create policy "public read offers" on public.offers for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or public.is_admin());
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select using (true);

-- Admins can add / edit / delete everything
drop policy if exists "admins write products" on public.products;
create policy "admins write products" on public.products for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins write designs" on public.designs;
create policy "admins write designs" on public.designs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins write offers" on public.offers;
create policy "admins write offers" on public.offers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins write settings" on public.site_settings;
create policy "admins write settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- Photo storage (public bucket "media"; only admins upload/delete)
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "public read media"  on storage.objects;
drop policy if exists "admins upload media" on storage.objects;
drop policy if exists "admins update media" on storage.objects;
drop policy if exists "admins delete media" on storage.objects;
create policy "public read media"   on storage.objects for select using (bucket_id = 'media');
create policy "admins upload media" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy "admins update media" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy "admins delete media" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- Starting website settings (edit the values from the panel)
-- Leave a value empty to keep the text that is already in the website.
-- In headings, put a word between *stars* to show it in gold italic.
insert into public.site_settings (key, label, grp, sort_order, value) values
  ('whatsapp',          'WhatsApp number (with country code)', 'Contact', 1, '+44 7394 499329'),
  ('email',             'Contact email',                       'Contact', 2, 'wnpenterpriseuk@gmail.com'),
  ('address',           'Address',                             'Contact', 3, 'Unit 5, Industrial Estate, Wednesfield Way, Well Lane, Wolverhampton WV11 1XP, UK'),
  ('min_qty',           'Minimum order (pieces)',              'Contact', 4, '50'),
  ('announcement',      'Top bar announcement (empty = hidden)', 'Home page', 10, ''),
  ('hero_eyebrow',      'Small line above main heading',       'Home page', 11, 'Luxury Rigid Boxes · From 50 Pieces'),
  ('hero_title',        'Main heading',                        'Home page', 12, 'Packaging that makes your brand feel *premium*'),
  ('hero_subtitle',     'Text under main heading',             'Home page', 13, 'Custom rigid boxes, perfume boxes and display packaging from just 50 pieces, made to your exact size and design and delivered across the UK, USA, Canada and Europe.'),
  ('products_title',    'Products – heading',                  'Sections', 20, 'Choose your box style'),
  ('products_subtitle', 'Products – text',                     'Sections', 21, 'Tap a style to see its designs. Pick the one you like and get a quote, or talk to our team on WhatsApp.'),
  ('offers_title',      'Offers – heading',                    'Sections', 22, 'Current offers'),
  ('why_title',         'Why us – heading',                    'Sections', 23, 'Luxury quality, fair prices'),
  ('why_text',          'Why us – text',                       'Sections', 24, 'WNP Enterprise Ltd is a UK-registered company supplying custom rigid packaging to perfume, beauty, gift and retail brands.'),
  ('contact_title',     'Contact – heading',                   'Sections', 25, 'Have a custom idea?'),
  ('contact_text',      'Contact – text',                      'Sections', 26, 'Tell us about your boxes and we will reply within 24 hours.'),
  ('footer_text',       'Footer – about text',                 'Sections', 27, 'Custom luxury rigid boxes and perfume packaging from 50 pieces, for brands in the UK, USA, Canada and Europe.')
on conflict (key) do nothing;

-- =====================================================================
-- ADD A TEAM MEMBER (run after creating the user in
-- Authentication > Users > Add user, with "Auto confirm" ticked):
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'mustafaimpex23@gmail.com'
--   on conflict do nothing;
--
-- REMOVE A TEAM MEMBER:
--   delete from public.admins where email = 'someone@example.com';
-- =====================================================================

-- =====================================================================
-- STARTING CONTENT – your current 6 box styles, designs and FAQs
-- (only added if not already there; safe to run again)
-- =====================================================================
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('magnetic-flip-top-perfume-box','Magnetic Flip-Top Perfume Box','A tall rigid box with a magnetic lid that flips open to show the bottle.',50,1) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Classic Flip-Top','Clean tall box with a hidden magnetic lid and a fitted base.',array['Magnetic lid','Matte finish']::text[],1),
  ('Foam Insert Flip-Top','Black foam insert with a cut-out that holds the bottle tightly.',array['Foam insert','Extra protection']::text[],2),
  ('Window Flip-Top','A clear window on the lid so the bottle shows without opening.',array['PET window','Retail ready']::text[],3),
  ('Leatherette Flip-Top','Wrapped in textured leather-look paper for a rich, soft feel.',array['Leatherette','Debossed logo']::text[],4),
  ('Satin-Lined Flip-Top','Inside lined with satin or velvet for a luxury unboxing.',array['Satin lining','Gift ready']::text[],5),
  ('Gold Foil Flip-Top','Your logo and lines in shiny gold foil on a dark box.',array['Gold foil','Two-tone']::text[],6)
 ) as v(name,description,tags,sort_order)
where p.slug='magnetic-flip-top-perfume-box' and not exists (select 1 from public.designs d where d.product_id=p.id);
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('double-door-perfume-box','Double-Door Perfume Box','Two panels open from the centre like doors to reveal the bottle.',50,2) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Classic Double-Door','Two equal doors with hidden magnets that open from the middle.',array['Centre opening','Magnets']::text[],1),
  ('Ribbon-Tie Double-Door','Doors close with a satin ribbon bow for gifting.',array['Satin ribbon','Gift style']::text[],2),
  ('Gold Foil Double-Door','Your logo in gold foil on the doors, with a foam insert inside.',array['Gold foil','Foam insert']::text[],3)
 ) as v(name,description,tags,sort_order)
where p.slug='double-door-perfume-box' and not exists (select 1 from public.designs d where d.product_id=p.id);
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('drawer-box','Sliding Drawer Box','A sleeve with a tray that slides out. Great for sets and gifts.',50,3) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Ribbon-Pull Drawer','Tray slides out with a satin ribbon pull on the end.',array['Ribbon pull','Classic']::text[],1),
  ('Thumb-Cut Drawer','A half-moon thumb cut on the sleeve for easy opening.',array['Thumb cut','Minimal']::text[],2)
 ) as v(name,description,tags,sort_order)
where p.slug='drawer-box' and not exists (select 1 from public.designs d where d.product_id=p.id);
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('lid-and-base-box','Two-Piece Lid & Base Box','A classic rigid box with a separate lid. Simple, strong and elegant.',50,4) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Full-Lid Box','Lid covers the full base for a clean, solid look.',array['Full lid','Classic']::text[],1),
  ('Half-Lid Box','Shorter lid that shows part of the base colour.',array['Half lid','Easy open']::text[],2),
  ('Shoulder-Neck Box','Lid sits on a visible inner neck, a top choice for perfume.',array['Shoulder neck','Two-tone']::text[],3)
 ) as v(name,description,tags,sort_order)
where p.slug='lid-and-base-box' and not exists (select 1 from public.designs d where d.product_id=p.id);
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('book-style-box','Book-Style Magnetic Box','Opens from the side like a book and closes with hidden magnets.',50,5) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Classic Book Box','Front flap with hidden magnets, opens like a book cover.',array['Magnetic flap','Classic']::text[],1),
  ('Ribbon Book Box','Ribbon on the flap to open it gently.',array['Ribbon','Gift style']::text[],2),
  ('Foam Insert Book Box','Custom foam inside to hold one or more bottles.',array['Foam insert','Protection']::text[],3)
 ) as v(name,description,tags,sort_order)
where p.slug='book-style-box' and not exists (select 1 from public.designs d where d.product_id=p.id);
insert into public.products (slug,name,short_desc,min_order,sort_order) values ('display-box','Rigid Display Box','Showcase boxes for counters and shelves so customers see the product.',50,6) on conflict (slug) do nothing;
insert into public.designs (product_id,name,description,tags,sort_order)
select p.id, v.name, v.description, v.tags, v.sort_order from public.products p,
 (values
  ('Counter Display','Stands on the counter and holds several bottles upright.',array['Counter','Multi-bottle']::text[],1),
  ('Tray Display','Open tray with slots for bottles or testers.',array['Slots','Testers']::text[],2),
  ('Open-Front Showcase','Open front with a raised back panel for your branding.',array['Open front','Branding panel']::text[],3)
 ) as v(name,description,tags,sort_order)
where p.slug='display-box' and not exists (select 1 from public.designs d where d.product_id=p.id);

-- FAQ
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists faqs_touch on public.faqs;
create trigger faqs_touch before update on public.faqs for each row execute function public.touch_updated_at();
alter table public.faqs enable row level security;
drop policy if exists "public read faqs" on public.faqs;
create policy "public read faqs" on public.faqs for select using (is_active or public.is_admin());
drop policy if exists "admins write faqs" on public.faqs;
create policy "admins write faqs" on public.faqs for all using (public.is_admin()) with check (public.is_admin());
insert into public.faqs (question,answer,sort_order)
select * from (values
  ('What is the minimum order?','The minimum order is 50 pieces per design. The more boxes you order, the lower the price per box.',1),
  ('How much do the boxes cost?','Every box is custom, so the price depends on size, material, finishes and quantity. Send your details through Get a Quote and we will reply with an exact price.',2),
  ('Can I get a sample first?','Yes, paid samples are available. The sample price depends on your box size, style and finishes. Use the "Order a Paid Sample" button and we will confirm the cost.',3),
  ('Can you print my logo?','Yes. Send your logo and we will add it with the finish you choose: foil, embossing, spot UV or print.',4),
  ('Which countries do you deliver to?','We deliver across the United Kingdom, the USA, Canada and Europe. Bulk order quotes include delivery. Sample shipping is quoted separately.',5)
) v(question,answer,sort_order)
where not exists (select 1 from public.faqs);
