// src/pages/CashierCustomers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCcw,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
  Phone,
  Mail,
  User2,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useSaleContext } from "../contexts/SaleContext.jsx";

/**
 * CashierCustomers.jsx
 * - Lists customers from SaleContext
 * - Client-side search by name/phone/email
 * - Create / Edit / Delete with modals & toasts
 * - NEW: "Owes" column showing outstanding balance
 */

export default function CashierCustomers() {
  const {
    customers,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    loading,
    error,
  } = useSaleContext();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // initial load
  useEffect(() => {
    fetchCustomers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () =>
    toast.promise(fetchCustomers(), {
      pending: "Refreshing…",
      success: "Up to date",
      error: "Refresh failed",
    });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers || [];
    return (customers || []).filter((c) => {
      const parts = [
        c?.name || "",
        c?.phone || c?.phone_number || "",
        c?.email || "",
      ]
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [customers, query]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Customers</h1>
          <p className="text-sm text-white/60">
            Manage customer contacts for retail & credit sales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border border-white/10 hover:bg-white/5"
            onClick={refresh}
          >
            <RefreshCcw size={16} /> Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white text-gray-900 hover:opacity-90"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> New Customer
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name / phone / email"
              className="w-full pl-7 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="text-sm text-white/60">
            Total: <span className="font-semibold">{rows.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 text-sm">
          {String(error)}
        </div>
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-right">Owes</th>{/* NEW */}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const owes = Number(
                  c.total_balance_due ?? c.balance_due ?? 0
                );
                return (
                  <tr key={c.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{c.name || "-"}</td>
                    <td className="px-3 py-2">{c.phone || c.phone_number || "-"}</td>
                    <td className="px-3 py-2">{c.email || "-"}</td>
                    <td className="px-3 py-2">{c.notes || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={
                          owes > 0
                            ? "inline-flex rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5"
                            : "text-white/70"
                        }
                      >
                        {formatMoney(owes)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => {
                            setEditing(c);
                            setShowModal(true);
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-btn text-rose-300"
                          title="Delete"
                          onClick={() =>
                            Swal.fire({
                              title: "Delete customer?",
                              text: c.name || "This customer will be removed.",
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonColor: "#ef4444",
                              confirmButtonText: "Delete",
                            }).then((r) => {
                              if (!r.isConfirmed) return;
                              toast
                                .promise(deleteCustomer(c.id), {
                                  pending: "Deleting…",
                                  success: "Customer deleted",
                                  error: "Delete failed",
                                })
                                .then(() => fetchCustomers())
                                .catch(() => {});
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/60">
                    {loading ? "Loading…" : "No customers"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {showModal && (
        <CustomerModal
          editing={editing}
          onClose={() => setShowModal(false)}
          onSubmit={async (payload) => {
            try {
              if (editing?.id) {
                await toast.promise(updateCustomer(editing.id, payload), {
                  pending: "Saving…",
                  success: "Customer updated",
                  error: "Update failed",
                });
              } else {
                await toast.promise(createCustomer(payload), {
                  pending: "Creating…",
                  success: "Customer created",
                  error: "Create failed",
                });
              }
              setShowModal(false);
              fetchCustomers().catch(() => {});
            } catch {}
          }}
        />
      )}

      <ToastContainer position="top-right" theme="dark" autoClose={2500} />
    </div>
  );
}

/* -------- Modal -------- */

function CustomerModal({ editing, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    name: editing?.name || "",
    phone: editing?.phone || editing?.phone_number || "",
    email: editing?.email || "",
    notes: editing?.notes || "",
  }));

  const canSave = String(form.name).trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f17] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">
            {editing ? "Edit Customer" : "New Customer"}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-400 flex items-center gap-2">
              <User2 size={14} /> Name
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="Customer name"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-gray-400 flex items-center gap-2">
              <Phone size={14} /> Phone (optional)
            </span>
            <input
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="+2547…"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-gray-400 flex items-center gap-2">
              <Mail size={14} /> Email (optional)
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="name@example.com"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-gray-400">Notes (optional)</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm"
              placeholder="Preferred terms, location, etc."
            />
          </label>
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
                name: String(form.name).trim(),
                ...(form.phone ? { phone: String(form.phone).trim() } : {}),
                ...(form.email ? { email: String(form.email).trim() } : {}),
                ...(form.notes ? { notes: String(form.notes).trim() } : {}),
              })
            }
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* Tiny icon-button style (shared) */
const style = document.createElement("style");
style.innerHTML = `.icon-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid hsl(0 0% 100% / 0.1);background:transparent;padding:.35rem;border-radius:.75rem}
.icon-btn:hover{background:hsl(0 0% 100% / 0.06)}`;
if (typeof document !== "undefined") document.head.appendChild(style);

/* Money formatter used in the "Owes" column */
function formatMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "KES",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
  }).format(Number(v));
}
