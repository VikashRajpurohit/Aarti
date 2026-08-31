import { createClient } from 'jsr:@supabase/supabase-js@2'
import { zipSync, strToU8 } from 'https://esm.sh/fflate@0.8.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'Content-Disposition',
}

const PAGE_SIZE = 1000
const TABLES = [
  'profiles',
  'challans',
  'activity_logs',
  'raw_material_types',
  'raw_material_entries',
  'production_product_types',
  'production_shifts',
  'production_outputs',
  'purchase_entries',
  'power_events',
  'website_inquiries',
  'website_visits',
  'site_config',
]

const RESTORE_ORDER = [
  'profiles',
  'raw_material_types',
  'production_product_types',
  'challans',
  'raw_material_entries',
  'production_shifts',
  'production_outputs',
  'purchase_entries',
  'power_events',
  'website_inquiries',
  'website_visits',
  'site_config',
  'activity_logs',
]

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value)
  const escaped = raw.replace(/"/g, '""')
  if (/[\n,\r"]/g.test(escaped)) {
    return `"${escaped}"`
  }
  return escaped
}

const buildColumns = (rows: Record<string, unknown>[]) => {
  const set = new Set<string>()
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => set.add(key))
  })
  return Array.from(set).sort()
}

const rowsToCsv = (rows: Record<string, unknown>[], columns: string[]) => {
  const header = columns.join(',')
  const lines = rows.map((row) => columns.map((col) => csvEscape(row?.[col])).join(','))
  return [header, ...lines].join('\n')
}

const fetchAllRows = async (client: any, table: string) => {
  const rows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

const fetchAllUsers = async (client: any) => {
  const users: Record<string, unknown>[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
    page += 1
  }

  return users
}

const buildRestoreScript = () => `/* eslint-disable */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const baseDir = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf8'));
const restoreOrder = manifest.restore_order || manifest.tables.map((t) => t.name);

const restoreTable = async (table) => {
  const filePath = path.join(baseDir, table + '.json');
  if (!fs.existsSync(filePath)) return;
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log('Restored ' + table + ': ' + rows.length + ' rows');
};

for (const table of restoreOrder) {
  await restoreTable(table);
}

console.log('Auth users are exported in auth_users.json.');
console.log('Supabase does not export password hashes; restore auth users manually if needed.');
console.log('Done.');
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('backup-export:start', new Date().toISOString())
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.log('backup-export:auth-failed', userError?.message || 'no-user')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('backup-export:user', user.id)

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, roles, is_disabled')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.roles?.includes('admin') || profile?.role === 'admin'
    if (profileError || !profile || !isAdmin || profile.is_disabled) {
      console.log('backup-export:forbidden', { profileError: profileError?.message, isAdmin, disabled: profile?.is_disabled })
      return new Response(JSON.stringify({ error: 'Forbidden: You must be an admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('backup-export:authorized', { isAdmin })

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const zipFiles: Record<string, Uint8Array> = {}
    const manifest: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      tables: [],
      restore_order: RESTORE_ORDER,
      app: { name: 'Aarti Polymers' },
    }

    for (const table of TABLES) {
      const rows = await fetchAllRows(supabaseAdmin, table)
      const columns = buildColumns(rows)
      const csv = rowsToCsv(rows, columns)
      zipFiles[`csv/${table}.csv`] = strToU8(csv)
      zipFiles[`supabase/${table}.json`] = strToU8(JSON.stringify(rows, null, 2))
      ;(manifest.tables as Record<string, unknown>[]).push({
        name: table,
        rows: rows.length,
        columns,
        csv: `csv/${table}.csv`,
        json: `supabase/${table}.json`,
      })
      console.log('backup-export:table', table, rows.length)
    }

    const authUsers = await fetchAllUsers(supabaseAdmin)
    const authColumns = buildColumns(authUsers)
    const authCsv = rowsToCsv(authUsers, authColumns)
    zipFiles['csv/auth_users.csv'] = strToU8(authCsv)
    zipFiles['supabase/auth_users.json'] = strToU8(JSON.stringify(authUsers, null, 2))
    ;(manifest as Record<string, unknown>).auth_users = {
      rows: authUsers.length,
      columns: authColumns,
      csv: 'csv/auth_users.csv',
      json: 'supabase/auth_users.json',
    }
    console.log('backup-export:auth-users', authUsers.length)

    zipFiles['supabase/manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
    zipFiles['supabase/restore.js'] = strToU8(buildRestoreScript())

    const zipData = zipSync(zipFiles, { level: 6 })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `AartiPolymers_backup_${timestamp}.zip`
    console.log('backup-export:zip', { filename, bytes: zipData.length })

    return new Response(zipData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('backup-export:error', error?.message || error)
    return new Response(JSON.stringify({ error: error.message || 'Backup failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
