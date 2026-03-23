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
  async startAudit(domain: string): Promise<Audit> {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const resp = await this.request<{
      audit_id: string;
      status: string;
      pages_crawled: number;
      total_pages: number;
      progress_pct: number;
    }>("/audit/start", { method: "POST", body: { url, max_pages: 50 } });

    return {
      id: resp.audit_id,
      domain,
      status: resp.status as Audit["status"],
      pages_crawled: resp.pages_crawled,
      issues_found: 0,
      score: 0,
      created_at: new Date().toISOString(),
      progress_pct: resp.progress_pct,
      total_pages: resp.total_pages,
    };
  }

  async getAuditStatus(id: string): Promise<Partial<Audit>> {
    const resp = await this.request<{
      audit_id: string;
      status: string;
      pages_crawled: number;
      total_pages: number;
      progress_pct: number;
    }>(`/audit/status/${id}`);

    return {
      id: resp.audit_id,
      status: resp.status as Audit["status"],
      pages_crawled: resp.pages_crawled,
      progress_pct: resp.progress_pct,
      total_pages: resp.total_pages,
    };
  }

  async getAuditResults(id: string): Promise<AuditResults> {
    return this.request<AuditResults>(`/audit/results/${id}`);
  }

  // Team endpoints
  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>("/teams");
  }

  async createTeam(name: string): Promise<Team> {
    return this.request<Team>("/teams", { method: "POST", body: { name } });
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return this.request<TeamMember[]>(`/teams/${teamId}/members`);
  }

  async inviteTeamMember(teamId: string, email: string, role: string): Promise<TeamMember> {
    return this.request<TeamMember>(`/teams/${teamId}/invite`, {
      method: "POST",
      body: { email, role },
    });
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    return this.request<void>(`/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  // Competitor endpoints
  async getCompetitors(): Promise<Competitor[]> {
    const resp = await this.request<{ competitors: Competitor[] }>("/competitors");
    return resp.competitors;
  }

  async addCompetitor(domain: string): Promise<Competitor> {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    return this.request<Competitor>("/competitors", {
      method: "POST",
      body: { url },
    });
  }

  async removeCompetitor(id: string): Promise<void> {
    return this.request<void>(`/competitors/${id}`, {
      method: "DELETE",
    });
  }

  // Settings
  async getSettings() {
    return this.request<UserSettings>("/auth/settings");
  }

  async updateSettings(settings: Partial<UserSettings>) {
    return this.request<UserSettings>("/auth/settings", {
      method: "PATCH",
      body: settings,
    });
  }

  async getBillingInfo() {
    return this.request<BillingInfo>("/billing/status");
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
  progress_pct?: number;
  total_pages?: number;
}

export interface AuditResults {
  audit_id: string;
  status: string;
  domain: string;
  pages_crawled: number;
  avg_seo_score: number | null;
  common_issues: string[];
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
}

export interface Competitor {
  id: string;
  url: string;
  domain: string;
  name: string | null;
  last_analyzed: string | null;
  seo_score: number | null;
  geo_score: number | null;
}

export interface UserSettings {
  full_name: string | null;
  email: string;
  notifications_enabled: boolean;
  weekly_reports: boolean;
}

export interface BillingInfo {
  tier: string;
  scans_today: number;
  scans_limit: number;
  subscription_status: string | null;
}

export const api = new ApiClient(API_BASE_URL);
