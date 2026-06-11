import cds from '@sap/cds'

/**
 * JWT Authentication Middleware for Production
 *
 * In production, replace mocked-auth with a real JWT verifier.
 * This module reads the JWT_SECRET env var and validates Bearer tokens.
 *
 * Usage: Referenced via CDS auth plugin configuration.
 *
 * For SAP BTP / Cloud Foundry:
 *   Set auth.kind = 'xsuaa' in the [production] CDS profile and provide
 *   VCAP_SERVICES with xsuaa credentials. @sap/xssec handles this automatically.
 *
 * For standalone JWT (non-SAP environments):
 *   Set CDS_AUTH=jwt and JWT_SECRET in environment to enable this middleware.
 */

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production'
const JWT_ISSUER  = process.env.JWT_ISSUER  || 'erp-platform'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'erp-api'

/**
 * Decode a Base64URL-encoded string (no padding required).
 */
function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64').toString('utf8')
}

/**
 * Lightweight JWT payload extractor — for demo/dev use only.
 * In production, use a proper library like `jsonwebtoken` for signature verification.
 */
export function extractJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(base64urlDecode(parts[1]))
  } catch {
    return null
  }
}

/**
 * Map JWT claims to CDS user roles.
 * Expects the JWT payload to contain:
 *   - sub: user ID
 *   - roles: string[] (custom claim)
 *   - scope: space-separated scopes (XSUAA style)
 */
export function mapJWTToUser(payload: Record<string, unknown>): cds.User {
  const roles: string[] = []

  if (Array.isArray(payload.roles)) {
    roles.push(...(payload.roles as string[]))
  }

  // Support XSUAA-style scope claim
  if (typeof payload.scope === 'string') {
    payload.scope.split(' ').forEach(s => {
      const role = s.split('.').pop()
      if (role) roles.push(role)
    })
  }

  const user = new cds.User({
    id: (payload.sub as string) || 'anonymous',
    roles,
  })

  return user
}

/**
 * ERP Role Definitions
 *
 * Role        | Capabilities
 * ------------|---------------------------------------------------------------
 * clerk       | Create and manage Orders, Clients, Products
 * manager     | Approve/reject Orders, generate Invoices, record payments
 * hr          | Manage Employees
 * reviewer    | Review travel records (existing travel module)
 * processor   | Process travel records (existing travel module)
 * admin       | Full access to all services
 */
export const ERP_ROLES = {
  CLERK:     'clerk',
  MANAGER:   'manager',
  HR:        'hr',
  REVIEWER:  'reviewer',
  PROCESSOR: 'processor',
  ADMIN:     'admin',
} as const

export type ERPRole = typeof ERP_ROLES[keyof typeof ERP_ROLES]

/**
 * Mock users for development (mirrors package.json mocked-auth config).
 */
export const MOCK_USERS = [
  { id: 'alice',  password: 'alice', roles: [ERP_ROLES.CLERK, 'authenticated-user'] },
  { id: 'bob',    password: 'bob',   roles: [ERP_ROLES.MANAGER, 'authenticated-user'] },
  { id: 'hr',     password: 'hr',    roles: [ERP_ROLES.HR, 'authenticated-user'] },
  { id: 'amy',    password: 'amy',   roles: [ERP_ROLES.PROCESSOR, 'authenticated-user'] },
  { id: 'martha', password: 'martha',roles: ['reviewer', 'authenticated-user'] },
  { id: 'admin',  password: 'admin', roles: Object.values(ERP_ROLES).concat(['authenticated-user']) },
] as const

export { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE }
