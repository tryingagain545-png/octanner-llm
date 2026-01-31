// Real API client for connecting to Python FastAPI backends

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export type TargetType = 'Chat UI' | 'RAG' | 'Agent' | 'File Upload' | 'Log Data';
export type ToolName = 'PromptMap' | 'RAG Tester' | 'Agent Fuzzer' | 'File Auditor' | 'Log Poisoner';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface Project {
  id: string;
  name: string;
  description: string;
  targetUrl: string;
  targetType: TargetType;
  createdAt: string;
}

export interface ScanResult {
  id: string;
  projectId: string;
  toolName: ToolName;
  status: 'running' | 'completed' | 'failed';
  severity?: Severity;
  evidence?: string;
  logs: string[];
  timestamp: string;
  metrics?: {
    attackSuccessRate: number;
    detectionTime: number;
    dataExfilVolume: number;
    repeatFailures: number;
  };
}

export interface Finding {
  id: string;
  scanId: string;
  title: string;
  severity: Severity;
  description: string;
  evidence: string;
  mitigation: string;
  timestamp: string;
}

export interface ScanRequest {
  projectId: string;
  tools: ToolName[];
}

// Tool availability based on target type
export const TOOL_MAPPING: Record<TargetType, ToolName[]> = {
  'Chat UI': ['PromptMap', 'Agent Fuzzer'],
  'RAG': ['RAG Tester', 'PromptMap'],
  'Agent': ['Agent Fuzzer', 'PromptMap'],
  'File Upload': ['File Auditor'],
  'Log Data': ['Log Poisoner'],
};

// Frontend request logging
const logFrontendRequest = (method: string, endpoint: string, status: number, duration: number) => {
  const logEntry = {
    id: `frontend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level: status >= 400 ? 'error' : status >= 300 ? 'warning' : 'info',
    source: 'Frontend',
    message: `${method} ${endpoint} - ${status}`,
    request: `${method} ${endpoint}`,
    metadata: {
      method,
      endpoint,
      status,
      duration: Math.round(duration),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }
  };

  // Send to backend for logging (fire and forget)
  fetch('http://localhost:8000/api/logs/frontend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry),
  }).catch(() => {
    // Ignore errors - logging should not break the app
  });
};

// HTTP Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const startTime = Date.now();
    const method = options?.method || 'GET';

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const duration = Date.now() - startTime;
      logFrontendRequest(method, endpoint, response.status, duration);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      const duration = Date.now() - startTime;
      logFrontendRequest(method, endpoint, 0, duration); // 0 status for network errors
      throw error;
    }
  }

  // Projects
  async createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/api/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`);
  }

  // Scans
  async startScan(data: ScanRequest): Promise<{ scanId: string }> {
    return this.request<{ scanId: string }>('/api/scans/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAllScans(): Promise<ScanResult[]> {
    return this.request<ScanResult[]>('/api/scans');
  }

  async getScanResults(projectId: string): Promise<ScanResult[]> {
    if (!projectId) {
      // If no projectId, get all scans
      return this.getAllScans();
    }
    return this.request<ScanResult[]>(`/api/scans/${projectId}/results`);
  }

  async getScanStatus(scanId: string): Promise<ScanResult> {
    return this.request<ScanResult>(`/api/scans/${scanId}/status`);
  }

  // Findings
  async getFindings(projectId?: string): Promise<Finding[]> {
    const endpoint = projectId
      ? `/api/findings?projectId=${projectId}`
      : '/api/findings';
    return this.request<Finding[]>(endpoint);
  }

  async createJiraTicket(findingId: string): Promise<{ success: boolean; ticketId: string }> {
    return this.request<{ success: boolean; ticketId: string }>(`/api/findings/${findingId}/jira`, {
      method: 'POST',
    });
  }
}

// WebSocket client for real-time updates
export class ScanWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private scanId: string,
    private onLog: (log: string) => void,
    private onComplete: (result: ScanResult) => void,
    private onError: (error: string) => void
  ) {}

  connect() {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/api/scans/${this.scanId}/stream`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          this.onLog(data.message);
        } else if (data.type === 'complete') {
          this.onComplete(data.result);
        } else if (data.type === 'error') {
          this.onError(data.message);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onError('Connection error');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export helper functions
export const createProject = (data: Omit<Project, 'id' | 'createdAt'>) =>
  apiClient.createProject(data);

export const getProjects = () => apiClient.getProjects();

export const getProject = (id: string) => apiClient.getProject(id);

export const startScan = (data: ScanRequest) => apiClient.startScan(data);

export const getAllScans = () => apiClient.getAllScans();

export const getScanResults = (projectId: string) => apiClient.getScanResults(projectId);

export const getFindings = (projectId?: string) => apiClient.getFindings(projectId);

export const createJiraTicket = (findingId: string) => apiClient.createJiraTicket(findingId);

// Chat Service Findings (port 8006)
export interface ChatFinding {
  timestamp: string;
  type: string;
  severity: string;
  payload: string;
  exposed_data: Record<string, any>;
  status: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
  ip?: string;
  request?: string;
  metadata?: Record<string, any>;
}

export async function getChatServiceFindings(): Promise<ChatFinding[]> {
  try {
    const response = await fetch('http://localhost:8006/findings');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.findings || [];
  } catch (error) {
    console.error('Failed to fetch chat service findings:', error);
    return [];
  }
}

export async function getLogs(limit?: number): Promise<LogEntry[]> {
  try {
    const params = limit ? `?limit=${limit}` : '';
    const response = await fetch(`http://localhost:8000/api/logs${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return [];
  }
}