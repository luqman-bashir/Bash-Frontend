// src/contexts/UserContext.jsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef
} from "react";

/**
 * UserContext.jsx
 * Auth + Users + Device Approval client for your Flask routes.
 *
 * ✅ Adds stable device fingerprint:
 *   - Generates UUID once (localStorage key "bb.device_id")
 *   - Sends it on every request as "X-Device-Id"
 */

// -------------------- API Helpers --------------------
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
  "/api"; // dev container: Vite proxies /api -> http://backend:5000

// Heartbeat (in ms) to notice revoked/deactivated sessions while idle
const HEARTBEAT_MS = Number(
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_AUTH_HEARTBEAT_MS) || 30000
);

// Where to send users after logout/401
const LOGIN_PATH =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_LOGIN_PATH) || "/login";

// Hard redirect toggle (recommended: true)
const REDIRECT_ON_LOGOUT = String(
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_AUTH_REDIRECT_ON_LOGOUT) ?? "true"
).toLowerCase() === "true";

// Use the same key everywhere in the app
const TOKEN_KEY = "token";
const USER_KEY = "auth_user";

// ✅ New: stable device id
const DEVICE_KEY = "bb.device_id";
function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      // Modern browsers: crypto.randomUUID()
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // If localStorage is unavailable, use ephemeral (will require re-approval per session)
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}
const DEVICE_ID = getOrCreateDeviceId();

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

  // ✅ Always send device header
  const baseHeaders = {
    ...(expectBlob ? {} : jsonHeaders),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "X-Device-Id": DEVICE_ID,
    ...(headers || {}),
  };

  const opts = { method, headers: baseHeaders };
  if (body !== undefined && body !== null && !expectBlob) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  // Build a rich error if not OK
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
  error: null, // global error (non-login)

  // for restricted roles on new device
  pendingApproval: null, // { ip, user_agent, message, request_id, email_sent? }

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

  // --- auto-logout timer based on JWT exp ---
  const logoutTimerRef = useRef(null);
  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  function decodeJwtExp(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  const hardRedirectToLogin = useCallback(() => {
    if (!REDIRECT_ON_LOGOUT) return;
    setTimeout(() => {
      try {
        window.location.assign(LOGIN_PATH);
      } catch {
        window.location.href = LOGIN_PATH;
      }
    }, 50);
  }, []);

  const clearAuth = useCallback(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch (_) {}
    clearLogoutTimer();
    dispatch({ type: "SET_AUTH", token: "", user: null });
    try { window.dispatchEvent(new CustomEvent("auth:logout")); } catch {}
    hardRedirectToLogin();
  }, [clearLogoutTimer, hardRedirectToLogin]);

  const scheduleAutoLogout = useCallback((token) => {
    clearLogoutTimer();
    const expMs = decodeJwtExp(token);
    if (!expMs) return;
    const msLeft = expMs - Date.now();
    if (msLeft <= 0) {
      clearAuth();
      return;
    }
    logoutTimerRef.current = setTimeout(() => {
      clearAuth();
    }, msLeft + 500);
  }, [clearAuth]);

  // ------ helpers ------
  const persistAuth = useCallback((token, user) => {
    try {
      if (typeof localStorage !== "undefined") {
        if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY);
      }
    } catch (_) {}
    dispatch({ type: "SET_AUTH", token, user });
    if (token) scheduleAutoLogout(token);
    else clearLogoutTimer();
  }, [scheduleAutoLogout, clearLogoutTimer]);

  // Stable getter for other providers
  const getToken = useCallback(
    () => state.token || ((typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || ""),
    [state.token]
  );

  // Centralized 401 handler around apiFetch
  const request = useCallback(async (path, opts = {}) => {
    try {
      return await apiFetch(path, opts);
    } catch (e) {
      if (e?.status === 401) {
        clearAuth();
        try { window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: e })); } catch {}
      }
      throw e;
    }
  }, [clearAuth]);

  // ------ auth routes ------
  const login = useCallback(async ({ email, password }) => {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_PENDING_APPROVAL", value: null });
    try {
      // ✅ DEVICE HEADER is automatically added by apiFetch
      const res = await request(`/login`, { method: "POST", body: { email, password } });
      const token = res?.token || "";
      const user = res?.user || null;
      if (!token || !user) throw new Error("Invalid login response");
      persistAuth(token, user);
      dispatch({ type: "SET_LOADING", loading: false });
      return { ok: true, user };
    } catch (e) {
      // ✅ Be robust: check for explicit code + fallback on message includes
      const code = e?.data?.error || "";
      if (e?.status === 403 && (code === "DEVICE_PENDING" || (e?.message || "").toLowerCase().includes("device"))) {
        const body = e?.data || {};
        const value = {
          ip: body?.ip,
          user_agent: body?.user_agent,
          message: body?.message || body?.error || e.message,
          request_id: body?.request_id || null,
          email_sent: !!body?.email_sent,
        };
        dispatch({ type: "SET_PENDING_APPROVAL", value });
        dispatch({ type: "SET_LOADING", loading: false });
        return { ok: false, pendingApproval: true, details: body };
      }
      dispatch({ type: "SET_LOADING", loading: false });
      return { ok: false, error: e.message };
    }
  }, [persistAuth, request]);

  const logout = useCallback(async () => {
    const token = getToken();
    try {
      if (token) await request(`/logout`, { method: "POST", token });
    } catch (_) {}
    clearAuth();
    return true;
  }, [getToken, request, clearAuth]);

  const fetchCurrentUser = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    const u = await request(`/current-user`, { token });
    persistAuth(token, u);
    return u;
  }, [getToken, persistAuth, request]);

  // ------ device approval (admin) ------
  const approveByCode = useCallback(async (arg1, arg2) => {
    const token = getToken();

    let request_id, code;
    if (typeof arg1 === "object" && arg1 !== null) {
      request_id = arg1.request_id;
      code = arg1.code;
    } else if (arg2 !== undefined) {
      request_id = arg1;
      code = arg2;
    } else {
      code = arg1;
      request_id = state.pendingApproval?.request_id;
    }
    if (!request_id || !code) {
      throw new Error("request_id and code are required");
    }

    return request(`/approve-by-code`, {
      method: "POST",
      token,
      body: { request_id, code }
    });
  }, [getToken, request, state.pendingApproval]);

  const approveDevice = useCallback(async (request_id) => {
    const token = getToken();
    if (!request_id) throw new Error("request_id is required");
    const res = await request(`/approve-device`, {
      method: "POST",
      token,
      body: { request_id }
    });
    if (state.pendingApproval?.request_id && Number(state.pendingApproval.request_id) === Number(request_id)) {
      dispatch({ type: "SET_PENDING_APPROVAL", value: null });
    }
    return res;
  }, [getToken, request, state.pendingApproval]);

  const approvePending = useCallback(async () => {
    const reqId = state.pendingApproval?.request_id;
    if (!reqId) throw new Error("No pending approval on this client");
    return approveDevice(reqId);
  }, [state.pendingApproval, approveDevice]);

  const getDeviceRequests = useCallback(async () => {
    const token = getToken();
    const res = await request(`/device-requests`, { token });
    dispatch({ type: "SET_DEVICE_REQUESTS", requests: res || [] });
    return res;
  }, [getToken, request]);

  const getDeviceSummary = useCallback(async () => {
    const token = getToken();
    const res = await request(`/device-summary`, { token });
    dispatch({ type: "SET_DEVICE_SUMMARY", summary: res || {} });
    return res;
  }, [getToken, request]);

  const rejectDeviceRequest = useCallback(async (request_id) => {
    const token = getToken();
    return request(`/device-requests/${request_id}`, { method: "DELETE", token });
  }, [getToken, request]);

  // ------ users CRUD ------
  const createUser = useCallback(async (payload) => {
    const token = getToken();
    return request(`/users`, { method: "POST", token, body: payload });
  }, [getToken, request]);

  const getUsers = useCallback(async ({ all = false } = {}) => {
    const token = getToken();
    const res = await request(`/users${qs({ all })}`, { token });
    dispatch({ type: "SET_USERS", users: Array.isArray(res) ? res : [] });
    return res;
  }, [getToken, request]);

  const getUser = useCallback(async (user_id) => {
    const token = getToken();
    return request(`/users/${user_id}`, { token });
  }, [getToken, request]);

  const updateUser = useCallback(async (user_id, patch) => {
    const token = getToken();
    const res = await request(`/users/${user_id}`, { method: "PUT", token, body: patch });
    try {
      if (state.user && Number(state.user.id) === Number(user_id)) await fetchCurrentUser();
    } catch (_) {}
    return res;
  }, [getToken, state.user, fetchCurrentUser, request]);

  const deleteUser = useCallback(async (user_id) => {
    const token = getToken();
    return request(`/users/${user_id}`, { method: "DELETE", token });
  }, [getToken, request]);

  const reactivateUser = useCallback(async (user_id) => {
    const token = getToken();
    return request(`/users/${user_id}/reactivate`, { method: "POST", token });
  }, [getToken, request]);

  // New signature: resetPassword(user_id, { newPassword, currentPassword? })
  // Backward compatible: resetPassword(user_id, newPassword, currentPassword?)
  const resetPassword = useCallback(async (user_id, arg1, arg2) => {
    let newPassword, currentPassword;
    if (typeof arg1 === "object" && arg1 !== null) {
      newPassword = arg1.newPassword;
      currentPassword = arg1.currentPassword;
    } else {
      newPassword = arg1;
      currentPassword = arg2;
    }
    if (!newPassword) throw new Error("New password is required");
    const token = getToken();
    const body = { new_password: newPassword };
    if (currentPassword) body.current_password = currentPassword;
    return request(`/reset-password/${user_id}`, { method: "PUT", token, body });
  }, [getToken, request]);

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
    approveByCode,        // legacy / email mode
    approveDevice,        // manual (no code)
    approvePending,       // convenience
    getDeviceRequests,
    getDeviceSummary,
    rejectDeviceRequest,

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

    // internals
    _persistAuth: persistAuth,
    _clearAuth: clearAuth,
    _request: request,

    // ✅ expose device id for UI/debug
    deviceId: DEVICE_ID,
  }), [
    state,
    login, logout, fetchCurrentUser, getToken,
    approveByCode, approveDevice, approvePending, getDeviceRequests, getDeviceSummary, rejectDeviceRequest,
    createUser, getUsers, getUser, updateUser, deleteUser, reactivateUser, resetPassword,
    isLoggedIn, isAuthenticated, isAdmin, isOverallAdmin, hasRole, needsApproval, clearNeedsApproval,
    persistAuth, clearAuth, request
  ]);

  // On boot: if we have a token schedule auto-logout and, if no user, fetch it
  useEffect(() => {
    if (state.token) {
      const token = state.token;
      const exp = decodeJwtExp(token);
      if (exp) {
        const msLeft = exp - Date.now();
        if (msLeft > 0) {
          clearLogoutTimer();
          logoutTimerRef.current = setTimeout(() => {
            clearAuth();
          }, msLeft + 500);
        } else {
          clearAuth();
        }
      }
      if (!state.user) {
        fetchCurrentUser().catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Heartbeat to catch server-side revocations (deactivate, manual invalidation)
  useEffect(() => {
    if (!state.token) return;
    let cancelled = false;

    const ping = () => {
      if (cancelled) return;
      fetchCurrentUser().catch(() => { /* 401 handled in request() -> clearAuth() */ });
    };

    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };

    const id = setInterval(ping, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state.token, fetchCurrentUser]);

  // Cross-tab logout sync (when one tab clears token, others follow)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY && !e.newValue) {
        clearAuth();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearAuth]);

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
