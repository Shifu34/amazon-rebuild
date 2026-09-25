-- Idempotent schema. Money is integer cents; product ids refer to data/products.json.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text not null default '',
  city text not null,
  state text not null,
  zip text not null,
  country text not null default 'United States',
  instructions text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  brand text not null,
  last4 text not null,
  exp_month int not null,
  exp_year int not null,
  name_on_card text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- owner is 'u:<user id>' for signed-in shoppers or 'g:<guest cookie id>'; guest rows move to the user on sign-in
create table if not exists cart_items (
  owner text not null,
  product_id int not null,
  quantity int not null check (quantity between 1 and 30),
  saved_for_later boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (owner, product_id)
);

create table if not exists orders (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  ship_to jsonb not null,
  payment jsonb not null,
  delivery_speed text not null,
  items_cents int not null,
  shipping_cents int not null,
  tax_cents int not null,
  duty_cents int not null default 0,
  total_cents int not null,
  placed_at timestamptz not null default now(),
  deliver_by timestamptz not null,
  cancelled_at timestamptz
);
create index if not exists orders_user on orders (user_id, placed_at desc);

create table if not exists order_items (
  order_id text not null references orders(id) on delete cascade,
  product_id int not null,
  title text not null,
  thumbnail text not null,
  price_cents int not null,
  quantity int not null,
  return_reason text,
  returned_at timestamptz,
  primary key (order_id, product_id)
);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists list_items (
  list_id uuid not null references lists(id) on delete cascade,
  product_id int not null,
  added_at timestamptz not null default now(),
  primary key (list_id, product_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id int not null,
  rating int not null check (rating between 1 and 5),
  headline text not null,
  body text not null,
  verified boolean not null default false,
  helpful int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists browsing_history (
  user_id uuid not null references users(id) on delete cascade,
  product_id int not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- checkout: one order per rendered checkout token, so a double-submitted "Place your order" can't create two orders
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key on orders (idempotency_key);

-- product detail slice: one default list per user, helpful votes (one per voter per review), lookups by product/recency
create unique index if not exists lists_one_default on lists (user_id) where is_default;
create table if not exists review_votes (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index if not exists reviews_product on reviews (product_id);
create index if not exists browsing_history_recent on browsing_history (user_id, viewed_at desc);

-- orders slice: per-item cancellation, returns (refund or replacement) and demo-issued refunds
alter table orders add column if not exists replacement_for text;
alter table order_items
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists return_comment text,
  add column if not exists return_code text,
  add column if not exists return_method text,
  add column if not exists return_resolution text,
  add column if not exists refund_cents int,
  add column if not exists refunded_at timestamptz,
  add column if not exists replacement_order_id text;

-- account slice: shoppers can turn browsing history off (views are not recorded while paused)
alter table users add column if not exists history_paused boolean not null default false;

-- product detail polish: Helpful votes on catalog reviews and Report on any review, one per shopper per kind.
-- review_key is a shopper review's uuid or seed-{productId}-{index} for the catalog's reviews
create table if not exists review_feedback (
  review_key text not null,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('helpful', 'report')),
  created_at timestamptz not null default now(),
  primary key (review_key, user_id, kind)
);

-- demo accounts: one per network per minute, enforced in the database so every serverless instance agrees (IPs stored hashed)
create table if not exists demo_signups (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists demo_signups_ip_created on demo_signups (ip_hash, created_at desc);

-- transactional emails: one row per attempt (sent, skipped or failed); also the source of the daily sending caps
create table if not exists sent_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  to_address text not null,
  kind text not null,
  subject text not null,
  order_id text,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists sent_emails_status_created on sent_emails (status, created_at desc);
create index if not exists sent_emails_to_created on sent_emails (to_address, created_at desc);

-- region: orders keep the display currency and its rate at placement (money stays in US cents)
alter table orders
  add column if not exists currency text not null default 'USD',
  add column if not exists fx_rate double precision not null default 1;

-- restock reminders: one nudge when a consumable is due, never a subscription. One row per shopper and product, replaced
-- when they set it again; `sent_at` closes it and `cancelled_at` records a one-click stop.
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id int not null,
  order_id text references orders(id) on delete set null,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz
);
create unique index if not exists reminders_user_product on reminders (user_id, product_id);
create index if not exists reminders_due on reminders (due_at);

-- price locks: today's price held while the shopper decides, honoured by checkout until it expires
create table if not exists price_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id int not null,
  price_cents int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create unique index if not exists price_locks_user_product on price_locks (user_id, product_id);

-- demo price drops: the catalog is static, so a walkthrough can't wait for a real price change. The demo control lowers a
-- product's price for one shopper (server-computed, never a price sent by the client) so price locks and price protection
-- can be seen working.
create table if not exists price_drops (
  user_id uuid not null references users(id) on delete cascade,
  product_id int not null,
  price_cents int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, product_id)
);

-- group buy: a team price that unlocks when enough shoppers commit before the deadline. Nobody is charged unless it fills.
create table if not exists group_buys (
  id uuid primary key default gen_random_uuid(),
  product_id int not null,
  price_cents int not null,
  target int not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists group_buys_product on group_buys (product_id, ends_at desc);

create table if not exists group_buy_members (
  group_buy_id uuid not null references group_buys(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  order_id text references orders(id) on delete set null,
  primary key (group_buy_id, user_id)
);

-- your nile day: a weekday to pool the week's orders onto, and the shipping we hand back for waiting
alter table users add column if not exists delivery_day smallint;          -- 0 Sunday … 6 Saturday; null ships as ordered
alter table orders add column if not exists pooled boolean not null default false;
alter table orders add column if not exists credit_cents int not null default 0;

-- cash on delivery: what the shopper chose, and whether the parcel was taken (reliability comes from their own history)
alter table orders add column if not exists payment_kind text not null default 'card';   -- 'card' | 'cod'
alter table orders add column if not exists confirmed_at timestamptz;
alter table orders add column if not exists refused_at timestamptz;
