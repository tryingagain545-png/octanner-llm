#!/usr/bin/env python3
"""
Diagnostic script for PromptMap + Ollama setup
Helps identify and fix common issues
"""

import sys
import requests
import subprocess
import json
from pathlib import Path
import time

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_status(check_name, status, details=""):
    """Print formatted status"""
    symbol = "✅" if status else "❌"
    print(f"{symbol} {check_name}")
    if details:
        print(f"   └─ {details}")

def check_ollama_running():
    """Check if Ollama server is running"""
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=2)
        return response.status_code == 200, "Ollama server responding"
    except requests.ConnectionError:
        return False, "Cannot connect to Ollama (not running or wrong port)"
    except Exception as e:
        return False, f"Error: {str(e)}"

def check_tinydolphin_installed():
    """Check if tinydolphin model is installed"""
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        data = response.json()
        models = [m.get("name", "") for m in data.get("models", [])]
        
        tinydolphin_found = any("tinydolphin" in m for m in models)
        
        if tinydolphin_found:
            return True, f"Found tinydolphin in installed models"
        else:
            available = ", ".join(models) if models else "No models installed"
            return False, f"tinydolphin not found. Available: {available[:100]}"
    except Exception as e:
        return False, f"Error checking models: {str(e)}"

def check_promptmap_installed():
    """Check if PromptMap is installed"""
    promptmap_path = Path("/home/raghu/Desktop/LLM_FINAL/backend/promptmap")
    if promptmap_path.exists():
        promptmap2 = promptmap_path / "promptmap2.py"
        if promptmap2.exists():
            return True, f"PromptMap found at {promptmap_path}"
        else:
            return False, "PromptMap directory exists but promptmap2.py not found"
    else:
        return False, f"PromptMap not found at {promptmap_path}"

def check_venv():
    """Check if Python venv is set up"""
    venv_path = Path("/home/raghu/Desktop/LLM_FINAL/backend/venv_py312")
    python_exe = venv_path / "bin" / "python"
    
    if venv_path.exists():
        if python_exe.exists():
            # Try to run python and check for required modules
            try:
                result = subprocess.run(
                    [str(python_exe), "-c", "import fastapi, yaml, subprocess; print('OK')"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return True, "venv_py312 exists with required packages"
                else:
                    return False, f"Missing packages: {result.stderr[:100]}"
            except Exception as e:
                return False, f"Error checking packages: {str(e)}"
        else:
            return False, "venv_py312 exists but python executable not found"
    else:
        return False, f"Python venv not found at {venv_path}"

def check_promptmap_server():
    """Check if PromptMap server is running"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=2)
        if response.status_code == 200:
            data = response.json()
            ready = data.get("ready_for_scan", False)
            status_msg = data.get("status", "unknown")
            return ready, f"PromptMap server: {status_msg}, ready: {ready}"
        else:
            return False, f"PromptMap server returned {response.status_code}"
    except requests.ConnectionError:
        return False, "Cannot connect to PromptMap server (may not be running)"
    except Exception as e:
        return False, f"Error: {str(e)}"

def check_target_url():
    """Check if target URL is accessible"""
    try:
        response = requests.get("http://localhost:5173", timeout=3)
        return response.status_code == 200, "Target dashboard accessible"
    except Exception as e:
        return False, f"Cannot reach target: {str(e)}"

def test_ollama_model():
    """Test if tinydolphin can generate a response"""
    try:
        payload = {
            "model": "tinydolphin",
            "prompt": "Say hello",
            "stream": False
        }
        response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=30)
        if response.status_code == 200:
            data = response.json()
            response_text = data.get("response", "")
            if response_text:
                return True, f"Model responding (response length: {len(response_text)} chars)"
            else:
                return False, "Model gave empty response"
        else:
            return False, f"API returned {response.status_code}"
    except requests.Timeout:
        return False, "Model response timeout (30s) - model may be slow"
    except Exception as e:
        return False, f"Error: {str(e)}"

def test_promptmap_health():
    """Test PromptMap health endpoint"""
    try:
        response = requests.get("http://localhost:8001/health", timeout=2)
        if response.status_code == 200:
            data = response.json()
            status = data.get("status", "unknown")
            promptmap = data.get("promptmap", "unknown")
            ollama = data.get("ollama", "unknown")
            return True, f"Status: {status}, PromptMap: {promptmap}, Ollama: {ollama}"
        else:
            return False, f"Health check returned {response.status_code}"
    except Exception as e:
        return False, f"Error: {str(e)}"

def print_fixes():
    """Print common fixes"""
    print("\n" + "="*60)
    print("  💡 COMMON FIXES")
    print("="*60 + "\n")
    
    print("Issue: Ollama not running")
    print("Fix:")
    print("  Terminal 1: ollama serve")
    print("  Terminal 2: ollama run tinydolphin\n")
    
    print("Issue: tinydolphin not installed")
    print("Fix:")
    print("  ollama pull tinydolphin\n")
    
    print("Issue: PromptMap server not running")
    print("Fix:")
    print("  cd /home/raghu/Desktop/LLM_FINAL/backend")
    print("  bash start_all.sh\n")
    
    print("Issue: Model response timeout")
    print("Fix: Try a faster model")
    print("  Edit /home/raghu/Desktop/LLM_FINAL/backend/tools/promptmap_server.py")
    print("  Line 137: Change 'tinydolphin' to 'neural-chat' or 'mistral'\n")
    
    print("Issue: 'Connection refused' errors")
    print("Fix: Check firewall/ports")
    print("  Check if ports are in use: lsof -i :11434 :8001 :8000\n")

def main():
    print_header("🔍 PromptMap + Ollama Setup Diagnostic")
    
    # Collect all checks
    checks = [
        ("1️⃣ Ollama Server Running", check_ollama_running),
        ("2️⃣ tinydolphin Model Installed", check_tinydolphin_installed),
        ("3️⃣ PromptMap Installation", check_promptmap_installed),
        ("4️⃣ Python Virtual Environment", check_venv),
        ("5️⃣ PromptMap Server Running", check_promptmap_server),
        ("6️⃣ Target URL Accessible", check_target_url),
    ]
    
    results = []
    for check_name, check_func in checks:
        print(f"Checking: {check_name}...")
        status, details = check_func()
        results.append((check_name, status))
        print_status(check_name, status, details)
        time.sleep(0.5)  # Small delay between checks
    
    # Additional tests if basic requirements met
    print_header("⚙️ Additional Tests")
    
    ollama_running = results[0][1]
    tinydolphin_installed = results[1][1]
    
    if ollama_running and tinydolphin_installed:
        print("Testing Ollama model response...")
        status, details = test_ollama_model()
        print_status("Model Response Test", status, details)
        time.sleep(1)
    
    if results[4][1]:  # PromptMap server running
        print("Testing PromptMap health...")
        status, details = test_promptmap_health()
        print_status("PromptMap Health", status, details)
    
    # Summary
    print_header("📊 Summary")
    
    passed = sum(1 for _, status in results if status)
    total = len(results)
    
    print(f"Checks passed: {passed}/{total}\n")
    
    all_good = all(status for _, status in results)
    
    if all_good:
        print("✅ Everything looks good!")
        print("\nYou can now:")
        print("  1. Go to http://localhost:5173")
        print("  2. Create a project")
        print("  3. Run a PromptMap security test")
        print("\nExpected behavior:")
        print("  - Dashboard shows real security metrics")
        print("  - Logs stream in real-time")
        print("  - Results based on actual tinydolphin testing")
    else:
        print("⚠️ Some checks failed. See details above.\n")
        print_fixes()
    
    print("\n" + "="*60)
    print("  For more help, check: /LOCAL_OLLAMA_SETUP.md")
    print("="*60 + "\n")
    
    return 0 if all_good else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⏹️  Diagnostic interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)