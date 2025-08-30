// src/api.js (or your axios setup)
import axios from "axios";
const API_URL =
  import.meta.env.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  "/api";

const api = axios.create({ baseURL: API_URL });
export default api;
