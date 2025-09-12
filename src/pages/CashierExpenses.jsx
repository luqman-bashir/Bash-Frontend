import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Trash2, RefreshCcw, Save, X, Search, Package } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { useUser } from "../contexts/UserContext.jsx";

/** Small utils */
const todayStr = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
};

const daysAgoStr = (n) => {
  const now = new Date();
  now.setDate(now.getDate() - n);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
};

const yesterdayStr = () => daysAgoStr(1);
const last7DaysStr = () => {
  const end = todayStr();
  const start = daysAgoStr(6);
  return { start, end };
};

const fmtMoney = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "KES",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0,
      }).format(Number(v));

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "/api";

/** Responsive helpers */
function useIsSmall() {
  const [small, setSmall] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : true
  );
  useEffect(() => {
    const onR = () => setSmall(window.innerWidth < 640);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return small;
}

/** SweetAlert (responsive) */
const swal = Swal.mixin({
  buttonsStyling: false,
  width: "min(92vw, 420px)",
  showClass: { popup: "swal2-show" },
  hideClass: { popup: "swal2-hide" },
  customClass: {
    popup: "rounded-2xl border border-white/10 bg-[#0b0f17] text-white",
    title: "text-base sm:text-lg",
    htmlContainer: "text-sm",
    confirmButton: "rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium",
    cancelButton: "rounded-xl border border-white/20 px-3 py-2 text-sm font-medium ml-2",
  },
});

export default function CashierExpenses() {
  const isSmall = useIsSmall();
  const toastPos = isSmall ? "top-center" : "top-right";

  // ---- token handling ----
  const userCtx = useUser?.() || {};
  const getDefaultToken = () => {
    try {
      return (
        (typeof localStorage !== "undefined" &&
          (localStorage.getItem("token") || localStorage.getItem("access_token"))) ||
        ""
      );
    } catch {
      return "";
    }
  };
  const token =
    (typeof userCtx.getToken === "function" && (userCtx.getToken() || userCtx.token)) ||
    userCtx.token ||
    getDefaultToken();

  // ---- state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    date_from: todayStr(),
    date_to: todayStr(),
    include_deleted: false,
  });

  // modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCogsModal, setShowCogsModal] = useState(false);

  // --- Quick range active detection (like AdminDashboard) ---
  const t = todayStr();
  const y = yesterdayStr();
  const { start: l7s, end: l7e } = last7DaysStr();
  const isTodayActive = filters.date_from === t && filters.date_to === t;
  const isYesterdayActive = filters.date_from === y && filters.date_to === y;
  const isLast7Active = filters.date_from === l7s && filters.date_to === l7e;

  // ---- API helper ----
  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }

  // ---- loaders ----
  const list = async (rangeOverride) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const df = rangeOverride?.date_from ?? filters.date_from ?? "";
      const dt = rangeOverride?.date_to ?? filters.date_to ?? "";
      const incDel =
        rangeOverride?.include_deleted !== undefined
          ? String(!!rangeOverride.include_deleted)
          : String(!!filters.include_deleted);

      const qs = new URLSearchParams({
        date_from: df,
        date_to: dt,
        include_deleted: incDel,
      });
      const expRes = await api(`/expenses?${qs.toString()}`);
      const expData = Array.isArray(expRes?.data) ? expRes.data : [];
      setRows(expData);
    } catch (e) {
      setError(e.message || "Failed to load expenses");
      toast.error(e.message || "Failed to load expenses", { position: toastPos, autoClose: 2500 });
    } finally {
      setLoading(false);
    }
  };

  const loadToday = async () => {
    const t = todayStr();
    const next = { ...filters, date_from: t, date_to: t, q: "", include_deleted: false };
    setFilters(next);
    await list(next);
  };

  const loadYesterday = async () => {
    const y = yesterdayStr();
    const next = { ...filters, date_from: y, date_to: y, q: "", include_deleted: false };
    setFilters(next);
    await list(next);
  };

  const loadLast7Days = async () => {
    const { start, end } = last7DaysStr();
    const next = { ...filters, date_from: start, date_to: end, q: "", include_deleted: false };
    setFilters(next);
    await list(next);
  };

  useEffect(() => {
    loadToday().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- actions ----
  const saveExpense = async (payload, id) => {
    try {
      await api(id ? `/expenses/${id}` : "/expenses", {
        method: id ? "PUT" : "POST",
        body: payload,
      });
      await list();
      toast.success(id ? "Expense updated" : "Expense created", {
        position: toastPos,
        autoClose: 2000,
      });
    } catch (e) {
      toast.error(e.message || "Failed to save", { position: toastPos, autoClose: 2500 });
      throw e;
    }
  };

  const removeExpense = async (row) => {
    const res = await swal.fire({
      icon: "warning",
      title: "Delete expense?",
      html: `${(row.description || "This expense")
        .toString()
        .slice(0, 120)} will be deleted permanently.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });
    if (!res.isConfirmed) return;
    try {
      await api(`/expenses/${row.id}`, { method: "DELETE" });
      await list();
      toast.success("Expense deleted", { position: toastPos, autoClose: 1800 });
    } catch (e) {
      toast.error(e.message || "Failed to delete", { position: toastPos, autoClose: 2500 });
    }
  };

  // COGS purchase
  const saveCogsPurchase = async (payload) => {
    const body = {
      amount: Number(payload.amount),
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.date ? { date: payload.date } : {}),
      ...(payload.payment_method ? { payment_method: payload.payment_method } : {}),
      ...(payload.bottle_size_id != null && payload.bottle_size_id !== ""
        ? { bottle_size_id: Number(payload.bottle_size_id) }
        : {}),
      ...(payload.unit_cost_carton != null && payload.unit_cost_carton !== ""
        ? { unit_cost_carton: Number(payload.unit_cost_carton) }
        : {}),
    };
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new Error("Amount is required and must be > 0");
    }
    try {
      await api("/cogs", { method: "POST", body });
      await list();
      toast.success("COGS recorded", { position: toastPos, autoClose: 1800 });
    } catch (e) {
      toast.error(e.message || "Failed to record COGS", { position: toastPos, autoClose: 2500 });
      throw e;
    }
  };

  // ---- client-side search (description) ----
  const shownRows = useMemo(() => {
    const q = String(filters.q || "").toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.description || "").toLowerCase().includes(q));
  }, [rows, filters.q]);

  // ---- totals for shown ----
  const totalsByMethod = useMemo(() => {
    return shownRows.reduce(
      (acc, r) => {
        const pm = (r.payment_method || "Cash").trim();
        const amt = Number(r.amount || 0);
        if (pm === "M-Pesa") acc.mpesa += amt;
        else acc.cash += amt;
        acc.total += amt;
        return acc;
      },
      { cash: 0, mpesa: 0, total: 0 }
    );
  }, [shownRows]);

  const countShown = shownRows.length;

  const shortDate = (iso) => {
    if (!iso) return "-";
    try {
      return String(iso).slice(0, 10);
    } catch {
      return iso;
    }
  };

  // ---- UI ----
  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Expenses</h1>
          <p className="text-sm text-gray-400">
            Showing{" "}
            <strong>
              {filters.date_from}
              {filters.date_to !== filters.date_from ? ` → ${filters.date_to}` : ""}
            </strong>
            . Use filters to change the range.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickBtn onClick={() => loadToday().catch(() => {})} active={isTodayActive} disabled={loading} title="Today">
            <RefreshCcw size={16} /> Today
          </QuickBtn>
          <QuickBtn onClick={() => loadYesterday().catch(() => {})} active={isYesterdayActive} disabled={loading} title="Yesterday">
            <RefreshCcw size={16} /> Yesterday
          </QuickBtn>
          <QuickBtn onClick={() => loadLast7Days().catch(() => {})} active={isLast7Active} disabled={loading} title="Last 7 Days">
            <RefreshCcw size={16} /> Last 7 Days
          </QuickBtn>

          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border border-white/10 hover:bg-white/5"
            onClick={() => setShowCogsModal(true)}
            title="Record COGS Purchase"
          >
            <Package size={16} /> COGS Purchase
          </button>

          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white text-gray-900 hover:opacity-90"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> New Expense
          </button>
        </div>
      </header>

      {/* Stats (shown set) — Net Sales removed */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <Stat label="Cash (Shown)" value={fmtMoney(totalsByMethod.cash)} />
        <Stat label="M-Pesa (Shown)" value={fmtMoney(totalsByMethod.mpesa)} />
        <Stat label="Total (Shown)" value={fmtMoney(totalsByMethod.total)} />
        <Stat label="Count (Shown)" value={countShown} />
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-white/10 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-sm text-gray-300">
            <Search size={16} /> Filters
          </div>
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search description (client-side)"
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm w/full sm:w-auto"
          />
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!filters.include_deleted}
              onChange={(e) => setFilters((f) => ({ ...f, include_deleted: e.target.checked }))}
            />
            <span>Include deleted</span>
          </label>
          <button
            className="rounded-xl border border-white/10 px-3 py-2 text-sm"
            onClick={() => list().catch(() => {})}
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 text-sm">
          {String(error)}
        </div>
      )}

      {/* Mobile cards (<= md) */}
      <div className="md:hidden grid gap-3">
        {shownRows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/10 p-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-sm text-gray-400">{shortDate(r.date)}</div>
                <div className="font-medium mt-0.5">{r.description || "-"}</div>
                <div className="text-xs text-gray-400 mt-1">Method: {r.payment_method || "-"}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold">{fmtMoney(r.amount)}</div>
                <div className="mt-2 inline-flex gap-2">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => {
                      setEditing(r);
                      setShowModal(true);
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="icon-btn text-rose-300"
                    title="Delete"
                    onClick={() => removeExpense(r).catch(() => {})}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {shownRows.length === 0 && (
          <div className="rounded-2xl border border-white/10 p-6 text-center text-gray-400">
            {loading ? "Loading…" : "No expenses"}
          </div>
        )}
      </div>

      {/* Desktop table (>= md) */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block">
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{shortDate(r.date)}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2">{r.payment_method || "-"}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.amount)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => {
                            setEditing(r);
                            setShowModal(true);
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-btn text-rose-300"
                          title="Delete"
                          onClick={() => removeExpense(r).catch(() => {})}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shownRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                      {loading ? "Loading…" : "No expenses"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {showModal && (
        <ExpenseModal
          editing={editing}
          onClose={() => setShowModal(false)}
          onSubmit={async (payload) => {
            await saveExpense(payload, editing?.id);
            setShowModal(false);
          }}
        />
      )}

      {showCogsModal && (
        <CogsModal
          onClose={() => setShowCogsModal(false)}
          onSubmit={async (payload) => {
            await saveCogsPurchase(payload);
            setShowCogsModal(false);
          }}
        />
      )}
    </div>
  );
}

/* -------- Subcomponents -------- */

function QuickBtn({ children, onClick, title, active = false, disabled = false }) {
  const base =
    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 border transition-colors shrink-0";
  const normal = "border-white/10 hover:bg-white/5 text-white";
  const selected = "bg-white text-gray-900 border-white";
  const disabledCls = disabled ? "opacity-60 cursor-not-allowed" : "";
  return (
    <button
      className={`${base} ${active ? selected : normal} ${disabledCls}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ExpenseModal({ editing, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    date: editing?.date ? String(editing.date).slice(0, 10) : todayStr(),
    description: editing?.description || "",
    payment_method: editing?.payment_method || "Cash",
    amount: editing?.amount ?? "",
  }));

  const canSave =
    String(form.description).trim().length > 0 &&
    String(form.amount).trim().length > 0 &&
    ["Cash", "M-Pesa"].includes(form.payment_method);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f17] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{editing ? "Edit Expense" : "New Expense"}</div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-400">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-gray-400">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="What was this expense?"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-gray-400">Payment Method</span>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-400">Amount</span>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">

          <button
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
            onClick={() =>
              onSubmit({
                date: form.date,
                description: String(form.description).trim(),
                payment_method: form.payment_method,
                amount: Number(form.amount),
              })
            }
          >
            <Save size={16} /> Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** ---------------- COGS Modal ---------------- */
function CogsModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    date: todayStr(),
    description: "",
    payment_method: "Cash",
    amount: "",
    bottle_size_id: "",
    unit_cost_carton: "",
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSave =
    String(form.amount).trim().length > 0 &&
    ["Cash", "M-Pesa", "Bank", "Other"].includes(form.payment_method) &&
    Number(form.amount) > 0;

  const warnText =
    form.bottle_size_id && !form.unit_cost_carton
      ? "Enter unit cost to update default cost for this size."
      : form.unit_cost_carton && !form.bottle_size_id
      ? "Enter a bottle size ID to update default cost."
      : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f17] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Record COGS Purchase</div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-400">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-gray-400">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="e.g., Water stock purchase"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-gray-400">Payment Method</span>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-400">Amount</span>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            className="text-left text-xs text-gray-400 underline underline-offset-4"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} optional: update default cost for a bottle size
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-gray-400">Bottle Size ID (optional)</span>
                <input
                  type="number"
                  min={0}
                  value={form.bottle_size_id}
                  onChange={(e) => setForm((s) => ({ ...s, bottle_size_id: e.target.value }))}
                  className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
                  placeholder="e.g., 2"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-gray-400">Unit Cost / Carton (optional)</span>
                <input
                  type="number"
                  min={0}
                  value={form.unit_cost_carton}
                  onChange={(e) => setForm((s) => ({ ...s, unit_cost_carton: e.target.value }))}
                  className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
                  placeholder="e.g., 320"
                />
              </label>
              {warnText && <div className="md:col-span-2 text-xs text-amber-300">{warnText}</div>}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
            onClick={() =>
              onSubmit({
                date: form.date,
                description: String(form.description || "COGS purchase").trim(),
                payment_method: form.payment_method,
                amount: Number(form.amount),
                bottle_size_id: form.bottle_size_id !== "" ? Number(form.bottle_size_id) : undefined,
                unit_cost_carton:
                  form.unit_cost_carton !== "" ? Number(form.unit_cost_carton) : undefined,
              })
            }
          >
            <Save size={16} /> Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* Tiny icon-button style */
const style = document.createElement("style");
style.innerHTML = `.icon-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid hsl(0 0% 100% / 0.1);background:transparent;padding:.35rem;border-radius:.75rem}
.icon-btn:hover{background:hsl(0 0% 100% / 0.06)}`;
if (typeof document !== "undefined") document.head.appendChild(style);

