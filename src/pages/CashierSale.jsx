// src/pages/CashierSale.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCcw,
  Filter,
  Search,
  Trash2,
  RotateCcw,
  Banknote,
  Save,
  User2,
  Package,
  CalendarDays,
  PackageCheck,
  Printer,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "react-toastify"; // ⬅️ no ToastContainer import

import { useSaleContext } from "../contexts/SaleContext.jsx";
import { usePackaging } from "../contexts/PackagingContext.jsx";

const PER_PAGE = 50;

/* ---------------- helpers (money, totals, datetime) ---------------- */

const GROSS_KEYS = ["total_amount", "gross_total", "subtotal", "amount", "total", "amount_total"];
const PAID_KEYS = ["paid_amount", "amount_paid", "paid", "payments_total"];
const DUE_KEYS = ["balance_due", "due", "outstanding", "remaining"];

function pickNum(obj, keys, d = 0) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return d;
}
function getGross(s) {
  return pickNum(s, GROSS_KEYS, 0);
}
function getPaid(s) {
  return pickNum(s, PAID_KEYS, 0);
}
function getDue(s) {
  const v = pickNum(s, DUE_KEYS, NaN);
  return Number.isFinite(v) ? v : Math.max(0, getGross(s) - getPaid(s));
}

function formatMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "KES",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
  }).format(Number(v));
}

// Parse "KES 12,000" / "KSh 12,000" / raw numbers safely
function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/kes|ksh/gi, "").replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// TZ-aware formatting (Africa/Nairobi)
function formatDateTime(input) {
  if (!input) return "";
  try {
    const s0 = String(input).trim();

    if (/^\d+$/.test(s0)) {
      let n = Number(s0);
      if (s0.length === 10) n *= 1000;
      return formatInNairobi(new Date(n));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s0)) return `${s0} 00:00:00`;

    const hasTZ = /([zZ]|[+-]\d{2}:\d{2})$/.test(s0);
    const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;
    const m = NAIVE_RE.exec(s0);

    if (m && !hasTZ) {
      const [_, Y, M, D, hh, mm, ssRaw] = m;
      const ss = ssRaw ? ssRaw.padStart(2, "0") : "00";
      return `${Y}-${M}-${D} ${hh}:${mm}:${ss}`;
    }

    const parsed = new Date(s0.replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) return formatInNairobi(parsed);

    return s0;
  } catch {
    return String(input);
  }
}
function formatInNairobi(dateObj) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(dateObj);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get(
    "second"
  )}`;
}

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}
function daysAgoNairobi(n) {
  const now = new Date();
  const dt = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}
function yesterdayNairobi() {
  return daysAgoNairobi(1);
}
function last7DaysNairobi() {
  return { start: daysAgoNairobi(6), end: todayNairobi() };
}

/* ---------------- API fallback helpers ---------------- */

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "/api";

function getDefaultToken() {
  try {
    return (
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("token") || localStorage.getItem("access_token"))) ||
      ""
    );
  } catch {
    return "";
  }
}

async function apiGet(path, token) {
  const res = await fetch(API_BASE + path, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* ---------------- Quick Button ---------------- */
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

/* ---------------- main page ---------------- */

export default function CashierSale() {
  const {
    loading,
    error,
    sales,
    pagination,
    filters,
    setFilters,
    listSales,
    listTodaySales,
    listYesterdaySales,
    listLast7DaysSales,
    setDateFiltersToToday,
    customers,
    fetchCustomers,
    createSale,
    deleteSale,
    restoreSale,
    createPayment,
    createCreditPayment,
    getReceipt,
    printSaleReceipt,
    listItemsForSale,
    closeDispatch,

    // optional
    listExpenses,
    listCogsPurchases,
    listCogs,
    fetchCogsSummary,
  } = useSaleContext();

  const { bottleSizes, sizeOptions, fetchBottleSizes, fetchBottleSizeOptions } = usePackaging();

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(null);
  const [showPrinterModal, setShowPrinterModal] = useState(null);

  const [draftFilters, setDraftFilters] = useState(filters);
  const [outstandingOnly, setOutstandingOnly] = useState(false);

  const [expensesTotal, setExpensesTotal] = useState(0);
  const [cogsPurchasesTotal, setCogsPurchasesTotal] = useState(0);

  useEffect(() => setDraftFilters(filters), [filters]);

  // ▶ Default to TODAY on first load + load sizes + customers + totals
  useEffect(() => {
    (async () => {
      try {
        setDateFiltersToToday();
        await listTodaySales();
        const t = todayNairobi();
        await Promise.all([
          loadExpensesTotals({ date_from: t, date_to: t }),
          loadCogsPurchasesTotals({ date_from: t, date_to: t }),
        ]);
      } catch {}
      fetchCustomers().catch(() => {});
      Promise.all([fetchBottleSizes(), fetchBottleSizeOptions()]).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active range flags
  const t = todayNairobi();
  const y = yesterdayNairobi();
  const { start: l7s, end: l7e } = last7DaysNairobi();
  const isTodayActive = (filters?.date_from === t && filters?.date_to === t) || false;
  const isYesterdayActive = (filters?.date_from === y && filters?.date_to === y) || false;
  const isLast7Active = (filters?.date_from === l7s && filters?.date_to === l7e) || false;

  const refresh = () =>
    Promise.all([
      listSales({ page: pagination.page, per_page: PER_PAGE, ...filters }),
      loadExpensesTotals(),
      loadCogsPurchasesTotals(),
    ]).catch(() => {});

  const applyFilters = () => {
    setFilters(draftFilters);
    Promise.all([
      listSales({ page: 1, per_page: PER_PAGE, ...draftFilters }),
      loadExpensesTotals(draftFilters),
      loadCogsPurchasesTotals(draftFilters),
    ]).catch(() => {});
  };

  // ⬇️ All three “range” actions now silent (no toast, just do the GET work)
  const resetToToday = async () => {
    try {
      setDateFiltersToToday();
      await listTodaySales();
      setOutstandingOnly(false);
      const tt = todayNairobi();
      await Promise.all([
        loadExpensesTotals({ date_from: tt, date_to: tt }),
        loadCogsPurchasesTotals({ date_from: tt, date_to: tt }),
      ]);
    } catch {}
  };

  const jumpYesterday = async () => {
    try {
      await listYesterdaySales();
      setOutstandingOnly(false);
      const yy = yesterdayNairobi();
      await Promise.all([
        loadExpensesTotals({ date_from: yy, date_to: yy }),
        loadCogsPurchasesTotals({ date_from: yy, date_to: yy }),
      ]);
    } catch {}
  };

  const jumpLast7 = async () => {
    try {
      await listLast7DaysSales();
      setOutstandingOnly(false);
      const r = last7DaysNairobi();
      await Promise.all([
        loadExpensesTotals({ date_from: r.start, date_to: r.end }),
        loadCogsPurchasesTotals({ date_from: r.start, date_to: r.end }),
      ]);
    } catch {}
  };

  const displayedSales = useMemo(() => {
    let arr = sales;
    if (outstandingOnly) arr = arr.filter((s) => getDue(s) > 0);
    return arr;
  }, [sales, outstandingOnly]);

  const totals = useMemo(() => {
    let gross = 0,
      paid = 0,
      due = 0;
    for (const s of displayedSales) {
      const g = getGross(s),
        p = getPaid(s);
      gross += g;
      paid += p;
      const d = pickNum(s, DUE_KEYS, NaN);
      due += Number.isFinite(d) ? d : Math.max(0, g - p);
    }
    return { gross, paid, due };
  }, [displayedSales]);

  const netSales = useMemo(
    () => Number(totals.paid || 0) - (Number(expensesTotal || 0) + Number(cogsPurchasesTotal || 0)),
    [totals.paid, expensesTotal, cogsPurchasesTotal]
  );

  /* ------------ range-based totals loaders ------------ */

  async function loadExpensesTotals(range) {
    const params = {
      date_from: range?.date_from ?? filters?.date_from ?? "",
      date_to: range?.date_to ?? filters?.date_to ?? "",
    };

    if (typeof listExpenses === "function") {
      try {
        const res = await listExpenses(params);
        const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setExpensesTotal((arr || []).reduce((a, e) => a + toNum(e?.amount), 0));
        return;
      } catch {}
    }

    try {
      const token = getDefaultToken();
      const qs = new URLSearchParams({
        date_from: params.date_from || "",
        date_to: params.date_to || "",
      });
      const res = await apiGet(`/expenses?${qs.toString()}`, token);
      const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setExpensesTotal((arr || []).reduce((a, e) => a + toNum(e?.amount), 0));
    } catch {
      setExpensesTotal(0);
    }
  }

  async function loadCogsPurchasesTotals(range) {
    const params = {
      date_from: range?.date_from ?? filters?.date_from ?? "",
      date_to: range?.date_to ?? filters?.date_to ?? "",
    };

    if (typeof listCogsPurchases === "function") {
      try {
        const res = await listCogsPurchases(params);
        const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setCogsPurchasesTotal((arr || []).reduce((a, r) => a + toNum(r?.amount), 0));
        return;
      } catch {}
    }

    if (typeof listCogs === "function") {
      try {
        const res = await listCogs(params);
        const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setCogsPurchasesTotal((arr || []).reduce((a, r) => a + toNum(r?.amount), 0));
        return;
      } catch {}
    }

    if (typeof fetchCogsSummary === "function") {
      try {
        const s = await fetchCogsSummary(params);
        const t = s?.totals || {};
        const guess =
          toNum(t.purchases) ||
          toNum(t.purchases_total) ||
          toNum(s?.purchases_total) ||
          0;
        setCogsPurchasesTotal(guess);
        return;
      } catch {}
    }

    try {
      const token = getDefaultToken();
      const qs = new URLSearchParams({
        date_from: params.date_from || "",
        date_to: params.date_to || "",
      });
      const res = await apiGet(`/cogs?${qs.toString()}`, token);
      const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setCogsPurchasesTotal((arr || []).reduce((a, r) => a + toNum(r?.amount), 0));
    } catch {
      setCogsPurchasesTotal(0);
    }
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Retail Sales</h1>
          <p className="text-sm text-white/60">
            Create sales, record payments, and print receipts.{" "}
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} /> Range:
            </span>{" "}
            <strong>
              {filters?.date_from || ""}
              {filters?.date_to && filters?.date_to !== filters?.date_from
                ? ` → ${filters.date_to}`
                : ""}
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickBtn
            onClick={() => {
              // silent GET refresh
              refresh();
            }}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCcw size={16} /> Refresh
          </QuickBtn>

          <QuickBtn
            onClick={resetToToday}
            active={isTodayActive}
            disabled={loading}
            title="Jump to today's sales (Africa/Nairobi)"
          >
            <CalendarDays size={16} /> Today
          </QuickBtn>

          <QuickBtn
            onClick={jumpYesterday}
            active={isYesterdayActive}
            disabled={loading}
            title="Show yesterday's sales (Africa/Nairobi)"
          >
            <CalendarDays size={16} /> Yesterday
          </QuickBtn>

          <QuickBtn
            onClick={jumpLast7}
            active={isLast7Active}
            disabled={loading}
            title="Show last 7 days (Africa/Nairobi)"
          >
            <CalendarDays size={16} /> Last 7 Days
          </QuickBtn>

          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white text-gray-900 hover:opacity-90"
            onClick={() => setShowSaleModal(true)}
          >
            <Plus size={16} /> New Sale
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 text-sm">
          {String(error)}
        </div>
      )}

      {/* 📊 KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MetricCard label="Listed Gross" value={formatMoney(totals.gross)} />
        <MetricCard label="Listed Paid" value={formatMoney(totals.paid)} />
        <MetricCard label="Listed Balance" value={formatMoney(totals.due)} />
        <MetricCard
          label="Net Sales (Paid − Expenses − COGS Purchases)"
          value={formatMoney(netSales)}
        />
      </div>

      <FiltersBar
        draft={draftFilters}
        setDraft={setDraftFilters}
        outstandingOnly={outstandingOnly}
        setOutstandingOnly={setOutstandingOnly}
        onApply={applyFilters}
      />

      {/* 📱 Mobile cards */}
      <div className="md:hidden">
        <SalesCards
          sales={displayedSales}
          loading={loading}
          onPay={(s) => setShowPayModal(s)}
          onDelete={(s) =>
            Swal.fire({
              title: "Delete this sale?",
              text: "Stock will be returned to inventory.",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, delete",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#ef4444",
            }).then((r) => {
              if (r.isConfirmed) {
                toast.promise(deleteSale(s.id).then(refresh), {
                  pending: "Deleting…",
                  success: "Sale deleted",
                  error: "Delete failed",
                });
              }
            })
          }
          onRestore={(s) =>
            toast.promise(restoreSale(s.id).then(refresh), {
              pending: "Restoring…",
              success: "Sale restored",
              error: "Restore failed",
            })
          }
          onCloseDispatch={(s) => setShowDispatchModal(s)}
          onPrint={(s) => setShowPrinterModal(s)}
        />
      </div>

      {/* 🖥️ Desktop table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block">
        <SalesTable
          sales={displayedSales}
          loading={loading}
          pagination={pagination}
          onPage={(p) => listSales({ page: p, per_page: PER_PAGE, ...filters }).catch(() => {})}
          onPay={(s) => setShowPayModal(s)}
          onDelete={(s) =>
            Swal.fire({
              title: "Delete this sale?",
              text: "Stock will be returned to inventory.",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, delete",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#ef4444",
            }).then((r) => {
              if (r.isConfirmed) {
                toast.promise(deleteSale(s.id).then(refresh), {
                  pending: "Deleting…",
                  success: "Sale deleted",
                  error: "Delete failed",
                });
              }
            })
          }
          onRestore={(s) =>
            toast.promise(restoreSale(s.id).then(refresh), {
              pending: "Restoring…",
              success: "Sale restored",
              error: "Restore failed",
            })
          }
          onCloseDispatch={(s) => setShowDispatchModal(s)}
          onPrint={(s) => setShowPrinterModal(s)}
        />
      </motion.div>

      {showSaleModal && (
        <SaleModal
          onClose={() => setShowSaleModal(false)}
          onSubmit={async (payload) => {
            try {
              await toast.promise(createSale(payload), {
                pending: "Creating sale…",
                success: "Sale created",
                error: {
                  render({ data }) {
                    return data?.message || data?.toString?.() || "Failed";
                  },
                },
              });
              setShowSaleModal(false);
              refresh();
            } catch {}
          }}
          customers={customers}
          bottleSizes={bottleSizes}
          sizeOptions={sizeOptions}
        />
      )}

      {showPayModal && (
        <PaymentModal
          sale={showPayModal}
          onClose={() => setShowPayModal(null)}
          onSubmit={async ({ amount, payment_method, date }) => {
            const fn =
              (showPayModal.sale_type || "").toLowerCase() === "credit"
                ? createCreditPayment
                : createPayment;
            try {
              await toast.promise(fn(showPayModal.id, { amount, payment_method, date }), {
                pending: "Recording payment…",
                success: "Payment recorded",
                error: "Payment failed",
              });
              setShowPayModal(null);
              refresh();
            } catch {}
          }}
        />
      )}

      {showDispatchModal && (
        <DispatchCloseModal
          sale={showDispatchModal}
          listItemsForSale={listItemsForSale}
          onClose={() => setShowDispatchModal(null)}
          onSubmit={async (payload) => {
            try {
              await toast.promise(closeDispatch(showDispatchModal.id, payload), {
                pending: "Closing dispatch…",
                success: "Dispatch closed",
                error: "Failed to close dispatch",
              });
              setShowDispatchModal(null);
              refresh();
            } catch {}
          }}
        />
      )}

      {showPrinterModal && (
        <PrinterModal
          sale={showPrinterModal}
          getReceipt={getReceipt}
          onClose={() => setShowPrinterModal(null)}
          onSubmit={async (payload) => {
            try {
              await toast.promise(printSaleReceipt(showPrinterModal.id, payload), {
                pending: "Sending to printer…",
                success: "Receipt sent",
                error: {
                  render({ data }) {
                    return data?.message || data?.toString?.() || "Print failed";
                  },
                },
              });
              setShowPrinterModal(null);
            } catch {}
          }}
        />
      )}
    </div>
  );
}

/* ---------------- UI Bits ---------------- */

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function FiltersBar({ draft, setDraft, outstandingOnly, setOutstandingOnly, onApply }) {
  return (
    <div className="mb-4 rounded-2xl border border-white/10 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 text-sm text-gray-300">
          <Filter size={16} /> Filters
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            placeholder="Receipt #"
            value={draft.receipt || ""}
            onChange={(e) => setDraft((s) => ({ ...s, receipt: e.target.value }))}
            className="pl-7 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>

        <input
          placeholder="Customer"
          value={draft.customer || ""}
          onChange={(e) => setDraft((s) => ({ ...s, customer: e.target.value }))}
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
        />

        <select
          value={draft.sale_type || ""}
          onChange={(e) => setDraft((s) => ({ ...s, sale_type: e.target.value }))}
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="normal">Normal</option>
          <option value="credit">Credit</option>
          <option value="dispatch">Dispatch</option>
        </select>

        <input
          type="date"
          value={draft.date_from || ""}
          onChange={(e) => setDraft((s) => ({ ...s, date_from: e.target.value }))}
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={draft.date_to || ""}
          onChange={(e) => setDraft((s) => ({ ...s, date_to: e.target.value }))}
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
        />

        <select
          value={draft.order || "desc"}
          onChange={(e) => setDraft((s) => ({ ...s, order: e.target.value }))}
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
        >
          <option value="desc">Newest</option>
          <option value="asc">Oldest</option>
        </select>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!draft.include_deleted}
            onChange={(e) => setDraft((s) => ({ ...s, include_deleted: e.target.checked }))}
          />
          <span>Include deleted</span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!outstandingOnly}
            onChange={(e) => setOutstandingOnly(e.target.checked)}
          />
          <span>Outstanding only</span>
        </label>

        <div className="ms-auto flex gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={onApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* 📱 Mobile cards list */
function SalesCards({
  sales,
  loading,
  onPay,
  onDelete,
  onRestore,
  onCloseDispatch,
  onPrint,
}) {
  return (
    <div className="grid gap-3">
      {sales.map((s) => (
        <div key={s.id} className="rounded-2xl border border-white/10 p-3 bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-white/60">{formatDateTime(s.date)}</div>
              <div className="mt-0.5 font-mono text-sm">{s.receipt_number}</div>
              <div className="mt-1 text-sm truncate">{s.customer_name || "—"}</div>
              <div className="mt-1 text-xs capitalize text-white/60">{s.sale_type}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatMoney(getGross(s))}</div>
              <div className="text-xs text-white/60">
                Paid {formatMoney(getPaid(s))} • Bal {formatMoney(getDue(s))}
              </div>
              <div className="mt-1">
                {s.is_deleted ? (
                  <span className="inline-flex rounded-full bg-rose-500/20 text-rose-300 px-2 py-0.5 text-[11px]">
                    Deleted
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[11px]">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 inline-flex flex-wrap gap-2">
            {!s.is_deleted && (
              <button className="icon-btn" title="Print receipt" onClick={() => onPrint(s)}>
                <Printer size={16} />
              </button>
            )}
            {!s.is_deleted && (
              <button className="icon-btn" title="Record payment" onClick={() => onPay(s)}>
                <Banknote size={16} />
              </button>
            )}
            {!s.is_deleted && (s.sale_type || "").toLowerCase() === "dispatch" && (
              <button
                className="icon-btn text-amber-300"
                title="Close dispatch"
                onClick={() => onCloseDispatch(s)}
              >
                <PackageCheck size={16} />
              </button>
            )}
            {!s.is_deleted ? (
              <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(s)}>
                <Trash2 size={16} />
              </button>
            ) : (
              <button
                className="icon-btn text-emerald-300"
                title="Restore"
                onClick={() => onRestore(s)}
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      {sales.length === 0 && (
        <div className="rounded-2xl border border-white/10 p-6 text-center text-white/60">
          {loading ? "Loading…" : "No sales"}
        </div>
      )}
    </div>
  );
}

/* 🖥️ Desktop table with horizontal scroll */
function SalesTable({
  sales,
  loading,
  pagination,
  onPage,
  onPay,
  onDelete,
  onRestore,
  onCloseDispatch,
  onPrint,
}) {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Receipt</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-white/10">
                <td className="px-3 py-2 align-top">{formatDateTime(s.date)}</td>
                <td className="px-3 py-2 align-top font-mono">{s.receipt_number}</td>
                <td className="px-3 py-2 align-top">{s.customer_name || ""}</td>
                <td className="px-3 py-2 align-top capitalize">{s.sale_type}</td>
                <td className="px-3 py-2 align-top text-right">{formatMoney(getGross(s))}</td>
                <td className="px-3 py-2 align-top text-right">{formatMoney(getPaid(s))}</td>
                <td className="px-3 py-2 align-top text-right">{formatMoney(getDue(s))}</td>
                <td className="px-3 py-2 align-top">
                  {s.is_deleted ? (
                    <span className="inline-flex rounded-full bg-rose-500/20 text-rose-300 px-2 py-0.5 text-xs">
                      Deleted
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <div className="inline-flex items-center gap-2">
                    {!s.is_deleted && (
                      <button className="icon-btn" title="Print to receipt printer" onClick={() => onPrint(s)}>
                        <Printer size={16} />
                      </button>
                    )}
                    {!s.is_deleted && (
                      <button className="icon-btn" title="Record payment" onClick={() => onPay(s)}>
                        <Banknote size={16} />
                      </button>
                    )}
                    {!s.is_deleted && (s.sale_type || "").toLowerCase() === "dispatch" && (
                      <button
                        className="icon-btn text-amber-300"
                        title="Close dispatch (enter returns & optional payment)"
                        onClick={() => onCloseDispatch(s)}
                      >
                        <PackageCheck size={16} />
                      </button>
                    )}
                    {!s.is_deleted ? (
                      <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(s)}>
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button className="icon-btn text-emerald-300" title="Restore" onClick={() => onRestore(s)}>
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-white/60">
                  {loading ? "Loading…" : "No sales"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 px-3 py-2 text-sm">
        <div>Page {pagination.page} of {Math.max(1, pagination.pages || 1)}</div>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            disabled={!pagination.has_prev}
            onClick={() => onPage(pagination.prev_page)}
          >
            Prev
          </button>
          <button
            className="rounded-xl border border-white/10 px-2 py-1 disabled:opacity-40"
            disabled={!pagination.has_next}
            onClick={() => onPage(pagination.next_page)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modals ---------------- */

function SaleModal({ onClose, onSubmit, customers, bottleSizes, sizeOptions }) {
  const [form, setForm] = useState(() => ({
    sale_type: "normal",
    customer_id: "",
    customer_name: "",
    notes: "",
    items: [{ bottle_size_id: "", quantity: "" }],
  }));

  const getCartonPrice = (sizeId) => {
    const sid = Number(sizeId);
    if (!sid) return 0;
    const bs = (bottleSizes || []).find((b) => Number(b.id) === sid);
    if (bs && Number(bs.selling_price) > 0) return Number(bs.selling_price);
    const opt = (sizeOptions || []).find((o) => Number(o.id) === sid);
    if (opt && Number(opt.selling_price) > 0) return Number(opt.selling_price);
    return 0;
  };

  const parsed = useMemo(() => {
    const rows = form.items.map((r) => {
      const qty = Math.max(0, Math.floor(Number(r.quantity) || 0));
      const unit = r.bottle_size_id ? getCartonPrice(r.bottle_size_id) : 0;
      return {
        bottle_size_id: r.bottle_size_id ? Number(r.bottle_size_id) : "",
        quantity: qty,
        unit,
        line_total: qty * unit,
      };
    });
    const total = rows.reduce((a, b) => a + (b.line_total || 0), 0);
    const totalCartons = rows.reduce((a, b) => a + (b.quantity || 0), 0);
    return { rows, total, totalCartons };
  }, [form.items, bottleSizes, sizeOptions]);

  const canSave =
    form.sale_type &&
    parsed.rows.length > 0 &&
    parsed.rows.every((it) => it.bottle_size_id && it.quantity > 0);

  const addRow = () =>
    setForm((s) => ({
      ...s,
      items: [...s.items, { bottle_size_id: "", quantity: "" }],
    }));

  const rmRow = (idx) =>
    setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));

  const makeSubmitItems = () => {
    const map = new Map();
    for (const r of parsed.rows) {
      if (!r.bottle_size_id || !r.quantity) continue;
      map.set(r.bottle_size_id, (map.get(r.bottle_size_id) || 0) + r.quantity);
    }
    return Array.from(map.entries()).map(([bottle_size_id, quantity]) => ({
      bottle_size_id,
      quantity,
    }));
  };

  return (
    <Modal onClose={onClose} title="New Sale">
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-white/60">Sale Type</label>
          <select
            value={form.sale_type}
            onChange={(e) => setForm((s) => ({ ...s, sale_type: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="credit">Credit</option>
            <option value="dispatch">Dispatch</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-white/60 flex items-center gap-2">
            <User2 size={14} /> Customer (optional)
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={form.customer_id}
              onChange={(e) =>
                setForm((s) => {
                  const cid = e.target.value;
                  const custName =
                    customers.find((c) => String(c.id) === String(cid))?.name || s.customer_name;
                  return { ...s, customer_id: cid, customer_name: custName };
                })
              }
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Or type customer name"
              value={form.customer_name}
              onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-white/60 flex items-center gap-2">
            <Package size={14} /> Items
          </label>

          {/* Header (sm+) */}
          <div className="hidden sm:grid sm:grid-cols-12 text-[11px] uppercase tracking-wide text-white/50">
            <div className="sm:col-span-6">Bottle Size</div>
            <div className="sm:col-span-3 text-right">Qty (cartons)</div>
            <div className="sm:col-span-3 text-right">Line Total</div>
          </div>

          {form.items.map((row, idx) => {
            const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
            const unit = row.bottle_size_id ? getCartonPrice(row.bottle_size_id) : 0;
            const line = qty * unit;

            return (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-start">
                <select
                  value={row.bottle_size_id}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      items: s.items.map((r, i) =>
                        i === idx ? { ...r, bottle_size_id: Number(e.target.value) } : r
                      ),
                    }))
                  }
                  className="sm:col-span-6 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
                >
                  <option value="">Size…</option>
                  {sizeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  placeholder="Qty (cartons)"
                  value={row.quantity}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      items: s.items.map((r, i) =>
                        i === idx ? { ...r, quantity: e.target.value } : r
                      ),
                    }))
                  }
                  className="sm:col-span-3 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-right"
                />

                {/* Line total (read-only) */}
                <div className="sm:col-span-3 rounded-xl bg-black/10 px-3 py-2 text-sm text-right">
                  {qty > 0 && unit > 0 ? (
                    <>
                      <div className="font-medium">{formatMoney(line)}</div>
                      <div className="text-[11px] text-white/60">
                        {qty} × {formatMoney(unit)}
                      </div>
                    </>
                  ) : (
                    ""
                  )}
                </div>

                {/* Remove row */}
                <button
                  className="sm:col-span-12 icon-btn text-rose-300 justify-self-end"
                  onClick={() => rmRow(idx)}
                  title="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={addRow}>
              Add Item
            </button>

            {/* Live grand totals */}
            <div className="text-right">
              <div className="text-xs text-white/60">Total Cartons</div>
              <div className="text-lg font-medium">{parsed.totalCartons}</div>
              <div className="mt-1 text-xs text-white/60">Total Price</div>
              <div className="text-xl font-semibold">{formatMoney(parsed.total)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-xs text-white/60">Notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* ⬇️ removed bottom Close; header Close remains */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() =>
            onSubmit({
              sale_type: form.sale_type,
              customer_id: form.customer_id ? Number(form.customer_id) : undefined,
              customer_name: form.customer_name?.trim() || undefined,
              notes: form.notes?.trim() || undefined,
              items: makeSubmitItems(),
            })
          }
        >
          <Save size={16} /> Save
        </button>
      </div>
    </Modal>
  );
}

function PaymentModal({ sale, onClose, onSubmit }) {
  const gross = getGross(sale);
  const paid = getPaid(sale);
  const balance = Math.max(0, gross - paid);

  const [form, setForm] = useState(() => ({
    amount: "",
    payment_method: "Cash",
    date: todayNairobi(),
  }));

  const amt = Number(form.amount || 0);
  const newPaid = paid + (Number.isFinite(amt) ? amt : 0);
  const newBalance = Math.max(0, gross - newPaid);

  // ⬇️ Only Cash & M-Pesa
  const allowedMethods = ["Cash", "M-Pesa"];
  const canSave =
    String(form.amount).length > 0 &&
    amt >= 0 &&
    amt <= balance &&
    allowedMethods.includes(form.payment_method);

  return (
    <Modal onClose={onClose} title={`Record Payment — ${sale.receipt_number}`}>
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile label="Gross" value={formatMoney(gross)} />
          <SummaryTile label="Already Paid" value={formatMoney(paid)} />
          <SummaryTile label="Balance" value={formatMoney(balance)} />
        </div>

        <div className="rounded-2xl border border-white/10 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-white/60">Amount</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={balance}
                  value={form.amount}
                  onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                  className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm whitespace-nowrap"
                  onClick={() => setForm((s) => ({ ...s, amount: String(balance) }))}
                >
                  Pay Balance
                </button>
              </div>
              {amt > balance && <span className="text-xs text-rose-300">Amount exceeds balance</span>}
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-white/60">Payment Method</span>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              >
                {allowedMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-white/60">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryTile label="New Paid" value={formatMoney(newPaid)} />
            <SummaryTile label="New Balance" value={formatMoney(newBalance)} />
          </div>
        </div>
      </div>

      {/* ⬇️ removed bottom Close; header Close remains */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() =>
            onSubmit({
              amount: Number(form.amount),
              payment_method: form.payment_method,
              date: form.date,
            })
          }
        >
          <Save size={16} /> Save
        </button>
      </div>
    </Modal>
  );
}

function DispatchCloseModal({ sale, listItemsForSale, onClose, onSubmit }) {
  const [rows, setRows] = useState([]);
  const [returns, setReturns] = useState({});
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(""); // ⬅️ inline error instead of toast

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listItemsForSale(sale.id);
        if (!mounted) return;
        setRows(items || []);
        const init = {};
        (items || []).forEach((it) => (init[it.bottle_size_id] = 0));
        setReturns(init);
      } catch {
        if (mounted) setErr("Failed to load dispatch items.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sale?.id, listItemsForSale]);

  const getReturn = (sid) => Number(returns[sid] || 0);
  const setReturn = (sid, val, max) => {
    let n = Number(val || 0);
    if (Number.isNaN(n) || n < 0) n = 0;
    if (n > max) n = max;
    setReturns((r) => ({ ...r, [sid]: n }));
  };

  const computed = useMemo(() => {
    let newTotal = 0;
    const details = rows.map((r) => {
      const sent = Number(r.quantity || 0);
      const ret = getReturn(r.bottle_size_id);
      const sold = Math.max(0, sent - ret);
      const unit = Number(r.unit_price || 0);
      const line = sold * unit;
      newTotal += line;
      return {
        size_id: r.bottle_size_id,
        label: r.bottle_size_label,
        sent,
        ret,
        sold,
        unit,
        line,
      };
    });
    return { details, newTotal };
  }, [rows, returns]);

  const alreadyPaid = getPaid(sale);
  const remaining = Math.max(0, computed.newTotal - alreadyPaid);
  const canSubmit =
    !loading &&
    computed.details.every((d) => d.ret >= 0 && d.ret <= d.sent) &&
    (amountPaid === "" || Number(amountPaid) <= remaining) &&
    ["Cash", "M-Pesa"].includes(paymentMethod);

  return (
    <Modal onClose={onClose} title={`Close Dispatch — ${sale?.receipt_number || ""}`}>
      <div className="grid gap-3">
        <div className="text-sm text-white/70">
          Enter cartons returned for each size. We’ll compute sold quantities and new totals.
        </div>

        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Bottle Size</th>
                <th className="px-3 py-2 text-right">Sent</th>
                <th className="px-3 py-2 text-right">Returned</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/60">
                    Loading…
                  </td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-rose-300">
                    {err}
                  </td>
                </tr>
              ) : (
                computed.details.map((d) => (
                  <tr key={d.size_id} className="border-t border-white/10">
                    <td className="px-3 py-2">{d.label || ""}</td>
                    <td className="px-3 py-2 text-right">{d.sent}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={d.sent}
                        value={getReturn(d.size_id)}
                        onChange={(e) => setReturn(d.size_id, e.target.value, d.sent)}
                        className="w-24 rounded-xl bg-black/20 border border-white/10 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{d.sold}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(d.unit)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium">{formatMoney(d.line)}</div>
                      {d.sold > 0 && d.unit > 0 && (
                        <div className="text-[11px] text-white/60">
                          {d.sold} × {formatMoney(d.unit)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile label="New Total" value={formatMoney(computed.newTotal)} />
          <SummaryTile label="Already Paid" value={formatMoney(alreadyPaid)} />
          <SummaryTile label="Remaining" value={formatMoney(remaining)} />
        </div>

        <div className="rounded-2xl border border-white/10 p-3">
          <div className="text-xs text-white/60 mb-2">Optional payment to record now</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-white/60">Amount</span>
              <input
                type="number"
                min={0}
                max={remaining}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-white/60">Method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </label>
            <div className="grid items-end">
              <div className="text-xs text-white/50">
                {amountPaid !== "" && Number(amountPaid) > remaining
                  ? "Amount exceeds remaining"
                  : "Leave empty to skip payment"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ⬇️ removed bottom Close; header Close remains */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() => {
            const returnsArr = computed.details
              .filter((d) => d.ret > 0)
              .map((d) => ({
                bottle_size_id: d.size_id,
                quantity_returned: d.ret,
              }));
            const payload = {
              returns: returnsArr,
              ...(String(amountPaid).length
                ? { amount_paid: Number(amountPaid), payment_method: paymentMethod }
                : {}),
            };
            onSubmit(payload);
          }}
        >
          <PackageCheck size={16} /> Close Dispatch
        </button>
      </div>
    </Modal>
  );
}

/* ✅ Printer Modal */
function PrinterModal({ sale, getReceipt, onClose, onSubmit }) {
  const [copies, setCopies] = useState(1);
  const [paymentRef, setPaymentRef] = useState("");
  const [copyLabel, setCopyLabel] = useState("");
  const [isReprint, setIsReprint] = useState(false);

  const [loading, setLoading] = useState(true);
  const [receiptData, setReceiptData] = useState(null);
  const [err, setErr] = useState(""); // ⬅️ inline error instead of toast

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getReceipt(sale.id);
        if (!mounted) return;
        setReceiptData(data || null);
      } catch {
        if (mounted) setErr("Failed to load receipt details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sale?.id, getReceipt]);

  const canSend = Number(copies) >= 1 && !loading && !err;

  const s = receiptData?.sale || {};
  const items = receiptData?.items || [];
  const totals = receiptData?.totals || {};

  return (
    <Modal onClose={onClose} title={`Send to Printer — ${sale?.receipt_number || ""}`}>
      <div className="grid gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60 mb-1">Summary</div>
          {loading ? (
            <div className="text-white/60">Loading…</div>
          ) : err ? (
            <div className="text-rose-300">{err}</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <div className="text-white/60">Date</div>
                <div>{formatDateTime(s?.date)}</div>
              </div>
              <div>
                <div className="text-white/60">Customer</div>
                <div>{s?.customer_name || ""}</div>
              </div>
              <div>
                <div className="text-white/60">Type</div>
                <div className="capitalize">{s?.sale_type}</div>
              </div>
              <div>
                <div className="text-white/60">Receipt</div>
                <div className="font-mono">{s?.receipt_number}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Cartons</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {loading || err ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-white/60">
                    {loading ? "Loading…" : err}
                  </td>
                </tr>
              ) : (
                items.map((it, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-3 py-2">{it.bottle_size_label}</td>
                    <td className="px-3 py-2 text-right">{it.quantity_cartons}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.unit_price_carton)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium">{formatMoney(it.line_total)}</div>
                      {Number(it.quantity_cartons) > 0 && Number(it.unit_price_carton) > 0 && (
                        <div className="text-[11px] text-white/60">
                          {it.quantity_cartons} × {formatMoney(it.unit_price_carton)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-white/70">
            {loading || err ? (
              loading ? "Loading totals…" : ""
            ) : (
              <>
                Subtotal: {formatMoney(totals?.subtotal)} · Paid: {formatMoney(totals?.paid)} ·
                Balance: {formatMoney(totals?.balance_due)}
              </>
            )}
          </div>
          <div className="text-xs text-white/60">
            Payment method will be derived from recorded payments for this sale.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Copies</span>
            <input
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value || 1)))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-white/60">Payment Ref (optional)</span>
            <input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. MPESA TXN"
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-white/60">Copy Label (optional)</span>
            <input
              value={copyLabel}
              onChange={(e) => setCopyLabel(e.target.value)}
              placeholder='e.g. "Customer Copy"'
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isReprint}
              onChange={(e) => setIsReprint(e.target.checked)}
            />
            <span>Mark as reprint</span>
          </label>
        </div>
      </div>

      {/* ⬇️ removed bottom Close; header Close remains */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={!canSend}
          className="inline-flex items-center gap-2 rounded-2xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() =>
            onSubmit({
              copies: Number(copies),
              ...(paymentRef.trim() ? { payment_ref: paymentRef.trim() } : {}),
              ...(copyLabel.trim() ? { copy_label: copyLabel.trim() } : {}),
              is_reprint: Boolean(isReprint),
            })
          }
        >
          <Printer size={16} /> Send
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b0f17] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="rounded-xl border border-white/10 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

// Tiny icon button style (only inject once)
if (typeof document !== "undefined" && !window.__cashiersale_icon_css__) {
  window.__cashiersale_icon_css__ = true;
  const style = document.createElement("style");
  style.innerHTML = `.icon-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid hsl(0 0% 100% / 0.1);background:transparent;padding:.35rem;border-radius:.75rem}
.icon-btn:hover{background:hsl(0 0% 100% / 0.06)}`;
  document.head.appendChild(style);
}
