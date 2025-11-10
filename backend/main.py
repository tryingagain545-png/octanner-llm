"""
AI Red Team Dashboard - Main FastAPI Orchestrator
Coordinates security testing tools and manages scan lifecycle
"""

from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
import asyncio
import httpx
import uuid
import json
import os
from enum import Enum
from atlassian import Jira

app = FastAPI(title="AI Red Team Dashboard API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tool Endpoints Configuration
TOOL_ENDPOINTS = {
    "PromptMap": "http://localhost:8001",
    "RAG Tester": "http://localhost:8002",
    "Agent Fuzzer": "http://localhost:8003",
    "File Auditor": "http://localhost:8004",
    "Log Poisoner": "http://localhost:8005",
}

# Data Models
class TargetType(str, Enum):
    CHAT_UI = "Chat UI"
    RAG = "RAG"
    AGENT = "Agent"
    FILE_UPLOAD = "File Upload"
    LOG_DATA = "Log Data"

class ToolName(str, Enum):
    PROMPTMAP = "PromptMap"
    RAG_TESTER = "RAG Tester"
    AGENT_FUZZER = "Agent Fuzzer"
    FILE_AUDITOR = "File Auditor"
    LOG_POISONER = "Log Poisoner"

class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INFO = "Info"

class ProjectCreate(BaseModel):
    name: str
    description: str
    targetUrl: str
    targetType: TargetType

class Project(ProjectCreate):
    id: str
    createdAt: datetime

class ScanRequest(BaseModel):
    projectId: str
    tools: List[ToolName]

class ScanResult(BaseModel):
    id: str
    projectId: str
    toolName: ToolName
    status: str
    severity: Optional[Severity] = None
    evidence: Optional[str] = None
    logs: List[str] = []
    timestamp: datetime
    metrics: Optional[Dict] = None

class Finding(BaseModel):
    id: str
    scanId: str
    title: str
    severity: Severity
    description: str
    evidence: str
    mitigation: str
    timestamp: datetime

# In-memory storage (replace with database in production)
projects_db: Dict[str, Project] = {}
scans_db: Dict[str, ScanResult] = {}
findings_db: Dict[str, Finding] = {}
active_websockets: Dict[str, List[WebSocket]] = {}

# Defense system storage
defense_settings_db: Dict[str, Dict] = {
    "chat_prompt_injection": {"enabled": False, "category": "chat", "severity": "high"},
    "chat_jailbreak": {"enabled": False, "category": "chat", "severity": "high"},
    "chat_data_leakage": {"enabled": False, "category": "chat", "severity": "medium"},
    "rag_context_poisoning": {"enabled": False, "category": "rag", "severity": "high"},
    "rag_retrieval_filtering": {"enabled": False, "category": "rag", "severity": "medium"},
    "agent_tool_execution": {"enabled": False, "category": "agent", "severity": "high"},
    "agent_memory_poisoning": {"enabled": False, "category": "agent", "severity": "medium"},
    "file_upload_validation": {"enabled": False, "category": "file", "severity": "high"},
    "file_metadata_filtering": {"enabled": False, "category": "file", "severity": "low"},
    "log_data_sanitization": {"enabled": False, "category": "log", "severity": "medium"},
}

# Jira Configuration
class JiraConfig(BaseModel):
    server: str
    username: str
    api_token: str
    project_key: str
    issue_type: str = "Bug"
    priority_field: str = "priority"

# Jira client instance
jira_client: Optional[Jira] = None

def get_jira_config() -> Optional[JiraConfig]:
    """Get Jira configuration from environment variables"""
    server = os.getenv("JIRA_SERVER")
    username = os.getenv("JIRA_USERNAME")
    api_token = os.getenv("JIRA_API_TOKEN")
    project_key = os.getenv("JIRA_PROJECT_KEY")

    if not all([server, username, api_token, project_key]):
        return None

    return JiraConfig(
        server=server,
        username=username,
        api_token=api_token,
        project_key=project_key
    )

def init_jira_client() -> Optional[Jira]:
    """Initialize Jira client if configuration is available"""
    global jira_client
    config = get_jira_config()
    if config:
        try:
            jira_client = Jira(
                url=config.server,
                username=config.username,
                password=config.api_token
            )
            return jira_client
        except Exception as e:
            print(f"Failed to initialize Jira client: {e}")
            return None
    return None

# Initialize Jira client on startup
jira_client = init_jira_client()

# API Endpoints

@app.get("/")
async def root():
    return {"message": "AI Red Team Dashboard API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Projects
@app.post("/api/projects", response_model=Project)
async def create_project(project: ProjectCreate):
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    new_project = Project(
        id=project_id,
        createdAt=datetime.utcnow(),
        **project.dict()
    )
    projects_db[project_id] = new_project
    return new_project

@app.get("/api/projects", response_model=List[Project])
async def get_projects():
    return list(projects_db.values())

@app.get("/api/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    return projects_db[project_id]

# Scans
@app.post("/api/scans/start")
async def start_scan(scan_request: ScanRequest, background_tasks: BackgroundTasks):
    scan_id = f"scan_{uuid.uuid4().hex[:8]}"
    
    # Verify project exists
    if scan_request.projectId not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Start scan in background
    background_tasks.add_task(
        execute_scan,
        scan_id,
        scan_request.projectId,
        scan_request.tools
    )
    
    return {"scanId": scan_id, "status": "started"}

async def execute_scan(scan_id: str, project_id: str, tools: List[ToolName]):
    """Execute security scans using microservices"""
    project = projects_db[project_id]
    
    for tool in tools:
        result_id = f"{scan_id}_{tool.value}"
        result = ScanResult(
            id=result_id,
            projectId=project_id,
            toolName=tool,
            status="running",
            logs=[],
            timestamp=datetime.utcnow()
        )
        scans_db[result_id] = result
        
        # Broadcast start
        await broadcast_log(scan_id, f"[{tool.value}] Starting scan...")
        
        try:
            # Call tool microservice
            tool_url = TOOL_ENDPOINTS[tool.value]
            async with httpx.AsyncClient(timeout=300.0) as client:
                # Try streaming endpoint first, fall back to regular endpoint
                try:
                    stream_response = await client.post(
                        f"{tool_url}/scan/stream",
                        json={"target_url": project.targetUrl, "target_type": project.targetType},
                        timeout=300.0
                    )
                    
                    if stream_response.status_code == 200:
                        # Process streaming logs and collect metrics
                        complete_data = None
                        async for line in stream_response.aiter_lines():
                            if line.startswith("data: "):
                                try:
                                    log_data = json.loads(line[6:])
                                    
                                    if log_data.get("type") == "log":
                                        msg = log_data.get("message", "")
                                        result.logs.append(msg)
                                        await broadcast_log(scan_id, f"[{tool.value}] {msg}")
                                    
                                    elif log_data.get("type") == "progress":
                                        progress = log_data.get("percentage", 0)
                                        current = log_data.get("current", 0)
                                        total = log_data.get("total", 0)
                                        await broadcast_log(scan_id, f"[{tool.value}] Progress: {current}/{total} ({progress}%)")
                                    
                                    elif log_data.get("type") == "test_result":
                                        test_result = log_data.get("result", "")
                                        result.logs.append(test_result)
                                        await broadcast_log(scan_id, f"[{tool.value}] {test_result}")
                                    
                                    elif log_data.get("type") == "metrics":
                                        # Store metrics from stream
                                        result.metrics = log_data.get("metrics", {})
                                        result.severity = Severity(log_data.get("severity", "Medium"))
                                        await broadcast_log(scan_id, f"[{tool.value}] Metrics calculated - {result.severity.value} severity")
                                    
                                    elif log_data.get("type") == "complete":
                                        # Extract final results from completion message
                                        complete_data = log_data
                                        break
                                except json.JSONDecodeError:
                                    pass
                        
                        # Update result with completion data
                        if complete_data and complete_data.get("status") == "done":
                            result.status = "completed"
                            result.severity = Severity(complete_data.get("severity", "Medium"))
                            result.metrics = complete_data.get("metrics", result.metrics)
                            
                            # Extract evidence from vulnerabilities
                            vulnerabilities = complete_data.get("vulnerabilities", [])
                            if vulnerabilities:
                                result.evidence = json.dumps(vulnerabilities, indent=2)
                            else:
                                result.evidence = f"Scan completed: {complete_data.get('passed', 0)} passed, {complete_data.get('failed', 0)} failed"
                            
                            await broadcast_log(scan_id, f"[{tool.value}] Scan completed - {result.severity.value} severity")
                        else:
                            # Fallback if complete message had error
                            result.status = "completed"
                            result.severity = Severity("Medium")
                    else:
                        raise Exception(f"Stream endpoint failed: HTTP {stream_response.status_code}")
                        
                except (httpx.ConnectError, httpx.RequestError):
                    # Fall back to regular endpoint
                    response = await client.post(
                        f"{tool_url}/scan",
                        json={"target_url": project.targetUrl, "target_type": project.targetType},
                        timeout=300.0
                    )
                    
                    if response.status_code == 200:
                        tool_result = response.json()
                        
                        # Update result
                        result.status = "completed"
                        result.severity = Severity(tool_result.get("severity", "Medium"))
                        result.evidence = tool_result.get("evidence", "")
                        result.logs = tool_result.get("logs", [])
                        result.metrics = tool_result.get("metrics", {})
                        
                        # Broadcast logs
                        for log in result.logs:
                            await broadcast_log(scan_id, f"[{tool.value}] {log}")
                        
                        await broadcast_log(scan_id, f"[{tool.value}] Scan completed - {result.severity.value} severity")
                    else:
                        result.status = "failed"
                        await broadcast_log(scan_id, f"[{tool.value}] Scan failed: HTTP {response.status_code}")
                    
        except Exception as e:
            result.status = "failed"
            await broadcast_log(scan_id, f"[{tool.value}] Error: {str(e)}")
        
        # Create finding if scan completed
        if result.status == "completed" and result.severity:
            finding = Finding(
                id=f"finding_{uuid.uuid4().hex[:8]}",
                scanId=result_id,
                title=f"Prompt Injection Vulnerability Assessment by {tool.value}",
                severity=result.severity,
                description=f"Security scan completed with {result.severity.value} severity",
                evidence=result.evidence or "Scan completed",
                mitigation="""Recommended Security Measures:
1. Input Validation & Sanitization
2. Prompt Engineering with Role-Based Boundaries
3. Output Filtering & Semantic Analysis
4. Rate Limiting & Anomaly Detection
5. Defense in Depth
6. Regular Security Testing""",
                timestamp=datetime.utcnow()
            )
            findings_db[finding.id] = finding
        
        scans_db[result_id] = result
        await broadcast_complete(scan_id, result)

@app.get("/api/scans", response_model=List[ScanResult])
async def get_all_scans():
    """Get all scans across all projects (for dashboard analytics)"""
    return list(scans_db.values())

@app.get("/api/scans/{project_id}/results", response_model=List[ScanResult])
async def get_scan_results(project_id: str):
    results = [s for s in scans_db.values() if s.projectId == project_id]
    return results

@app.get("/api/scans/{scan_id}/status", response_model=ScanResult)
async def get_scan_status(scan_id: str):
    if scan_id not in scans_db:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scans_db[scan_id]

# WebSocket for real-time updates
@app.websocket("/api/scans/{scan_id}/stream")
async def websocket_endpoint(websocket: WebSocket, scan_id: str):
    await websocket.accept()
    
    if scan_id not in active_websockets:
        active_websockets[scan_id] = []
    active_websockets[scan_id].append(websocket)
    
    try:
        while True:
            # Keep connection alive
            await asyncio.sleep(1)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_websockets[scan_id].remove(websocket)

async def broadcast_log(scan_id: str, message: str):
    """Broadcast log message to all connected clients"""
    if scan_id in active_websockets:
        for ws in active_websockets[scan_id]:
            try:
                await ws.send_json({"type": "log", "message": message})
            except:
                pass

async def broadcast_complete(scan_id: str, result: ScanResult):
    """Broadcast scan completion"""
    if scan_id in active_websockets:
        for ws in active_websockets[scan_id]:
            try:
                await ws.send_json({
                    "type": "complete",
                    "result": result.dict()
                })
            except:
                pass

# Findings
async def fetch_chat_service_findings():
    """Fetch findings from the vulnerable chat service on port 8006"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get('http://localhost:8006/findings')
            if response.status_code == 200:
                data = response.json()
                chat_findings = data.get('findings', [])
                
                # Transform chat findings to match Finding model
                transformed = []
                for idx, cf in enumerate(chat_findings):
                    # Create a unique finding ID based on content
                    finding_id = f"chat_{uuid.uuid4().hex[:8]}"
                    
                    # Map severity from chat format (CRITICAL/HIGH) to Dashboard format (Critical/High)
                    severity_map = {
                        'CRITICAL': Severity.CRITICAL,
                        'HIGH': Severity.HIGH,
                        'MEDIUM': Severity.MEDIUM,
                        'LOW': Severity.LOW
                    }
                    severity = severity_map.get(cf.get('severity', 'MEDIUM'), Severity.MEDIUM)
                    
                    # Create finding with proper format
                    finding = Finding(
                        id=finding_id,
                        scanId="chat-service",
                        title=f"{cf.get('type', 'Unknown')} - Chat Vulnerability",
                        severity=severity,
                        description=f"Detected in Ollama chat service: {cf.get('type', 'Unknown')}",
                        evidence=f"Payload: {cf.get('payload', 'N/A')}\n\nExposed Data: {json.dumps(cf.get('exposed_data', {}), indent=2)}",
                        mitigation="Implement input validation and sanitization in the chat service. Use prompt guards and content filtering.",
                        timestamp=datetime.fromisoformat(cf.get('timestamp', datetime.utcnow().isoformat()).replace('Z', '+00:00'))
                    )
                    transformed.append(finding)
                
                return transformed
    except Exception as e:
        print(f"Error fetching chat service findings: {e}")
    
    return []

@app.get("/api/findings", response_model=List[Finding])
async def get_findings(projectId: Optional[str] = None):
    # Fetch chat service findings
    chat_findings = await fetch_chat_service_findings()
    
    # Get main findings
    main_findings = list(findings_db.values())
    
    # Merge findings
    all_findings = main_findings + chat_findings
    
    if projectId:
        project_scans = [s.id for s in scans_db.values() if s.projectId == projectId]
        # For chat findings (scanId="chat-service"), include them for all projects
        return [f for f in all_findings if f.scanId in project_scans or f.scanId == "chat-service"]
    
    return all_findings

# Defense System Endpoints
@app.get("/api/defense/settings")
async def get_defense_settings():
    """Get all defense settings"""
    return {
        "settings": defense_settings_db,
        "enabled_count": sum(1 for s in defense_settings_db.values() if s["enabled"]),
        "total_count": len(defense_settings_db)
    }

@app.put("/api/defense/settings/{setting_id}")
async def update_defense_setting(setting_id: str, enabled: bool = Query(...)):
    """Update a specific defense setting"""
    if setting_id not in defense_settings_db:
        raise HTTPException(status_code=404, detail="Defense setting not found")

    if enabled is None:
        raise HTTPException(status_code=400, detail="enabled parameter is required")

    defense_settings_db[setting_id]["enabled"] = enabled
    return {"success": True, "setting": setting_id, "enabled": enabled}

@app.put("/api/defense/settings")
async def update_all_defense_settings(enabled: bool = Query(...)):
    """Enable or disable all defense settings"""
    for setting in defense_settings_db.values():
        setting["enabled"] = enabled

    return {
        "success": True,
        "enabled": enabled,
        "updated_count": len(defense_settings_db)
    }

@app.get("/api/defense/status")
async def get_defense_status():
    """Get defense system status"""
    enabled_count = sum(1 for s in defense_settings_db.values() if s["enabled"])
    total_count = len(defense_settings_db)

    # Check if chat defenses are enabled (for vulnerable_chat_enhanced.py)
    chat_defenses_enabled = any(
        s["enabled"] for s in defense_settings_db.values()
        if s["category"] == "chat"
    )

    return {
        "global_enabled": enabled_count == total_count,
        "enabled_count": enabled_count,
        "total_count": total_count,
        "chat_defenses_enabled": chat_defenses_enabled,
        "protection_level": "full" if enabled_count == total_count else "partial" if enabled_count > 0 else "none"
    }

@app.get("/api/jira/status")
async def get_jira_status():
    """Get Jira integration status"""
    config = get_jira_config()
    if not config:
        return {
            "configured": False,
            "message": "Jira not configured. Set JIRA_SERVER, JIRA_USERNAME, JIRA_API_TOKEN, and JIRA_PROJECT_KEY environment variables."
        }

    # Test connection
    try:
        if jira_client:
            # Try to get current user to test connection
            user = jira_client.current_user()
            return {
                "configured": True,
                "server": config.server,
                "project_key": config.project_key,
                "username": config.username,
                "connected": True,
                "user": user
            }
        else:
            return {
                "configured": True,
                "server": config.server,
                "project_key": config.project_key,
                "username": config.username,
                "connected": False,
                "error": "Failed to initialize Jira client"
            }
    except Exception as e:
        return {
            "configured": True,
            "server": config.server,
            "project_key": config.project_key,
            "username": config.username,
            "connected": False,
            "error": str(e)
        }

@app.post("/api/findings/{finding_id}/jira")
async def create_jira_ticket(finding_id: str):
    """Create a JIRA ticket for a security finding"""
    if finding_id not in findings_db:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding = findings_db[finding_id]
    config = get_jira_config()

    if not config or not jira_client:
        # Fallback to mock ticket if Jira is not configured
        ticket_id = f"AIRSEC-{uuid.uuid4().hex[:4].upper()}"
        return {
            "success": True,
            "ticketId": ticket_id,
            "url": f"https://your-jira.atlassian.net/browse/{ticket_id}",
            "note": "Jira not configured - using mock ticket"
        }

    try:
        # Map severity to Jira priority
        priority_map = {
            "critical": "Highest",
            "high": "High",
            "medium": "Medium",
            "low": "Low",
            "info": "Lowest"
        }

        # Create the issue
        issue_dict = {
            'project': {'key': config.project_key},
            'summary': f"Security Finding: {finding['title']}",
            'description': f"""
Security Finding Details:

**Title:** {finding['title']}
**Severity:** {finding['severity']}
**Type:** {finding['type']}
**Description:** {finding.get('description', 'N/A')}

**Payload:** {finding.get('payload', 'N/A')}
**Exposed Data:** {finding.get('exposed_data', 'N/A')}

**Timestamp:** {finding.get('timestamp', 'N/A')}
**Finding ID:** {finding_id}

This ticket was automatically created by the AI Red Team Dashboard.
            """,
            'issuetype': {'name': config.issue_type},
            'priority': {'name': priority_map.get(finding['severity'].lower(), 'Medium')}
        }

        # Add custom fields if needed
        if finding.get('tool'):
            issue_dict['customfield_10001'] = finding['tool']  # Adjust field ID as needed

        # Create the issue
        result = jira_client.create_issue(fields=issue_dict)

        ticket_id = result['key']
        ticket_url = f"{config.server}/browse/{ticket_id}"

        return {
            "success": True,
            "ticketId": ticket_id,
            "url": ticket_url
        }

    except Exception as e:
        print(f"Failed to create Jira ticket: {e}")
        # Fallback to mock ticket on error
        ticket_id = f"AIRSEC-{uuid.uuid4().hex[:4].upper()}"
        return {
            "success": True,
            "ticketId": ticket_id,
            "url": f"https://your-jira.atlassian.net/browse/{ticket_id}",
            "note": f"Jira API error: {str(e)}"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)