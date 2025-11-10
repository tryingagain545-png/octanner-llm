#!/bin/bash

# Start all backend services for AI Red Team Dashboard

echo "Starting AI Red Team Dashboard Backend Services..."
echo "=================================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine Python interpreter
if [ -f "$SCRIPT_DIR/venv_py312/bin/python" ]; then
    PYTHON_BIN="$SCRIPT_DIR/venv_py312/bin/python"
else
    PYTHON_BIN="python"
fi

echo "Using Python: $PYTHON_BIN"
echo ""

# Start orchestrator
echo "Starting Orchestrator (port 8000)..."
cd "$SCRIPT_DIR"
$PYTHON_BIN main.py &
ORCH_PID=$!

# Wait a bit for orchestrator to start
sleep 2

# Start tool servers
echo "Starting PromptMap (port 8001)..."
echo "  ℹ️ Using Local Ollama + tinydolphin (FREE, NO API KEY NEEDED)"
$PYTHON_BIN "$SCRIPT_DIR/tools/promptmap_server.py" &
PM_PID=$!

echo "Starting RAG Tester (port 8002)..."
$PYTHON_BIN "$SCRIPT_DIR/tools/rag_tester_server.py" &
RAG_PID=$!

echo "Starting Agent Fuzzer (port 8003)..."
$PYTHON_BIN "$SCRIPT_DIR/tools/agent_fuzzer_server.py" &
AGENT_PID=$!

echo "Starting File Auditor (port 8004)..."
$PYTHON_BIN "$SCRIPT_DIR/tools/file_auditor_server.py" &
FILE_PID=$!

echo "Starting Log Poisoner (port 8005)..."
$PYTHON_BIN "$SCRIPT_DIR/tools/log_poisoner_server.py" &
LOG_PID=$!

echo ""
echo "=================================================="
echo "✓ All services started!"
echo ""
echo "🌐 Orchestrator API: http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
echo "🔧 Tool Servers:"
echo "   - PromptMap (Ollama): http://localhost:8001"
echo "   - RAG Tester: http://localhost:8002"
echo "   - Agent Fuzzer: http://localhost:8003"
echo "   - File Auditor: http://localhost:8004"
echo "   - Log Poisoner: http://localhost:8005"
echo ""
echo "💡 PromptMap requires Ollama running in separate terminals:"
echo "   Terminal A: ollama serve"
echo "   Terminal B: ollama run tinydolphin"
echo ""
echo "⚙️  Press Ctrl+C to stop all services"
echo "=================================================="

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping all services...'; kill $ORCH_PID $PM_PID $RAG_PID $AGENT_PID $FILE_PID $LOG_PID 2>/dev/null; exit" INT
wait