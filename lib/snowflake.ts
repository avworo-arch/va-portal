import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Uses the `snow` CLI with your existing SSO session instead of the SDK.
// Binds are interpolated safely via JSON — never via string concat.
export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: unknown[] = []
): Promise<T[]> {
  // Replace positional ? placeholders with bound values
  let i = 0
  const interpolated = sql.replace(/\?/g, () => {
    const val = binds[i++]
    if (val === null || val === undefined) return 'NULL'
    if (typeof val === 'number') return String(val)
    // Escape single quotes for string values
    return `'${String(val).replace(/'/g, "''")}'`
  })

  const { stdout } = await execFileAsync('snow', [
    'sql',
    '--query', interpolated,
    '--format', 'json',
    '--connection', 'sm-default',
  ])

  const parsed = JSON.parse(stdout.trim())
  // snow --format json returns a flat array of row objects
  return (Array.isArray(parsed) ? parsed : [parsed]) as T[]
}
