const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  noAuth?: boolean;
}

interface ApiError {
  detail: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("auth_token");
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, noAuth = false } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (!noAuth) {
      const token = this.getToken();
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      let detail = "An unexpected error occurred";
      try {
        const errorData = await response.json();
        detail = errorData.detail || errorData.message || detail;
      } catch {
        detail = response.statusText;
      }
      const error: ApiError = { detail, status: response.status };
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string }>(
      "/auth/login",
      {
        method: "POST",
        body: { email, password },
        noAuth: true,
      }
    );
  }

  async register(
    email: string,
    password: string,
    fullName: string
  ) {
    return this.request<{ id: string; email: string; full_name: string }>(
      "/auth/register",
      {
        method: "POST",
        body: { email, password, full_name: fullName },
        noAuth: true,
      }
    );
  }

  async getMe() {
    return this.request<{
      id: string;
      email: string;
      full_name: string;
      tier: string;
      analyses_remaining: number;
      created_at: string;
    }>("/auth/me");
  }

  // Analysis endpoints
  async getAnalyses(page: number = 1, limit: number = 20) {
    return this.request<{
      items: Analysis[];
      total: number;
      page: number;
      pages: number;
    }>(`/analyses?page=${page}&limit=${limit}`);
  }

  async getAnalysis(id: string) {
    return this.request<Analysis>(`/analyses/${id}`);
  }

  async startAnalysis(url: string, keyword: string) {
    return this.request<Analysis>("/analyses", {
      method: "POST",
      body: { url, keyword },
    });
  }

  // Audit endpoints
  async getAudits(page: number = 1, limit: number = 20) {
    return this.request<{
      items: Audit[];
      total: number;
      page: number;
      pages: number;
    }>(`/audits?page=${page}&limit=${limit}`);
  }

  async startAudit(domain: string) {
    return this.request<Audit>("/audits", {
      method: "POST",
      body: { domain },
    });
  }

  // Team endpoints
  async getTeam() {
    return this.request<Team>("/teams/me");
  }

  async inviteTeamMember(email: string, role: string) {
    return this.request<{ message: string }>("/teams/invite", {
      method: "POST",
      body: { email, role },
    });
  }

  async removeTeamMember(userId: string) {
    return this.request<void>(`/teams/members/${userId}`, {
      method: "DELETE",
    });
  }

  // Competitor endpoints
  async getCompetitors() {
    return this.request<Competitor[]>("/competitors");
  }

  async addCompetitor(domain: string) {
    return this.request<Competitor>("/competitors", {
      method: "POST",
      body: { domain },
    });
  }

  async removeCompetitor(id: string) {
    return this.request<void>(`/competitors/${id}`, {
      method: "DELETE",
    });
  }

  // Settings
  async updateSettings(settings: Partial<UserSettings>) {
    return this.request<UserSettings>("/settings", {
      method: "PATCH",
      body: settings,
    });
  }

  async getBillingInfo() {
    return this.request<BillingInfo>("/billing");
  }
}

// Types
export interface Analysis {
  id: string;
  url: string;
  keyword: string;
  seo_score: number;
  geo_score: number;
  overall_score: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  recommendations_count: number;
}

export interface Audit {
  id: string;
  domain: string;
  status: "pending" | "running" | "completed" | "failed";
  pages_crawled: number;
  issues_found: number;
  score: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  plan: string;
}

export interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface Competitor {
  id: string;
  domain: string;
  last_score: number;
  trend: number[];
  tracked_since: string;
}

export interface UserSettings {
  full_name: string;
  email: string;
  notifications_enabled: boolean;
  weekly_reports: boolean;
  timezone: string;
}

export interface BillingInfo {
  tier: string;
  price: number;
  next_billing_date: string;
  payment_method: {
    type: string;
    last4: string;
  } | null;
}

export const api = new ApiClient(API_BASE_URL);
