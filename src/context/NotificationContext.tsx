import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import Notification from "../components/Notification";

export type NotificationType = "success" | "error" | "info" | "warning";

type NotificationState = {
  type: NotificationType;
  message: string;
} | null;

type NotificationContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

const AUTO_HIDE_MS = 4000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotificationState>(null);

  const clear = useCallback(() => setState(null), []);

  const success = useCallback((message: string) => {
    setState({ type: "success", message });
  }, []);

  const error = useCallback((message: string) => {
    setState({ type: "error", message });
  }, []);

  const info = useCallback((message: string) => {
    setState({ type: "warning", message });
  }, []);

  const warning = useCallback((message: string) => {
    setState({ type: "warning", message });
  }, []);

  const value = useMemo(
    () => ({ success, error, info, warning, clear }),
    [success, error, info, warning, clear]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Notification
        state={state}
        onClose={clear}
        autoHideMs={AUTO_HIDE_MS}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}
