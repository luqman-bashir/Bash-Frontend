// src/pages/PackagingAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Edit2, Trash2, RotateCcw, PackageSearch,
  Filter, RefreshCcw, Save, X, Loader2
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Swal from "sweetalert2";
import { usePackaging } from "../contexts/PackagingContext.jsx";

/**
 * PackagingAdmin — mobile-first, responsive UI
 * - Collapsible filters on mobile; always visible ≥sm
 * - Cards on mobile; tables on ≥sm (Entries/Sizes/Stock)
 * - Responsive Toasts + SweetAlert2 (narrower on phones)
 */

export default function PackagingAdmin() {
  const {
    // global
    loading, error,

    // entries
    entries, pagination, filters,
    listPackaging, createPackaging, updatePackaging,
    deletePackaging, restorePackaging,

    // sizes
    bottleSizes, sizeOptions = [],
    fetchBottleSizes, fetchBottleSizeOptions,
    createBottleSize, updateBottleSize, deleteBottleSize,

    // stock
    stockBalances, fetchStockBalances, setFilters,
  } = usePackaging();

  const [tab, setTab] = useState("entries");

  // Modals
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [editingSize, setEditingSize] = useState(null);

  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // First load
  useEffect(() => { listPackaging({ page: 1 }).catch(() => {}); }, []); // eslint-disable-line

  // Tab-aware fetches
  useEffect(() => {
    if (tab === "stock") fetchStockBalances().catch(() => {});
    if (tab === "sizes") Promise.all([fetchBottleSizes(), fetchBottleSizeOptions()]).catch(() => {});
  }, [tab]); // eslint-disable-line

  const onFilterChange = (patch) => {
    const f = { ...filters, ...patch };
    setFilters(f);
    listPackaging({ ...f, page: 1 }).catch(() => {});
  };

  async function refresh() {
    try {
      setRefreshing(true);
      if (tab === "entries") {
        await toast.promise(
          listPackaging({ ...filters, page: pagination.page }),
          { pending: "Refreshing entries…", success: "Entries updated", error: "Refresh failed" }
        );
      } else if (tab === "sizes") {
        await toast.promise(
          Promise.all([fetchBottleSizes(), fetchBottleSizeOptions()]),
          { pending: "Refreshing sizes…", success: "Sizes updated", error: "Failed to refresh sizes" }
        );
      } else if (tab === "stock") {
        await toast.promise(
          fetchStockBalances(),
          { pending: "Refreshing stock…", success: "Stock updated", error: "Failed to refresh stock" }
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  const totalCartons = useMemo(
    () => entries.reduce((acc, e) => acc + (e.cartons || 0), 0),
    [entries]
  );
  const totalBottles = useMemo(
    () => entries.reduce((acc, e) => acc + (e.bottles || 0), 0),
    [entries]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Packaging</h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Manage bottle sizes, daily packaging entries, and live stock balances.
          </p>
        </div>

        {/* Actions toolbar (wrap + horizontal scroll on tiny screens) */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 -mx-1 px-1">
          <ToolbarBtn onClick={refresh} title="Refresh">
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </ToolbarBtn>

          {tab === "entries" && (
            <ToolbarBtn styleType="primary" onClick={() => { setEditingEntry(null); setShowEntryModal(true); }}>
              <Plus size={16} /> New Entry
            </ToolbarBtn>
          )}
          {tab === "sizes" && (
            <ToolbarBtn styleType="primary" onClick={() => { setEditingSize(null); setShowSizeModal(true); }}>
              <Plus size={16} /> New Size
            </ToolbarBtn>
          )}
        </div>
      </header>

      {/* Tabs (scrollable on mobile) */}
      <nav className="mb-4 -mx-1 px-1 overflow-x-auto no-scrollbar">
        <div className="inline-flex gap-2">
          <TabButton active={tab === "entries"} onClick={() => setTab("entries")}>Entries</TabButton>
          <TabButton active={tab === "sizes"} onClick={() => setTab("sizes")}>Bottle Sizes</TabButton>
          <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>Stock</TabButton>
        </div>
      </nav>

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 text-sm">
          {String(error)}
        </div>
      )}

      {/* ENTRIES TAB */}
      {tab === "entries" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <EntriesStats totalCartons={totalCartons} totalBottles={totalBottles} />

          <EntriesFilters sizeOptions={sizeOptions} filters={filters} onChange={onFilterChange} />

          {/* Mobile cards */}
          <EntriesCards
            className="sm:hidden"
            entries={entries}
            loading={loading}
            onEdit={(e) => { setEditingEntry(e); setShowEntryModal(true); }}
            onDelete={(e) => handleDeleteEntry(e, deletePackaging)}
            onRestore={(e) => handleRestoreEntry(e, restorePackaging)}
          />

          {/* Desktop table */}
          <EntriesTable
            className="hidden sm:block"
            entries={entries}
            loading={loading}
            pagination={pagination}
            onPage={(p) => listPackaging({ ...filters, page: p }).catch(() => {})}
            onEdit={(e) => { setEditingEntry(e); setShowEntryModal(true); }}
            onDelete={(e) => handleDeleteEntry(e, deletePackaging)}
            onRestore={(e) => handleRestoreEntry(e, restorePackaging)}
          />
        </motion.div>
      )}

      {/* SIZES TAB */}
      {tab === "sizes" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* Mobile cards */}
          <SizesCards
            className="sm:hidden"
            sizes={bottleSizes}
            loading={loading}
            onEdit={(s) => { setEditingSize(s); setShowSizeModal(true); }}
            onDelete={(s) => handleDeleteSize(s, deleteBottleSize)}
          />
          {/* Desktop table */}
          <SizesTable
            className="hidden sm:block"
            sizes={bottleSizes}
            loading={loading}
            onEdit={(s) => { setEditingSize(s); setShowSizeModal(true); }}
            onDelete={(s) => handleDeleteSize(s, deleteBottleSize)}
          />
        </motion.div>
      )}

      {/* STOCK TAB */}
      {tab === "stock" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* Mobile cards */}
          <StockCards className="sm:hidden" balances={stockBalances} loading={loading} />
          {/* Desktop table */}
          <StockTable className="hidden sm:block" balances={stockBalances} loading={loading} />
        </motion.div>
      )}

      {/* Modals */}
      {showEntryModal && (
        <EntryModal
          sizeOptions={sizeOptions}
          editing={editingEntry}
          onClose={() => setShowEntryModal(false)}
          onSubmit={async (payload) => {
            try {
              await toast.promise(
                editingEntry ? updatePackaging(editingEntry.id, payload) : createPackaging(payload),
                {
                  pending: editingEntry ? "Updating entry…" : "Creating entry…",
                  success: editingEntry ? "Entry updated" : "Entry created",
                  error: { render({ data }) { return data?.response?.data?.error || "Save failed"; } },
                }
              );
              setNotice("");
            } finally {
              setShowEntryModal(false);
            }
          }}
        />
      )}

      {showSizeModal && (
        <SizeModal
          editing={editingSize}
          onClose={() => setShowSizeModal(false)}
          onSubmit={async (payload) => {
            try {
              await toast.promise(
                editingSize ? updateBottleSize(editingSize.id, payload) : createBottleSize(payload),
                {
                  pending: editingSize ? "Updating size…" : "Creating size…",
                  success: editingSize ? "Size updated" : "Size created",
                  error: { render({ data }) { return data?.response?.data?.error || "Save failed"; } },
                }
              );
              setNotice("");
            } finally {
              setShowSizeModal(false);
            }
          }}
        />
      )}

      {/* Responsive Toasts — tightly sized on small screens */}

    </div>
  );
}

/* ---------- Shared tiny UI bits ---------- */
function ToolbarBtn({ children, onClick, title, styleType = "ghost" }) {
  const base = "inline-flex items-center gap-2 rounded-2xl px-3 py-2 shrink-0 text-sm whitespace-nowrap";
  const cls =
    styleType === "primary"
      ? "bg-white text-gray-900 hover:opacity-90"
      : "border border-white/10 hover:bg-white/5";
  return (
    <button className={`${base} ${cls}`} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-2xl px-3 py-2 text-sm transition whitespace-nowrap " +
        (active ? "bg-white text-gray-900" : "border border-white/10 hover:bg-white/5")
      }
    >
      {children}
    </button>
  );
}

/* ---------- Entries: stats + filters ---------- */
function EntriesStats({ totalCartons, totalBottles }) {
  return (
    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Entries" value={Intl.NumberFormat().format(totalCartons)} sub="Total cartons" />
      <StatCard label="Bottles" value={Intl.NumberFormat().format(totalBottles)} sub="From listed entries" />
    </div>
  );
}
function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
      <div className="text-[11px] sm:text-xs text-gray-400">{label}</div>
      <div className="text-lg sm:text-xl font-semibold mt-1">{value}</div>
      <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

/* ---- Collapsible Filters (mobile) ---- */
function EntriesFilters({ sizeOptions, filters, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-2xl border border-white/10">
      {/* Mobile header toggle */}
      <button className="w-full flex items-center justify-between p-3 sm:hidden" onClick={() => setOpen((v) => !v)}>
        <span className="inline-flex items-center gap-2 text-sm text-gray-300">
          <Filter size={16} /> Filters
        </span>
        <span className="text-xs text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>

      {/* Filters body: collapsible on mobile, always open ≥sm */}
      <div className={`${open ? "block" : "hidden"} sm:block p-3`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <select
            value={filters.bottle_size_id || ""}
            onChange={(e) => onChange({ bottle_size_id: e.target.value })}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          >
            <option value="">All sizes</option>
            {sizeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.date_from || ""}
            onChange={(e) => onChange({ date_from: e.target.value })}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          />
          <input
            type="date"
            value={filters.date_to || ""}
            onChange={(e) => onChange({ date_to: e.target.value })}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          />

          <select
            value={filters.order || "desc"}
            onChange={(e) => onChange({ order: e.target.value })}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs sm:text-sm"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>

          <label className="inline-flex items-center gap-2 text-xs sm:text-sm">
            <input
              type="checkbox"
              checked={!!filters.include_deleted}
              onChange={(e) => onChange({ include_deleted: e.target.checked })}
            />
            <span>Include deleted</span>
          </label>
        </div>
      </div>
    </div>
  );
}

/* ---------- Entries: Cards (mobile) + Table (desktop) ---------- */
function EntriesCards({ className = "", entries, loading, onEdit, onDelete, onRestore }) {
  return (
    <div className={className}>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          {loading ? "Loading…" : "No entries"}
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => (
            <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{e.bottle_size_label}</div>
                  <div className="text-xs text-white/60">{formatDate(e.date)}</div>
                </div>
                <div className="inline-flex items-center gap-2">
                  {!e.is_deleted && (
                    <button className="icon-btn" title="Edit" onClick={() => onEdit(e)}>
                      <Edit2 size={16} />
                    </button>
                  )}
                  {!e.is_deleted ? (
                    <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(e)}>
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button className="icon-btn text-emerald-300" title="Restore" onClick={() => onRestore(e)}>
                      <RotateCcw size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <CellRow label="Cartons" value={e.cartons} />
                <CellRow label="Bottles" value={e.bottles} />
                <CellRow label="Added by" value={e.added_by_name || "-"} />
                <CellRow
                  label="Status"
                  value={
                    e.is_deleted
                      ? <span className="inline-flex rounded-full bg-rose-500/20 text-rose-300 px-2 py-0.5">Deleted</span>
                      : <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">Active</span>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EntriesTable({ className = "", entries, loading, pagination, onPage, onEdit, onDelete, onRestore }) {
  return (
    <div className={`${className} rounded-2xl border border-white/10 overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Size</th>
            <th className="px-3 py-2 text-right">Cartons</th>
            <th className="px-3 py-2 text-right">Bottles</th>
            <th className="px-3 py-2 text-left">Added by</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-white/10">
              <td className="px-3 py-2 align-top">{formatDate(e.date)}</td>
              <td className="px-3 py-2 align-top">{e.bottle_size_label}</td>
              <td className="px-3 py-2 text-right align-top">{e.cartons}</td>
              <td className="px-3 py-2 text-right align-top">{e.bottles}</td>
              <td className="px-3 py-2 align-top">{e.added_by_name || "-"}</td>
              <td className="px-3 py-2 align-top">
                {e.is_deleted ? (
                  <span className="inline-flex rounded-full bg-rose-500/20 text-rose-300 px-2 py-0.5 text-xs">Deleted</span>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">Active</span>
                )}
              </td>
              <td className="px-3 py-2 text-right align-top">
                <div className="inline-flex items-center gap-2">
                  {!e.is_deleted && (
                    <button className="icon-btn" title="Edit" onClick={() => onEdit(e)}>
                      <Edit2 size={16} />
                    </button>
                  )}
                  {!e.is_deleted ? (
                    <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(e)}>
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button className="icon-btn text-emerald-300" title="Restore" onClick={() => onRestore(e)}>
                      <RotateCcw size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                {loading ? "Loading…" : "No entries"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-sm">
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

/* ---------- Sizes: Cards + Table ---------- */
function SizesCards({ className = "", sizes, loading, onEdit, onDelete }) {
  return (
    <div className={className}>
      {sizes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          {loading ? "Loading…" : "No bottle sizes"}
        </div>
      ) : (
        <div className="grid gap-3">
          {sizes.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-white/60">Units/carton: {s.units_per_carton || "-"}</div>
                </div>
                <div className="inline-flex items-center gap-2">
                  <button className="icon-btn" title="Edit" onClick={() => onEdit(s)}>
                    <Edit2 size={16} />
                  </button>
                  <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(s)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                <CellRow label="Carton Price" value={formatMoney(s.selling_price)} />
                <CellRow label="Cost / Carton" value={formatMoney(s.cost_price_carton)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SizesTable({ className = "", sizes, loading, onEdit, onDelete }) {
  return (
    <div className={`${className} rounded-2xl border border-white/10 overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left">Label</th>
            <th className="px-3 py-2 text-right">Units/carton</th>
            <th className="px-3 py-2 text-right">Carton Price</th>
            <th className="px-3 py-2 text-right">Cost/carton</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s.id} className="border-t border-white/10">
              <td className="px-3 py-2">{s.label}</td>
              <td className="px-3 py-2 text-right">{s.units_per_carton || "-"}</td>
              <td className="px-3 py-2 text-right">{formatMoney(s.selling_price)}</td>
              <td className="px-3 py-2 text-right">{formatMoney(s.cost_price_carton)}</td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex items-center gap-2">
                  <button className="icon-btn" title="Edit" onClick={() => onEdit(s)}>
                    <Edit2 size={16} />
                  </button>
                  <button className="icon-btn text-rose-300" title="Delete" onClick={() => onDelete(s)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {sizes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                {loading ? "Loading…" : "No bottle sizes"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Stock: Cards + Table ---------- */
function StockCards({ className = "", balances, loading }) {
  const totalValue = useMemo(
    () => balances.reduce((acc, r) => acc + (Number(r.cartons_on_hand || 0) * Number(r.carton_price || 0)), 0),
    [balances]
  );

  return (
    <div className={className}>
      <div className="mb-3 text-sm text-gray-300 flex items-center justify-between">
        <div className="inline-flex items-center gap-2"><PackageSearch size={16} /> Live Stock Balances</div>
        <div>Total value: <span className="font-semibold">{formatMoney(totalValue)}</span></div>
      </div>

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
  const totalValue = useMemo(
    () => balances.reduce((acc, r) => acc + (Number(r.cartons_on_hand || 0) * Number(r.carton_price || 0)), 0),
    [balances]
  );

  return (
    <div className={`${className} rounded-2xl border border-white/10 overflow-hidden`}>
      <div className="p-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm text-gray-300">
          <PackageSearch size={16} /> Live Stock Balances
        </div>
        <div className="text-sm text-gray-300">Total value: <span className="font-semibold">{formatMoney(totalValue)}</span></div>
      </div>
      <table className="w-full text-sm">
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

/* ---------- Modals ---------- */
function EntryModal({ sizeOptions, editing, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    bottle_size_id: editing?.bottle_size_id || "",
    cartons: editing?.cartons ?? "",
    date: editing?.date ? editing.date.slice(0, 10) : today(),
  }));

  const canSave = form.bottle_size_id && String(form.cartons).length > 0;

  return (
    <Modal onClose={onClose} title={editing ? "Edit Entry" : "New Entry"}>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Bottle size</label>
          <select
            value={form.bottle_size_id}
            onChange={(e) => setForm((s) => ({ ...s, bottle_size_id: Number(e.target.value) }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="" disabled>Select size</option>
            {sizeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Cartons</label>
          <input
            type="number"
            min={0}
            value={form.cartons}
            onChange={(e) => setForm((s) => ({ ...s, cartons: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded-xl border border-white/10 px-3 py-2" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() => onSubmit({
            bottle_size_id: Number(form.bottle_size_id),
            cartons: Number(form.cartons),
            date: form.date,
          })}
        >
          <Save size={16} /> Save
        </button>
      </div>
    </Modal>
  );
}

function SizeModal({ editing, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    label: editing?.label || "",
    selling_price: editing?.selling_price ?? "",
    cost_price_carton: editing?.cost_price_carton ?? "",
  }));

  const canSave = form.label && String(form.selling_price).length > 0;

  return (
    <Modal onClose={onClose} title={editing ? "Edit Bottle Size" : "New Bottle Size"}>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Label</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Carton Price (selling)</label>
          <input
            type="number"
            min={0}
            value={form.selling_price}
            onChange={(e) => setForm((s) => ({ ...s, selling_price: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-gray-400">Cost per Carton (optional)</label>
          <input
            type="number"
            min={0}
            value={form.cost_price_carton}
            onChange={(e) => setForm((s) => ({ ...s, cost_price_carton: e.target.value }))}
            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded-xl border border-white/10 px-3 py-2" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-3 py-2 disabled:opacity-50"
          onClick={() => onSubmit({
            label: String(form.label).trim(),
            selling_price: Number(form.selling_price),
            cost_price_carton: String(form.cost_price_carton).length ? Number(form.cost_price_carton) : undefined,
          })}
        >
          <Save size={16} /> Save
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f17] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/* ---------- Small helpers ---------- */
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

async function handleDeleteEntry(e, deletePackaging) {
  if (!(await confirmDanger({ title: "Delete entry?", text: "Stock will decrease by its cartons." }))) return;
  await toast.promise(deletePackaging(e.id), {
    pending: "Deleting entry…",
    success: "Entry deleted",
    error: { render({ data }) { return data?.response?.data?.error || "Delete failed"; } },
  });
}
async function handleRestoreEntry(e, restorePackaging) {
  if (!(await confirmDanger({ title: "Restore entry?", text: "This will increase stock by its cartons." }))) return;
  await toast.promise(restorePackaging(e.id), {
    pending: "Restoring…",
    success: "Entry restored",
    error: "Restore failed",
  });
}
async function handleDeleteSize(s, deleteBottleSize) {
  if (!(await confirmDanger({ title: "Delete bottle size?", text: "Only possible when no entries use it." }))) return;
  await toast.promise(deleteBottleSize(s.id), {
    pending: "Deleting size…",
    success: "Size deleted",
    error: { render({ data }) { return data?.response?.data?.error || "Delete failed"; } },
  });
}

// ---- utils ----
function formatDate(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
function formatDateTime(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
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
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ---- Responsive SweetAlert helper (extra small on phones) ---- */
async function confirmDanger({ title = "Are you sure?", text = "This cannot be undone." } = {}) {
  const res = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, do it",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    background: "#0b0f17",
    color: "#e5e7eb",
    // Make it truly small on phones:
    width: "min(92vw, 340px)",
    padding: "0.75rem",
    buttonsStyling: false, // let our Tailwind classes control size
    customClass: {
      popup: "!rounded-2xl",
      title: "text-sm sm:text-base",
      htmlContainer: "text-xs sm:text-sm",
      actions: "flex flex-col sm:flex-row gap-2 sm:gap-3",
      confirmButton:
        "inline-flex items-center justify-center rounded-xl bg-white text-gray-900 px-3 py-1.5 text-sm",
      cancelButton:
        "inline-flex items-center justify-center rounded-xl border border-white/20 px-3 py-1.5 text-sm text-white",
    },
  });
  return res.isConfirmed;
}

/* ---- Tiny styles: icon button, no-scrollbar ---- */
const style = document.createElement("style");
style.innerHTML = `
.icon-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid hsl(0 0% 100% / 0.1);background:transparent;padding:.35rem;border-radius:.75rem}
.icon-btn:hover{background:hsl(0 0% 100% / 0.06)}
.no-scrollbar::-webkit-scrollbar{display:none}
.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
`;
if (typeof document !== "undefined") document.head.appendChild(style);

