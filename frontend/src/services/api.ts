import axios from "axios";

const API_BASE = "/api";

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track a single in-flight refresh so multiple 401s don't all try to refresh at once
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // Never retry auth endpoints themselves — avoids infinite refresh loops
    const isAuthEndpoint =
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/auth/signin") ||
      originalRequest?.url?.includes("/auth/signup");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const refreshToken =
        typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

      if (!refreshToken) {
        // No refresh token — go to sign-in
        if (typeof window !== "undefined") window.location.href = "/signin";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Another refresh is in flight — queue this request
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      try {
        const res = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );
        const { access_token, refresh_token } = res.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        if (typeof window !== "undefined") window.location.href = "/signin";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  signup: (data: { email: string; password: string; full_name: string }) =>
    apiClient.post("/auth/signup", data),
  signin: (data: { email: string; password: string }) =>
    apiClient.post("/auth/signin", data),
  signout: () => apiClient.post("/auth/signout"),
  me: () => apiClient.get("/auth/me"),
  resetPassword: (email: string) =>
    apiClient.post("/auth/reset-password", { email }),
};

export const statementsApi = {
  upload: (file: File, replace = false) => {
    const form = new FormData();
    form.append("file", file);
    form.append("replace", String(replace));
    return apiClient.post("/statements/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  list: () => apiClient.get("/statements/"),
  trades: (id: string) => apiClient.get(`/statements/${id}/trades`),
  delete: (id: string) => apiClient.delete(`/statements/${id}`),
};

export const dashboardApi = {
  accounts: () => apiClient.get("/dashboard/accounts"),
  summary: (params?: { accountId?: string | null; statementId?: string | null }) =>
    apiClient.get("/dashboard/summary", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined },
    }),
  positions: (params?: { accountId?: string | null; statementId?: string | null }) =>
    apiClient.get("/dashboard/positions", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined },
    }),
  alerts: (params?: { accountId?: string | null; statementId?: string | null }) =>
    apiClient.get("/dashboard/alerts", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined },
    }),
  mom: (params?: { accountId?: string | null; statementId?: string | null; from?: string; to?: string }) =>
    apiClient.get("/dashboard/mom", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined, from: params?.from, to: params?.to },
    }),
  tickerPnl: (params?: { accountId?: string | null; statementId?: string | null }) =>
    apiClient.get("/dashboard/ticker-pnl", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined },
    }),
  strategyPnl: (params?: { accountId?: string | null; statementId?: string | null }) =>
    apiClient.get("/dashboard/strategy-pnl", {
      params: { account_id: params?.accountId || undefined, statement_id: params?.statementId || undefined },
    }),
};
