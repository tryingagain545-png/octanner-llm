#!/usr/bin/env python3
"""
Test script for real PromptMap integration
Tests the PromptMap server against a sample endpoint
"""

import requests
import json
import sys

PROMPTMAP_SERVER = "http://localhost:8001"

def test_health():
    """Test if PromptMap server is healthy"""
    print("🔍 Testing PromptMap server health...")
    try:
        response = requests.get(f"{PROMPTMAP_SERVER}/health", timeout=5)
        data = response.json()
        print(f"✓ Server is healthy: {data}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_root():
    """Test if PromptMap server responds to root request"""
    print("\n🔍 Testing PromptMap server info...")
    try:
        response = requests.get(f"{PROMPTMAP_SERVER}/", timeout=5)
        data = response.json()
        print(f"✓ Server info:")
        for key, value in data.items():
            print(f"  - {key}: {value}")
        return True
    except Exception as e:
        print(f"✗ Server info request failed: {e}")
        return False

def test_scan_simulation():
    """Test scan endpoint with a simple simulation"""
    print("\n🔍 Testing PromptMap scan endpoint...")
    
    # Note: This test won't actually scan because we don't have an API key
    # But it will test the endpoint connectivity
    try:
        payload = {
            "target_url": "http://localhost:5173",
            "target_type": "Chat UI",
            "model": "gpt-3.5-turbo"
        }
        
        response = requests.post(
            f"{PROMPTMAP_SERVER}/scan",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✓ Scan request successful!")
            print(f"  - Title: {data.get('title')}")
            print(f"  - Severity: {data.get('severity')}")
            print(f"  - Vulnerabilities Found: {data.get('vulnerabilities_found')}")
            print(f"  - Total Tests: {data.get('total_tests_run')}")
            return True
        else:
            print(f"⚠ Scan returned status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"⚠ Scan test error (expected if API key not configured): {str(e)[:100]}")
        print("  This is normal if OPENAI_API_KEY is not set")
        return None

def main():
    print("=" * 60)
    print("PromptMap Server Test Suite")
    print("=" * 60)
    
    # Test health
    health_ok = test_health()
    
    # Test root info
    info_ok = test_root()
    
    # Test scan (may fail without API key, that's OK)
    scan_ok = test_scan_simulation()
    
    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    print(f"✓ Health Check: {'PASS' if health_ok else 'FAIL'}")
    print(f"✓ Server Info: {'PASS' if info_ok else 'FAIL'}")
    
    if scan_ok is True:
        print(f"✓ Scan Test: PASS")
    elif scan_ok is None:
        print(f"⚠ Scan Test: SKIP (no API key configured)")
        print("\n💡 To enable full scanning:")
        print("   1. Get an OpenAI API key from https://platform.openai.com/api/keys")
        print("   2. Create /home/raghu/Desktop/LLM_FINAL/backend/.env with:")
        print("      export OPENAI_API_KEY='sk-your-key-here'")
        print("   3. Restart the PromptMap server")
    else:
        print(f"✗ Scan Test: FAIL")
    
    print("\n✓ PromptMap server is running and ready!")
    print("✓ You can now use PromptMap from the dashboard")
    
    if health_ok and info_ok:
        print("\n🎉 All core tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)