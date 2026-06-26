-- ============================================================
-- KRA Management System — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. TEAMS  (policies added after users table exists)
-- ============================================================
create table if not exists teams (
  id          uuid primary key default uuid_generate_v4(),
  team_name   varchar(100) not null unique,
  created_at  timestamptz default now()
);

alter table teams enable row level security;

-- ============================================================
-- 2. USERS
-- ============================================================
create table if not exists users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            varchar(100) not null unique,
  full_name           varchar(200) not null,
  role                varchar(20)  not null check (role in ('admin', 'owner', 'employee')),
  team_id             uuid references teams(id),
  is_paid_ads_member  boolean      not null default false,
  is_active           boolean      not null default true,
  created_at          timestamptz  default now()
);

alter table users enable row level security;

create policy "Admins manage users" on users
  for all using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('admin', 'owner')
        and u.is_active = true
    )
  );

create policy "Employees read own profile" on users
  for select using (id = auth.uid());

-- ============================================================
-- TEAMS RLS policies (now that users table exists)
-- ============================================================
create policy "Admins manage teams" on teams
  for all using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "Employees read teams" on teams
  for select using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.is_active = true
    )
  );

-- ============================================================
-- 3. SETTINGS
-- ============================================================
create table if not exists settings (
  setting_key    varchar(100) primary key,
  setting_value  varchar(255) not null,
  updated_by     uuid references users(id),
  updated_at     timestamptz  default now()
);

alter table settings enable row level security;

create policy "Admins manage settings" on settings
  for all using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "All authenticated read settings" on settings
  for select using (auth.uid() is not null);

-- Default settings
insert into settings (setting_key, setting_value) values
  ('daily_cutoff_time', '19:00'),
  ('currency', 'INR')
on conflict (setting_key) do nothing;

-- ============================================================
-- 4. KRA TEMPLATES
-- ============================================================
create table if not exists kra_templates (
  id           uuid primary key default uuid_generate_v4(),
  title        varchar(300) not null,
  kra_type     varchar(20)  not null check (kra_type in ('quantitative', 'qualitative')),
  target_value decimal(12,2),
  description  text,
  is_recurring boolean      not null default false,
  created_by   uuid references users(id),
  team_id      uuid references teams(id),
  created_at   timestamptz  default now()
);

alter table kra_templates enable row level security;

create policy "Admins manage kra templates" on kra_templates
  for all using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

-- ============================================================
-- 5. KRA ASSIGNMENTS
-- ============================================================
create table if not exists kra_assignments (
  id             uuid primary key default uuid_generate_v4(),
  kra_id         uuid not null references kra_templates(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  assigned_date  date not null,
  assigned_by    uuid references users(id),
  assigned_at    timestamptz default now(),
  unique (kra_id, user_id, assigned_date)
);

alter table kra_assignments enable row level security;

create policy "Admins manage assignments" on kra_assignments
  for all using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "Employees read own assignments" on kra_assignments
  for select using (user_id = auth.uid());

-- kra_templates policy deferred until kra_assignments exists
create policy "Employees read assigned kra templates" on kra_templates
  for select using (
    exists (
      select 1 from kra_assignments
      where kra_assignments.kra_id = kra_templates.id
        and kra_assignments.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. KRA LOGS
-- ============================================================
create table if not exists kra_logs (
  id                uuid primary key default uuid_generate_v4(),
  assignment_id     uuid not null references kra_assignments(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  log_date          date not null,
  achieved_value    decimal(12,2),
  status            varchar(20) not null check (status in ('done', 'in_progress', 'blocked')),
  comments          text,
  submitted_at      timestamptz,
  submission_status varchar(20) check (submission_status in ('on_time', 'late', 'missing')),
  is_draft          boolean not null default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (assignment_id, user_id, log_date)
);

alter table kra_logs enable row level security;

create policy "Admins read all kra logs" on kra_logs
  for select using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "Employees manage own kra logs" on kra_logs
  for all using (user_id = auth.uid());

-- ============================================================
-- 7. AD ACCOUNTS
-- ============================================================
create table if not exists ad_accounts (
  id                uuid primary key default uuid_generate_v4(),
  platform          varchar(20) not null check (platform in ('meta', 'google')),
  account_name      varchar(200) not null,
  account_ref_id    varchar(100),
  client_name       varchar(200) not null,
  monthly_budget    decimal(14,2) not null default 0,
  daily_lead_target integer not null default 0,
  assigned_user_ids uuid[] not null default '{}',
  is_active         boolean not null default true,
  created_by        uuid references users(id),
  created_at        timestamptz default now()
);

alter table ad_accounts enable row level security;

create policy "Admins manage ad accounts" on ad_accounts
  for all using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "Paid Ads employees read assigned accounts" on ad_accounts
  for select using (
    is_active = true
    and auth.uid() = any(assigned_user_ids)
  );

-- ============================================================
-- 8. ADS LOGS
-- ============================================================
create table if not exists ads_logs (
  id                    uuid primary key default uuid_generate_v4(),
  account_id            uuid not null references ad_accounts(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  log_date              date not null,
  daily_budget_set      decimal(14,2) not null default 0,
  daily_spend_actual    decimal(14,2) not null default 0,
  budget_utilisation_pct decimal(8,2),
  leads_generated       integer not null default 0,
  lead_target           integer not null default 0,
  lead_achievement_pct  decimal(8,2),
  conversions           integer not null default 0,
  conversion_value      decimal(14,2) not null default 0,
  cost_per_lead         decimal(12,2),
  cost_per_conversion   decimal(12,2),
  roas                  decimal(10,2),
  campaign_status       varchar(20) not null check (campaign_status in ('running', 'paused', 'issue')),
  notes                 text,
  submitted_at          timestamptz,
  submission_status     varchar(20) check (submission_status in ('on_time', 'late', 'missing')),
  is_draft              boolean not null default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (account_id, user_id, log_date)
);

alter table ads_logs enable row level security;

create policy "Admins read all ads logs" on ads_logs
  for select using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('admin', 'owner')
        and users.is_active = true
    )
  );

create policy "Employees manage own ads logs" on ads_logs
  for all using (user_id = auth.uid());

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_kra_assignments_user_date  on kra_assignments(user_id, assigned_date);
create index if not exists idx_kra_assignments_date       on kra_assignments(assigned_date);
create index if not exists idx_kra_logs_user_date         on kra_logs(user_id, log_date);
create index if not exists idx_ads_logs_user_date         on ads_logs(user_id, log_date);
create index if not exists idx_ads_logs_account_date      on ads_logs(account_id, log_date);
create index if not exists idx_users_team                 on users(team_id);
create index if not exists idx_users_username             on users(username);
