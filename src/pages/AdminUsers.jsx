// src/pages/AdminUsers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "../contexts/UserContext.jsx";
import {
  FiPlus, FiEdit2, FiLock, FiCheckCircle, FiXCircle,
  FiRefreshCw, FiUserX, FiUserCheck, FiSearch, FiTrash2, FiCheck
} from "react-icons/fi";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/** SweetAlert helpers (dark look + toast) */
const swalBase = {
  background: "#0f172a",       // slate-900
  color: "#e2e8f0",            // slate-200
  confirmButtonColor: "#10b981", // emerald-500
  cancelButtonColor: "#334155",  // slate-700
  customClass: { popup: "rounded-2xl" },
};
const Toast = Swal.mixin({
  ...swalBase,
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

/** Ask for confirmation with SweetAlert2 */
async function confirmAction({ title, text, confirmText = "Yes", icon = "question" }) {
  const res = await Swal.fire({
    ...swalBase,
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
  });
  return res.isConfirmed;
}

/** Helpers */
const isOverall = (u) =>
  String(u?.role || "").toLowerCase() === "admin" &&
  String(u?.admin_level || "").toLowerCase() === "overall";

/** ✅ Kenya timezone formatter for device requests */
const fmtKE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
function formatKE(iso) {
  try { return fmtKE.format(new Date(iso)); } catch { return iso || ""; }
}

/** ✅ Optional batch approve helper */
async function approveAllVisible({ items, approveDevice, after }) {
  const ids = (items || []).map(r => r.id);
  if (!ids.length) return;
  const ok = await confirmAction({
    title: "Approve all visible requests?",
    text: `This will approve ${ids.length} device(s).`,
    confirmText: "Approve all",
  });
  if (!ok) return;
  for (const id of ids) {
    try { await approveDevice(id); } catch { /* ignore one-off failures */ }
  }
  await after?.();
  Toast.fire({ icon: "success", title: `Approved ${ids.length} device(s)` });
}

/** Small UI helpers */
function Section({ title, actions, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}
function Badge({ color = "slate", children }) {
  const map = {
    slate: "bg-white/10 text-white/80",
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
    amber: "bg-amber-500/15 text-amber-300",
    blue: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
  };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${map[color]}`}>{children}</span>;
}
function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-emerald-300/60 ${props.className || ""}`}
    />
  );
}
function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60 ${props.className || ""}`}
    />
  );
}
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[92%] max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400" />
        <div className="flex items-center justify-between px-5 py-3">
          <h4 className="text-base font-semibold">{title}</h4>
          <button
            onClick={onClose}
            className="rounded p-1 text-white/70 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** Main page */
export default function AdminUsers() {
  const {
    // auth/roles
    isOverallAdmin,
    // users
    users, getUsers, createUser, updateUser, deleteUser, reactivateUser, resetPassword,
    // devices
    deviceRequests, getDeviceRequests, approveDevice, rejectDeviceRequest,
    deviceSummary, getDeviceSummary,
  } = useUser();

  const [tab, setTab] = useState("users"); // users | requests | summary
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const [draft, setDraft] = useState({
    id: null, name: "", email: "", password: "",
    role: "cashier", admin_level: "normal", phone: "", image: "",
    is_active: true,
  });
  const [pwDraft, setPwDraft] = useState({ user_id: null, password: "" });

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // ✅ Only fetch admin-only device data if user is overall admin
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr(""); setMsg("");
        await getUsers({ all: true });
        if (isOverallAdmin) {
          await Promise.all([getDeviceRequests(), getDeviceSummary()]);
        }
      } catch (e) {
        if (!ignore) setErr(e?.message || "Failed to load data");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [getUsers, getDeviceRequests, getDeviceSummary, isOverallAdmin]);

  const filteredUsers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users || [];
    return (users || []).filter(u =>
      [u.name, u.email, u.role, u.admin_level, u.phone].filter(Boolean).some(x => String(x).toLowerCase().includes(term))
    );
  }, [users, q]);

  if (!isOverallAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <h3 className="text-lg font-semibold text-red-200">Overall admin only</h3>
        <p className="mt-2 text-sm text-red-100/80">You need overall admin privileges to manage users and devices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>Users</TabButton>
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
          Device Requests {deviceRequests?.length ? <Badge color="amber">&nbsp;{deviceRequests.length}</Badge> : null}
        </TabButton>
        <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Device Summary</TabButton>
      </div>

      {msg ? <div className="rounded border border-emerald-400/30 bg-emerald-500/10 p-3 text-emerald-200">{msg}</div> : null}
      {err ? <div className="rounded border border-red-400/30 bg-red-500/10 p-3 text-red-200">{err}</div> : null}

      {/* USERS */}
      {tab === "users" && (
        <Section
          title="Users"
          actions={
            <>
              <div className="relative hidden sm:block">
                <FiSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
                <TextInput
                  value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search users…"
                  className="pl-8 w-64"
                />
              </div>
              <button
                onClick={() => {
                  setDraft({
                    id: null, name: "", email: "", password: "",
                    role: "cashier", admin_level: "normal",
                    phone: "", image: "", is_active: true,
                  });
                  setCreateOpen(true); setErr(""); setMsg("");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow hover:shadow-lg"
              >
                <FiPlus /> New User
              </button>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-white/70">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredUsers || []).map(u => {
                  const overall = isOverall(u);
                  return (
                    <tr key={u.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2">
                        {u.name}{" "}
                        {overall ? <Badge color="violet">&nbsp;Overall</Badge> : null}
                      </td>
                      <td className="px-3 py-2">{u.email || <span className="text-white/40">—</span>}</td>
                      <td className="px-3 py-2">
                        <Badge color={u.role === "admin" ? "blue" : "slate"}>{u.role}</Badge>
                      </td>
                      <td className="px-3 py-2">{u.admin_level || <span className="text-white/40">—</span>}</td>
                      <td className="px-3 py-2">{u.phone || <span className="text-white/40">—</span>}</td>
                      <td className="px-3 py-2">
                        {u.device_approved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><FiCheckCircle /> Approved</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-300"><FiXCircle /> Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {u.is_active ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          {overall ? (
                            <span
                              title="Overall admin is locked"
                              className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-white/80"
                            >
                              <FiLock /> Locked
                            </span>
                          ) : (
                            <>
                              <button
                                className="rounded px-2 py-1 hover:bg-white/10"
                                title="Edit"
                                onClick={() => {
                                  setDraft({
                                    id: u.id,
                                    name: u.name || "",
                                    email: u.email || "",
                                    password: "",
                                    role: u.role || "cashier",
                                    admin_level: u.admin_level || "normal",
                                    phone: u.phone || "",
                                    image: u.image || "",
                                    is_active: !!u.is_active,
                                    _overall: false,
                                  });
                                  setEditOpen(true); setErr(""); setMsg("");
                                }}
                              >
                                <FiEdit2 />
                              </button>

                              <button
                                className="rounded px-2 py-1 hover:bg-white/10"
                                title="Reset password"
                                onClick={() => {
                                  setPwDraft({ user_id: u.id, password: "" });
                                  setPwOpen(true); setErr(""); setMsg("");
                                }}
                              >
                                <FiLock />
                              </button>

                              {u.is_active ? (
                                <button
                                  className="rounded px-2 py-1 text-red-300 hover:bg-red-500/10"
                                  title="Deactivate (soft delete)"
                                  onClick={async () => {
                                    const ok = await confirmAction({
                                      title: "Deactivate user?",
                                      text: `This will sign out ${u.name} and disable access.`,
                                      confirmText: "Deactivate",
                                      icon: "warning",
                                    });
                                    if (!ok) return;

                                    setErr(""); setMsg("");
                                    try {
                                      setLoading(true);
                                      await deleteUser(u.id);
                                      await getUsers({ all: true });
                                      setMsg(`Deactivated ${u.name}`);
                                      Toast.fire({ icon: "success", title: `Deactivated ${u.name}` });
                                    } catch (e) {
                                      setErr(e?.message || "Failed to deactivate");
                                      Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to deactivate" });
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <FiUserX />
                                </button>
                              ) : (
                                <button
                                  className="rounded px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
                                  title="Reactivate"
                                  onClick={async () => {
                                    setErr(""); setMsg("");
                                    try {
                                      setLoading(true);
                                      await reactivateUser(u.id);
                                      await getUsers({ all: true });
                                      setMsg(`Reactivated ${u.name}`);
                                      Toast.fire({ icon: "success", title: `Reactivated ${u.name}` });
                                    } catch (e) {
                                      setErr(e?.message || "Failed to reactivate");
                                      Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to reactivate" });
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <FiUserCheck />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredUsers?.length && (
                  <tr>
                    <td colSpan="8" className="px-3 py-8 text-center text-white/60">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* REQUESTS (Approve/Reject table) */}
      {tab === "requests" && (
        <Section
          title="Pending Device Requests"
          actions={
            <>
              <button
                onClick={async () => {
                  setErr(""); setMsg(""); setLoading(true);
                  try {
                    await getDeviceRequests();
                    setMsg("Refreshed");
                    Toast.fire({ icon: "success", title: "Refreshed" });
                  } catch (e) {
                    setErr(e?.message || "Failed");
                    Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed" });
                  } finally {
                    setLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                disabled={loading}
              >
                <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              {/* ✅ Approve all visible */}
              <button
                onClick={() =>
                  approveAllVisible({
                    items: deviceRequests,
                    approveDevice,
                    after: async () => {
                      await Promise.all([getDeviceRequests(), getDeviceSummary(), getUsers({ all: true })]);
                    },
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                disabled={loading || !(deviceRequests || []).length}
              >
                <FiCheck /> Approve All
              </button>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-white/70">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Req ID</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">User Agent</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(deviceRequests || []).map((r) => (
                  <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-3 py-2">{r.user} <span className="text-white/40">#{r.user_id}</span></td>
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">{r.ip}</td>
                    <td className="px-3 py-2">
                      <span title={r.user_agent} className="line-clamp-2 break-all text-white/80">{r.user_agent}</span>
                    </td>
                    {/* ✅ Kenya time */}
                    <td className="px-3 py-2">{formatKE(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
                          title="Approve this device"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: "Approve device?",
                              text: `Approve request #${r.id} for ${r.user}?`,
                              confirmText: "Approve",
                            });
                            if (!ok) return;

                            setErr(""); setMsg("");
                            try {
                              setLoading(true);
                              await approveDevice(r.id);
                              await Promise.all([getDeviceRequests(), getDeviceSummary(), getUsers({ all: true })]);
                              setMsg(`Approved request #${r.id} for ${r.user}`);
                              Toast.fire({ icon: "success", title: `Approved #${r.id}` });
                            } catch (e) {
                              setErr(e?.message || "Failed to approve");
                              Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to approve" });
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <FiCheck /> Approve
                        </button>
                        <button
                          className="rounded px-2 py-1 text-red-300 hover:bg-red-500/10"
                          title="Reject & mark resolved"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: "Reject device?",
                              text: `Reject request #${r.id} for ${r.user}?`,
                              confirmText: "Reject",
                              icon: "warning",
                            });
                            if (!ok) return;

                            setErr(""); setMsg("");
                            try {
                              setLoading(true);
                              await rejectDeviceRequest(r.id);
                              await getDeviceRequests();
                              setMsg(`Rejected request for ${r.user}`);
                              Toast.fire({ icon: "success", title: `Rejected #${r.id}` });
                            } catch (e) {
                              setErr(e?.message || "Failed to reject");
                              Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to reject" });
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!deviceRequests?.length && (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center text-white/60">No pending device requests.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* SUMMARY */}
      {tab === "summary" && (
        <Section
          title="Approved Devices per User"
          actions={
            <button
              onClick={async () => {
                setErr(""); setMsg(""); setLoading(true);
                try {
                  await getDeviceSummary();
                  setMsg("Refreshed");
                  Toast.fire({ icon: "success", title: "Refreshed" });
                } catch (e) {
                  setErr(e?.message || "Failed");
                  Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed" });
                } finally {
                  setLoading(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              disabled={loading}
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          }
        >
          <div className="grid gap-3">
            {Object.keys(deviceSummary || {}).length === 0 && (
              <div className="rounded border border-white/10 bg-white/5 p-4 text-white/70">No approved devices yet.</div>
            )}
            {Object.entries(deviceSummary || {}).map(([uid, devices]) => {
              const u = (users || []).find(x => String(x.id) === String(uid));
              return (
                <div key={uid} className="rounded border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-sm font-semibold">
                    {u?.name || `User #${uid}`}{" "}
                    <span className="text-white/50">{u?.email ? `• ${u.email}` : ""}</span>
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
                    {(devices || []).map((line, i) => <li key={i} className="break-all">{line}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* CREATE USER MODAL (NO overall option) */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User">
        <UserForm
          draft={draft} setDraft={setDraft}
          canSetOverall={false}
          lockRoleAdminActive={false}
          onCancel={() => setCreateOpen(false)}
          onSubmit={async () => {
            setErr(""); setMsg("");
            try {
              setLoading(true);
              await createUser({
                name: draft.name,
                email: draft.email || undefined,
                password: draft.password || undefined,
                role: draft.role,
                admin_level: draft.role === "admin" ? "normal" : "normal",
                phone: draft.phone || undefined,
                image: draft.image || undefined,
              });
              await getUsers({ all: true });
              setMsg(`Created ${draft.name}`);
              setCreateOpen(false);
              Toast.fire({ icon: "success", title: `Created ${draft.name}` });
            } catch (e) {
              setErr(e?.message || "Failed to create user");
              Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to create user" });
            } finally {
              setLoading(false);
            }
          }}
          submitLabel="Create"
        />
      </Modal>

      {/* EDIT USER MODAL (never opened for overall admin) */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit User">
        <UserForm
          draft={draft} setDraft={setDraft} isEdit
          canSetOverall={Boolean(draft?._overall)}
          lockRoleAdminActive={Boolean(draft?._overall)}
          onCancel={() => setEditOpen(false)}
          onSubmit={async () => {
            setErr(""); setMsg("");
            try {
              setLoading(true);
              const patch = {
                name: draft.name,
                email: draft.email,
                phone: draft.phone,
                image: draft.image,
              };
              if (!draft._overall) {
                patch.role = draft.role;
                patch.admin_level = draft.role === "admin" ? (draft.admin_level || "normal") : "normal";
                // NOTE: do NOT touch device_approved or is_active here.
              }
              if (draft.password) patch.password = draft.password;

              await updateUser(draft.id, patch);
              await getUsers({ all: true });
              setMsg(`Updated ${draft.name}`);
              setEditOpen(false);
              Toast.fire({ icon: "success", title: `Updated ${draft.name}` });
            } catch (e) {
              setErr(e?.message || "Failed to update user");
              Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e?.message || "Failed to update user" });
            } finally {
              setLoading(false);
            }
          }}
          submitLabel="Save changes"
        />
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Reset Password">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(""); setMsg("");
            try {
              setLoading(true);
              await resetPassword(pwDraft.user_id, pwDraft.password);
              setMsg("Password reset successfully");
              setPwOpen(false);
              Toast.fire({ icon: "success", title: "Password reset" });
            } catch (e2) {
              setErr(e2?.message || "Failed to reset password");
              Swal.fire({ ...swalBase, icon: "error", title: "Failed", text: e2?.message || "Failed to reset password" });
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-sm text-white/80">New Password</label>
            <TextInput
              type="password"
              value={pwDraft.password}
              onChange={(e) => setPwDraft({ ...pwDraft, password: e.target.value })}
              placeholder="Enter a strong password"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPwOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Cancel</button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:shadow-lg">
              <FiLock /> Update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** Subcomponents */
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
        active ? "bg-white text-slate-900" : "border border-white/10 text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function UserForm({
  draft, setDraft, onSubmit, submitLabel = "Save",
  isEdit = false, canSetOverall = false, lockRoleAdminActive = false,
  onCancel,
}) {
  const isAdminRole = (draft.role || "") === "admin";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm text-white/80">Name</label>
        <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-white/80">Email</label>
        <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-white/80">{isEdit ? "Password (optional)" : "Password"}</label>
        <TextInput
          type="password"
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          required={!isEdit}
          placeholder={isEdit ? "Leave blank to keep current" : "••••••••"}
        />
      </div>

      {/* Role (locked for overall admin) */}
      <div>
        <label className="mb-1 block text-sm text-white/80">Role</label>
        <Select
          value={draft.role}
          onChange={(e) => setDraft({
            ...draft,
            role: e.target.value,
            admin_level: e.target.value === "admin" ? (draft.admin_level || "normal") : "normal",
          })}
          disabled={lockRoleAdminActive}
        >
          <option value="cashier">cashier</option>
          <option value="server">server</option>
          <option value="admin">admin</option>
        </Select>
      </div>

      {/* Admin level */}
      <div>
        <label className="mb-1 block text-sm text-white/80">Admin Level</label>
        <Select
          value={isAdminRole ? (draft.admin_level || "normal") : "normal"}
          onChange={(e) => setDraft({ ...draft, admin_level: e.target.value })}
          disabled={lockRoleAdminActive || !isAdminRole}
        >
          <option value="normal">normal</option>
          {canSetOverall ? <option value="overall" disabled>overall (locked)</option> : null}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-white/80">Phone</label>
        <TextInput value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-white/80">Image URL</label>
        <TextInput value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
      </div>

      <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Cancel</button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:shadow-lg">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
