-- Create validation_results table for storing extended validation payloads
-- Run this in your Supabase SQL editor or via the CLI

create table if not exists public.validation_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  idea text,
  business_type text,
  status text,
  product_notice jsonb,
  quick_guidance jsonb,
  scoring_transparency jsonb,
  financials jsonb
);

-- Helpful indexes
create index if not exists validation_results_created_at_idx on public.validation_results (created_at desc);
create index if not exists validation_results_business_type_idx on public.validation_results (business_type);
create index if not exists validation_results_status_idx on public.validation_results (status);

-- If you plan to enable RLS later, uncomment these and add policies
-- alter table public.validation_results enable row level security;
-- Example read policy for anon (adjust to your needs):
-- create policy "Public read validation_results" on public.validation_results
--   for select using (true);

