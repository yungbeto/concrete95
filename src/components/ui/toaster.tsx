"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={5000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {/* Win95 title bar */}
            {title && (
              <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-blue-800 px-1.5 h-6 flex-shrink-0">
                <ToastTitle className="text-white font-bold text-xs select-none leading-none">{title}</ToastTitle>
                <ToastClose className="static h-4 w-4 ml-1" />
              </div>
            )}

            {/* Body */}
            <div className={`w-full ${title ? 'pt-7' : 'pr-8'}`}>
              {description && (
                <ToastDescription className="mb-0">{description}</ToastDescription>
              )}
              {action && (
                <div className="mt-2 flex justify-end">
                  {action}
                </div>
              )}
            </div>

            {/* Close button when there's no title bar */}
            {!title && <ToastClose />}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
