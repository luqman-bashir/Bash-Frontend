// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCcw,
  CalendarDays,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Save,
  X,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSaleContext } from "../contexts/SaleContext.jsx";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * AdminDashboard.jsx — mobile-first responsive
 * - Expenses = OpEx only (non-COGS)
 * - Net = Paid − (OpEx + COGS purchases)
 * - Net Profit (card) = (COGS Sales − COGS Cost) − OpEx   ← classic GP – OpEx
 */

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "/api";

const COLORS = {
  paid: "#22c55e",
  expenses: "#ef4444",
  net: "#06b6d4",
  gross: "#a78bfa",
  balance: "#f59e0b",
  cogs: "#f97316",
  axis: "rgba(255,255,255,0.5)",
};

export default function AdminDashboard() {
  const {
    fetchSummaryByDate,
    listExpenses,
    exportSalesItemsPDF,
    fetchCartonsBySize,
    fetchCogsSummary,
  } = useSaleContext();

  const [filters, setFilters] = useState(() => {
    const t = todayKE();
    return { date_from: t, date_to: t };
  });

  const [loading, setLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cartonsSummary, setCartonsSummary] = useState({
    by_size: [],
    totals: { cartons: 0, revenue: 0 },
  });
  const [cogsSummary, setCogsSummary] = useState({
    totals: { sales: 0, cogs: 0 },
    by_size: [],
  });

  const [showCogsModal, setShowCogsModal] = useState(false);

  // one active loading toast at a time
  const LOAD_TOAST_ID = "range-load";
  const loadingToastRef = useRef(null);

  const beginLoadingToast = (msg) => {
    if (loadingToastRef.current) {
      toast.dismiss(loadingToastRef.current);
      loadingToastRef.current = null;
    }
    loadingToastRef.current = toast.loading(msg, { toastId: LOAD_TOAST_ID });
  };
  const resolveLoadingToast = (msg = "Ready") => {
    if (!loadingToastRef.current) return;
    toast.update(loadingToastRef.current, {
      render: msg,
      type: "success",
      isLoading: false,
      autoClose: 2200,
      closeOnClick: true,
    });
    loadingToastRef.current = null;
  };
  const rejectLoadingToast = (errMsg = "Failed") => {
    if (!loadingToastRef.current) return;
    toast.update(loadingToastRef.current, {
      render: errMsg,
      type: "error",
      isLoading: false,
      autoClose: 3000,
      closeOnClick: true,
    });
    loadingToastRef.current = null;
  };

  const load = async (range = filters) => {
    setLoading(true);
    try {
      const [sum, exp, car, cogs] = await Promise.all([
        fetchSummaryByDate({ date_from: range.date_from, date_to: range.date_to }),
        listExpenses({ date_from: range.date_from, date_to: range.date_to }),
        fetchCartonsBySize
          ? fetchCartonsBySize({ date_from: range.date_from, date_to: range.date_to })
          : Promise.resolve({ by_size: [], totals: { cartons: 0, revenue: 0 } }),
        fetchCogsSummary
          ? fetchCogsSummary({ date_from: range.date_from, date_to: range.date_to })
          : Promise.resolve({ totals: { sales: 0, cogs: 0 }, by_size: [] }),
      ]);

      setSalesSummary(sum || []);
      setExpenses(exp || []);
      setCartonsSummary(car || { by_size: [], totals: { cartons: 0, revenue: 0 } });
      setCogsSummary(
        cogs && cogs.totals
          ? {
              totals: { sales: num(cogs.totals.sales), cogs: num(cogs.totals.cogs) },
              by_size: cogs.by_size || [],
            }
          : { totals: { sales: 0, cogs: 0 }, by_size: [] }
      );
    } finally {
      setLoading(false);
    }
  };

  const runWithLoadingToast = async (fn, { pending, success, error }) => {
    beginLoadingToast(pending);
    try {
      const res = await fn();
      resolveLoadingToast(success);
      return res;
    } catch (e) {
      rejectLoadingToast(e?.message || error || "Failed");
      throw e;
    }
  };

  useEffect(() => {
    runWithLoadingToast(() => load(), {
      pending: "Loading…",
      success: "Ready",
      error: "Failed to load",
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = (range, toastLabel) => {
    setFilters(range);
    return runWithLoadingToast(() => load(range), {
      pending: `Loading ${toastLabel}…`,
      success: `Showing ${toastLabel}`,
      error: "Failed",
    });
  };

  const onToday = () => applyRange({ date_from: todayKE(), date_to: todayKE() }, "today");
  const onYesterday = () => applyRange({ date_from: yesterdayKE(), date_to: yesterdayKE() }, "yesterday");
  const onLast7 = () => {
    const { start, end } = last7DaysKE();
    return applyRange({ date_from: start, date_to: end }, "last 7 days");
  };
  const onApply = () =>
    runWithLoadingToast(() => load(), { pending: "Applying…", success: "Updated", error: "Failed" });
  const onRefresh = () =>
    runWithLoadingToast(() => load(), { pending: "Refreshing…", success: "Up to date", error: "Refresh failed" });
  const onExportSalesPDF = () =>
    toast.promise(exportSalesItemsPDF({ date_from: filters.date_from, date_to: filters.date_to }), {
      pending: "Generating PDF…",
      success: "PDF downloaded",
      error: "Export failed",
    });

  // flexible pickers for backend shape differences
  const pickDate = (r) => r?.date || r?.day || r?.sale_date || "";
  const pickGross = (r) => num(r?.gross ?? r?.total ?? r?.total_amount);
  const pickPaid = (r) => num(r?.paid ?? r?.paid_amount);
  const pickBalance = (r) => num(r?.balance ?? r?.balance_due);
  const pickCount = (r) => num(r?.count ?? r?.num_sales);

  /* ---------- Split expenses: OpEx vs COGS purchases ---------- */
  const isCogsExp = (e) => String(e?.category || "").toLowerCase() === "cogs";

  const opExTotal = useMemo(
    () => (expenses || []).filter((e) => !isCogsExp(e)).reduce((a, e) => a + num(e.amount), 0),
    [expenses]
  );

  const cogsPurchasesTotal = useMemo(
    () => (expenses || []).filter(isCogsExp).reduce((a, e) => a + num(e.amount), 0),
    [expenses]
  );

  // group by day (YYYY-MM-DD) - OpEx only
  const opExByDate = useMemo(() => {
    const m = {};
    for (const e of expenses || []) {
      if (isCogsExp(e)) continue;
      const raw = String(e.date || e.created_at || "");
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0] || ymdInKE(new Date(raw));
      if (!iso) continue;
      m[iso] = (m[iso] || 0) + num(e.amount);
    }
    return m;
  }, [expenses]);

  // group by day (YYYY-MM-DD) - COGS purchases only
  const cogsByDate = useMemo(() => {
    const m = {};
    for (const e of expenses || []) {
      if (!isCogsExp(e)) continue;
      const raw = String(e.date || e.created_at || "");
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0] || ymdInKE(new Date(raw));
      if (!iso) continue;
      m[iso] = (m[iso] || 0) + num(e.amount);
    }
    return m;
  }, [expenses]);

  /* ---------- Sales totals (folded) ---------- */
  const totalSales = useMemo(() => {
    let gross = 0,
      paid = 0,
      balance = 0,
      count = 0;
    for (const r of salesSummary || []) {
      gross += pickGross(r);
      paid += pickPaid(r);
      balance += pickBalance(r);
      count += pickCount(r);
    }
    return { gross, paid, balance, count };
  }, [salesSummary]);

  // Net = Paid − (OpEx + COGS purchases)
  const net = useMemo(
    () => totalSales.paid - (opExTotal + cogsPurchasesTotal),
    [totalSales.paid, opExTotal, cogsPurchasesTotal]
  );

  const totalCartons = useMemo(() => num(cartonsSummary?.totals?.cartons), [cartonsSummary]);

  // COGS Summary (from sold items)
  const cogsTotals = useMemo(() => {
    const t = cogsSummary?.totals ?? {};
    const sales = num(t.sales ?? t.total_sales ?? t.revenue);
    const cogs = num(t.cogs ?? t.total_cogs);
    return { sales, cogs };
  }, [cogsSummary]);

  // Net Profit = (Gross Profit) − OpEx = (COGS sales − COGS cost) − OpEx
  const netProfit = useMemo(
    () => (cogsTotals.sales - cogsTotals.cogs) - opExTotal,
    [cogsTotals.sales, cogsTotals.cogs, opExTotal]
  );

  /* ---------- Merge by day (Paid, OpEx, COGS purchases) ---------- */
  const dayRows = useMemo(() => {
    const map = new Map();

    // seed from sales
    for (const r of salesSummary || []) {
      const d = pickDate(r);
      if (!d) continue;
      map.set(d, {
        date: d,
        gross: pickGross(r),
        paid: pickPaid(r),
        balance: pickBalance(r),
        count: pickCount(r),
        opEx: 0,      // OpEx only
        cogsPurch: 0, // COGS purchases only
      });
    }

    // add OpEx
    for (const d of Object.keys(opExByDate)) {
      if (!map.has(d)) {
        map.set(d, { date: d, gross: 0, paid: 0, balance: 0, count: 0, opEx: 0, cogsPurch: 0 });
      }
      map.get(d).opEx += opExByDate[d];
    }

    // add COGS purchases
    for (const d of Object.keys(cogsByDate)) {
      if (!map.has(d)) {
        map.set(d, { date: d, gross: 0, paid: 0, balance: 0, count: 0, opEx: 0, cogsPurch: 0 });
      }
      map.get(d).cogsPurch += cogsByDate[d];
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [salesSummary, opExByDate, cogsByDate]);

  /* ---------- Chart: show OpEx as “Expenses”; Net uses OpEx + COGS purchases ---------- */
  const chartDailyArea = useMemo(
    () =>
      (dayRows || []).map((r) => ({
        date: r.date?.slice(5) || r.date,
        Paid: r.paid,
        Expenses: r.opEx,                          // show ONLY OpEx
        Net: r.paid - (r.opEx + r.cogsPurch),      // net uses both OpEx + COGS purchases
      })),
    [dayRows]
  );

  /* ---------- Pie: show “Expenses” slice = OpEx only ---------- */
  const pieTotals = useMemo(
    () => [
      { name: "Paid", value: totalSales.paid, color: COLORS.paid },
      { name: "Expenses", value: opExTotal, color: COLORS.expenses }, // OpEx only
      { name: "Balance", value: totalSales.balance, color: COLORS.balance },
    ],
    [totalSales.paid, totalSales.balance, opExTotal]
  );

  /* ---------- COGS purchase modal POST helper ---------- */
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

  const saveCogsPurchase = async (payload) => {
    const token = getDefaultToken();
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

    const res = await fetch(API_BASE + "/cogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      throw new Error(msg);
    }
    await load(filters);
    toast.success("COGS recorded");
  };

  /* ---------- UI ---------- */
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-white/60">
            Financial summary for{" "}
            <strong>
              {filters.date_from}
              {filters.date_to && filters.date_to !== filters.date_from ? ` → ${filters.date_to}` : ""}
            </strong>
          </p>
        </div>

        {/* Actions: wrap + horizontal scroll on tiny screens */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 -mx-1 px-1">
          <ToolbarBtn onClick={onRefresh}><RefreshCcw size={16} /> Refresh</ToolbarBtn>
          <ToolbarBtn onClick={onToday} title="Today (Africa/Nairobi)"><CalendarDays size={16} /> Today</ToolbarBtn>
          <ToolbarBtn onClick={onYesterday} title="Yesterday (Africa/Nairobi)"><CalendarDays size={16} /> Yesterday</ToolbarBtn>
          <ToolbarBtn onClick={onLast7} title="Last 7 Days (Africa/Nairobi)"><CalendarDays size={16} /> Last 7 Days</ToolbarBtn>
          <ToolbarBtn onClick={() => setShowCogsModal(true)}><Package size={16} /> Record COGS</ToolbarBtn>
          <ToolbarBtn onClick={onExportSalesPDF}><Download size={16} /> Export Sales PDF</ToolbarBtn>
        </div>
      </header>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-white/10 p-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300">
            <Filter size={16} /> Filters
          </div>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          />
          <button className="rounded-xl border border-white/10 px-3 py-2 text-xs sm:text-sm" onClick={onApply}>
            Apply
          </button>
        </div>
      </div>

      {/* KPIs — mobile-first grid (2/3/4 cols) */}
      <div className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <KPI compact label="Sales Gross" value={fmt(totalSales.gross)} color={COLORS.gross} />
          <KPI compact label="Sales Paid" value={fmt(totalSales.paid)} color={COLORS.paid} trend={trendFrom(dayRows, "paid")} />
          <KPI compact label="Sales Balance" value={fmt(totalSales.balance)} color={COLORS.balance} />
          <KPI compact label="Expenses" value={fmt(opExTotal)} color={COLORS.expenses} trend={trendFrom(dayRows, "opEx")} />
          <KPI compact label="Net (Paid - Exp - COGS Purch.)" value={fmt(net)} color={COLORS.net} trend={trendNet(dayRows)} />
          <KPI compact label="Total Cartons" value={Number(totalCartons || 0).toLocaleString()} color="#60a5fa" />
          <KPI compact label="COGS (Combined)" value={fmt(cogsTotals.cogs)} color={COLORS.cogs} />
          <KPI compact label="Net Profit" value={fmt(netProfit)} color="#10b981" />
        </div>
      </div>

      {/* COGS by Size */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="mb-2 text-sm text-white/80">COGS Breakdown (selected range)</div>
        {cogsSummary?.by_size?.length ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left">Bottle Size</th>
                  <th className="px-3 py-2 text-right">Cartons</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">COGS</th>
                </tr>
              </thead>
              <tbody>
                {[...cogsSummary.by_size]
                  .sort((a, b) => (num(b.cartons||0)-num(a.cartons||0)) || (num(b.sales||0)-num(a.sales||0)))
                  .map((r) => {
                    const sales = num(r.sales);
                    const cogs = num(r.cogs);
                    const cartons = num(r.cartons);
                    return (
                      <tr key={r.label || r.bottle_size_id} className="border-t border-white/10">
                        <td className="px-3 py-2">{r.label || "Unknown"}</td>
                        <td className="px-3 py-2 text-right">{Number(cartons || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{fmt(sales)}</td>
                        <td className="px-3 py-2 text-right">{fmt(cogs)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            {loading ? "Loading COGS…" : "No COGS data for this range"}
          </div>
        )}
      </motion.div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 xl:col-span-2"
        >
          <div className="mb-2 text-sm text-white/80">Daily Paid vs Expenses vs Net</div>
          {chartDailyArea.length ? (
            <div className="h-56 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDailyArea} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.paid} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.paid} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.expenses} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.expenses} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.net} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.net} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke={COLORS.axis} />
                  <YAxis stroke={COLORS.axis} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend className="hidden sm:block" wrapperStyle={{ color: "rgba(255,255,255,0.8)" }} />
                  <Area type="monotone" dataKey="Paid" stroke={COLORS.paid} fill="url(#paidGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Expenses" stroke={COLORS.expenses} fill="url(#expGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Net" stroke={COLORS.net} fill="url(#netGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-white/60">{loading ? "Loading…" : "No chart data"}</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"
        >
          <div className="mb-2 text-sm text-white/80">Totals Breakdown</div>
          {pieTotals.some((s) => s.value > 0) ? (
            <div className="h-56 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend className="hidden sm:block" wrapperStyle={{ color: "rgba(255,255,255,0.8)" }} />
                  <Pie data={pieTotals} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieTotals.map((slice, i) => (
                      <Cell key={i} fill={slice.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-white/60">{loading ? "Loading…" : "No chart data"}</div>
          )}
        </motion.div>
      </div>

      {/* Daily table → mobile cards + desktop table */}
      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {dayRows.length ? (
          dayRows.map((r) => (
            <div key={r.date} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{r.date}</div>
                <div className="text-white/60"># {Number(r.count || 0).toLocaleString()}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <CellRow label="Sales Gross" value={fmt(r.gross)} />
                <CellRow label="Paid" value={fmt(r.paid)} />
                <CellRow label="Balance" value={fmt(r.balance)} />
                <CellRow label="Expenses" value={fmt(r.opEx)} />
                <CellRow label="Net" value={fmt(r.paid - (r.opEx + r.cogsPurch))} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            {loading ? "Loading…" : "No data"}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <motion.div className="hidden sm:block" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mt-6 rounded-2xl border border-white/10 overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Sales Gross</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">Expenses</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right"># Sales</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map((r) => (
                <tr key={r.date} className="border-t border-white/10">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.gross)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.paid)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.balance)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.opEx)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.paid - (r.opEx + r.cogsPurch))}</td>
                  <td className="px-3 py-2 text-right">{Number(r.count || 0).toLocaleString()}</td>
                </tr>
              ))}
              {dayRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-white/60">
                    {loading ? "Loading…" : "No data"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {showCogsModal && (
        <CogsModal
          onClose={() => setShowCogsModal(false)}
          onSubmit={async (payload) => {
            try {
              await saveCogsPurchase(payload);
              setShowCogsModal(false);
            } catch (e) {
              toast.error(String(e.message || "Failed to save COGS"));
            }
          }}
        />
      )}

      <ToastContainer position="top-right" theme="dark" autoClose={2200} limit={1} />
    </div>
  );
}

/* ---------------- Small UI helpers ---------------- */
function ToolbarBtn({ children, onClick, title }) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border border-white/10 hover:bg-white/5 shrink-0"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function CellRow({ label, value }) {
  return (
    <>
      <div className="text-white/70">{label}</div>
      <div className="text-right font-medium">{value}</div>
    </>
  );
}

function KPI({ label, value, color, trend, compact = false }) {
  const up = trend && trend.delta > 0;
  const down = trend && trend.delta < 0;

  const pad = compact ? "p-3" : "p-4";
  const valueCls = compact ? "text-lg sm:text-xl" : "text-2xl";
  const labelCls = compact ? "text-[10px] sm:text-xs" : "text-xs";

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 ${pad}`}
      style={{ boxShadow: `0 0 0 1px ${color}22 inset` }}
    >
      <div className={`${labelCls} uppercase tracking-wide`} style={{ color: "rgba(255,255,255,0.7)" }}>
        {label}
      </div>
      <div className={`mt-1 font-semibold ${valueCls}`} style={{ color }}>
        {value}
      </div>
      {trend && trend.pct !== null && (
        <div className={`mt-1 inline-flex items-center gap-1 ${compact ? "text-[10px]" : "text-xs"}`}>
          {up && <ArrowUpRight size={compact ? 12 : 14} className="text-emerald-400" />}
          {down && <ArrowDownRight size={compact ? 12 : 14} className="text-rose-400" />}
          <span className={up ? "text-emerald-400" : down ? "text-rose-400" : "text-white/60"}>
            {trend.pct !== null ? `${trend.pct >= 0 ? "+" : ""}${trend.pct.toFixed(1)}%` : "—"}
          </span>
          <span className="text-white/40">vs prev day</span>
        </div>
      )}
    </div>
  );
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f17] px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-white/70">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="text-white/70">{p.name}</span>
          </div>
          <div className="font-medium">{fmt(p.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** ---------------- COGS Modal ---------------- */
function CogsModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    date: todayKE(),
    description: "COGS purchase",
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
                <option value="Bank">Bank</option>
                <option value="Other">Other</option>
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
                unit_cost_carton: form.unit_cost_carton !== "" ? Number(form.unit_cost_carton) : undefined,
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

/* ---------------- Trend helpers ---------------- */
function trendFrom(dayRows, key) {
  const lastTwo = dayRows.slice(-2);
  if (lastTwo.length < 2) return null;
  const prev = lastTwo[0][key] || 0;
  const curr = lastTwo[1][key] || 0;
  const delta = curr - prev;
  const pct = prev > 0 ? (delta / prev) * 100 : null;
  return { delta, pct };
}
function trendNet(dayRows) {
  const lastTwo = dayRows.slice(-2);
  if (lastTwo.length < 2) return null;
  const prevNet = (lastTwo[0].paid || 0) - ((lastTwo[0].opEx || 0) + (lastTwo[0].cogsPurch || 0));
  const currNet = (lastTwo[1].paid || 0) - ((lastTwo[1].opEx || 0) + (lastTwo[1].cogsPurch || 0));
  const delta = currNet - prevNet;
  const pct = prevNet > 0 ? (delta / prevNet) * 100 : null;
  return { delta, pct };
}

/* ---------------- Date helpers (Africa/Nairobi) ---------------- */
const TZ_KE = "Africa/Nairobi";
function ymdInKE(dateObj) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_KE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateObj);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}
function todayKE() { return ymdInKE(new Date()); }
function daysAgoKE(n) { return ymdInKE(new Date(Date.now() - n * 86400000)); }
function yesterdayKE() { return daysAgoKE(1); }
function last7DaysKE() { return { start: daysAgoKE(6), end: todayKE() }; }

/* ---------------- Number / Currency helpers ---------------- */
function num(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/kes|ksh/gi, "").replace(/[,\s]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(v) {
  const n = num(v);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "KES",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
  }).format(n);
}

/* Tiny icon-button + utilities */
const style = document.createElement("style");
style.innerHTML = `
.icon-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid hsl(0 0% 100% / 0.1);background:transparent;padding:.35rem;border-radius:.75rem}
.icon-btn:hover{background:hsl(0 0% 100% / 0.06)}
.no-scrollbar::-webkit-scrollbar{display:none}
.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
`;
if (typeof document !== "undefined") document.head.appendChild(style);
