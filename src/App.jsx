// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";

import Home from "./pages/Home";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import PackagingAdmin from "./pages/PackagingAdmin.jsx";
import CashierSale from "./pages/CashierSale.jsx";
import CashierExpenses from "./pages/CashierExpenses.jsx";
import CashierCustomers from "./pages/CashierCustomers.jsx";
import CashierStock from "./pages/CashierStock.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

// 🔐 Contexts
import { UserProvider, useUser } from "./contexts/UserContext.jsx";
import { PackagingProvider } from "./contexts/PackagingContext.jsx";
import { SaleProvider } from "./contexts/SaleContext.jsx";

// ✅ Only import 'toast' here (single ToastContainer lives in index.jsx)
import { toast } from "react-toastify";

/* ----------------- Role helpers (centralized) ----------------- */
function normalizeRole(user) {
  return (user?.role_slug || user?.role || "").toString().trim().toLowerCase();
}
function roleFlags(user, ctxOverallAdmin) {
  const r = normalizeRole(user);
  const isOverall =
    !!ctxOverallAdmin ||
    user?.is_overall_admin === true ||
    user?.is_super_admin === true ||
    r === "overall_admin" ||
    r === "overall-admin" ||
    r === "superadmin";
  const isAdmin = user?.is_admin === true || r === "admin";
  const isCashier = r === "cashier";
  return { isOverall, isAdmin, isCashier };
}

export default function App() {
  return (
    <UserProvider>
      <WithSaleProvider>
        <PackagingProvider>
          <Router>
            {/* Re-mount route tree on auth changes to avoid “manual refresh” feeling */}
            <AuthRerenderKey>
              <div className="flex min-h-screen flex-col bg-gray-900 text-white lg:flex-row">
                {/* Re-mount NavBar when auth flips, so UI updates instantly */}
                <NavKeyed />
                <main className="flex w-full items-center justify-center p-6 lg:w-5/6">
                  <div className="w-full max-w-7xl">
                    {/* 🔔 Global auth toaster (no container here) */}
                    <AuthToasterRoot />
                    <Routes>
                      {/* Public (auto-redirect logged-in users to /dashboard) */}
                      <Route path="/" element={<AutoHome />} />
                      {/* Alias so hard redirects to /login work */}
                      <Route path="/login" element={<AutoHome />} />

                      {/* Dashboards */}
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <AdminDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/dashboard"
                        element={
                          <RequireAdmin>
                            <AdminDashboard />
                          </RequireAdmin>
                        }
                      />

                      {/* Admin areas (Admin OR Overall Admin) */}
                      <Route
                        path="/admin/packaging"
                        element={
                          <RequireAdmin>
                            <PackagingAdmin />
                          </RequireAdmin>
                        }
                      />

                      {/* Users page (Overall → full; Admin → readOnly) */}
                      <Route
                        path="/admin/users"
                        element={
                          <RequireAdmin>
                            <UsersRoute />
                          </RequireAdmin>
                        }
                      />

                      {/* Cashier pages — allow Cashier, Admin, Overall Admin */}
                      <Route
                        path="/cashier/sale"
                        element={
                          <RequireCashierOrAdmin>
                            <CashierSale />
                          </RequireCashierOrAdmin>
                        }
                      />
                      <Route
                        path="/cashier/expenses"
                        element={
                          <RequireCashierOrAdmin>
                            <CashierExpenses />
                          </RequireCashierOrAdmin>
                        }
                      />
                      <Route
                        path="/cashier/customers"
                        element={
                          <RequireCashierOrAdmin>
                            <CashierCustomers />
                          </RequireCashierOrAdmin>
                        }
                      />
                      <Route
                        path="/cashier/stock"
                        element={
                          <RequireCashierOrAdmin>
                            <CashierStock />
                          </RequireCashierOrAdmin>
                        }
                      />

                      {/* Fallback */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </main>
              </div>
              <Footer />
            </AuthRerenderKey>
          </Router>
        </PackagingProvider>
      </WithSaleProvider>
    </UserProvider>
  );
}

/** Wrap SaleProvider so it always has the latest auth token from UserContext */
function WithSaleProvider({ children }) {
  const { token } = useUser();
  return <SaleProvider getToken={() => token}>{children}</SaleProvider>;
}

/**
 * Forces a remount of the route tree when auth flips (login/logout).
 * This clears any stale page state that might make it look like you need a manual refresh.
 */
function AuthRerenderKey({ children }) {
  const { token } = useUser();
  return <AuthLocationKey key={token ? "authed" : "guest"}>{children}</AuthLocationKey>;
}

/**
 * Also include location in the key so navigating to the same route after auth flips
 * still re-evaluates guards cleanly.
 */
function AuthLocationKey({ children }) {
  const location = useLocation();
  const { token } = useUser();
  return <div key={`${token ? "in" : "out"}:${location.pathname}`}>{children}</div>;
}

/** Remount NavBar on auth changes so its menus show correct state instantly */
function NavKeyed() {
  const { token } = useUser();
  return <NavBar key={token ? "nav-in" : "nav-out"} />;
}

/* ----------------- Global toaster for auth events ----------------- */
function AuthToasterRoot() {
  const { error, pendingApproval, isLoggedIn } = useUser();
  const ref = React.useRef({ wasLoggedIn: isLoggedIn });

  // Deduped error toast
  React.useEffect(() => {
    if (!error) return;
    toast.error(error, { toastId: "auth-error" });
  }, [error]);

  // Optional: toast for server-side revocation
  React.useEffect(() => {
    const handler = () => {
      toast.error("Session ended. Please sign in again.", { toastId: "auth-ended" });
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  // Optional: show signed-out once
  React.useEffect(() => {
    if (ref.current.wasLoggedIn && !isLoggedIn) {
      toast.success("Signed out", { toastId: "logout-toast" });
    }
    ref.current.wasLoggedIn = isLoggedIn;
  }, [isLoggedIn]);

  return null;
}

/* ----------------- Route Guards ----------------- */

function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useUser();
  if (loading) return <ScreenSpinner label="Loading…" />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

/** Admin OR Overall Admin */
function RequireAdmin({ children }) {
  const { isLoggedIn, isOverallAdmin, user, loading } = useUser();
  if (loading) return <ScreenSpinner label="Checking access…" />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  const { isOverall, isAdmin } = roleFlags(user, isOverallAdmin);
  if (!(isOverall || isAdmin)) return <DeniedAdmin />;
  return children;
}

/** Only Overall Admin */
function RequireOverallAdmin({ children }) {
  const { isLoggedIn, isOverallAdmin, user, loading } = useUser();
  if (loading) return <ScreenSpinner label="Checking access…" />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  const { isOverall } = roleFlags(user, isOverallAdmin);
  if (!isOverall) return <Denied />;
  return children;
}

/** Cashier OR Admin OR Overall Admin */
function RequireCashierOrAdmin({ children }) {
  const { isLoggedIn, isOverallAdmin, user, loading } = useUser();
  if (loading) return <ScreenSpinner label="Checking access…" />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  const { isOverall, isAdmin, isCashier } = roleFlags(user, isOverallAdmin);
  if (!(isCashier || isAdmin || isOverall)) return <Denied />;
  return children;
}

/* ------------- Role-aware wrapper for Users page ------------- */
function UsersRoute() {
  const { isOverallAdmin, user } = useUser();
  const { isOverall } = roleFlags(user, isOverallAdmin);
  return <AdminUsers readOnly={!isOverall} />;
}

/* ------------- UX helpers (spinner, denied, 404, auto-home) ------------- */

function ScreenSpinner({ label = "Loading…" }) {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex items-center gap-3 text-white/70">
        <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

function Denied() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
      <h3 className="text-lg font-semibold text-red-200">Access Denied</h3>
      <p className="mt-2 text-sm text-red-100/80">You don’t have permission to view this page.</p>
    </div>
  );
}

function DeniedAdmin() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-center">
      <h3 className="text-lg font-semibold text-yellow-200">Admin Only</h3>
      <p className="mt-2 text-sm text-yellow-100/80">
        You need <strong>Admin</strong> or <strong>Overall Admin</strong> access for this page.
      </p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="text-center">
        <div className="text-6xl font-black tracking-tight text-white/20">404</div>
        <p className="mt-2 text-white/70">Page not found.</p>
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:shadow-lg"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}

/** Public home that auto routes logged-in users to dashboard */
function AutoHome() {
  const { isLoggedIn, loading } = useUser();
  if (loading) return <ScreenSpinner label="Loading…" />;
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : <Home />;
}
