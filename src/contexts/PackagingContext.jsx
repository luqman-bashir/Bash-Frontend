// src/contexts/PackagingContext.jsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState
} from "react";
import axios from "axios";
import { useUser } from "./UserContext.jsx";

/** Base API (containerized dev: Vite proxies /api -> http://backend:5000) */
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "/api";

/** Axios instance with JWT from localStorage */
const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PackagingContext = createContext(null);

export function PackagingProvider({ children }) {
  const { isAuthenticated } = useUser();

  // Bottle sizes
  const [bottleSizes, setBottleSizes] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);

  // Packaging entries
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1, per_page: 20, total: 0, pages: 0, has_next: false, has_prev: false,
  });
  const [filters, setFilters] = useState({
    bottle_size_id: "",
    date_from: "",
    date_to: "",
    include_deleted: false,
    order: "desc",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stock balances
  const [stockBalances, setStockBalances] = useState([]);

  /** ---------------- Stock Balances (declare FIRST; used by others) ---------------- */
  const fetchStockBalances = useCallback(async () => {
    const { data } = await api.get("/stock-balances");
    setStockBalances(data?.data || []);
    return data?.data || [];
  }, []);

  /** --------------- Bottle Sizes ---------------- */
  const fetchBottleSizes = useCallback(async () => {
    const { data } = await api.get("/bottle-sizes");
    setBottleSizes(data?.data || []);
    return data?.data || [];
  }, []);

  const fetchBottleSizeOptions = useCallback(async () => {
    const { data } = await api.get("/bottle-sizes/options");
    setSizeOptions(data?.data || []);
    return data?.data || [];
  }, []);

  const createBottleSize = useCallback(
    async (payload) => {
      // { label, selling_price, cost_price_carton? }
      const { data } = await api.post("/bottle-sizes", payload);
      await Promise.all([fetchBottleSizes(), fetchBottleSizeOptions(), fetchStockBalances()]);
      return data;
    },
    [fetchBottleSizes, fetchBottleSizeOptions, fetchStockBalances]
  );

  const updateBottleSize = useCallback(
    async (id, payload) => {
      const { data } = await api.patch(`/bottle-sizes/${id}`, payload);
      await Promise.all([fetchBottleSizes(), fetchBottleSizeOptions(), fetchStockBalances()]);
      return data;
    },
    [fetchBottleSizes, fetchBottleSizeOptions, fetchStockBalances]
  );

  const deleteBottleSize = useCallback(
    async (id) => {
      const { data } = await api.delete(`/bottle-sizes/${id}`);
      await Promise.all([fetchBottleSizes(), fetchBottleSizeOptions(), fetchStockBalances()]);
      return data;
    },
    [fetchBottleSizes, fetchBottleSizeOptions, fetchStockBalances]
  );

  /** ---------------- Packaging Entries ---------------- */
  const listPackaging = useCallback(
    async ({ page = 1, per_page = pagination.per_page, ...overrides } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        const f = { ...filters, ...overrides };
        if (f.bottle_size_id) q.set("bottle_size_id", f.bottle_size_id);
        if (f.date_from) q.set("date_from", f.date_from);
        if (f.date_to) q.set("date_to", f.date_to);
        if (f.include_deleted) q.set("include_deleted", "true");
        if (f.order) q.set("order", f.order);
        q.set("page", String(page));
        q.set("per_page", String(per_page));

        const { data } = await api.get(`/packaging?${q.toString()}`);
        setEntries(data?.data || []);
        setPagination(data?.pagination || pagination);
        setFilters(f);
        return data;
      } catch (e) {
        setError(e?.response?.data?.error || "Failed to load packaging");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination]
  );

  const createPackaging = useCallback(
    async ({ bottle_size_id, cartons, date }) => {
      const payload = { bottle_size_id, cartons };
      if (date) payload.date = date; // "YYYY-MM-DD"
      const { data } = await api.post("/packaging", payload);
      await Promise.all([listPackaging({ page: 1 }), fetchStockBalances()]);
      return data;
    },
    [listPackaging, fetchStockBalances]
  );

  const getPackaging = useCallback(async (entryId) => {
    const { data } = await api.get(`/packaging/${entryId}`);
    return data?.data;
  }, []);

  const updatePackaging = useCallback(
    async (entryId, payload) => {
      const { data } = await api.patch(`/packaging/${entryId}`, payload);
      await Promise.all([listPackaging({ page: pagination.page }), fetchStockBalances()]);
      return data;
    },
    [listPackaging, pagination.page, fetchStockBalances]
  );

  const deletePackaging = useCallback(
    async (entryId) => {
      const { data } = await api.delete(`/packaging/${entryId}`);
      await Promise.all([listPackaging({ page: pagination.page }), fetchStockBalances()]);
      return data;
    },
    [listPackaging, pagination.page, fetchStockBalances]
  );

  const restorePackaging = useCallback(
    async (entryId) => {
      const { data } = await api.post(`/packaging/${entryId}/restore`);
      await Promise.all([listPackaging({ page: 1 }), fetchStockBalances()]);
      return data;
    },
    [listPackaging, fetchStockBalances]
  );

  /** Initial loads — only after auth to avoid @jwt_required() 500/401 */
  useEffect(() => {
    if (!isAuthenticated) return;
    // Load sizes + options + stock; list entries when you land on the page
    fetchBottleSizes().catch(() => {});
    fetchBottleSizeOptions().catch(() => {});
    fetchStockBalances().catch(() => {}); // ← now safe (declared above)
    // You can call listPackaging({ page: 1 }) from the relevant page/screen
  }, [isAuthenticated, fetchBottleSizes, fetchBottleSizeOptions, fetchStockBalances]);

  const value = useMemo(
    () => ({
      api,
      loading,
      error,

      bottleSizes,
      sizeOptions,
      fetchBottleSizes,
      fetchBottleSizeOptions,
      createBottleSize,
      updateBottleSize,
      deleteBottleSize,

      entries,
      pagination,
      filters,
      listPackaging,
      createPackaging,
      getPackaging,
      updatePackaging,
      deletePackaging,
      restorePackaging,

      stockBalances,
      fetchStockBalances,
      setFilters,
    }),
    [
      loading,
      error,
      bottleSizes,
      sizeOptions,
      entries,
      pagination,
      filters,
      stockBalances,
      fetchBottleSizes,
      fetchBottleSizeOptions,
      createBottleSize,
      updateBottleSize,
      deleteBottleSize,
      listPackaging,
      createPackaging,
      getPackaging,
      updatePackaging,
      deletePackaging,
      restorePackaging,
      fetchStockBalances,
    ]
  );

  return <PackagingContext.Provider value={value}>{children}</PackagingContext.Provider>;
}

export function usePackaging() {
  const ctx = useContext(PackagingContext);
  if (!ctx) throw new Error("usePackaging must be used within <PackagingProvider>");
  return ctx;
}
