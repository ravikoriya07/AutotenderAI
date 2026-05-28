import axios, { type AxiosInstance } from "axios";
import { clearAuthSession, getAuthToken } from "@/lib/authStorage";
import { globalLoaderStore } from "@/lib/globalLoaderStore";

const defaultHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
} as const;

function attachApiInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use(
    (config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const skipLoader = Boolean(
        (config as { skipGlobalLoader?: boolean }).skipGlobalLoader
      );
      if (!skipLoader) {
        globalLoaderStore.begin();
        (config as { _loaderTracked?: boolean })._loaderTracked = true;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => {
      const tracked = Boolean(
        (response.config as { _loaderTracked?: boolean })._loaderTracked
      );
      if (tracked) globalLoaderStore.end();
      return response;
    },
    (error) => {
      const tracked = Boolean(
        (error.config as { _loaderTracked?: boolean } | undefined)?._loaderTracked
      );
      if (tracked) globalLoaderStore.end();

      const status = error?.response?.status;
      if (status === 401 && typeof window !== "undefined") {
        const pathname = window.location.pathname;
        const isPublicAuthPage =
          pathname === "/login" || pathname === "/register";
        if (!isPublicAuthPage) {
          clearAuthSession();
          window.location.replace("/login");
        }
      }
      return Promise.reject(error);
    }
  );
}

function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, headers: { ...defaultHeaders } });
  attachApiInterceptors(client);
  return client;
}

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (!baseURL) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is required. Set it in .env (e.g. http://91.199.227.82:31570)."
  );
}

export const apiClient = createApiClient(baseURL);
