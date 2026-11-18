"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppState, Collection, Preferences, User } from "@/lib/types";

export async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error)
    throw new Error(body.error || "تعذّر إكمال الطلب. حاول مرة أخرى.");
  return body.data;
}
type AppContextType = {
  user: User | null;
  state: AppState | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  authenticate: (
    action: string,
    values?: Record<string, unknown>,
  ) => Promise<void>;
  create: <T = any>(
    collection: Collection,
    values: Record<string, unknown>,
  ) => Promise<T>;
  update: <T = any>(
    collection: Collection,
    id: string,
    values: Record<string, unknown>,
  ) => Promise<T>;
  remove: (collection: Collection, id: string) => Promise<void>;
  action: <T = any>(
    path: string,
    payload: Record<string, unknown>,
  ) => Promise<T>;
  savePreferences: (values: Partial<Preferences>) => Promise<void>;
};
const AppContext = createContext<AppContextType | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [state, setState] = useState<AppState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++epoch.current;
    try {
      const auth = await request<{ user: User | null }>("/api/auth");
      const nextState = auth.user
        ? await request<AppState>("/api/state")
        : null;
      if (generation !== epoch.current) return;
      setUser(auth.user);
      setState(nextState);
      setError("");
    } catch (e) {
      if (generation === epoch.current)
        setError(e instanceof Error ? e.message : "تعذّر الاتصال");
      throw e;
    } finally {
      if (generation === epoch.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  const authenticate = useCallback(
    async (action: string, values: Record<string, unknown> = {}) => {
      ++epoch.current;
      await request("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action, ...values }),
      });
      if (action === "sign-out") {
        ++epoch.current;
        setUser(null);
        setState(null);
      } else {
        setState(null);
        await refresh();
      }
    },
    [refresh],
  );
  const create = useCallback(
    async <T = any,>(
      collection: Collection,
      values: Record<string, unknown>,
    ) => {
      const data = await request<T>(`/api/records/${collection}`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      await refresh();
      return data;
    },
    [refresh],
  );
  const update = useCallback(
    async <T = any,>(
      collection: Collection,
      id: string,
      values: Record<string, unknown>,
    ) => {
      const data = await request<T>(`/api/records/${collection}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await refresh();
      return data;
    },
    [refresh],
  );
  const remove = useCallback(
    async (collection: Collection, id: string) => {
      await request(`/api/records/${collection}/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );
  const action = useCallback(
    async <T = any,>(path: string, payload: Record<string, unknown>) => {
      const data = await request<T>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh();
      return data;
    },
    [refresh],
  );
  const savePreferences = useCallback(
    async (values: Partial<Preferences>) => {
      await request("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await refresh();
    },
    [refresh],
  );
  return (
    <AppContext.Provider
      value={{
        user,
        state,
        loading,
        error,
        refresh,
        authenticate,
        create,
        update,
        remove,
        action,
        savePreferences,
      }}
    >
      <div key={user?.id || "anonymous"} className="account-surface">
        {children}
      </div>
    </AppContext.Provider>
  );
}
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("AppProvider is required");
  return app;
}
