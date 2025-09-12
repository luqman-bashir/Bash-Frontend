// src/pages/Home.jsx — spotlight hero, shimmer badges, visible email, clears after success
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext.jsx";
import Logo from "../assets/Bash.png";
import { toast } from "react-toastify";

/* Role → landing path */
const startPathForUser = (user) => {
  const role = (user?.role || "").toLowerCase();
  if (role === "admin") return "/admin/dashboard";
  if (role === "cashier" || role === "server") return "/cashier/sale";
  return "/dashboard";
};

export default function Home() {
  const { isLoggedIn, user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);

  // Open login modal if navbar sent us with ?login=1 or ?auth=login
  useEffect(() => {
    if (isLoggedIn) return; // no modal if already logged in
    const qs = new URLSearchParams(location.search);
    const shouldOpen =
      qs.get("login") === "1" ||
      qs.get("auth") === "login" ||
      (location.state && location.state.openLogin === true);
    if (shouldOpen) setOpen(true);
  }, [location.key, location.search, location.state, isLoggedIn]);

  // Remove login query hints when closing modal so it doesn't keep reopening
  const clearLoginQuery = useCallback(() => {
    const qs = new URLSearchParams(location.search);
    let changed = false;
    if (qs.has("login")) { qs.delete("login"); changed = true; }
    if (qs.get("auth") === "login") { qs.delete("auth"); changed = true; }
    if (changed) {
      navigate({ pathname: location.pathname, search: qs.toString() }, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <BackgroundAuras />
      <MouseSpotlight />
      <FloatingBubbles />

      {/* Centered logo at the very top — bigger, no white background */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto max-w-7xl px-6 pt-8">
          <div className="flex justify-center">
            <img
              src={Logo}
              alt="Bash logo"
              className="h-24 w-auto sm:h-28 md:h-32 object-contain select-none drop-shadow-[0_0_20px_rgba(56,189,248,0.25)]"
            />
          </div>
        </div>
      </header>

      {/* Centered hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-16 pt-36 sm:pt-44">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-white/70 sm:text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] animate-[pulse_3s_ease-in-out_infinite]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              real-time • accurate • fast
            </div>

            <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
              Run your{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 bg-clip-text text-transparent [background-size:200%_auto] animate-[shimmer_6s_linear_infinite]">
                  purified water
                </span>
                <span className="pointer-events-none absolute -inset-x-1 -bottom-1 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
              </span>{" "}
              business with confidence.
            </h1>

            <p className="mt-4 text-white/70">
              Create sales, record payments, track stock and packaging, manage users and approvals,
              all in one place. Built for the bustle of the floor and the clarity of the office.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isLoggedIn ? (
                <a
                  href={startPathForUser(user)}
                  className="group relative inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition will-change-transform hover:shadow-xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                >
                  <span className="absolute -inset-px rounded-xl bg-[radial-gradient(120px_120px_at_var(--mx)_var(--my),rgba(56,189,248,0.15),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  Open Dashboard <span className="transition group-hover:translate-x-0.5">→</span>
                </a>
              ) : (
                <button
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                  }}
                  onClick={() => setOpen(true)}
                  className="group relative inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition will-change-transform hover:shadow-xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                >
                  <span className="absolute -inset-px rounded-xl bg-[radial-gradient(120px_120px_at_var(--mx)_var(--my),rgba(16,185,129,0.18),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  <span className="relative z-10 flex items-center gap-2">
                    <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                    Sign in to continue
                  </span>
                  <span className="relative z-10 transition group-hover:translate-x-0.5">→</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Login modal */}
      <LoginModal
        open={open}
        onRequestClose={() => {
          setOpen(false);
          clearLoginQuery();
        }}
      />

      {/* Animations */}
      <style>{`
        @keyframes rise {
          0% { transform: translateY(0) translateX(0) scale(0.8); opacity: .0; }
          10% { opacity: .25; }
          100% { transform: translateY(-110vh) translateX(20px) scale(1); opacity: .0; }
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .shake { animation: shake .5s; }
      `}</style>
    </div>
  );
}

/* ---------- Background bits ---------- */
function BackgroundAuras() {
  return (
    <>
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto h-72 w-[60rem] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </>
  );
}

function MouseSpotlight() {
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  useEffect(() => {
    const onMove = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(56,189,248,0.08), transparent 60%)`,
      }}
      aria-hidden
    />
  );
}

function FloatingBubbles() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 12,
        size: 6 + Math.random() * 10,
      })),
    []
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/10"
          style={{
            left: `${b.left}%`,
            bottom: "-40px",
            width: `${b.size}px`,
            height: `${b.size}px`,
            animation: `rise ${b.duration}s linear ${b.delay}s infinite`,
            backdropFilter: "blur(2px)",
            border: "1px solid rgba(255,255,255,.12)",
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Login Modal (visible email, clears after success) ---------- */
function LoginModal({ open, onRequestClose }) {
  const navigate = useNavigate();
  const { login, pendingApproval } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);
  const emailRef = useRef(null);
  const modalRef = useRef(null);
  const [shake, setShake] = useState(false);

  // ✅ Single stable toast instance for this modal
  const toastIdRef = useRef("login-toast");

  // Auto-dismiss toast when modal closes or unmounts
  useEffect(() => {
    if (!open) toast.dismiss(toastIdRef.current);
  }, [open]);
  useEffect(() => () => toast.dismiss(toastIdRef.current), []);

  // allow close only if not submitting (let them close even if error)
  const canClose = !submitting;
  const guardedClose = useCallback(() => {
    if (canClose) {
      onRequestClose?.();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 550);
    }
  }, [canClose, onRequestClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus trap + Esc handling
  useEffect(() => {
    if (!open) return;
    setTimeout(() => emailRef.current?.focus(), 50);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (canClose) guardedClose();
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canClose, guardedClose]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // prevent double-submit
    setSubmitting(true);
    setError("");

    const tid = toastIdRef.current;

    // Show or reset the single loader toast
    if (!toast.isActive(tid)) {
      toast.loading("Signing in…", { toastId: tid });
    } else {
      toast.update(tid, { render: "Signing in…", isLoading: true });
    }

    try {
      const res = await login({ email, password });

      if (res?.ok && res.user) {
        toast.update(tid, {
          render: `Welcome ${res.user?.name || res.user?.email || "back"}`,
          type: "success",
          isLoading: false,
          autoClose: 1500,
          closeOnClick: true,
        });

        // Clear sensitive inputs AFTER success
        setEmail("");
        setPassword("");

        // Navigate to role landing
        navigate(startPathForUser(res.user), { replace: true });
        return;
      }

      if (res?.pendingApproval) {
        toast.update(tid, {
          render:
            res?.details?.error ||
            `Device approval required. Ask overall admin${
              res?.details?.request_id ? ` (Req #${res.details.request_id})` : ""
            }.`,
          type: "info",
          isLoading: false,
          autoClose: 3600,
          closeOnClick: true,
        });
      } else {
        const msg = res?.error || "Login failed";
        setError(msg);
        setShake(true);
        toast.update(tid, {
          render: msg,
          type: "error",
          isLoading: false,
          autoClose: 3600,
          closeOnClick: true,
        });
      }
    } catch (err) {
      console.error("Login error", err);
      const msg = "Login failed";
      setError(msg);
      setShake(true);
      toast.update(tid, {
        render: msg,
        type: "error",
        isLoading: false,
        autoClose: 3600,
        closeOnClick: true,
      });
    } finally {
      setSubmitting(false);
      setTimeout(() => setShake(false), 550);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center" role="dialog" aria-modal="true">
      {/* Backdrop is inert to prevent accidental dismiss */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={modalRef}
        className={`relative z-10 w-[92%] max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl ${shake ? "shake" : ""}`}
      >
        <div className="h-1 w-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400" />
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <h3 className="text-lg font-semibold">Sign in to your account</h3>
            <button
              onClick={guardedClose}
              disabled={!canClose}
              className={`ml-auto rounded-md p-1 transition ${canClose ? "text-white/60 hover:bg-white/10 hover:text-white" : "cursor-not-allowed text-white/30"}`}
              aria-label="Close"
              type="button"
              title={canClose ? "Close" : "Signing in…"}
            >
              ✕
            </button>
          </div>

          {/* device approval note */}
          {pendingApproval ? (
            <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <strong>New device detected.</strong> Awaiting overall admin approval.
              <div className="mt-1 text-amber-200/80">
                IP: {pendingApproval.ip || "unknown"}
                <br />
                Agent: {(pendingApproval.user_agent || "").slice(0, 60)}…
              </div>
            </div>
          ) : null}

          {/* errors */}
          {error ? (
            <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} autoComplete="off" className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-white/80" htmlFor="email">Email</label>
              </div>
              <div className="relative">
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-24 text-white outline-none ring-0 placeholder:text-white/40 focus:border-emerald-300/60"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-white/80" htmlFor="password">Password</label>
                {capsLockOn && (
                  <span className="text-[11px] text-amber-300">Caps Lock is ON</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState && e.getModifierState("CapsLock"))}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-14 text-white outline-none ring-0 placeholder:text-white/40 focus:border-emerald-300/60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute inset-y-0 right-1 my-1 rounded-md px-2 text-xs text-white/70 hover:bg-white/10"
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md hover:shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Spinner /> : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-white/50">
            Need access? Ask the overall admin to approve your device.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
