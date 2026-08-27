// The notification center (JB model): every event goes through
// notify() — it lands in the HISTORY (the Notifications panel is the
// truth) and shows a transient balloon. Balloons: info/success/
// warning — timed 10s; error — sticky until closed. A `key` replaces
// the previous balloon with the same key (server lost → back).

import { persistentAtom } from '@nanostores/persistent'
import { toast } from 'sonner'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: number
  severity: NotificationSeverity
  title: string
  body: string
  /** Unix ms. */
  at: number
  read: boolean
}

const HISTORY_CAP = 200
const TIMED_MS = 10_000

function decodeHistory(raw: string): AppNotification[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (n): n is AppNotification =>
        typeof n === 'object' &&
        n !== null &&
        'id' in n &&
        'severity' in n &&
        'title' in n &&
        'at' in n,
    )
  } catch {
    return []
  }
}

/** History survives restarts — the panel is the truth, not the
 * balloons. */
export const $notifications = persistentAtom<AppNotification[]>('graphene.notifications', [], {
  encode: JSON.stringify,
  decode: decodeHistory,
})

let nextId = ($notifications.get()[0]?.id ?? 0) + 1
const balloonByKey = new Map<string, string | number>()

export interface NotifyInput {
  severity: NotificationSeverity
  title: string
  body?: string
  /** Overrides the severity default (error → sticky). */
  sticky?: boolean
  /** Replaces the live balloon with the same key. */
  key?: string
  /** History only — no balloon. */
  silent?: boolean
}

export function notify(input: NotifyInput): void {
  const entry: AppNotification = {
    id: nextId,
    severity: input.severity,
    title: input.title,
    body: input.body ?? '',
    at: Date.now(),
    read: false,
  }
  nextId += 1
  $notifications.set([entry, ...$notifications.get()].slice(0, HISTORY_CAP))

  if (input.silent === true) return

  if (input.key !== undefined) {
    const previous = balloonByKey.get(input.key)
    if (previous !== undefined) toast.dismiss(previous)
  }
  const sticky = input.sticky ?? input.severity === 'error'
  const show =
    input.severity === 'error'
      ? toast.error
      : input.severity === 'warning'
        ? toast.warning
        : input.severity === 'success'
          ? toast.success
          : toast.info
  const balloonId = show(input.title, {
    description: input.body,
    duration: sticky ? Number.POSITIVE_INFINITY : TIMED_MS,
  })
  if (input.key !== undefined) balloonByKey.set(input.key, balloonId)
}

/** Drops the live balloon behind a key (the condition resolved). */
export function dismissBalloon(key: string): void {
  const id = balloonByKey.get(key)
  if (id !== undefined) {
    toast.dismiss(id)
    balloonByKey.delete(key)
  }
}

export function markAllNotificationsRead(): void {
  const current = $notifications.get()
  if (current.every((n) => n.read)) return
  $notifications.set(current.map((n) => (n.read ? n : { ...n, read: true })))
}

export function clearNotifications(): void {
  $notifications.set([])
}
