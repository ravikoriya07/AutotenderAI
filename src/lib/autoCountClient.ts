import axios from "axios";
import { clearAuthSession, getAuthToken } from "@/lib/authStorage";

/** Separate service from main API (`NEXT_PUBLIC_API_BASE_URL`); auto-count defaults to :31656. */
const baseURL = process.env.NEXT_PUBLIC_AUTO_COUNT_BASE_URL;

export const autoCountClient = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

autoCountClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

autoCountClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      const token = getAuthToken();
      const pathname = window.location.pathname;
      const isPublicAuthPage = pathname === "/login" || pathname === "/register";
      if (token && !isPublicAuthPage) {
        clearAuthSession();
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);
