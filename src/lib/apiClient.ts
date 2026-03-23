import axios from "axios";
import { getAuthToken } from "@/lib/authStorage";
import { globalLoaderStore } from "@/lib/globalLoaderStore";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://91.199.227.82:31655";

export const apiClient = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const skipLoader = Boolean((config as { skipGlobalLoader?: boolean }).skipGlobalLoader);
    if (!skipLoader) {
      globalLoaderStore.begin();
      (config as { _loaderTracked?: boolean })._loaderTracked = true;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const tracked = Boolean((response.config as { _loaderTracked?: boolean })._loaderTracked);
    if (tracked) globalLoaderStore.end();
    return response;
  },
  (error) => {
    const tracked = Boolean((error.config as { _loaderTracked?: boolean } | undefined)?._loaderTracked);
    if (tracked) globalLoaderStore.end();
    return Promise.reject(error);
  }
);
