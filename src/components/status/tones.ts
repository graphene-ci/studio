// The pinned status-color module's shared tone maps: status tokens
// reach markup ONLY through files in components/status/.

export type StatusTone = 'success' | 'pending' | 'warning' | 'failed' | 'canceled'

export const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-status-success',
  pending: 'text-status-pending',
  warning: 'text-status-warning',
  failed: 'text-status-failed',
  canceled: 'text-status-canceled',
}

export const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-status-success',
  pending: 'bg-status-pending',
  warning: 'bg-status-warning',
  failed: 'bg-status-failed',
  canceled: 'bg-status-canceled',
}
