// src/pages/CashierStock.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PackageSearch, RefreshCcw, Loader2 } from "lucide-react";
import { usePackaging } from "../contexts/PackagingContext.jsx";

/**
 * CashierStock — responsive, read-only stock view
 * - Mobile: compact cards
 * - ≥sm screens: full table with horizontal scroll if needed
 * - Removed "Total stock value" KPI per request
 */

export default function CashierStock() {
  const { loading, error, stockBalances, fetchStockBalances } = usePackaging();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStockBalances().catch(() => {});
  }, []); // eslint-disable-line

  async function refresh() {
    try {
      setRefreshing(true);
      await fetchStockBalances();
    } finally {
      setRefreshing(false);
    }
  }

  const lastUpdated = useMemo(() => {
    const ts = stockBalances
      .map((r) => (r.updated_at ? new Date(r.updated_at).getTime() : 0))
      .filter(Boolean);
    if (!ts.length) return null;
    return new Date(Math.max(...ts));
  }, [stockBalances]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Stock</h1>
          <p className="text-xs sm:text-sm text-gray-400">View live bottle stock balances (read-only).</p>
        </div>
        <div className="flex flex-nowrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border border-white/10 hover:bg-white/5 disabled:opacity-50 text-sm whitespace-nowrap"
            onClick={refresh}
            disabled={refreshing}
            title="Refresh"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 text-sm">
          {String(error)}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Stats (no total value) */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-gray-400">SKU count</div>
            <div className="text-lg sm:text-xl font-semibold mt-1">
              {Intl.NumberFormat().format(stockBalances.length)}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Bottle sizes</div>
          </div>
          <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-gray-400">Last updated</div>
            <div className="text-lg sm:text-xl font-semibold mt-1">
              {lastUpdated ? lastUpdated.toLocaleString() : "-"}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">From records</div>
          </div>
        </div>

        {/* Mobile cards */}
        <StockCards className="sm:hidden" balances={stockBalances} loading={loading || refreshing} />

        {/* Desktop table */}
        <StockTable className="hidden sm:block" balances={stockBalances} loading={loading || refreshing} />
      </motion.div>
    </div>
  );
}

function StockCards({ className = "", balances, loading }) {
  return (
    <div className={className}>
      {balances.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          {loading ? "Loading…" : "No stock records"}
        </div>
      ) : (
        <div className="grid gap-3">
          {balances.map((r) => (
            <div key={r.bottle_size_id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-xs text-white/60">Units/carton: {r.units_per_carton || "-"}</div>
                </div>
                <div className="text-xs text-white/60">{formatDateTime(r.updated_at)}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <CellRow label="Cartons" value={r.cartons_on_hand} />
                <CellRow label="Bottles" value={r.bottles_on_hand} />
                <CellRow label="Carton Price" value={formatMoney(r.carton_price)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockTable({ className = "", balances, loading }) {
  return (
    <div className={`${className} rounded-2xl border border-white/10 overflow-x-auto`}>
      <div className="p-3 flex items-center gap-2 text-sm text-gray-300">
        <PackageSearch size={16} /> Live Stock Balances
      </div>
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left">Label</th>
            <th className="px-3 py-2 text-right">Units/carton</th>
            <th className="px-3 py-2 text-right">Cartons</th>
            <th className="px-3 py-2 text-right">Bottles</th>
            <th className="px-3 py-2 text-right">Carton Price</th>
            <th className="px-3 py-2 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((r) => (
            <tr key={r.bottle_size_id} className="border-t border-white/10">
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2 text-right">{r.units_per_carton || "-"}</td>
              <td className="px-3 py-2 text-right">{r.cartons_on_hand}</td>
              <td className="px-3 py-2 text-right">{r.bottles_on_hand}</td>
              <td className="px-3 py-2 text-right">{formatMoney(r.carton_price)}</td>
              <td className="px-3 py-2 text-right">{formatDateTime(r.updated_at)}</td>
            </tr>
          ))}

          {balances.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                {loading ? "Loading…" : "No stock records"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- tiny cell helper ---------- */
function CellRow({ label, value }) {
  return (
    <>
      <div className="text-white/70">{label}</div>
      <div className="text-right font-medium">
        {typeof value === "string" || typeof value === "number" ? value : value}
      </div>
    </>
  );
}

/* ---------- utils ---------- */
function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "KES",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
  }).format(Number(v));
}
