import { query } from './snowflake'

// No PII fields anywhere in this file.
// Identifiers used: CLIENT_REFERRAL_ID, VA_AUTHORIZATION_NUMBER, REFERRING_ORGANIZATION_ACCOUNT_NAME

export interface ReferralRow {
  CLIENT_REFERRAL_ID: string
  VA_AUTHORIZATION_NUMBER: string | null
  REFERRING_ORGANIZATION_ACCOUNT_NAME: string
  REFERRAL_STATUS_SIMPLIFIED: string | null
  REFERRAL_STATUS_INTERNAL_SIMPLIFIED: string | null
  REFERRAL_RECEIVED_DATE: string | null
  REFERRAL_AUTHORIZATION_START_DATE: string | null
  REFERRAL_AUTHORIZATION_END_DATE: string | null
  IS_SCHEDULED: boolean | null
  IS_CONVERTED: boolean | null
  REFERRAL_FIRST_SCHEDULE_DATE: string | null
  REFERRAL_FIRST_SESSION_DATE: string | null
  MOST_RECENT_DATE_OF_SERVICE: string | null
  TOTAL_ATTENDED_SESSIONS: number | null
  HAS_FUTURE_SESSION: boolean | null
  NEXT_APPOINTMENT: string | null
  RECORD_TYPE_NAME: string | null
}

export interface ReferralDetail extends ReferralRow {
  AUTH_STATUS: string | null
  NUM_CLAIMS_CLEAN: number | null
  NUM_NO_SHOWS: number | null
  HAS_SOAP_NOTES: boolean | null
  SESSION_FORMAT_PREFERENCE: string | null
  REFERRAL_TYPE_OF_SERVICE: string | null
}

export interface FilterParams {
  facility?: string
  referralId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

const SELECT_COLS = `
      r.CLIENT_REFERRAL_ID,
      r.VA_AUTHORIZATION_NUMBER,
      r.REFERRING_ORGANIZATION_ACCOUNT_NAME,
      r.REFERRAL_STATUS_SIMPLIFIED,
      r.REFERRAL_STATUS_INTERNAL_SIMPLIFIED,
      r.REFERRAL_RECEIVED_DATE::DATE::VARCHAR         AS REFERRAL_RECEIVED_DATE,
      r.REFERRAL_AUTHORIZATION_START_DATE::VARCHAR    AS REFERRAL_AUTHORIZATION_START_DATE,
      r.REFERRAL_AUTHORIZATION_END_DATE::VARCHAR      AS REFERRAL_AUTHORIZATION_END_DATE,
      r.IS_SCHEDULED,
      r.IS_CONVERTED,
      r.REFERRAL_FIRST_SCHEDULE_DATE::VARCHAR         AS REFERRAL_FIRST_SCHEDULE_DATE,
      r.REFERRAL_FIRST_SESSION_DATE::VARCHAR          AS REFERRAL_FIRST_SESSION_DATE,
      r.MOST_RECENT_DATE_OF_SERVICE::VARCHAR          AS MOST_RECENT_DATE_OF_SERVICE,
      r.TOTAL_ATTENDED_SESSIONS,
      j.HAS_FUTURE_SESSION_SCHEDULED                  AS HAS_FUTURE_SESSION,
      j.NEXT_UNCANCELED_START_AT_MST::VARCHAR         AS NEXT_APPOINTMENT`

// Unified filtered query — requires at least one of: facility, referralId, or date range
export async function queryReferrals(filters: FilterParams): Promise<ReferralRow[]> {
  const { facility, referralId, dateFrom, dateTo, limit = 100, offset = 0 } = filters

  const clauses: string[] = [`r.RECORD_TYPE_NAME = 'Patient Referral - VA'`]
  const binds: unknown[] = []

  if (facility) {
    clauses.push(`UPPER(r.REFERRING_ORGANIZATION_ACCOUNT_NAME) = UPPER(?)`)
    binds.push(facility)
  }
  if (referralId) {
    clauses.push(`(r.CLIENT_REFERRAL_ID ILIKE ? OR r.VA_AUTHORIZATION_NUMBER ILIKE ?)`)
    binds.push(`%${referralId}%`, `%${referralId}%`)
  }
  if (dateFrom) {
    clauses.push(`r.REFERRAL_RECEIVED_DATE >= ?`)
    binds.push(dateFrom)
  }
  if (dateTo) {
    clauses.push(`r.REFERRAL_RECEIVED_DATE <= ?`)
    binds.push(dateTo)
  }

  binds.push(limit, offset)

  return query<ReferralRow>(
    `SELECT ${SELECT_COLS}
    FROM ANALYTICS.MARTS.FCT_ENTERPRISE_REFERRALS_NEW r
    LEFT JOIN ANALYTICS.MARTS.FCT_CLIENT_JOURNEY j
      ON r.PERSONA_CLIENT_ID = j.PERSONA_CLIENT_ID
    WHERE ${clauses.join(' AND ')}
    ORDER BY r.REFERRAL_RECEIVED_DATE DESC
    LIMIT ? OFFSET ?`,
    binds
  )
}

// Referrals for a specific facility (by account name) — no PII
export async function getReferralsByFacility(
  facilityName: string,
  limit = 500,
  offset = 0
): Promise<ReferralRow[]> {
  return queryReferrals({ facility: facilityName, limit, offset })
}

export interface AuthRow {
  VA_AUTHORIZATION_NUMBER: string
  VA_AUTHORIZATION_STATUS: string | null
  AUTH_START: string | null
  AUTH_END: string | null
  NUM_CLAIMS_CLEAN: number | null
  NUM_NO_SHOWS_CLEAN: number | null
  IS_ACTIVE: boolean
}

// Single referral detail — pulls the most recent active auth for current status
export async function getReferralDetail(referralId: string): Promise<ReferralDetail | null> {
  const rows = await query<ReferralDetail>(
    `
    SELECT
      r.CLIENT_REFERRAL_ID,
      r.REFERRING_ORGANIZATION_ACCOUNT_NAME,
      r.REFERRAL_STATUS_SIMPLIFIED,
      r.REFERRAL_STATUS_INTERNAL_SIMPLIFIED,
      r.REFERRAL_RECEIVED_DATE::DATE::VARCHAR         AS REFERRAL_RECEIVED_DATE,
      r.IS_SCHEDULED,
      r.IS_CONVERTED,
      r.REFERRAL_FIRST_SCHEDULE_DATE::VARCHAR         AS REFERRAL_FIRST_SCHEDULE_DATE,
      r.REFERRAL_FIRST_SESSION_DATE::VARCHAR          AS REFERRAL_FIRST_SESSION_DATE,
      r.MOST_RECENT_DATE_OF_SERVICE::VARCHAR          AS MOST_RECENT_DATE_OF_SERVICE,
      r.SESSION_FORMAT_PREFERENCE,
      r.REFERRAL_TYPE_OF_SERVICE,
      j.HAS_FUTURE_SESSION_SCHEDULED                  AS HAS_FUTURE_SESSION,
      j.NEXT_UNCANCELED_START_AT_MST::VARCHAR         AS NEXT_APPOINTMENT,
      -- Most recent auth (highest start date across all auths for this client)
      latest_a.VA_AUTHORIZATION_NUMBER,
      latest_a.REFERRAL_AUTHORIZATION_START_DATE::VARCHAR AS REFERRAL_AUTHORIZATION_START_DATE,
      latest_a.REFERRAL_AUTHORIZATION_END_DATE::VARCHAR   AS REFERRAL_AUTHORIZATION_END_DATE,
      latest_a.VA_AUTHORIZATION_STATUS                    AS AUTH_STATUS,
      latest_a.NUM_CLAIMS_CLEAN,
      latest_a.NUM_NO_SHOWS_CLEAN                         AS NUM_NO_SHOWS,
      -- Lifetime sessions across all auths
      j.NUM_LIFETIME_ATTENDED_SESSIONS                    AS TOTAL_ATTENDED_SESSIONS,
      c.HAS_SOAP_NOTES
    FROM ANALYTICS.MARTS.FCT_ENTERPRISE_REFERRALS_NEW r
    LEFT JOIN ANALYTICS.MARTS.FCT_CLIENT_JOURNEY j
      ON r.PERSONA_CLIENT_ID = j.PERSONA_CLIENT_ID
    -- Get the most recent auth for this client across all their referrals
    LEFT JOIN (
      SELECT a.*,
        ROW_NUMBER() OVER (
          PARTITION BY a.PERSONA_CLIENT_ID
          ORDER BY a.REFERRAL_AUTHORIZATION_START_DATE DESC NULLS LAST
        ) AS rn
      FROM ANALYTICS.MARTS.FCT_VA_AUTHORIZATION_STATUS a
    ) latest_a
      ON latest_a.PERSONA_CLIENT_ID = r.PERSONA_CLIENT_ID
      AND latest_a.rn = 1
    LEFT JOIN ANALYTICS.MARTS.FCT_CLAIMS c
      ON r.MOST_RECENT_CLAIM_ID = c.CLAIM_ID
    WHERE r.RECORD_TYPE_NAME = 'Patient Referral - VA'
      AND r.CLIENT_REFERRAL_ID = ?
    LIMIT 1
    `,
    [referralId]
  )
  return rows[0] ?? null
}

// All authorizations for a client — for the auth history timeline on detail page
export async function getAuthHistory(referralId: string): Promise<AuthRow[]> {
  return query<AuthRow>(
    `
    SELECT
      a.VA_AUTHORIZATION_NUMBER,
      a.VA_AUTHORIZATION_STATUS,
      a.REFERRAL_AUTHORIZATION_START_DATE::VARCHAR  AS AUTH_START,
      a.REFERRAL_AUTHORIZATION_END_DATE::VARCHAR    AS AUTH_END,
      a.NUM_CLAIMS_CLEAN,
      a.NUM_NO_SHOWS_CLEAN,
      CASE
        WHEN a.REFERRAL_AUTHORIZATION_END_DATE >= CURRENT_DATE THEN TRUE
        ELSE FALSE
      END AS IS_ACTIVE
    FROM ANALYTICS.MARTS.FCT_VA_AUTHORIZATION_STATUS a
    INNER JOIN ANALYTICS.MARTS.FCT_ENTERPRISE_REFERRALS_NEW r
      ON a.PERSONA_CLIENT_ID = r.PERSONA_CLIENT_ID
    WHERE r.CLIENT_REFERRAL_ID = ?
      AND r.RECORD_TYPE_NAME = 'Patient Referral - VA'
    ORDER BY a.REFERRAL_AUTHORIZATION_START_DATE DESC
    `,
    [referralId]
  )
}

// All VA facilities — for AM dropdown and user assignment
export async function getFacilityList(): Promise<{ name: string; count: number }[]> {
  return query<{ name: string; count: number }>(
    `
    SELECT
      REFERRING_ORGANIZATION_ACCOUNT_NAME  AS name,
      COUNT(*)                             AS count
    FROM ANALYTICS.MARTS.FCT_ENTERPRISE_REFERRALS_NEW
    WHERE RECORD_TYPE_NAME = 'Patient Referral - VA'
      AND REFERRING_ORGANIZATION_ACCOUNT_NAME IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC
    `
  )
}

// Search referrals by referral ID within a facility (or all facilities for AMs)
export async function searchReferrals(
  referralId: string,
  facilityName?: string
): Promise<ReferralRow[]> {
  return queryReferrals({ referralId, facility: facilityName, limit: 50 })
}
