import { invoke } from "@tauri-apps/api/core";

const DEFAULT_PORT = 46727;

async function getBaseUrl(): Promise<string> {
  try {
    const port: number = await invoke<number>("get_backend_port");
    return `http://127.0.0.1:${port}`;
  } catch {
    return `http://127.0.0.1:${DEFAULT_PORT}`;
  }
}

export interface SyncPayload {
  usage: any[];
  cost: any[];
  installedProviders: string[];
  timestamp: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `HTTP error! Status: ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}

export async function getProviders(): Promise<any[]> {
  return request<any[]>("/api/v1/providers");
}

export async function getCost(): Promise<any[]> {
  return request<any[]>("/api/v1/cost");
}

export async function triggerRefresh(): Promise<SyncPayload> {
  return request<SyncPayload>("/api/v1/providers/refresh", {
    method: "POST",
  });
}

export async function getSettings(): Promise<any> {
  return request<any>("/api/v1/settings");
}

export async function updateSettings(settings: any): Promise<any> {
  return request<any>("/api/v1/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function getCredentials(): Promise<any[]> {
  return request<any[]>("/api/v1/credentials");
}

export async function storeCredential(provider: string, secret: string, type: "key" | "cookie", fields?: Record<string, string>): Promise<any> {
  return request<any>("/api/v1/credentials", {
    method: "POST",
    body: JSON.stringify({ provider, secret, type, fields: fields ?? {} }),
  });
}

export async function deleteCredential(provider: string): Promise<any> {
  return request<any>(`/api/v1/credentials/${provider}`, {
    method: "DELETE",
  });
}

export async function getBrowsers(): Promise<any[]> {
  return request<any[]>("/api/v1/browsers");
}

export async function importCookies(browserId: string, profileId: string, providerId: string): Promise<any> {
  return request<any>("/api/v1/browsers/import", {
    method: "POST",
    body: JSON.stringify({ browserId, profileId, providerId }),
  });
}
