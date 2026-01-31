"""
AI Red Team Dashboard - Main FastAPI Orchestrator
Coordinates security testing tools and manages scan lifecycle
"""

from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import asyncio
import httpx
import uuid
import json
import time
from enum import Enum

app = FastAPI(title="AI Red Team Dashboard API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    if request.headers.get("X-Forwarded-For"):
        client_ip = request.headers.get("X-Forwarded-For").split(",")[0].strip()
    elif request.headers.get("X-Real-IP"):
        client_ip = request.headers.get("X-Real-IP")

    # Process request
    response = await call_next(request)
    process_time = time.time() - start_time

    # Create log entry
    log_entry = LogEntry(
        id=f"req-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now(timezone.utc),
        level="info",
        source="API Server",
        message=f"{request.method} {request.url.path} - {response.status_code}",
        ip=client_ip,
        request=f"{request.method} {request.url.path}",
        metadata={
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.url.query),
            "status_code": response.status_code,
            "process_time": round(process_time * 1000, 2),  # ms
            "user_agent": request.headers.get("User-Agent", ""),
            "content_length": request.headers.get("Content-Length", ""),
        }
    )

    # Store log
    request_logs.append(log_entry)

    # Keep only last 1000 request logs
    if len(request_logs) > 1000:
        request_logs.pop(0)

    # Broadcast to WebSocket clients
    await broadcast_log_update()

    return response

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

class LogEntry(BaseModel):
    id: str
    timestamp: datetime
    level: str  # info, warning, error, success
    source: str
    message: str
    ip: Optional[str] = None
    request: Optional[str] = None
    metadata: Optional[Dict] = None

    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )

# In-memory storage (replace with database in production)
projects_db: Dict[str, Project] = {}
scans_db: Dict[str, ScanResult] = {}
findings_db: Dict[str, Finding] = {}
active_websockets: Dict[str, List[WebSocket]] = {}
logs_websockets: List[WebSocket] = []
request_logs: List[LogEntry] = []

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

# API Endpoints

@app.get("/")
async def root():
    return {"message": "AI Red Team Dashboard API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Projects
@app.post("/api/projects", response_model=Project)
async def create_project(project: ProjectCreate):
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    new_project = Project(
        id=project_id,
        createdAt=datetime.now(timezone.utc),
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
async def start_scan(scan_request: ScanRequest, background_tasks: BackgroundTasks, request: Request):
    scan_id = f"scan_{uuid.uuid4().hex[:8]}"

    # Verify project exists
    if scan_request.projectId not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")

    # Log scan initiation
    client_ip = request.client.host if request.client else "unknown"
    scan_start_log = LogEntry(
        id=f"scan-start-{scan_id}",
        timestamp=datetime.now(timezone.utc),
        level="info",
        source="Scan Orchestrator",
        message=f"Scan initiated: {scan_id} for project {scan_request.projectId}",
        ip=client_ip,
        request=f"POST /api/scans/start",
        metadata={
            "scanId": scan_id,
            "projectId": scan_request.projectId,
            "tools": [t.value for t in scan_request.tools],
            "event": "scan_started"
        }
    )
    request_logs.append(scan_start_log)
    await broadcast_log_update()

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
            timestamp=datetime.now(timezone.utc)
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
                                        await broadcast_log_update()

                                    elif log_data.get("type") == "progress":
                                        progress = log_data.get("percentage", 0)
                                        current = log_data.get("current", 0)
                                        total = log_data.get("total", 0)
                                        await broadcast_log(scan_id, f"[{tool.value}] Progress: {current}/{total} ({progress}%)")

                                    elif log_data.get("type") == "test_result":
                                        test_result = log_data.get("result", "")
                                        result.logs.append(test_result)
                                        await broadcast_log(scan_id, f"[{tool.value}] {test_result}")
                                        await broadcast_log_update()
                                    
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
                timestamp=datetime.now(timezone.utc)
            )
            findings_db[finding.id] = finding
        
        scans_db[result_id] = result
        await broadcast_complete(scan_id, result)

        # Log scan completion
        scan_complete_log = LogEntry(
            id=f"scan-complete-{result_id}",
            timestamp=datetime.now(timezone.utc),
            level="success" if result.status == "completed" else "error",
            source="Scan Orchestrator",
            message=f"Scan completed: {result_id} - {result.status}",
            request=f"Scan {scan_id}",
            metadata={
                "scanId": scan_id,
                "resultId": result_id,
                "projectId": project_id,
                "tool": tool.value,
                "status": result.status,
                "severity": result.severity.value if result.severity else None,
                "event": "scan_completed"
            }
        )
        request_logs.append(scan_complete_log)
        await broadcast_log_update()

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

# WebSocket for real-time logs
logs_websockets: List[WebSocket] = []

@app.websocket("/api/logs/stream")
async def logs_websocket_endpoint(websocket: WebSocket):
    client_ip = websocket.client.host if websocket.client else "unknown"
    await websocket.accept()
    logs_websockets.append(websocket)

    # Log WebSocket connection
    ws_log = LogEntry(
        id=f"ws-connect-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now(timezone.utc),
        level="info",
        source="WebSocket Server",
        message="WebSocket connection established for logs",
        ip=client_ip,
        request="WebSocket /api/logs/stream",
        metadata={"event": "connect"}
    )
    request_logs.append(ws_log)
    await broadcast_log_update()

    try:
        while True:
            # Keep connection alive and periodically send latest logs
            await asyncio.sleep(5)  # Send updates every 5 seconds
            try:
                recent_logs = await get_logs(50)  # Get 50 most recent logs
                await websocket.send_json({
                    "type": "logs_update",
                    "logs": [log.dict() for log in recent_logs]
                })
            except:
                pass
    except Exception as e:
        print(f"Logs WebSocket error: {e}")
    finally:
        logs_websockets.remove(websocket)
        # Log WebSocket disconnection
        ws_disconnect_log = LogEntry(
            id=f"ws-disconnect-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(timezone.utc),
            level="info",
            source="WebSocket Server",
            message="WebSocket connection closed for logs",
            ip=client_ip,
            request="WebSocket /api/logs/stream",
            metadata={"event": "disconnect"}
        )
        request_logs.append(ws_disconnect_log)
        await broadcast_log_update()

async def broadcast_log_update():
    """Broadcast log updates to all connected log clients"""
    if logs_websockets:
        try:
            recent_logs = await get_logs(50)
            for ws in logs_websockets:
                try:
                    await ws.send_json({
                        "type": "logs_update",
                        "logs": [log.dict() for log in recent_logs]
                    })
                except:
                    pass
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
                        timestamp=datetime.fromisoformat(cf.get('timestamp', datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00'))
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

@app.post("/api/findings/{finding_id}/jira")
async def create_jira_ticket(finding_id: str):
    """Mock JIRA integration - replace with real JIRA API"""
    if finding_id not in findings_db:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding = findings_db[finding_id]

    # TODO: Implement real JIRA API integration
    # For now, return mock ticket
    ticket_id = f"AIRSEC-{uuid.uuid4().hex[:4].upper()}"

    return {
        "success": True,
        "ticketId": ticket_id,
        "url": f"https://your-jira.atlassian.net/browse/{ticket_id}"
    }

@app.post("/api/logs/frontend")
async def log_frontend_request(log_entry: LogEntry):
    """Receive frontend request logs"""
    request_logs.append(log_entry)

    # Keep only last 1000 request logs
    if len(request_logs) > 1000:
        request_logs.pop(0)

    # Broadcast to WebSocket clients
    await broadcast_log_update()

    return {"status": "logged"}

@app.get("/api/logs", response_model=List[LogEntry])
async def get_logs(limit: int = Query(1000, description="Maximum number of log entries to return")):
    """Get aggregated logs from all sources"""
    log_entries: List[LogEntry] = []

    # Process scan logs
    for scan_id, scan in scans_db.items():
        # Add scan status logs
        log_entries.append(LogEntry(
            id=f"{scan_id}-status",
            timestamp=scan.timestamp,
            level="success" if scan.status == "completed" else "error" if scan.status == "failed" else "info",
            source=scan.toolName,
            message=f"Scan {scan.status}",
            request=f"Scan {scan_id}",
            metadata={
                "scanId": scan_id,
                "projectId": scan.projectId,
                "status": scan.status,
            }
        ))

        # Add individual log messages from scan
        for idx, log_message in enumerate(scan.logs):
            log_entries.append(LogEntry(
                id=f"{scan_id}-log-{idx}",
                timestamp=scan.timestamp,
                level="error" if "error" in log_message.lower() else
                     "warning" if "warning" in log_message.lower() else
                     "success" if "success" in log_message.lower() or "completed" in log_message.lower() else "info",
                source=scan.toolName,
                message=log_message,
                request=f"Scan {scan_id}",
                metadata={
                    "scanId": scan_id,
                    "projectId": scan.projectId,
                }
            ))

    # Process finding logs
    for finding_id, finding in findings_db.items():
        log_entries.append(LogEntry(
            id=f"finding-{finding_id}",
            timestamp=finding.timestamp,
            level="error" if finding.severity == "Critical" else
                 "warning" if finding.severity in ["High", "Medium"] else "info",
            source="Security Scanner",
            message=f"Security finding: {finding.title}",
            request=f"Finding {finding_id}",
            metadata={
                "findingId": finding_id,
                "scanId": finding.scanId,
                "severity": finding.severity,
                "description": finding.description,
            }
        ))

    # Process request logs
    for req_log in request_logs:
        log_entries.append(req_log)

    # Sort by timestamp (newest first) and limit
    log_entries.sort(key=lambda x: x.timestamp, reverse=True)
    return log_entries[:limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)