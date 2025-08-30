// src/contexts/UserContext.jsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer
} from "react";

/**
 * UserContext.jsx
 * Auth + Users + Device Approval client for your Flask routes.
 */

// -------------------- API Helpers --------------------
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
  "/api"; // dev container: Vite proxies /api -> http://backend:5000

// Use the same key everywhere in the app
const TOKEN_KEY = "token";
const USER_KEY = "auth_user";

const jsonHeaders = { "Content-Type": "application/json" };

function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function apiFetch(path, { method = "GET", token, body, headers, expectBlob = false } = {}) {
  const url = API_BASE + path;
  const opts = {
    method,
    headers: {
      ...(expectBlob ? {} : jsonHeaders),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  };
  if (body !== undefined && body !== null && !expectBlob) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let err = { status: res.status, statusText: res.statusText, message: `${res.status} ${res.statusText}` };
    try {
      const j = await res.json();
      err.message = j?.error || err.message;
      err.data = j;
    } catch (_) {}
    const e = new Error(err.message);
    Object.assign(e, err);
    throw e;
  }
  if (expectBlob) return res.blob();
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

// -------------------- State --------------------
const initialState = {
  token: (typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || "",
  user: (() => {
    try {
      const raw = (typeof localStorage !== "undefined" && localStorage.getItem(USER_KEY)) || null;
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  })(),
  loading: false,
  error: null,

  // for restricted roles on new device
  pendingApproval: null, // { ip, user_agent, message }

  deviceRequests: [],
  deviceSummary: {},
  users: [],
  pagination: { page: 1, per_page: 20, total: 0, pages: 0 },
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_AUTH":
      return { ...state, token: action.token || "", user: action.user || null };
    case "SET_PENDING_APPROVAL":
      return { ...state, pendingApproval: action.value };
    case "SET_USERS":
      return { ...state, users: action.users || [] };
    case "SET_DEVICE_REQUESTS":
      return { ...state, deviceRequests: action.requests || [] };
    case "SET_DEVICE_SUMMARY":
      return { ...state, deviceSummary: action.summary || {} };
    default:
      return state;
  }
}

const UserContext = createContext(null);
export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within <UserProvider>");
  return ctx;
}

// -------------------- Provider --------------------
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ------ helpers ------
  const persistAuth = useCallback((token, user) => {
    try {
      if (typeof localStorage !== "undefined") {
        if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY);
      }
    } catch (_) {}
    dispatch({ type: "SET_AUTH", token, user });
  }, []);

  const clearAuth = useCallback(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch (_) {}
    dispatch({ type: "SET_AUTH", token: "", user: null });
  }, []);

  // Stable getter for other providers
  const getToken = useCallback(
    () => state.token || ((typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || ""),
    [state.token]
  );

  const handle401 = useCallback((e) => {
    if (e?.status === 401) clearAuth();
  }, [clearAuth]);

  // ------ auth routes ------
  const login = useCallback(async ({ email, password }) => {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_PENDING_APPROVAL", value: null });
    try {
      const res = await apiFetch(`/login`, { method: "POST", body: { email, password } });
      const token = res?.token || "";
      const user = res?.user || null;
      if (!token || !user) throw new Error("Invalid login response");
      persistAuth(token, user);
      dispatch({ type: "SET_LOADING", loading: false });
      return { ok: true, user };
    } catch (e) {
      // restricted device (403)
      if (e?.status === 403 && (e?.message || "").toLowerCase().includes("device")) {
        const body = e?.data || {};
        dispatch({
          type: "SET_PENDING_APPROVAL",
          value: { ip: body?.ip, user_agent: body?.user_agent, message: body?.error || e.message }
        });
        dispatch({ type: "SET_LOADING", loading: false });
        return { ok: false, pendingApproval: true, details: body };
      }
      dispatch({ type: "SET_ERROR", error: e.message });
      dispatch({ type: "SET_LOADING", loading: false });
      return { ok: false, error: e.message };
    }
  }, [persistAuth]);

  const logout = useCallback(async () => {
    const token = getToken();
    try {
      if (token) await apiFetch(`/logout`, { method: "POST", token });
    } catch (_) {}
    clearAuth();
    return true;
  }, [getToken, clearAuth]);

  const fetchCurrentUser = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    try {
      const u = await apiFetch(`/current-user`, { token });
      persistAuth(token, u);
      return u;
    } catch (e) {
      handle401(e);
      throw e;
    }
  }, [getToken, persistAuth, handle401]);

  // ------ device approval (admin) ------
  const approveByCode = useCallback(async (code) => {
    const token = getToken();
    return apiFetch(`/approve-by-code`, { method: "POST", token, body: { code } });
  }, [getToken]);

  const getDeviceRequests = useCallback(async () => {
    const token = getToken();
    const res = await apiFetch(`/device-requests`, { token });
    dispatch({ type: "SET_DEVICE_REQUESTS", requests: res || [] });
    return res;
  }, [getToken]);

  const getDeviceSummary = useCallback(async () => {
    const token = getToken();
    const res = await apiFetch(`/device-summary`, { token });
    dispatch({ type: "SET_DEVICE_SUMMARY", summary: res || {} });
    return res;
  }, [getToken]);

  // ------ users CRUD ------
  const createUser = useCallback(async (payload) => {
    const token = getToken();
    return apiFetch(`/users`, { method: "POST", token, body: payload });
  }, [getToken]);

  const getUsers = useCallback(async ({ all = false } = {}) => {
    const token = getToken();
    const res = await apiFetch(`/users${qs({ all })}`, { token });
    dispatch({ type: "SET_USERS", users: Array.isArray(res) ? res : [] });
    return res;
  }, [getToken]);

  const getUser = useCallback(async (user_id) => {
    const token = getToken();
    return apiFetch(`/users/${user_id}`, { token });
  }, [getToken]);

  const updateUser = useCallback(async (user_id, patch) => {
    const token = getToken();
    const res = await apiFetch(`/users/${user_id}`, { method: "PUT", token, body: patch });
    try {
      if (state.user && Number(state.user.id) === Number(user_id)) await fetchCurrentUser();
    } catch (_) {}
    return res;
  }, [getToken, state.user, fetchCurrentUser]);

  const deleteUser = useCallback(async (user_id) => {
    const token = getToken();
    return apiFetch(`/users/${user_id}`, { method: "DELETE", token });
  }, [getToken]);

  const reactivateUser = useCallback(async (user_id) => {
    const token = getToken();
    return apiFetch(`/users/${user_id}/reactivate`, { method: "POST", token });
  }, [getToken]);

  const resetPassword = useCallback(async (user_id, newPassword) => {
    const token = getToken();
    return apiFetch(`/reset-password/${user_id}`, { method: "PUT", token, body: { password: newPassword } });
  }, [getToken]);
  const rejectDeviceRequest = useCallback(async (request_id) => {
  const token = getToken();
  // adjust the path if your backend uses a different route
  const res = await apiFetch(`/device-requests/${request_id}`, {
    method: "DELETE",
    token,
  });
  return res; // { message }
}, [getToken]);

  // ------ derived helpers ------
  const isLoggedIn = !!state.token && !!state.user;
  const isAdmin = (state.user?.role || "").toLowerCase() === "admin";
  const isOverallAdmin = isAdmin && (state.user?.admin_level || "").toLowerCase() === "overall";

  const hasRole = useCallback((...roles) => {
    const r = (state.user?.role || "").toLowerCase();
    return roles.map((x) => String(x).toLowerCase()).includes(r);
  }, [state.user]);

  // Aliases for your Home.jsx naming
  const isAuthenticated = isLoggedIn;
  const needsApproval = state.pendingApproval;
  const clearNeedsApproval = useCallback(() => {
    dispatch({ type: "SET_PENDING_APPROVAL", value: null });
  }, []);

  const value = useMemo(() => ({
    // state
    token: state.token,
    user: state.user,
    loading: state.loading,
    error: state.error,
    pendingApproval: state.pendingApproval,
    deviceRequests: state.deviceRequests,
    deviceSummary: state.deviceSummary,
    users: state.users,

    // auth
    login,
    logout,
    fetchCurrentUser,
    getToken,

    // device approval
    approveByCode,
    getDeviceRequests,
    getDeviceSummary,

    // users
    createUser,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    reactivateUser,
    resetPassword,

    // helpers
    isLoggedIn,
    isAuthenticated,     // alias for Home.jsx
    isAdmin,
    isOverallAdmin,
    hasRole,
    needsApproval,       // alias for Home.jsx
    clearNeedsApproval,
    rejectDeviceRequest,
      // alias for Home.jsx

    // internals (rarely needed)
    _persistAuth: persistAuth,
    _clearAuth: clearAuth,
  }), [state,
        login, logout, fetchCurrentUser, getToken,
        approveByCode, getDeviceRequests, getDeviceSummary,
        createUser, getUsers, getUser, updateUser, deleteUser, reactivateUser, resetPassword,
        isLoggedIn, isAuthenticated, isAdmin, isOverallAdmin, hasRole,
        needsApproval, clearNeedsApproval,rejectDeviceRequest,
        persistAuth, clearAuth]);

  // On boot: if we have a token but no user, fetch it; ignore errors
  useEffect(() => {
    if (state.token && !state.user) {
      fetchCurrentUser().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// -------------------- Convenience Hooks --------------------
export function useAuth() { return useUserContext(); }
export function useRequireOverallAdmin() {
  const { isOverallAdmin } = useUserContext();
  return isOverallAdmin;
}
export function useUser() {
  return useContext(UserContext);
}
