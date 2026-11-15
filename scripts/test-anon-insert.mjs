// Checks whether an unauthenticated client (anon key only) can write to the tasks table.
// Run with: node --env-file=.env scripts/test-anon-insert.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY, {
  auth: { persistSession: false },
})

const { data: sessionData } = await supabase.auth.getSession()
console.log('Session:', sessionData.session ? 'logged in (unexpected)' : 'none (anon)')

const { data, error } = await supabase
  .from('tasks')
  .insert({
    title: '[anon-insert test] delete me',
    description: 'Created by scripts/test-anon-insert.mjs',
    tag: '',
    status: 'todo',
    order: 9999,
  })
  .select()
  .single()

if (error) {
  console.log('PASS: anon insert was rejected')
  console.log(`  ${error.code ?? ''} ${error.message}`)
  process.exit(0)
}

console.log('FAIL: anon insert succeeded, so RLS is not blocking writes')
console.log('  Inserted row id:', data.id)

const { error: deleteError, count } = await supabase
  .from('tasks')
  .delete({ count: 'exact' })
  .eq('id', data.id)

if (deleteError || !count) {
  console.log('  Cleanup failed; delete this row manually:', deleteError?.message ?? 'no rows deleted')
} else {
  console.log('  Cleaned up test row (anon delete also works)')
}
process.exit(1)
