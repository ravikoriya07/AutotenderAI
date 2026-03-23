import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";

type AuthRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

function parseLoginResponse(data: unknown): {
  token: string;
  name: string;
  email: string;
} {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid login response");
  }
  const o = data as Record<string, unknown>;
  const nestedUser =
    o.user && typeof o.user === "object"
      ? (o.user as Record<string, unknown>)
      : null;
  const token =
    (typeof o.access_token === "string" && o.access_token) ||
    (typeof o.token === "string" && o.token) ||
    (typeof o.jwt === "string" && o.jwt) ||
    (typeof o.accessToken === "string" && o.accessToken) ||
    "";
  const name =
    (typeof o.name === "string" && o.name) ||
    (typeof o.display_name === "string" && o.display_name) ||
    (typeof o.full_name === "string" && o.full_name) ||
    (nestedUser && typeof nestedUser.name === "string" && nestedUser.name) ||
    (nestedUser &&
      typeof nestedUser.display_name === "string" &&
      nestedUser.display_name) ||
    (nestedUser &&
      typeof nestedUser.full_name === "string" &&
      nestedUser.full_name) ||
    "";
  const email =
    (typeof o.email === "string" && o.email) ||
    (typeof o.user_email === "string" && o.user_email) ||
    (typeof o.userEmail === "string" && o.userEmail) ||
    (nestedUser && typeof nestedUser.email === "string" && nestedUser.email) ||
    "";
  if (!token) {
    throw new Error("Login response missing token");
  }
  return { token, name, email };
}

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResult = {
  token: string;
  name: string;
  email: string;
};

export async function loginUser(payload: LoginPayload): Promise<LoginResult> {
  const config: AuthRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.post<unknown>(
    "/login",
    {
      username: payload.username.trim(),
      password: payload.password,
    },
    config
  );
  return parseLoginResponse(data);
}

export type RegisterPayload = {
  username: string;
  name: string;
  email: string;
  password: string;
};

export async function registerUser(payload: RegisterPayload): Promise<unknown> {
  const config: AuthRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.post<unknown>("/register", {
    username: payload.username.trim(),
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password,
  }, config);
  return data;
}
