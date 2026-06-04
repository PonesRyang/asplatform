const ADMIN_TOKEN_KEY = 'adminToken'
const SERVICE_TOKEN_KEY = 'serviceToken'

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getServiceToken(): string | null {
  return localStorage.getItem(SERVICE_TOKEN_KEY)
}

export function setServiceToken(token: string): void {
  localStorage.setItem(SERVICE_TOKEN_KEY, token)
}

export function clearServiceToken(): void {
  localStorage.removeItem(SERVICE_TOKEN_KEY)
}
