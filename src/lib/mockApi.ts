// Mock API and WebSocket simulation for AI Red Team Dashboard

export type TargetType = 'Chat UI' | 'RAG' | 'Agent' | 'File Upload' | 'Log Data';
export type ToolName = 'PromptMap' | 'RAG Tester' | 'Agent Fuzzer' | 'File Auditor' | 'Log Poisoner';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface Project {
  id: string;
  name: string;
  description: string;
  targetUrl: string;
  targetType: TargetType;
  createdAt: Date;
}

export interface ScanResult {
  id: string;
  projectId: string;
  toolName: ToolName;
  status: 'running' | 'completed' | 'failed';
  severity?: Severity;
  evidence?: string;
  logs: string[];
  timestamp: Date;
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
  timestamp: Date;
}

// In-memory storage
const projects: Project[] = [];
const scanResults: ScanResult[] = [];
const findings: Finding[] = [];

// Tool availability based on target type
export const TOOL_MAPPING: Record<TargetType, ToolName[]> = {
  'Chat UI': ['PromptMap', 'Agent Fuzzer'],
  'RAG': ['RAG Tester', 'PromptMap'],
  'Agent': ['Agent Fuzzer', 'PromptMap'],
  'File Upload': ['File Auditor'],
  'Log Data': ['Log Poisoner'],
};

// Mock log messages
const LOG_TEMPLATES = [
  'Initializing security scan...',
  'Loading attack vectors...',
  'Testing prompt injection patterns...',
  'Analyzing response behavior...',
  'Detecting jailbreak attempts...',
  'Checking for data leakage...',
  'Validating input sanitization...',
  'Testing boundary conditions...',
  'Scanning for vulnerabilities...',
  'Generating attack payloads...',
  'Monitoring system responses...',
  'Collecting evidence...',
  'Analyzing security posture...',
  'Finalizing scan results...',
];

// Mock findings templates
const FINDING_TEMPLATES = {
  Critical: [
    {
      title: 'Prompt Injection Vulnerability',
      description: 'System accepts malicious prompts that bypass safety filters',
      mitigation: 'Implement input validation and prompt sanitization',
    },
    {
      title: 'Unrestricted Data Exfiltration',
      description: 'Sensitive data can be extracted through crafted queries',
      mitigation: 'Add output filtering and data loss prevention controls',
    },
  ],
  High: [
    {
      title: 'Jailbreak Pattern Detected',
      description: 'Model responds to prohibited instructions using role-play techniques',
      mitigation: 'Strengthen system prompts and add behavioral guardrails',
    },
    {
      title: 'RAG Poisoning Susceptibility',
      description: 'Malicious documents can manipulate retrieval results',
      mitigation: 'Implement document validation and source verification',
    },
  ],
  Medium: [
    {
      title: 'Insufficient Rate Limiting',
      description: 'API endpoints lack proper throttling mechanisms',
      mitigation: 'Implement rate limiting and request quotas',
    },
    {
      title: 'Metadata Injection in Uploads',
      description: 'File uploads accept malicious metadata without validation',
      mitigation: 'Strip metadata and validate file contents',
    },
  ],
  Low: [
    {
      title: 'Verbose Error Messages',
      description: 'System exposes internal details in error responses',
      mitigation: 'Implement generic error messages for production',
    },
  ],
};

// API Functions
export const createProject = (data: Omit<Project, 'id' | 'createdAt'>): Project => {
  const project: Project = {
    ...data,
    id: `proj_${Date.now()}`,
    createdAt: new Date(),
  };
  projects.push(project);
  return project;
};

export const getProjects = (): Project[] => {
  return projects;
};

export const getProject = (id: string): Project | undefined => {
  return projects.find((p) => p.id === id);
};

export const runScan = async (
  projectId: string,
  tools: ToolName[],
  onLog: (scanId: string, log: string) => void,
  onComplete: (result: ScanResult) => void
): Promise<void> => {
  for (const tool of tools) {
    const scanId = `scan_${Date.now()}_${tool}`;
    const result: ScanResult = {
      id: scanId,
      projectId,
      toolName: tool,
      status: 'running',
      logs: [],
      timestamp: new Date(),
    };
    scanResults.push(result);

    // Simulate real-time log streaming
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
      const log = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
      result.logs.push(`[${tool}] ${log}`);
      onLog(scanId, `[${tool}] ${log}`);
    }

    // Complete scan with results
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    result.status = 'completed';
    result.severity = severity;
    result.evidence = `Vulnerability detected in ${tool} scan. See logs for details.`;
    result.metrics = {
      attackSuccessRate: Math.random() * 100,
      detectionTime: Math.random() * 10,
      dataExfilVolume: Math.random() * 5,
      repeatFailures: Math.floor(Math.random() * 5),
    };

    // Generate findings
    const templates = FINDING_TEMPLATES[severity] || FINDING_TEMPLATES.Medium;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const finding: Finding = {
      id: `finding_${Date.now()}`,
      scanId: result.id,
      title: template.title,
      severity,
      description: template.description,
      evidence: result.logs.join('\n'),
      mitigation: template.mitigation,
      timestamp: new Date(),
    };
    findings.push(finding);

    onComplete(result);
  }
};

export const getScanResults = (projectId: string): ScanResult[] => {
  return scanResults.filter((s) => s.projectId === projectId);
};

export const getFindings = (projectId?: string): Finding[] => {
  if (!projectId) return findings;
  const projectScans = scanResults.filter((s) => s.projectId === projectId).map((s) => s.id);
  return findings.filter((f) => projectScans.includes(f.scanId));
};

export const createJiraTicket = async (finding: Finding): Promise<{ success: boolean; ticketId: string }> => {
  // Mock JIRA integration
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    success: true,
    ticketId: `AIRSEC-${Math.floor(Math.random() * 1000)}`,
  };
};