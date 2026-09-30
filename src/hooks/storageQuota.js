import { files } from '../lib/files'

/** Per-user storage allowance for images + attached files (MB). */
export const USER_QUOTA_MB = 200
export const USER_QUOTA_BYTES = USER_QUOTA_MB * 1024 * 1024

/** How much this user has uploaded so far (server-side total, includes files of deleted docs). */
export async function getUsage() {
  try {
    const { bytes } = await files.totalSize()
    return Number(bytes) || 0
  } catch (err) {
    console.error(err)
    return null // unknown — don't block the user on a failed check
  }
}

/**
 * Check whether `extraBytes` more fits in the user's allowance.
 * `pendingBytes` = uploads already in flight in this session (not yet counted server-side).
 */
export async function checkQuota(extraBytes, pendingBytes = 0) {
  const used = await getUsage()
  if (used == null) return { ok: true, used: null, remaining: null }
  const remaining = Math.max(0, USER_QUOTA_BYTES - used - pendingBytes)
  return { ok: extraBytes <= remaining, used, remaining }
}

export function quotaMessage(remaining) {
  const mb = Math.max(0, remaining / (1024 * 1024))
  const left = mb < 1 ? 'أقل من 1 ميجابايت' : `${mb.toFixed(1)} ميجابايت`
  return `وصلت للحد المسموح لمساحة الملفات (${USER_QUOTA_MB} ميجابايت لكل حساب). المتبقي لك: ${left}.`
}