export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

// ── Auth-expiry guard ─────────────────────────────────────────────────────────
// A 401 during the first seconds after login is a race condition (token not yet
// propagated), not a genuine expiry. We require two 401s within a short window
// before treating the session as expired. This prevents a single bad request
// from nuking a freshly-created session.
let _firstFailedAt = 0
const AUTH_FAIL_WINDOW_MS = 5000   // two 401s must occur within 5 s
const LOGIN_GRACE_MS      = 3000   // ignore all 401s for 3 s after token is set

function shouldExpireSession() {
  const token = getToken()
  if (!token) return false  // already gone, nothing to do

  // If the token was just written (OAuth callback), ignore the 401 entirely
  const tokenAge = Date.now() - Number(localStorage.getItem('token_set_at') || 0)
  if (tokenAge < LOGIN_GRACE_MS) return false

  const now = Date.now()
  if (now - _firstFailedAt > AUTH_FAIL_WINDOW_MS) {
    // First failure in a new window — record it but don't expire yet
    _firstFailedAt = now
    return false
  }

  // Second failure inside the window — genuine expiry
  _firstFailedAt = 0
  return true
}

async function request(path, options = {}) {
  const token = getToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (networkErr) {
    // fetch() itself threw — server unreachable or CORS preflight blocked
    throw new Error(`네트워크 오류: 서버에 연결할 수 없습니다. (${networkErr.message})`)
  }

  // 서버가 새 토큰을 발급했으면 자동으로 교체 (silent refresh)
  const newToken = response.headers.get('x-new-token')
  if (newToken) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('token_set_at', String(Date.now()))
  }

  // 토큰 만료 / 인증 실패 → 연속 두 번 실패 시에만 세션 종료
  if (response.status === 401) {
    if (shouldExpireSession()) {
      localStorage.removeItem('token')
      localStorage.removeItem('token_set_at')
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
  }

  const data = await response.json()

  if (!response.ok || data.success === false) {
    const detail = data.error ? ` (${data.error})` : ''
    throw new Error((data.message || 'API 요청 실패') + detail)
  }

  return data
}

export const api = {
  get: (path) =>
    request(path, {
      method: 'GET',
    }),

  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patch: (path, body) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (path, body = null) =>
    request(path, {
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
}