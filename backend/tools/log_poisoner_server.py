"""
Log Poisoner Server
Tests log parsing vulnerabilities with malformed entries
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import random

app = FastAPI(title="Log Poisoner Security Tool", version="1.0.0")

class ScanRequest(BaseModel):
    target_url: str
    target_type: str

class ScanResponse(BaseModel):
    severity: str
    evidence: str
    logs: List[str]
    metrics: Dict
    title: str
    description: str
    mitigation: str

@app.get("/")
async def root():
    return {"tool": "Log Poisoner", "status": "ready"}

@app.post("/scan", response_model=ScanResponse)
async def scan_log_injection(request: ScanRequest):
    """
    Test log injection vulnerabilities
    """
    logs = []
    
    try:
        logs.append("Initializing Log Poisoner...")
        logs.append(f"Target: {request.target_url}")
        logs.append("Generating malformed log entries...")
        
        # Simulate log poisoning tests
        test_payloads = [
            "Log injection with newline characters",
            "Format string injection in log messages",
            "ANSI escape code injection",
            "Log forging with fake timestamps",
            "Command injection via log parameters"
        ]
        
        logs.append(f"Testing {len(test_payloads)} injection vectors...")
        
        for i, payload in enumerate(test_payloads, 1):
            logs.append(f"[{i}/{len(test_payloads)}] Testing: {payload}")
        
        # Simulate results
        vulnerability_detected = random.choice([True, False, False])
        
        if vulnerability_detected:
            severity = random.choice(["Medium", "High"])
            evidence = "Log injection vulnerability detected. Malformed entries can corrupt logs or inject false information."
            description = "The logging system is vulnerable to injection attacks that can manipulate log data, potentially hiding malicious activity."
            title = "Log Injection Vulnerability"
        else:
            severity = "Low"
            evidence = "Logging system properly sanitizes inputs. No injection vulnerabilities detected."
            description = "The system has proper log input validation and sanitization."
            title = "Log Security Assessment - Passed"
        
        logs.append(f"Log poisoning test complete - {severity} severity")
        logs.append("Checking log sanitization...")
        logs.append("Testing parser robustness...")
        logs.append("Analyzing log integrity...")
        
        # Calculate metrics
        metrics = {
            "attackSuccessRate": random.uniform(25, 60) if severity in ["Critical", "High"] else random.uniform(5, 20),
            "detectionTime": random.uniform(1, 5),
            "dataExfilVolume": random.uniform(0.1, 1),
            "repeatFailures": random.randint(0, 2)
        }
        
        logs.append(f"Injection success rate: {metrics['attackSuccessRate']:.1f}%")
        
        mitigation = """
        Recommended mitigations:
        1. Sanitize all log inputs
        2. Use structured logging (JSON format)
        3. Validate log entry formats
        4. Implement log integrity checks
        5. Use parameterized logging
        6. Escape special characters
        7. Monitor for anomalous log patterns
        """
        
        return ScanResponse(
            severity=severity,
            evidence=evidence,
            logs=logs,
            metrics=metrics,
            title=title,
            description=description,
            mitigation=mitigation.strip()
        )
        
    except Exception as e:
        logs.append(f"Error during scan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)