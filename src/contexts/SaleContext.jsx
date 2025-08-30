import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

/**
 * SaleContext.jsx — matches latest Flask routes & Nairobi time rules
 * Provides:
 * - Customers CRUD
 * - Sales list/search/CRUD
 * - Payments (incl. credit)
 * - Dispatch close
 * - Summary by date (normalized: always { date, gross, paid, balance, count })
 * - Cartons-by-size summary (totals first, then per-size)
 * - COGS summary (totals + per-size; with Today/Yesterday/Last-7 helpers)
 * - COGS purchases (POST /cogs) to record non-sale COGS (e.g., water purchase)
 * - Receipt + CSV/PDF exports + email
 * - Today / Yesterday / Last-7-days helpers
 */

// -------------------- API Helpers --------------------
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "/api"; // Vite proxy in dev

const jsonHeaders = { Accept: "application/json", "Content-Type": "application/json" };

function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function apiFetch(path, { method = "GET", token, body, headers, blob = false } = {}) {
  const url = API_BASE + path;
  const opts = {
    method,
    headers: {
      ...(blob ? {} : jsonHeaders),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  };
  if (body !== undefined && body !== null && !blob) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(url, opts);
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
  if (blob) return res.blob();
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getDefaultToken() {
  try {
    const t = localStorage.getItem("token") || localStorage.getItem("access_token");
    return t || "";
  } catch {
    return "";
  }
}

// -------------------- Money & Date Helpers --------------------
// Robust numeric normalizer for values like "KES 12,000", "KSh 1 500", "12,000.50"
function toNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v
      .replace(/(kes|ksh|\bsh\b|\bkes\.)/gi, "")
      .replace(/[,\u00A0\s]/g, "") // commas, nbsp, spaces
      .replace(/[^\d.-]/g, ""); // keep digits, dot, minus
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// -------------------- Nairobi-time helpers --------------------
const NAIROBI_TZ = "Africa/Nairobi";

function ymdInNairobi(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NAIROBI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}
function todayISOInNairobi() {
  return ymdInNairobi(new Date());
}
function yesterdayISOInNairobi() {
  const now = new Date();
  const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return ymdInNairobi(yest);
}
function daysAgoISOInNairobi(n) {
  const now = new Date();
  const dt = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  return ymdInNairobi(dt);
}

// Accept backend shapes safely
function extractSalesArray(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.sales)) return res.sales;
  return [];
}

// -------------------- Context State --------------------
const initialState = {
  loading: false,
  error: null,

  sales: [],
  pagination: { page: 1, per_page: 20, total: 0, pages: 0 },

  filters: {
    receipt: "",
    customer: "",
    sale_type: "",
    date_from: "",
    date_to: "",
    include_deleted: false,
    order: "desc",
  },

  selectedSale: null,
  customers: [],
  summaryByDate: [],

  // Expenses (optional)
  expenses: [],
  expenseToday: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SALES":
      return { ...state, sales: action.sales, pagination: action.pagination || state.pagination };
    case "SET_FILTERS":
      return { ...state, filters: { ...state.filters, ...(action.filters || {}) } };
    case "SET_SELECTED_SALE":
      return { ...state, selectedSale: action.sale };
    case "SET_CUSTOMERS":
      return { ...state, customers: action.customers || [] };
    case "SET_SUMMARY":
      return { ...state, summaryByDate: action.data || [] };
    case "SET_EXPENSES":
      return { ...state, expenses: action.data || [] };
    case "SET_EXPENSE_TODAY":
      return { ...state, expenseToday: action.data || null };
    default:
      return state;
  }
}

const SaleContext = createContext(null);
export function useSaleContext() {
  const ctx = useContext(SaleContext);
  if (!ctx) throw new Error("useSaleContext must be used within <SaleProvider>");
  return ctx;
}

// -------------------- Provider --------------------
export function SaleProvider({ children, getToken }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Always use the latest getToken function
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const getAuthToken = useCallback(() => {
    try {
      if (typeof getTokenRef.current === "function") {
        const t = getTokenRef.current();
        if (t) return t;
      }
    } catch {}
    return getDefaultToken();
  }, []);

  // ---------------- Customers ----------------
  const fetchCustomers = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return { data: [] };
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await apiFetch(`/customers`, { token });
      dispatch({ type: "SET_CUSTOMERS", customers: res?.data || [] });
      dispatch({ type: "SET_LOADING", loading: false });
      return res;
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e.message });
      dispatch({ type: "SET_LOADING", loading: false });
      throw e;
    }
  }, [getAuthToken]);

  const createCustomer = useCallback(
    async (payload) => {
      const token = getAuthToken();
      const res = await apiFetch(`/customers`, { method: "POST", token, body: payload });
      try {
        await fetchCustomers();
      } catch {}
      return res?.data;
    },
    [getAuthToken, fetchCustomers]
  );

  const updateCustomer = useCallback(
    async (customer_id, patch) => {
      const token = getAuthToken();
      const res = await apiFetch(`/customers/${customer_id}`, { method: "PUT", token, body: patch });
      try {
        await fetchCustomers();
      } catch {}
      return res?.data;
    },
    [getAuthToken, fetchCustomers]
  );

  const deleteCustomer = useCallback(
    async (customer_id) => {
      const token = getAuthToken();
      await apiFetch(`/customers/${customer_id}`, { method: "DELETE", token });
      try {
        await fetchCustomers();
      } catch {}
      return true;
    },
    [getAuthToken, fetchCustomers]
  );

  // ---------------- Sales: list & filters ----------------
  const setFilters = useCallback((filters) => dispatch({ type: "SET_FILTERS", filters }), []);

  const listSales = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token) return { data: [] };
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const q = {
          page: params.page ?? state.pagination.page,
          per_page: params.per_page ?? state.pagination.per_page,
          receipt: params.receipt ?? state.filters.receipt,
          customer: params.customer ?? state.filters.customer,
          sale_type: params.sale_type ?? state.filters.sale_type,
          date_from: params.date_from ?? state.filters.date_from,
          date_to: params.date_to ?? state.filters.date_to,
          include_deleted: params.include_deleted ?? state.filters.include_deleted,
          order: params.order ?? state.filters.order,
        };
        const res = await apiFetch(`/retail-sales${qs(q)}`, { token });
        dispatch({
          type: "SET_SALES",
          sales: res?.data || [],
          pagination: res?.pagination || initialState.pagination,
        });
        dispatch({ type: "SET_LOADING", loading: false });
        return res;
      } catch (e) {
        dispatch({ type: "SET_ERROR", error: e.message });
        dispatch({ type: "SET_LOADING", loading: false });
        throw e;
      }
    },
    [getAuthToken, state.pagination.page, state.pagination.per_page, state.filters]
  );

  // Exact today
  const listTodaySales = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return { data: [] };
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await apiFetch(`/retail-sales/today`, { token });
      const rows = extractSalesArray(res);
      dispatch({
        type: "SET_SALES",
        sales: rows,
        pagination: { page: 1, per_page: rows.length, total: rows.length, pages: 1 },
      });
      const today = todayISOInNairobi();
      dispatch({ type: "SET_FILTERS", filters: { date_from: today, date_to: today } });
      dispatch({ type: "SET_LOADING", loading: false });
      return res;
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e.message });
      dispatch({ type: "SET_LOADING", loading: false });
      throw e;
    }
  }, [getAuthToken]);

  // Yesterday
  const listYesterdaySales = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return { sales: [] };
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await apiFetch(`/retail-sales/yesterday`, { token });
      const rows = extractSalesArray(res);
      dispatch({
        type: "SET_SALES",
        sales: rows,
        pagination: { page: 1, per_page: rows.length, total: rows.length, pages: 1 },
      });
      const y = res?.date || yesterdayISOInNairobi();
      dispatch({ type: "SET_FILTERS", filters: { date_from: y, date_to: y } });
      dispatch({ type: "SET_LOADING", loading: false });
      return res;
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e.message });
      dispatch({ type: "SET_LOADING", loading: false });
      throw e;
    }
  }, [getAuthToken]);

  // Last 7 days (inclusive t-6 .. t)
  const listLast7DaysSales = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return { sales: [] };
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await apiFetch(`/retail-sales/last-7-days`, { token });
      const rows = extractSalesArray(res);
      dispatch({
        type: "SET_SALES",
        sales: rows,
        pagination: { page: 1, per_page: rows.length, total: rows.length, pages: 1 },
      });
      const end = res?.end_date || todayISOInNairobi();
      const start = res?.start_date || daysAgoISOInNairobi(6);
      dispatch({ type: "SET_FILTERS", filters: { date_from: start, date_to: end } });
      dispatch({ type: "SET_LOADING", loading: false });
      return res;
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e.message });
      dispatch({ type: "SET_LOADING", loading: false });
      throw e;
    }
  }, [getAuthToken]);

  // Handy helper: set filters to "today" (Nairobi)
  const setDateFiltersToToday = useCallback(() => {
    const today = todayISOInNairobi();
    dispatch({ type: "SET_FILTERS", filters: { date_from: today, date_to: today } });
  }, []);

  const searchSales = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token) return { data: [] };
      return apiFetch(`/retail-sales/search${qs(params)}`, { token });
    },
    [getAuthToken]
  );

  // ---------------- Sales: CRUD ----------------
  const createSale = useCallback(
    async (payload) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales`, { method: "POST", token, body: payload });
      try {
        await listSales();
      } catch {}
      return res?.data;
    },
    [getAuthToken, listSales]
  );

  const getSale = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}`, { token });
      dispatch({ type: "SET_SELECTED_SALE", sale: res?.data || null });
      return res?.data;
    },
    [getAuthToken]
  );

  const getSaleByReceipt = useCallback(
    async (receipt_number) => {
      const token = getAuthToken();
      const res = await apiFetch(
        `/retail-sales/by-receipt/${encodeURIComponent(receipt_number)}`,
        { token }
      );
      return res?.data;
    },
    [getAuthToken]
  );

  const updateSale = useCallback(
    async (sale_id, patch) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}`, {
        method: "PUT",
        token,
        body: patch,
      });
      try {
        await getSale(sale_id);
      } catch {}
      try {
        await listSales();
      } catch {}
      return res?.data;
    },
    [getAuthToken, getSale, listSales]
  );

  const deleteSale = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      await apiFetch(`/retail-sales/${sale_id}`, { method: "DELETE", token });
      try {
        await listSales();
      } catch {}
      return true;
    },
    [getAuthToken, listSales]
  );

  const restoreSale = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/restore`, {
        method: "POST",
        token,
      });
      try {
        await getSale(sale_id);
      } catch {}
      try {
        await listSales();
      } catch {}
      return res?.data || { message: res?.message };
    },
    [getAuthToken, getSale, listSales]
  );

  const listItemsForSale = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/items`, { token });
      return res?.data || [];
    },
    [getAuthToken]
  );

  // ---------------- Payments ----------------
  const createPayment = useCallback(
    async (sale_id, { amount, payment_method, date }) => {
      const token = getAuthToken();
      const body = { amount, payment_method, ...(date ? { date } : {}) };
      const res = await apiFetch(`/retail-sales/${sale_id}/payments`, {
        method: "POST",
        token,
        body,
      });
      try {
        await getSale(sale_id);
      } catch {}
      try {
        await listSales();
      } catch {}
      return res?.data;
    },
    [getAuthToken, getSale, listSales]
  );

  const createCreditPayment = useCallback(
    async (sale_id, { amount, payment_method, date }) => {
      const token = getAuthToken();
      const body = { amount, payment_method, ...(date ? { date } : {}) };
      const res = await apiFetch(`/credit-sales/${sale_id}/payments`, {
        method: "POST",
        token,
        body,
      });
      try {
        await getSale(sale_id);
      } catch {}
      try {
        await listSales();
      } catch {}
      return res; // { ok, message, email_sent, data }
    },
    [getAuthToken, getSale, listSales]
  );

  const listPayments = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/payments`, { token });
      return res?.data || [];
    },
    [getAuthToken]
  );

  const getPayment = useCallback(
    async (payment_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/customer-payments/${payment_id}`, { token });
      return res?.data;
    },
    [getAuthToken]
  );

  const updatePayment = useCallback(
    async (payment_id, patch) => {
      const token = getAuthToken();
      const res = await apiFetch(`/customer-payments/${payment_id}`, {
        method: "PUT",
        token,
        body: patch,
      });
      return res?.data;
    },
    [getAuthToken]
  );

  const deletePayment = useCallback(
    async (payment_id) => {
      const token = getAuthToken();
      await apiFetch(`/customer-payments/${payment_id}`, { method: "DELETE", token });
      return true;
    },
    [getAuthToken]
  );

  const sendPaymentEmail = useCallback(
    async ({ retail_sale_id, amount, balance }) => {
      const token = getAuthToken();
      const body = { retail_sale_id, amount, balance };
      const res = await apiFetch(`/send-payment-email`, {
        method: "POST",
        token,
        body,
      });
      return res?.email_sent === true;
    },
    [getAuthToken]
  );

  // ---------------- Dispatch close ----------------
  const closeDispatch = useCallback(
    async (sale_id, payload) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/close-dispatch`, {
        method: "POST",
        token,
        body: payload,
      });
      try {
        await getSale(sale_id);
      } catch {}
      try {
        await listSales();
      } catch {}
      return res?.data;
    },
    [getAuthToken, getSale, listSales]
  );

  // ---------------- Summary (normalized money totals) ----------------
  const fetchSummaryByDate = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token) return [];

      const res = await apiFetch(`/retail-sales/summary/by-date${qs(params)}`, { token });

      // Accept common shapes
      const payload =
        res?.data ??
        res?.summary ??
        res?.rows ??
        res;

      const raw = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      const data = raw.map((r) => {
        // flexible date
        let date =
          r.date ||
          r.day ||
          r.sale_date ||
          (typeof r.created_at === "string" ? r.created_at.slice(0, 10) : "");

        // flexible numeric fields
        const gross =
          toNum(r.gross) ||
          toNum(r.total) ||
          toNum(r.total_amount) ||
          toNum(r.amount_total) ||
          toNum(r.revenue) ||
          0;

        const paid =
          toNum(r.paid) ||
          toNum(r.paid_amount) ||
          toNum(r.amount_paid) ||
          toNum(r.total_paid) ||
          0;

        const balanceRaw =
          r.balance ??
          r.balance_due ??
          r.amount_due ??
          r.outstanding ??
          (gross - paid);

        const balance = toNum(balanceRaw);

        const count =
          (Number.isFinite(Number(r.count)) ? Number(r.count) : null) ??
          (Number.isFinite(Number(r.num_sales)) ? Number(r.num_sales) : null) ??
          (Number.isFinite(Number(r.sales_count)) ? Number(r.sales_count) : null) ??
          0;

        return {
          date: typeof date === "string" ? date.slice(0, 10) : "",
          gross,
          paid,
          balance,
          count,
        };
      });

      dispatch({ type: "SET_SUMMARY", data });
      return data;
    },
    [getAuthToken]
  );

  // Summary for today only (Nairobi)
  const fetchSummaryToday = useCallback(async () => {
    const today = todayISOInNairobi();
    return fetchSummaryByDate({ date_from: today, date_to: today });
  }, [fetchSummaryByDate]);

  // ---------------- Cartons-by-size summary (totals first, then per-size) ----------------
  const fetchCartonsBySize = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token) return { totals: { cartons: 0, revenue: 0 }, by_size: [] };

      const res = await apiFetch(`/retail-sales/summary/cartons${qs(params)}`, { token });

      const payload = res?.data ?? res ?? {};
      const list = Array.isArray(payload.by_size)
        ? payload.by_size
        : Array.isArray(payload)
        ? payload
        : [];

      const by_size = list
        .map((r) => ({
          bottle_size_id: Number(r.bottle_size_id ?? r.id ?? 0) || null,
          label: r.label ?? r.bottle_size_label ?? "Unknown",
          cartons: toNum(r.cartons ?? r.quantity ?? r.total_cartons),
          revenue: toNum(r.revenue ?? r.value ?? r.total_value),
        }))
        .sort((a, b) => b.cartons - a.cartons || b.revenue - a.revenue);

      const totalsSrc = payload.totals ?? payload.total ?? null;
      const totals = totalsSrc
        ? {
            cartons: toNum(totalsSrc.cartons ?? totalsSrc.total_cartons ?? 0),
            revenue: toNum(totalsSrc.revenue ?? totalsSrc.total_value ?? 0),
          }
        : by_size.reduce(
            (acc, x) => {
              acc.cartons += x.cartons;
              acc.revenue += x.revenue;
              return acc;
            },
            { cartons: 0, revenue: 0 }
          );

      return {
        totals,
        by_size,
        date_from: payload.date_from ?? params.date_from ?? null,
        date_to: payload.date_to ?? params.date_to ?? null,
      };
    },
    [getAuthToken]
  );

  // Convenience wrappers for cartons
  const fetchCartonsToday = useCallback(async () => {
    const d = todayISOInNairobi();
    return fetchCartonsBySize({ date_from: d, date_to: d });
  }, [fetchCartonsBySize]);

  const fetchCartonsYesterday = useCallback(async () => {
    const y = yesterdayISOInNairobi();
    return fetchCartonsBySize({ date_from: y, date_to: y });
  }, [fetchCartonsBySize]);

  const fetchCartonsLast7Days = useCallback(async () => {
    const end = todayISOInNairobi();
    const start = daysAgoISOInNairobi(6);
    return fetchCartonsBySize({ date_from: start, date_to: end });
  }, [fetchCartonsBySize]);

  // ---------------- COGS summary (totals + per-size) ----------------
  const fetchCogsSummary = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token)
        return {
          totals: { sales: 0, cogs: 0, gross: 0, gm: 0, breakdown: { cogs_sales: 0, purchases: 0 } },
          by_size: [],
          date_from: params.date_from ?? null,
          date_to: params.date_to ?? null,
        };

      const res = await apiFetch(`/retail-sales/summary/cogs${qs(params)}`, { token });

      const payload = res?.data ?? res ?? {};

      const t = payload.totals ?? {};
      const totals_sales = toNum(t.sales ?? t.total_sales ?? t.revenue);
      const totals_cogs = toNum(t.cogs ?? t.total_cogs);
      const totals_gross = toNum(t.gross ?? t.gross_profit ?? (totals_sales - totals_cogs));
      const totals_gm =
        t.gm !== undefined
          ? toNum(t.gm)
          : t.gross_margin !== undefined
          ? toNum(t.gross_margin)
          : totals_sales > 0
          ? (totals_gross / totals_sales) * 100
          : 0;

      const br = t.breakdown ?? {};
      const breakdown = {
        cogs_sales: toNum(br.cogs_sales ?? t.cogs_sales ?? 0),
        purchases: toNum(br.purchases ?? t.cogs_purchases ?? 0),
      };

      const totals = {
        sales: totals_sales,
        cogs: totals_cogs,
        gross: totals_gross,
        gm: totals_gm,
        breakdown,
      };

      const list = Array.isArray(payload.by_size) ? payload.by_size : Array.isArray(payload) ? payload : [];
      const by_size = list
        .map((r) => {
          const sales = toNum(r.sales ?? r.revenue ?? r.total);
          const cogs = toNum(r.cogs ?? r.cogs_total ?? r.cost);
          const gross = toNum(r.gross ?? r.gross_profit ?? (sales - cogs));
          const gm = sales > 0 ? (gross / sales) * 100 : 0;
          return {
            bottle_size_id: Number(r.bottle_size_id ?? r.id ?? 0) || null,
            label: r.label ?? r.bottle_size_label ?? "Unknown",
            cartons: toNum(r.cartons ?? r.quantity ?? 0),
            sales,
            cogs,
            gross,
            gm,
          };
        })
        .sort((a, b) => b.cartons - a.cartons || b.sales - a.sales);

      return {
        totals,
        by_size,
        date_from: payload.date_from ?? params.date_from ?? null,
        date_to: payload.date_to ?? params.date_to ?? null,
      };
    },
    [getAuthToken]
  );

  // Convenience wrappers for COGS (Africa/Nairobi)
  const fetchCogsToday = useCallback(async () => {
    const d = todayISOInNairobi();
    return fetchCogsSummary({ date_from: d, date_to: d });
  }, [fetchCogsSummary]);

  const fetchCogsYesterday = useCallback(async () => {
    const y = yesterdayISOInNairobi();
    return fetchCogsSummary({ date_from: y, date_to: y });
  }, [fetchCogsSummary]);

  const fetchCogsLast7Days = useCallback(async () => {
    const end = todayISOInNairobi();
    const start = daysAgoISOInNairobi(6);
    return fetchCogsSummary({ date_from: start, date_to: end });
  }, [fetchCogsSummary]);

  // ---------------- COGS purchases (manual) ----------------
  const createCogsPurchase = useCallback(
    async (payload = {}) => {
      const token = getAuthToken();
      const body = {
        amount: toNum(payload.amount),
        ...(payload.description ? { description: payload.description } : {}),
        ...(payload.date ? { date: payload.date } : {}),
        ...(payload.payment_method ? { payment_method: payload.payment_method } : {}),
        ...(payload.bottle_size_id != null ? { bottle_size_id: payload.bottle_size_id } : {}),
        ...(payload.unit_cost_carton != null ? { unit_cost_carton: toNum(payload.unit_cost_carton) } : {}),
      };
      if (!Number.isFinite(body.amount) || body.amount <= 0) {
        throw new Error("amount is required and must be > 0");
      }
      const res = await apiFetch(`/cogs`, { method: "POST", token, body });
      return res?.data;
    },
    [getAuthToken]
  );

  // ---------------- Receipts, Printing & Exports ----------------
  const getReceipt = useCallback(
    async (sale_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/receipt`, { token });
      return res?.data;
    },
    [getAuthToken]
  );

  const printSaleReceipt = useCallback(
    async (sale_id, payload = {}) => {
      const token = getAuthToken();
      const res = await apiFetch(`/retail-sales/${sale_id}/print`, {
        method: "POST",
        token,
        body: payload,
      });
      return res; // { ok, message }
    },
    [getAuthToken]
  );

  const exportSalesCSV = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      const blob = await apiFetch(`/retail-sales/export.csv${qs(params)}`, {
        token,
        blob: true,
      });
      downloadBlob(blob, `retail_sales_${new Date().toISOString().slice(0, 10)}.csv`);
      return true;
    },
    [getAuthToken]
  );

  const exportSalesItemsPDF = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      const blob = await apiFetch(`/retail-sales/export-items.pdf${qs(params)}`, {
        token,
        blob: true,
      });
      downloadBlob(blob, `sales-report-${Date.now()}.pdf`);
      return true;
    },
    [getAuthToken]
  );

  const exportSalesCSVToday = useCallback(async () => {
    const today = todayISOInNairobi();
    return exportSalesCSV({ date_from: today, date_to: today });
  }, [exportSalesCSV]);

  const exportSalesItemsPDFToday = useCallback(async () => {
    const today = todayISOInNairobi();
    return exportSalesItemsPDF({ date_from: today, date_to: today });
  }, [exportSalesItemsPDF]);

  // ---------------- Expenses (optional) ----------------
  const listExpenses = useCallback(
    async (params = {}) => {
      const token = getAuthToken();
      if (!token) return [];
      const res = await apiFetch(`/expenses${qs(params)}`, { token });
      const data = res?.data || [];
      dispatch({ type: "SET_EXPENSES", data });
      return data;
    },
    [getAuthToken]
  );

  const getExpenseToday = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;
    const res = await apiFetch(`/expenses/today`, { token });
    const data = res?.data || null;
    dispatch({ type: "SET_EXPENSE_TODAY", data });
    return data;
  }, [getAuthToken]);

  const createExpense = useCallback(
    async (payload) => {
      const token = getAuthToken();
      const res = await apiFetch(`/expenses`, { method: "POST", token, body: payload });
      try {
        await listExpenses();
      } catch {}
      return res?.data;
    },
    [getAuthToken, listExpenses]
  );

  const getExpense = useCallback(
    async (expense_id) => {
      const token = getAuthToken();
      const res = await apiFetch(`/expenses/${expense_id}`, { token });
      return res?.data;
    },
    [getAuthToken]
  );

  const updateExpense = useCallback(
    async (expense_id, patch) => {
      const token = getAuthToken();
      const res = await apiFetch(`/expenses/${expense_id}`, {
        method: "PUT",
        token,
        body: patch,
      });
      try {
        await listExpenses();
      } catch {}
      return res?.data;
    },
    [getAuthToken, listExpenses]
  );

  const deleteExpense = useCallback(
    async (expense_id) => {
      const token = getAuthToken();
      await apiFetch(`/expenses/${expense_id}`, { method: "DELETE", token });
      try {
        await listExpenses();
      } catch {}
      return true;
    },
    [getAuthToken, listExpenses]
  );

  // ---------------- Boot ----------------
  useEffect(() => {
    if (getAuthToken()) fetchCustomers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      // customers
      fetchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      // sales list & filters
      setFilters,
      listSales,
      listTodaySales,
      listYesterdaySales,
      listLast7DaysSales,
      setDateFiltersToToday,
      searchSales,
      // sales CRUD
      createSale,
      getSale,
      getSaleByReceipt,
      updateSale,
      deleteSale,
      restoreSale,
      listItemsForSale,
      // payments
      createPayment,
      createCreditPayment,
      listPayments,
      getPayment,
      updatePayment,
      deletePayment,
      sendPaymentEmail,
      // dispatch
      closeDispatch,
      // summaries (money)
      fetchSummaryByDate,
      fetchSummaryToday,
      // cartons-by-size summaries
      fetchCartonsBySize,
      fetchCartonsToday,
      fetchCartonsYesterday,
      fetchCartonsLast7Days,
      // COGS summaries
      fetchCogsSummary,
      fetchCogsToday,
      fetchCogsYesterday,
      fetchCogsLast7Days,
      // COGS purchases
      createCogsPurchase,
      // receipts, printing & exports
      getReceipt,
      printSaleReceipt,
      exportSalesCSV,
      exportSalesItemsPDF,
      exportSalesCSVToday,
      exportSalesItemsPDFToday,
      // expenses (optional)
      listExpenses,
      getExpenseToday,
      createExpense,
      getExpense,
      updateExpense,
      deleteExpense,
    }),
    [
      state,
      fetchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      setFilters,
      listSales,
      listTodaySales,
      listYesterdaySales,
      listLast7DaysSales,
      setDateFiltersToToday,
      searchSales,
      createSale,
      getSale,
      getSaleByReceipt,
      updateSale,
      deleteSale,
      restoreSale,
      listItemsForSale,
      createPayment,
      createCreditPayment,
      listPayments,
      getPayment,
      updatePayment,
      deletePayment,
      sendPaymentEmail,
      closeDispatch,
      fetchSummaryByDate,
      fetchSummaryToday,
      fetchCartonsBySize,
      fetchCartonsToday,
      fetchCartonsYesterday,
      fetchCartonsLast7Days,
      fetchCogsSummary,
      fetchCogsToday,
      fetchCogsYesterday,
      fetchCogsLast7Days,
      createCogsPurchase,
      getReceipt,
      printSaleReceipt,
      exportSalesCSV,
      exportSalesItemsPDF,
      exportSalesCSVToday,
      exportSalesItemsPDFToday,
      listExpenses,
      getExpenseToday,
      createExpense,
      getExpense,
      updateExpense,
      deleteExpense,
    ]
  );

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

// -------------------- Convenience Hooks --------------------
export function useSalesList(initialParams) {
  const { listSales, sales, pagination, loading, error } = useSaleContext();
  useEffect(() => {
    listSales(initialParams).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { sales, pagination, loading, error };
}

export function useSale(sale_id) {
  const { getSale, selectedSale, loading, error } = useSaleContext();
  useEffect(() => {
    if (sale_id) getSale(sale_id).catch(() => {});
  }, [sale_id, getSale]);
  return { sale: selectedSale, loading, error };
}

export function useSaleByReceipt(receipt_number) {
  const { getSaleByReceipt, loading, error } = useSaleContext();
  const [sale, setSale] = useState(null);
  useEffect(() => {
    if (receipt_number) {
      getSaleByReceipt(receipt_number).then(setSale).catch(() => {});
    }
  }, [receipt_number, getSaleByReceipt]);
  return { sale, loading, error };
}
