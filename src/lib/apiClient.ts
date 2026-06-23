const BASE_URL = "http://127.0.0.1:46727";

export interface SyncPayload {
  usage: any[];
  cost: any[];
  installedProviders: string[];
  timestamp: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
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

export async function storeCredential(provider: string, secret: string, type: "key" | "cookie"): Promise<any> {
  return request<any>("/api/v1/credentials", {
    method: "POST",
    body: JSON.stringify({ provider, secret, type }),
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
