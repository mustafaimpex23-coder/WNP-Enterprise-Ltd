-- =====================================================================
-- WNP Enterprise – UPDATE 3: letterhead documents + company names
-- Run ONCE in Supabase > SQL Editor > New query > paste all > Run.
-- Safe to run again.
-- =====================================================================

-- Quotations, job cards and invoices made in the admin panel
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  number      text unique not null,
  doc_type    text not null default 'quotation' check (doc_type in ('quotation','job_card','proforma','invoice')),
  company     text not null default 'uk' check (company in ('uk','us')),
  query_id    uuid,
  customer    jsonb not null default '{}',
  items       jsonb not null default '[]',
  spec        text,
  currency    text not null default 'GBP',
  tax_rate    numeric not null default 0,
  subtotal    numeric not null default 0,
  total       numeric not null default 0,
  show_prices boolean not null default true,
  notes       text,
  terms       text,
  issue_date  date not null default current_date,
  due_date    date,
  status      text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists documents_created_idx on public.documents (created_at desc);
drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();

-- Only admins can see or change documents
alter table public.documents enable row level security;
drop policy if exists "admins all documents" on public.documents;
create policy "admins all documents" on public.documents for all using (public.is_admin()) with check (public.is_admin());

-- Company names shown next to each address, and letterhead details
insert into public.site_settings (key, label, grp, sort_order, value) values
  ('uk_company', 'UK company name (shown with the UK address)',  'Contact', 2,  'WNP Enterprise Ltd'),
  ('us_company', 'USA company name (shown with the USA address)', 'Contact', 3,  'Providers LLC'),
  ('us_email',   'USA company email (letterhead, empty = main email)', 'Letterheads', 50, ''),
  ('us_phone',   'USA company phone (letterhead, empty = hidden)',     'Letterheads', 51, ''),
  ('doc_terms',  'Default terms on quotes and invoices',           'Letterheads', 52, 'Prices are valid for 30 days. Production starts after design approval and payment as agreed. Delivery times are confirmed in writing.'),
  ('bank_uk',    'UK payment details printed on invoices (optional)', 'Letterheads', 53, ''),
  ('bank_us',    'USA payment details printed on invoices (optional)', 'Letterheads', 54, '')
on conflict (key) do nothing;
