"""
Ollama Chat Service - Backend API for chat interface
Handles chat requests and proxies to Ollama API
"""

import httpx
import asyncio
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Ollama Chat Service", version="1.0.0")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (can be restricted to specific domains)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_TIMEOUT = 300  # 5 minutes timeout for model generation

# Request/Response models
class ChatRequest(BaseModel):
    prompt: str
    model: str = "tinydolphin"
    temperature: float = 0.7
    num_ctx: int = 4096
    stream: bool = False

class ChatResponse(BaseModel):
    response: str
    model: str
    status: str = "success"

class ModelsResponse(BaseModel):
    models: list

# Health check
@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                return {"status": "healthy", "ollama": "connected"}
            else:
                return {"status": "unhealthy", "ollama": "disconnected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "ollama": "error", "error": str(e)}

# Get available models
@app.get("/models")
async def get_models():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                return {
                    "models": [m.get("name", m.get("model", "unknown")) for m in data.get("models", [])]
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to fetch models from Ollama")
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Chat endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to Ollama and get a response
    """
    try:
        logger.info(f"Chat request: model={request.model}, prompt_length={len(request.prompt)}")
        
        # Prepare the request for Ollama
        ollama_request = {
            "model": request.model,
            "prompt": request.prompt,
            "temperature": request.temperature,
            "num_ctx": request.num_ctx,
            "stream": request.stream
        }
        
        # Send request to Ollama
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            try:
                logger.info(f"Sending request to Ollama at {OLLAMA_BASE_URL}/api/generate")
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=ollama_request
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check for errors in response
                    if "error" in data:
                        logger.error(f"Ollama error: {data['error']}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Ollama error: {data['error']}"
                        )
                    
                    # Extract response
                    ollama_response = data.get("response", "").strip()
                    
                    if not ollama_response:
                        logger.warning("Empty response from Ollama")
                        return ChatResponse(
                            response="[Model returned empty response]",
                            model=request.model,
                            status="empty_response"
                        )
                    
                    logger.info(f"Successful response from Ollama (length: {len(ollama_response)})")
                    return ChatResponse(
                        response=ollama_response,
                        model=request.model,
                        status="success"
                    )
                else:
                    logger.error(f"Ollama API error: {response.status_code}")
                    logger.error(f"Response: {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Ollama API error: {response.text}"
                    )
                    
            except httpx.TimeoutException:
                logger.error("Request to Ollama timed out")
                raise HTTPException(
                    status_code=504,
                    detail="Request timed out. The model is taking too long to respond. Try reducing context length."
                )
            except httpx.ConnectError:
                logger.error("Cannot connect to Ollama")
                raise HTTPException(
                    status_code=503,
                    detail="Cannot connect to Ollama. Make sure it's running on localhost:11434"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error: {str(e)}"
        )

# Pull a model endpoint
@app.post("/pull-model/{model_name}")
async def pull_model(model_name: str):
    """
    Pull a model from Ollama registry
    """
    try:
        logger.info(f"Pulling model: {model_name}")
        
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/pull",
                json={"name": model_name}
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully pulled model: {model_name}")
                return {"status": "success", "model": model_name}
            else:
                logger.error(f"Failed to pull model: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text
                )
    except Exception as e:
        logger.error(f"Error pulling model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)