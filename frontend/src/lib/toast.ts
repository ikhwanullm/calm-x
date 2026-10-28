import { toast } from "sonner"
import type { ExternalToast } from "sonner"

export interface NotifyOptions {
  description?: string
  action?: { label: string; onClick: () => void }
  /** Milliseconds; never below the 3000ms minimum. Use longer for Undo toasts. */
  duration?: number
}

/**
 * Typed toast helpers for Calm-X.
 * All toasts have a minimum 3000ms duration per ui-guidelines.md §6.
 *
 * notify.success(message) - simple message
 * notify.success(message, "description string") - with description
 * notify.success(message, { description?, action? }) - with options
 */
export const notify = {
  success: (message: string, options?: string | NotifyOptions) => {
    const opts: ExternalToast = { duration: 3000 }
    if (typeof options === "string") {
      opts.description = options
    } else if (options != null) {
      opts.description = options.description
      if (options.action) opts.action = options.action
      if (options.duration) opts.duration = Math.max(3000, options.duration)
    }
    toast.success(message, opts)
  },

  error: (message: string, description?: string) =>
    toast.error(message, { description, duration: 5000 }),

  info: (message: string, description?: string) =>
    toast.info(message, { description, duration: 3000 }),
}
