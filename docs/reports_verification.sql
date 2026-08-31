-- Reports ground-truth verification harness
-- ---------------------------------------------------------------------------
-- Purpose: compute each Reports section directly in SQL so on-screen numbers can
-- be compared against the database. These queries mirror the client-side
-- aggregation in src/services/reportService.js. Run via the Supabase MCP
-- (execute_sql) or the SQL editor. Replace the :range dates below.
--
-- Note on timezones: date-only tables (production_shifts, raw_material_entries,
-- purchase_entries) are filtered by their own DATE column. Timestamp tables
-- (challans.status_changed_at, power_events.occurred_at) are bucketed by the
-- Asia/Kolkata day — the same rule the app uses (getKolkataDateString).
--
-- Set the range once:
--   \set start_date '2026-03-23'
--   \set end_date   '2026-03-29'
-- or replace the literals inline.

-- === PRODUCTION (by category; day+night combined) ===========================
-- Mirrors buildProductionSummary: stretch/bubble = units + weight
-- (total_weight, else output_count*avg_weight); pouch = total_pieces; baby = units.
select
  o.category,
  sum(coalesce(o.output_count,0)) filter (where o.category in ('stretch','bubble','baby')) as units,
  sum(coalesce(o.total_weight, coalesce(o.output_count,0)*coalesce(o.avg_weight,0)))
    filter (where o.category in ('stretch','bubble')) as weight_kg,
  sum(coalesce(o.total_pieces,0)) filter (where o.category='pouch') as pouch_pieces
from production_shifts s
join production_outputs o on o.shift_id = s.id
where s.shift_date between '2026-03-23' and '2026-03-29'
group by o.category
order by o.category;

-- Day vs night split (mirrors dayShiftTotals / nightShiftTotals)
select s.shift_type, o.category,
  sum(coalesce(o.output_count,0)) as units,
  sum(coalesce(o.total_weight, coalesce(o.output_count,0)*coalesce(o.avg_weight,0))) as weight_kg,
  sum(coalesce(o.total_pieces,0)) as pieces
from production_shifts s
join production_outputs o on o.shift_id = s.id
where s.shift_date between '2026-03-23' and '2026-03-29'
group by s.shift_type, o.category
order by s.shift_type, o.category;

-- === RAW MATERIAL USAGE (per material, from jsonb) ==========================
-- Mirrors buildRawMaterialSummary (keys on material_id, falls back to name).
select
  coalesce(m->>'material_id', m->>'name') as material_key,
  max(m->>'name') as material_name,
  sum((m->>'quantity')::numeric) as qty
from raw_material_entries e,
     jsonb_array_elements(e.materials) m
where e.shift_date between '2026-03-23' and '2026-03-29'
group by 1
order by qty desc;

-- === PURCHASES (per material) ===============================================
select p.material_id, max(t.name) as material_name, sum(p.quantity) as qty
from purchase_entries p
left join raw_material_types t on t.id = p.material_id
where p.purchase_date between '2026-03-23' and '2026-03-29'
group by p.material_id
order by qty desc;

-- === STOCK BALANCE as of a date (cumulative; mirrors getStockBalance) =======
-- balance = Σ purchases(≤ date) − Σ usage(≤ date), active materials only.
with target as (select date '2026-03-29' as d)
select t.id, t.name,
  coalesce((select sum(p.quantity) from purchase_entries p
            where p.material_id = t.id and p.purchase_date <= (select d from target)), 0) as purchased,
  coalesce((select sum((m->>'quantity')::numeric)
            from raw_material_entries e, jsonb_array_elements(e.materials) m
            where coalesce(m->>'material_id', m->>'name') = t.id::text
              and e.shift_date <= (select d from target)), 0) as used
from raw_material_types t
where t.is_active
order by t.name;
-- (balance = purchased - used; if every "purchased" is 0 the app shows the
--  "no purchase data yet" state instead of negative balances.)

-- === SALES (departed challans; bucketed by IST day) =========================
-- Mirrors buildSalesSummary: boxes = items count, pieces/weight summed from items.
select
  count(*) as challans,
  sum(jsonb_array_length(items)) as boxes,
  sum((select sum((i->>'pieces')::numeric) from jsonb_array_elements(items) i)) as pieces,
  round(sum((select sum((i->>'weight')::numeric) from jsonb_array_elements(items) i))::numeric, 2) as gross_weight_kg
from challans
where status='departed'
  and (status_changed_at at time zone 'Asia/Kolkata')::date
      between '2026-03-23' and '2026-03-29';

-- === POWER (cuts / ins bucketed by IST day) =================================
select event_type, count(*)
from power_events
where (occurred_at at time zone 'Asia/Kolkata')::date between '2026-03-23' and '2026-03-29'
group by event_type;

-- === Data freshness (confirm which days actually have data) =================
select 'production_shifts' t, max(shift_date)::text latest from production_shifts
union all select 'raw_material_entries', max(shift_date)::text from raw_material_entries
union all select 'purchase_entries', max(purchase_date)::text from purchase_entries
union all select 'power_events', max((occurred_at at time zone 'Asia/Kolkata')::date)::text from power_events
union all select 'challans_departed', max((status_changed_at at time zone 'Asia/Kolkata')::date)::text
  from challans where status='departed';
