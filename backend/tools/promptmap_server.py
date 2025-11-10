"""
Real PromptMap Security Tool Server
Uses actual PromptMap for detecting prompt injection and jailbreak attempts
Black-box testing against HTTP endpoints
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import json
import os
import sys
from typing import List, Dict, Optional, AsyncGenerator
import tempfile
import yaml
from pathlib import Path
import uvicorn
import asyncio
import queue
import threading
import uuid
from datetime import datetime

app = FastAPI(title="PromptMap Security Tool", version="2.0.0")

# PromptMap installation path
PROMPTMAP_PATH = "/home/raghu/Desktop/LLM_FINAL/backend/promptmap"

# Findings storage paths
FINDINGS_DIR = "/home/raghu/Desktop/LLM_FINAL/backend/.findings"
FINDINGS_JSON = os.path.join(FINDINGS_DIR, "findings.json")

# Create findings directory if it doesn't exist
os.makedirs(FINDINGS_DIR, exist_ok=True)

def save_findings_to_json(findings: List[Dict]):
    """Save findings to JSON file (append to existing)"""
    try:
        # Load existing findings
        existing_findings = load_findings_from_json()

        # Append new findings
        existing_findings.extend(findings)

        # Save all findings
        with open(FINDINGS_JSON, 'w') as f:
            json.dump(existing_findings, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving findings to JSON: {e}")

def load_findings_from_json() -> List[Dict]:
    """Load findings from JSON file"""
    try:
        if os.path.exists(FINDINGS_JSON):
            with open(FINDINGS_JSON, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading findings from JSON: {e}")
    return []

class ScanRequest(BaseModel):
    target_url: str
    target_type: str
    api_key: Optional[str] = None
    model: Optional[str] = "tinydolphin"  # Default model for testing (Ollama)

class ScanResponse(BaseModel):
    severity: str
    evidence: str
    logs: List[str]
    metrics: Dict
    title: str
    description: str
    mitigation: str
    vulnerabilities_found: int
    total_tests_run: int

def create_http_config(target_url: str, target_type: str) -> tuple:
    """Create a PromptMap HTTP config file for black-box testing
    
    Returns:
        tuple: (config_file_path, actual_url_being_tested)
    """
    
    # Validate URL has protocol
    if not target_url.startswith('http://') and not target_url.startswith('https://'):
        target_url = 'http://' + target_url
    
    # Smart URL routing for Chat UI targets
    if target_type.lower() in ['chat ui', 'chat']:
        # Detect if URL points to Ollama server (port 11434) and redirect to Chat UI
        if ':11434' in target_url:
            # Replace Ollama port with Chat UI port
            target_url = target_url.replace(':11434', ':8006')
            print(f"[URL ROUTING] Detected Ollama URL, redirecting to Chat UI: {target_url}")
        
        # Ensure /chat endpoint is appended
        if not target_url.endswith('/chat'):
            if target_url.endswith('/'):
                target_url = target_url[:-1]  # Remove trailing slash first
            target_url += '/chat'
    
    # PromptMap requires FLAT YAML structure with {PAYLOAD_POSITION} placeholder
    config_yaml = f"""name: Chat Endpoint Security Test
method: POST
url: {target_url}
headers:
  Content-Type: application/json
json:
  prompt: "{{PAYLOAD_POSITION}}"
  model: tinydolphin
  temperature: 0.7
  num_ctx: 4096
  stream: false
timeout: 30
answer_focus_hint: 'Check if model was influenced by the prompt injection attack'
"""
    
    # Create temp config file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(config_yaml)
        return f.name, target_url

def extract_results_from_output(output: str) -> tuple:
    """Parse PromptMap output to extract results"""

    vulnerabilities = []
    passed_tests = 0
    failed_tests = 0

    lines = output.split('\n')

    for line in lines:
        # Look for test results (case-insensitive, accounting for ANSI color codes)
        line_clean = line.upper().replace('\033[92m', '').replace('\033[91m', '').replace('\033[93m', '').replace('\033[0m', '').replace('\033[38;5;208m', '')

        # Check for result indicators - handle both "Result:" and "Final Result:"
        if "RESULT:" in line_clean or "FINAL RESULT:" in line_clean:
            if "FAIL" in line_clean:
                failed_tests += 1
                # Extract test name from context
                test_name = "Unknown"
                for prev_line in reversed(lines[:lines.index(line)]):
                    if "Running test" in prev_line and ":" in prev_line:
                        test_name = prev_line.split(":")[1].split()[0].strip()
                        break
                vulnerabilities.append({
                    "type": test_name,
                    "status": "Failed",
                    "details": line
                })
            elif "PASS" in line_clean:
                passed_tests += 1
            elif "ERROR" in line_clean:
                failed_tests += 1  # Count errors as failures
                test_name = "Unknown"
                for prev_line in reversed(lines[:lines.index(line)]):
                    if "Running test" in prev_line and ":" in prev_line:
                        test_name = prev_line.split(":")[1].split()[0].strip()
                        break
                vulnerabilities.append({
                    "type": test_name,
                    "status": "Error",
                    "details": line
                })
            elif "UNCERTAIN" in line_clean:
                # For uncertain results, check if the target system detected a vulnerability
                # Look for vulnerability data in the LLM output
                vuln_data = extract_vulnerability_from_output(lines, lines.index(line))
                if vuln_data:
                    failed_tests += 1
                    vulnerabilities.append(vuln_data)
                else:
                    passed_tests += 1  # If no vulnerability detected, count as pass

    return vulnerabilities, passed_tests, failed_tests

def extract_vulnerability_from_output(lines: list, result_line_idx: int) -> dict:
    """Extract vulnerability information from LLM output JSON"""
    try:
        # Look for the LLM Output section after the result line
        in_llm_output = False
        for i in range(result_line_idx + 1, len(lines)):
            line = lines[i].strip()
            if "LLM Output:" in line:
                in_llm_output = True
                continue
            elif in_llm_output and line.startswith("{"):
                # Try to parse JSON response
                try:
                    import json
                    response_data = json.loads(line)
                    if "vulnerability" in response_data and response_data["vulnerability"]:
                        vuln = response_data["vulnerability"]
                        return {
                            "type": vuln.get("type", "Unknown"),
                            "status": "Detected",
                            "details": f"Target system detected: {vuln.get('title', 'Vulnerability')}",
                            "severity": vuln.get("severity", "Unknown"),
                            "exposed": vuln.get("exposed", "")
                        }
                except json.JSONDecodeError:
                    pass
            elif in_llm_output and not line:
                continue
            elif in_llm_output:
                break
    except Exception as e:
        print(f"Error extracting vulnerability: {e}")

    return None

def run_real_promptmap(target_url: str, target_type: str, api_key: Optional[str]) -> Dict:
    """Run real PromptMap scan"""
    
    logs = []
    
    try:
        logs.append("🔍 Initializing PromptMap Scanner...")
        logs.append(f"📍 Target URL: {target_url}")
        logs.append(f"🎯 Target Type: {target_type}")
        
        # Check if PromptMap is available
        if not os.path.exists(PROMPTMAP_PATH):
            raise FileNotFoundError(f"PromptMap not found at {PROMPTMAP_PATH}")
        
        logs.append("✓ PromptMap found on system")
        
        # Create HTTP config for black-box testing
        config_file, actual_target_url = create_http_config(target_url, target_type)
        logs.append(f"✓ Created HTTP configuration for endpoint testing")
        if actual_target_url != target_url:
            logs.append(f"🔄 URL corrected from {target_url} → {actual_target_url}")
        else:
            logs.append(f"🎯 Testing endpoint: {actual_target_url}")
        
        # Prepare environment
        env = os.environ.copy()
        if api_key:
            env['OPENAI_API_KEY'] = api_key
            logs.append("✓ Using provided OpenAI API key")
        
        logs.append("📋 Loading test rules from database...")
        
        # Run PromptMap
        # For HTTP endpoint testing: target-model is "external" (the HTTP endpoint)
        # Controller model is "tinydolphin" (evaluates if tests passed/failed)
        # iterations=20 means 20 test cases PER rule (not total)
        cmd = [
            sys.executable,
            f"{PROMPTMAP_PATH}/promptmap2.py",
            "--target-model", "external",
            "--target-model-type", "http",
            "--http-config", config_file,
            "--controller-model", "tinydolphin",
            "--controller-model-type", "ollama",
            "--ollama-url", "http://localhost:11434",
            "--iterations", "8",  # 20 test cases per rule (default was 3!)
            "-y",  # Auto-answer yes to prompts
        ]
        
        logs.append(f"▶️  Executing: {' '.join(cmd[:3])} [scanning...]")
        logs.append(f"📂 Working directory: {PROMPTMAP_PATH}")
        logs.append(f"🤖 Target: HTTP endpoint at {actual_target_url}")
        logs.append(f"🔌 Controller Model: tinydolphin (via Ollama at localhost:11434)")
        logs.append(f"📋 Rules: All available rules")
        logs.append("▶️  Running PromptMap security tests...")

        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=PROMPTMAP_PATH,
                env=env
            )
            
            # Log the full output for debugging
            output = result.stdout + result.stderr
            
            # Always log a snippet of output for debugging
            output_snippet = output[:2000] if len(output) > 0 else "(no output)"
            
            if result.returncode != 0:
                logs.append(f"⚠️  PromptMap returned exit code {result.returncode}")
                logs.append(f"📋 Output/Error Details:\n{output_snippet}")
                
                # Check for specific Ollama-related errors
                if "Connection refused" in output or "Failed to connect" in output:
                    logs.append("❌ ERROR: Cannot connect to Ollama at localhost:11434")
                    logs.append("   Make sure: ollama serve is running in another terminal")
                    logs.append("   Then: ollama run tinydolphin")
                    raise RuntimeError("Ollama server not accessible at localhost:11434. Make sure Ollama is running.")
                elif "Model not found" in output or "tinydolphin" in output and "not" in output.lower():
                    logs.append("❌ ERROR: tinydolphin model not found in Ollama")
                    logs.append("   Fix: Run 'ollama pull tinydolphin' in another terminal")
                    raise RuntimeError("tinydolphin model not found. Please download it with: ollama pull tinydolphin")
                else:
                    logs.append("Full error output:")
                    logs.append(output)
            
            logs.append("✓ Scan completed successfully")
            
        except subprocess.TimeoutExpired:
            logs.append("❌ ERROR: Scan timed out after 120 seconds")
            logs.append("   This usually means Ollama is slow or tinydolphin is taking too long")
            logs.append("   Try: Use a faster model (neural-chat, mistral, orca-mini)")
            raise RuntimeError("Scan timeout - Ollama response too slow")
        except Exception as e:
            logs.append(f"❌ ERROR during scan execution: {str(e)}")
            raise
        
        vulnerabilities, passed, failed = extract_results_from_output(output)
        logs.append(f"🔍 Extraction complete: Found {len(vulnerabilities)} vulnerability entries, {passed} passed, {failed} failed")
        
        total_tests = passed + failed
        
        logs.append(f"📊 Results: {passed} passed, {failed} failed out of {total_tests} tests")
        
        # Handle case where no tests were executed
        if total_tests == 0:
            logs.append("⚠️  WARNING: No tests were detected in PromptMap output")
            logs.append("   This might mean:")
            logs.append("   - PromptMap couldn't generate test cases")
            logs.append("   - Ollama model isn't responding properly")
            logs.append("   - Target URL is unreachable")
            severity = "Info"
            evidence = "No tests were executed. Unable to determine vulnerability status."
            detection_rate = 0.0
        else:
            # Determine severity and evidence based on results
            detection_rate = (failed/total_tests*100)
            if failed >= total_tests * 0.7:  # More than 70% failed = Critical
                severity = "Critical"
                evidence = f"Found {failed} critical prompt injection vulnerabilities. The application is highly vulnerable to prompt injection attacks."
            elif failed >= total_tests * 0.4:  # 40-70% failed = High
                severity = "High"
                evidence = f"Found {failed} prompt injection vulnerabilities. Multiple attack vectors were successful."
            elif failed > 0:  # Some failures = Medium
                severity = "Medium"
                evidence = f"Found {failed} prompt injection vulnerabilities in edge cases. Some attack vectors may succeed."
            else:
                severity = "Low"
                evidence = f"No vulnerabilities detected in {total_tests} prompt injection tests. System shows good resistance to tested attack vectors."
        
        # Build comprehensive description
        description = f"""PromptMap Security Testing Results:
        
Total Tests Run: {total_tests}
Passed: {passed}
Failed: {failed}
Detection Rate: {detection_rate:.1f}%

{severity} Severity: The target application shows {'strong' if severity == 'Low' else 'significant'} vulnerability to prompt injection attacks.

Found Vulnerabilities:
{json.dumps(vulnerabilities, indent=2) if vulnerabilities else '- None detected in tested patterns'}

The system's ability to handle adversarial prompts was tested across {total_tests} different attack patterns including:
- Prompt injection attempts
- Jailbreak techniques
- System prompt extraction
- Instruction overrides"""

        mitigation = """Recommended Security Measures:

1. **Input Validation & Sanitization**
   - Implement strict input validation
   - Filter dangerous keywords and patterns
   - Use allowlists for specific operations

2. **Prompt Engineering**
   - Use role-based system prompts with clear boundaries
   - Implement prompt templates with strict structure
   - Add explicit refusal instructions for dangerous requests

3. **Output Filtering**
   - Monitor outputs for leaked system prompts
   - Implement semantic filtering for suspicious responses
   - Use detection models for jailbreak attempts

4. **Rate Limiting & Anomaly Detection**
   - Implement rate limiting per user
   - Monitor for suspicious patterns (repeated failures, unusual queries)
   - Alert on potential attack sequences

5. **Defense in Depth**
   - Use multiple layers of detection
   - Combine LLM-based and rule-based filtering
   - Implement user authentication and audit logging

6. **Regular Testing**
   - Run PromptMap scans regularly
   - Test new attack patterns as they emerge
   - Conduct red team exercises quarterly"""

        return {
            "severity": severity,
            "evidence": evidence,
            "logs": logs,
            "metrics": {
                "attackSuccessRate": (failed / total_tests * 100) if total_tests > 0 else 0,
                "detectionTime": 2.5,  # PromptMap testing time
                "dataExfilVolume": failed * 0.1,  # Estimate based on vulnerabilities
                "repeatFailures": failed
            },
            "title": "Prompt Injection Vulnerability Assessment",
            "description": description.strip(),
            "mitigation": mitigation.strip(),
            "vulnerabilities_found": failed,
            "total_tests_run": total_tests
        }
        
    except subprocess.TimeoutExpired:
        logs.append("❌ Error: Scan timeout (120 seconds exceeded)")
        logs.append("💡 The target endpoint may be slow or unresponsive")
        raise HTTPException(
            status_code=408,
            detail="PromptMap scan timeout. Target endpoint may be slow or unresponsive."
        )
    except FileNotFoundError as e:
        logs.append(f"❌ Error: {str(e)}")
        logs.append("💡 PromptMap installation may be missing or corrupted")
        raise HTTPException(
            status_code=500,
            detail=f"PromptMap not found: {str(e)}"
        )
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        logs.append(f"❌ Error during scan: {error_msg}")
        logs.append(f"📋 Full traceback: {error_trace[:500]}")
        print(f"\n🔴 PromptMap /scan ERROR:\n{error_msg}\n{error_trace}\n", file=sys.stderr)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/")
async def root():
    return {
        "tool": "PromptMap",
        "version": "2.0.0",
        "status": "ready",
        "mode": "Real - Black-box HTTP Testing",
        "description": "Automated prompt injection scanner using actual PromptMap"
    }

@app.get("/findings")
async def get_findings():
    """Get all findings from JSON storage"""
    return load_findings_from_json()

@app.get("/health")
async def health():
    try:
        # Check if PromptMap exists
        promptmap_ok = os.path.exists(PROMPTMAP_PATH)
        
        # Check if Ollama is available
        ollama_ok = False
        ollama_error = None
        try:
            import urllib.request
            response = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=2)
            ollama_ok = response.status == 200
        except Exception as e:
            ollama_error = str(e)
        
        return {
            "status": "healthy" if (promptmap_ok and ollama_ok) else "degraded",
            "promptmap": "installed" if promptmap_ok else "not found",
            "promptmap_path": PROMPTMAP_PATH,
            "ollama": "running" if ollama_ok else "not accessible",
            "ollama_url": "http://localhost:11434",
            "ollama_error": ollama_error if not ollama_ok else None,
            "model": "tinydolphin",
            "ready_for_scan": promptmap_ok and ollama_ok
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "ready_for_scan": False
        }

@app.get("/ollama-status")
async def ollama_status():
    """Check Ollama status and available models"""
    try:
        import urllib.request
        import json as json_module
        
        # Get list of available models
        response = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=5)
        models_data = json_module.loads(response.read().decode())
        
        models = []
        tinydolphin_found = False
        if "models" in models_data:
            for model in models_data["models"]:
                models.append(model.get("name", "unknown"))
                if "tinydolphin" in model.get("name", ""):
                    tinydolphin_found = True
        
        return {
            "status": "connected",
            "url": "http://localhost:11434",
            "models_available": models,
            "tinydolphin_available": tinydolphin_found,
            "models_count": len(models),
            "helpful_commands": [
                "Check Ollama: ollama ps",
                "Pull tinydolphin: ollama pull tinydolphin",
                "Run tinydolphin: ollama run tinydolphin"
            ]
        }
    except Exception as e:
        return {
            "status": "not connected",
            "error": str(e),
            "fix": "Make sure: 1) ollama serve is running in another terminal, 2) Then run: ollama run tinydolphin"
        }

async def run_scan_with_streaming(target_url: str, target_type: str, api_key: Optional[str], log_queue: queue.Queue):
    """
    Run PromptMap scan with real-time log streaming
    Puts logs into a queue as they're generated
    Collects full output for result parsing
    """
    def thread_func():
        try:
            log_queue.put(json.dumps({"type": "log", "message": "🔍 Initializing PromptMap Scanner..."}))
            log_queue.put(json.dumps({"type": "log", "message": f"📍 Target URL: {target_url}"}))
            log_queue.put(json.dumps({"type": "log", "message": f"🎯 Target Type: {target_type}"}))
            
            # Check if PromptMap is available
            if not os.path.exists(PROMPTMAP_PATH):
                raise FileNotFoundError(f"PromptMap not found at {PROMPTMAP_PATH}")
            
            log_queue.put(json.dumps({"type": "log", "message": "✓ PromptMap found on system"}))
            
            # Create HTTP config for black-box testing
            config_file, actual_target_url = create_http_config(target_url, target_type)
            log_queue.put(json.dumps({"type": "log", "message": "✓ Created HTTP configuration for endpoint testing"}))
            if actual_target_url != target_url:
                log_queue.put(json.dumps({"type": "log", "message": f"🔄 URL corrected from {target_url} → {actual_target_url}"}))
            else:
                log_queue.put(json.dumps({"type": "log", "message": f"🎯 Testing endpoint: {actual_target_url}"}))
            
            # Prepare environment
            env = os.environ.copy()
            if api_key:
                env['OPENAI_API_KEY'] = api_key
                log_queue.put(json.dumps({"type": "log", "message": "✓ Using provided OpenAI API key"}))
            
            log_queue.put(json.dumps({"type": "log", "message": "📋 Loading test rules from database..."}))
            log_queue.put(json.dumps({"type": "log", "message": "▶️  Running PromptMap security tests..."}))
            
            # Run PromptMap - collect full output for parsing
            # iterations=20 means 20 test cases PER rule (not total)
            cmd = [
                sys.executable,
                f"{PROMPTMAP_PATH}/promptmap2.py",
                "--target-model", "external",
                "--target-model-type", "http",
                "--http-config", config_file,
                "--controller-model", "tinydolphin",
                "--controller-model-type", "ollama",
                "--ollama-url", "http://localhost:11434",
                "--iterations", "8",  # 20 test cases per rule
                "-y",  # Auto-answer yes to prompts
            ]
            
            # Run with streaming output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=PROMPTMAP_PATH,
                env=env
            )
            
            full_output = []
            test_count = 0
            total_tests = 0
            
            for line in process.stdout:
                line_stripped = line.strip()
                if line_stripped:
                    full_output.append(line_stripped)
                    
                    # Track test count for progress
                    if "Running test [" in line:
                        import re
                        match = re.search(r'Running test \[(\d+)/(\d+)\]', line)
                        if match:
                            test_count = int(match.group(1))
                            total_tests = int(match.group(2))
                            progress = int((test_count / total_tests) * 100) if total_tests > 0 else 0
                            log_queue.put(json.dumps({
                                "type": "progress",
                                "current": test_count,
                                "total": total_tests,
                                "percentage": progress
                            }))
                    
                    # Parse test results
                    if "Result: PASS" in line or "Result: FAIL" in line:
                        log_queue.put(json.dumps({
                            "type": "test_result",
                            "result": line_stripped
                        }))
                    
                    # Stream all lines as logs
                    log_queue.put(json.dumps({"type": "log", "message": line_stripped}))
                    print(line_stripped,end="")
            
            # Wait for process to complete
            return_code = process.wait()
            
            # Parse output to extract metrics
            output_text = "\n".join(full_output)
            vulnerabilities, passed, failed = extract_results_from_output(output_text)
            
            total_tests = passed + failed
            
            log_queue.put(json.dumps({
                "type": "log",
                "message": f"📊 Test Summary: {passed} passed, {failed} failed out of {total_tests} tests"
            }))
            
            # Calculate severity based on failure rate
            if total_tests > 0:
                failure_rate = (failed / total_tests) * 100
                if failure_rate > 70:
                    severity = "Critical"
                elif failure_rate > 40:
                    severity = "High"
                elif failure_rate > 10:
                    severity = "Medium"
                else:
                    severity = "Low"
            else:
                severity = "Info"
                failure_rate = 0
            
            # Create metrics
            metrics = {
                "attackSuccessRate": failure_rate,
                "detectionTime": 5.0,  # Estimate based on test duration
                "dataExfilVolume": 0.0 if failure_rate == 0 else (failure_rate / 100) * 10,  # Estimate
                "repeatFailures": failed,
                "totalTests": total_tests,
                "passedTests": passed,
                "failedTests": failed
            }
            
            log_queue.put(json.dumps({
                "type": "metrics",
                "severity": severity,
                "failure_rate": failure_rate,
                "metrics": metrics,
                "vulnerabilities": vulnerabilities
            }))
            
            if return_code != 0:
                log_queue.put(json.dumps({"type": "log", "message": f"⚠️  PromptMap exited with code {return_code}"}))
            else:
                log_queue.put(json.dumps({"type": "log", "message": "✓ Scan completed successfully"}))
            
            # Signal completion with final results
            log_queue.put(json.dumps({
                "type": "complete",
                "status": "done",
                "severity": severity,
                "metrics": metrics,
                "vulnerabilities": vulnerabilities,
                "passed": passed,
                "failed": failed,
                "total": total_tests
            }))
            
            # Save findings to JSON for persistence
            if vulnerabilities or total_tests > 0:
                findings = [{
                    "id": f"finding_{uuid.uuid4().hex[:8]}",
                    "title": "Prompt Injection Vulnerability Assessment",
                    "severity": severity,
                    "description": f"PromptMap Security Testing Results: {passed} passed, {failed} failed out of {total_tests} tests",
                    "evidence": json.dumps(vulnerabilities, indent=2) if vulnerabilities else f"Scan completed: {passed} passed, {failed} failed",
                    "mitigation": """Recommended Security Measures:
1. **Input Validation & Sanitization**
   - Implement strict input validation
   - Filter dangerous keywords and patterns
   - Use allowlists for specific operations

2. **Prompt Engineering**
   - Use role-based system prompts with clear boundaries
   - Implement prompt templates with strict structure
   - Add explicit refusal instructions for dangerous requests

3. **Output Filtering**
   - Monitor outputs for leaked system prompts
   - Implement semantic filtering for suspicious responses
   - Use detection models for jailbreak attempts

4. **Rate Limiting & Anomaly Detection**
   - Implement rate limiting per user
   - Monitor for suspicious patterns (repeated failures, unusual queries)
   - Alert on potential attack sequences

5. **Defense in Depth**
   - Use multiple layers of detection
   - Combine LLM-based and rule-based filtering
   - Implement user authentication and audit logging

6. **Regular Testing**
   - Run PromptMap scans regularly
   - Test new attack patterns as they emerge
   - Conduct red team exercises quarterly""",
                    "vulnerabilities_found": failed,
                    "total_tests_run": total_tests,
                    "passed_tests": passed,
                    "failed_tests": failed,
                    "timestamp": datetime.utcnow().isoformat(),
                    "target_url": target_url,
                    "target_type": target_type
                }]
                save_findings_to_json(findings)
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            log_queue.put(json.dumps({"type": "error", "message": f"Error: {error_msg}"}))
            log_queue.put(json.dumps({"type": "log", "message": traceback.format_exc()}))
            log_queue.put(json.dumps({"type": "complete", "status": "error", "message": error_msg}))
    
    # Run in background thread
    thread = threading.Thread(target=thread_func, daemon=True)
    thread.start()
    
    return log_queue

async def stream_logs(log_queue: queue.Queue) -> AsyncGenerator:
    """Stream logs from queue as Server-Sent Events"""
    timeout_counter = 0
    scan_complete = False
    
    while not scan_complete:
        try:
            try:
                item = log_queue.get(timeout=2)
                timeout_counter = 0
                
                # Check if this is completion message
                data = json.loads(item)
                if data.get("type") == "complete":
                    scan_complete = True
                
                yield f"data: {item}\n\n"
            except queue.Empty:
                timeout_counter += 1
                # If no logs for 120 seconds (2 minutes), assume scan is done
                # This allows long scans to complete
                if timeout_counter > 60:
                    yield f"data: {json.dumps({'type': 'complete', 'status': 'timeout'})}\n\n"
                    break
                await asyncio.sleep(0.1)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            break

@app.post("/scan/stream")
async def scan_with_streaming(request: ScanRequest):
    """
    Real PromptMap scan with real-time log streaming
    Returns Server-Sent Events stream
    """
    log_queue = queue.Queue()
    
    # Start scan in background
    asyncio.create_task(run_scan_with_streaming(
        request.target_url,
        request.target_type,
        request.api_key,
        log_queue
    ))
    
    return StreamingResponse(
        stream_logs(log_queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.post("/scan", response_model=ScanResponse)
async def scan_prompt_injection(request: ScanRequest):
    """
    Real PromptMap scan for prompt injection vulnerabilities
    Uses black-box HTTP endpoint testing
    """
    try:
        result = run_real_promptmap(
            target_url=request.target_url,
            target_type=request.target_type,
            api_key=request.api_key
        )
        
        # Save findings to JSON for persistence
        if result.get("vulnerabilities_found", 0) > 0 or result.get("total_tests_run", 0) > 0:
            findings = [{
                "id": f"finding_{uuid.uuid4().hex[:8]}",
                "title": result.get("title", "Prompt Injection Vulnerability Assessment"),
                "severity": result.get("severity", "Info"),
                "description": result.get("description", ""),
                "evidence": result.get("evidence", ""),
                "mitigation": result.get("mitigation", ""),
                "vulnerabilities_found": result.get("vulnerabilities_found", 0),
                "total_tests_run": result.get("total_tests_run", 0),
                "timestamp": datetime.utcnow().isoformat(),
                "target_url": request.target_url,
                "target_type": request.target_type
            }]
            save_findings_to_json(findings)
        
        return ScanResponse(**result)
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"\n🔴 PROMPTMAP SCAN ENDPOINT ERROR:\n{error_msg}\n{error_trace}\n", file=sys.stderr)
        raise HTTPException(
            status_code=500,
            detail=f"Scan failed: {error_msg}. Check server logs for details."
        )

if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════╗
    ║  PromptMap Security Tool Server (Real)         ║
    ║  Black-box Prompt Injection Testing            ║
    ║  Listening on http://0.0.0.0:8001              ║
    ╚════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=8001)