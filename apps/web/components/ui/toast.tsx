"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { IconX, IconCheck, IconAlertCircle, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => string;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  loading: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000): string => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);

    if (type !== "loading" && duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, [dismiss]);

  const success = useCallback((message: string, duration?: number) => toast(message, "success", duration), [toast]);
  const error = useCallback((message: string, duration?: number) => toast(message, "error", duration), [toast]);
  const info = useCallback((message: string, duration?: number) => toast(message, "info", duration), [toast]);
  const loading = useCallback((message: string, duration?: number) => toast(message, "loading", duration), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, loading, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  // Auto dismiss for loading toasts after 30 seconds max
  useEffect(() => {
    if (toast.type === "loading" && toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.type, toast.duration]);

  const icons = {
    success: <IconCheck size={20} className="text-green-500 shrink-0" />,
    error: <IconAlertCircle size={20} className="text-red-500 shrink-0" />,
    info: <IconInfoCircle size={20} className="text-blue-500 shrink-0" />,
    loading: <IconLoader2 size={20} className="text-green-500 shrink-0 animate-spin" />,
  };

  const bgColors = {
    success: "bg-white dark:bg-neutral-900 border-green-200 dark:border-green-900/50",
    error: "bg-white dark:bg-neutral-900 border-red-200 dark:border-red-900/50",
    info: "bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-900/50",
    loading: "bg-white dark:bg-neutral-900 border-green-200 dark:border-green-900/50",
  };

  return (
    <div
      className={`
        pointer-events-auto min-w-[320px] max-w-md p-4 rounded-2xl border-2
        shadow-2xl flex items-start gap-3
        transition-all duration-200 ease-out
        ${bgColors[toast.type]}
        ${isExiting ? "opacity-0 translate-x-4 scale-95" : "opacity-100 translate-x-0 scale-100"}
      `}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-foreground break-words">
        {toast.message}
      </p>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
      >
        <IconX size={16} className="text-muted-foreground" />
      </button>
    </div>
  );
}
