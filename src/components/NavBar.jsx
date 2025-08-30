// src/components/NavBar.jsx — glassy, responsive sidebar + mobile drawer
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext.jsx";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  FiMenu, FiX, FiChevronLeft, FiChevronRight,
  FiShoppingCart, FiDollarSign, FiUsers, FiBox, FiArchive,
  FiBarChart2, FiUserCheck, FiLogOut, FiLogIn
} from "react-icons/fi";
import { toast } from "react-toastify";

// visual styles
const linkBase =
  "relative flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/10";
const linkActive = "bg-white/10 text-white shadow-inner";

// Optional brand via env, with fallback
const BRAND =
  (import.meta.env?.VITE_BRAND_NAME) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BRAND_NAME) ||
  "Blue Bash";

/* ---------- role helpers ---------- */
function normalizeRole(user) {
  return (user?.role_slug || user?.role || "")
    .toString()
    .trim()
    .toLowerCase();
}
function roleFlags(user, ctxOverallAdmin) {
  const r = normalizeRole(user);
  const isOverall =
    !!ctxOverallAdmin ||
    user?.is_overall_admin === true ||
    user?.is_super_admin === true ||
    r === "overall_admin" || r === "overall-admin" || r === "superadmin";
  const isAdmin = user?.is_admin === true || r === "admin";
  const isCashier = r === "cashier" || r === "server";
  return { isOverall, isAdmin, isCashier };
}

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggedIn, isOverallAdmin } = useUser();
  const { isOverall, isAdmin, isCashier } = roleFlags(user, isOverallAdmin);

  const showCashierSection = isCashier || isAdmin || isOverall; // admins can also access cashier tools
  const showAdminSection = isAdmin || isOverall;

  const cashierLinks = [
    { to: "/cashier/sale", icon: <FiShoppingCart />, label: "Sale" },
    { to: "/cashier/customers", icon: <FiUsers />, label: "Customers" },
    { to: "/cashier/expenses", icon: <FiArchive />, label: "Expenses" },
    { to: "/cashier/stock", icon: <FiBox />, label: "Stock" },
  ];
  const adminLinks = [
    { to: "/admin/dashboard", icon: <FiBarChart2 />, label: "Dashboard" },
    { to: "/admin/packaging", icon: <FiArchive />, label: "Packaging" },
    { to: "/admin/users", icon: <FiUserCheck />, label: "Users & Devices" },
  ];

  // mobile drawer
  const [open, setOpen] = useState(false);

  // desktop collapse state + persistence
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // keyboard shortcut: Ctrl+B to toggle collapse
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Redirect after login by role (Admin→/admin/dashboard, Cashier→/cashier/sale)
  useEffect(() => {
    if (!isLoggedIn) return;
    const p = location.pathname;
    if (p === "/" || p === "/dashboard" || p === "/admin") {
      if (isAdmin || isOverall) navigate("/admin/dashboard", { replace: true });
      else if (isCashier) navigate("/cashier/sale", { replace: true });
    }
  }, [isLoggedIn, isAdmin, isOverall, isCashier, location.pathname, navigate]);

  // logout with toasts
  const handleLogout = async () => {
    const id = "logout-toast"; // stable id avoids dupes
    try {
      toast.loading("Signing out…", { toastId: id });
      await logout(); // your context fn
      toast.update(id, {
        render: "Signed out",
        type: "success",
        isLoading: false,
        autoClose: 1800,
        closeOnClick: true,
      });
      setTimeout(() => navigate("/", { replace: true }), 120);
    } catch (e) {
      toast.update(id, {
        render: e?.message || "Failed to logout",
        type: "error",
        isLoading: false,
        autoClose: 3000,
        closeOnClick: true,
      });
    }
  };

  const handleBrandClick = () => {
    if (isAdmin || isOverall) navigate("/admin/dashboard");
    else if (isCashier) navigate("/cashier/sale");
    else navigate("/");
  };

  return (
    <>
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/80 p-4 backdrop-blur lg:hidden print:hidden">
        <Brand collapsed={false} onClick={handleBrandClick} />
        <button onClick={() => setOpen(true)} className="rounded p-2 hover:bg-white/10" aria-label="Open menu">
          <FiMenu size={22} />
        </button>
      </div>

      {/* Sidebar (desktop) with collapse */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-slate-950/80 p-3 backdrop-blur lg:flex lg:flex-col transition-[width] duration-200 print:hidden ${collapsed ? "w-20" : "w-64"}`}
      >
        {/* gradient top accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 rounded-full mb-3" />

        <div className="mb-3 flex items-center justify-between">
          <Brand collapsed={collapsed} onClick={handleBrandClick} />
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded p-2 hover:bg-white/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,black,black,transparent)]">
          <NavSection title="Cashier" show={showCashierSection} links={cashierLinks} collapsed={collapsed} />
          <NavSection title="Admin" show={showAdminSection} links={adminLinks} collapsed={collapsed} />
        </div>

        {/* user footer + logout / sign-in */}
        <div className={`mt-3 rounded-xl border border-white/10 bg-white/5 ${collapsed ? "px-2 py-2" : "px-3 py-2"}`}>
          <div className="flex items-center gap-2">
            <Avatar name={user?.name} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user?.name || "Guest"}</div>
                <div className="truncate text-[11px] text-white/60">{user?.role || "-"}</div>
              </div>
            )}
            <div className="ml-auto">
              {isLoggedIn ? (
                collapsed ? (
                  <Tooltip.Provider delayDuration={200}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={handleLogout}
                          className="rounded p-2 hover:bg-white/10"
                          aria-label="Logout"
                          title="Logout"
                        >
                          <FiLogOut />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="right"
                          className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow"
                        >
                          Logout
                          <Tooltip.Arrow className="fill-white" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
                  >
                    <FiLogOut className="text-sm" /> Logout
                  </button>
                )
              ) : (
                <>
                  {collapsed ? (
                    <Tooltip.Provider delayDuration={200}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <NavLink
                            to="/?login=1"
                            className="rounded p-2 hover:bg-white/10"
                            aria-label="Sign in"
                            title="Sign in"
                          >
                            <FiLogIn />
                          </NavLink>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="right"
                            className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow"
                          >
                            Sign in
                            <Tooltip.Arrow className="fill-white" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  ) : (
                    <NavLink
                      to="/?login=1"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
                    >
                      <FiLogIn className="text-sm" /> Sign in
                    </NavLink>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Slide-over (mobile) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 translate-x-0 bg-slate-950/95 p-4 shadow-xl transition-transform">
            <div className="mb-3 flex items-center justify-between">
              <Brand collapsed={false} onClick={() => { setOpen(false); handleBrandClick(); }} />
              <button onClick={() => setOpen(false)} className="rounded p-2 hover:bg-white/10" aria-label="Close menu">
                <FiX size={20} />
              </button>
            </div>

            <NavSection title="Cashier" show={showCashierSection} links={cashierLinks} onNavigate={() => setOpen(false)} />
            <NavSection title="Admin" show={showAdminSection} links={adminLinks} onNavigate={() => setOpen(false)} />

            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <Avatar name={user?.name} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{user?.name || "Guest"}</div>
                  <div className="truncate text-xs text-white/60">{user?.role || "-"}</div>
                </div>
                <div className="ml-auto">
                  {isLoggedIn ? (
                    <button
                      onClick={() => {
                        setOpen(false);
                        handleLogout();
                      }}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
                    >
                      <FiLogOut className="text-sm" /> Logout
                    </button>
                  ) : (
                    <NavLink
                      to="/?login=1"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
                    >
                      <FiLogIn className="text-sm" /> Sign in
                    </NavLink>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Brand({ collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 cursor-pointer select-none"
      title={BRAND}
    >
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-slate-900 font-bold shadow ring-1 ring-white/20">B</div>
      <span
        className={`text-lg font-semibold transition-[opacity,width] duration-200 ${collapsed ? "pointer-events-none w-0 opacity-0" : "opacity-100"}`}
      >
        {BRAND}
      </span>
    </button>
  );
}

function NavSection({ title, show, links, collapsed, onNavigate }) {
  if (!show) return null;
  return (
    <div className="mb-4">
      {!collapsed && (
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="text-xs uppercase tracking-wider text-white/50">{title}</div>
          <div className="h-px flex-1 bg-white/10 ml-3" />
        </div>
      )}
      <nav className="grid gap-1">
        {links.map((l) => (
          <NavItem key={l.to} to={l.to} icon={l.icon} label={l.label} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}

/** Render-prop NavLink so we can style the active marker reliably */
function NavItem({ to, icon, label, collapsed, onNavigate }) {
  const linkEl = (
    <NavLink to={to} end onClick={onNavigate} className="block">
      {({ isActive }) => (
        <div
          className={`${linkBase} ${isActive ? linkActive : "text-white/85"} ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {/* active gradient marker */}
          <span
            className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-gradient-to-b from-emerald-300 via-cyan-300 to-sky-400 ${isActive ? "opacity-100" : "opacity-0"}`}
          />
          <span className="text-lg">{icon}</span>
          <span className={`${collapsed ? "sr-only" : ""}`}>{label}</span>
        </div>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{linkEl}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow">
              {label}
              <Tooltip.Arrow className="fill-white" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }
  return linkEl;
}

function Avatar({ name }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-900 text-sm font-semibold">
      {letter || "?"}
    </div>
  );
}
