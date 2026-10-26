import { toast } from 'sonner'

/**
 * Typed toast helpers for Calm-X.
 * All toasts have a minimum 3000ms duration per ui-guidelines.md §6.
 */
export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, { description, duration: 3000 }),

  error: (message: string, description?: string) =>
    toast.error(message, { description, duration: 5000 }),

  info: (message: string, description?: string) =>
    toast.info(message, { description, duration: 3000 }),
}
