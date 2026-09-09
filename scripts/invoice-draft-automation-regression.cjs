const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const scheduler = read('supabase/invoice-draft-automation.sql')
const catchup = read('supabase/invoice-draft-catchup.sql')
const weekly = read('supabase/invoice-draft-weekly-support.sql')

assert.match(scheduler, /charge_date between current_date and current_date \+ 2/)
assert.match(catchup, /orbit_create_invoice_drafts\(uuid\)/)
assert.match(catchup, /orbit_create_all_invoice_drafts\(\)/)
assert.match(weekly, /'''weekly'', ''every week'', ''semanal'', ''semanalmente''/)
assert.match(weekly, /grant execute on function public\.orbit_create_invoice_drafts\(uuid\) to service_role/)

console.log('Invoice draft automation regression checks passed.')
