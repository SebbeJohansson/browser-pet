// Forwards one System One request to TypeSafe with the user's own key.
// Needed because api.typesafe.ai rejects browser origins (CORS).
// The key comes in per request and is never logged or stored.
const UPSTREAM = 'https://api.typesafe.ai/v1/systemone'
const MAX_BODY_BYTES = 64 * 1024

export default defineEventHandler(async (event) => {
  const key = getHeader(event, 'x-jev-key')
  if (!key) throw createError({ statusCode: 401, statusMessage: 'Missing Jev key' })

  const length = Number(getHeader(event, 'content-length') ?? 0)
  if (length > MAX_BODY_BYTES) throw createError({ statusCode: 413, statusMessage: 'Request too large' })

  const body = await readBody<{ state?: unknown; questions?: unknown }>(event)
  if (!body || typeof body !== 'object' || !body.questions || typeof body.questions !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body needs state and questions' })
  }

  const res = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state: body.state ?? '', questions: body.questions }),
  })

  setResponseStatus(event, res.status)
  setHeader(event, 'content-type', res.headers.get('content-type') ?? 'application/json')
  setHeader(event, 'cache-control', 'no-store')
  return await res.text()
})
