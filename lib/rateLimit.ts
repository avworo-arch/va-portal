// Simple in-memory rate limiter — per IP, resets every window
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(ip: string, opts: { limit: number; windowMs: number }): boolean {
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + opts.windowMs })
    return true // allowed
  }

  if (entry.count >= opts.limit) return false // blocked

  entry.count++
  return true // allowed
}

export function getClientIp(request: Request): string {
  const headers = new Headers((request as Request & { headers: Headers }).headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
