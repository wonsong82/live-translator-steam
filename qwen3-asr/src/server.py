import asyncio
import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import uvicorn

from config import get_config
from health import check_health

app = FastAPI()
config = get_config()

asr_pipeline = None


def get_asr_pipeline():
    global asr_pipeline
    if asr_pipeline is not None:
        return asr_pipeline

    try:
        from qwen_asr import QwenASRPipeline
        asr_pipeline = QwenASRPipeline(
            model_path=config.model,
            gpu_memory_utilization=config.gpu_memory_utilization,
        )
        return asr_pipeline
    except ImportError:
        return None


@app.get("/health")
async def health():
    status = check_health(asr_pipeline)
    code = 200 if status["healthy"] else 503
    return JSONResponse(content=status, status_code=code)


@app.websocket("/ws/transcribe")
async def transcribe(websocket: WebSocket):
    await websocket.accept()
    pipeline = get_asr_pipeline()

    if pipeline is None:
        await websocket.send_json({"type": "error", "text": "ASR pipeline not loaded"})
        await websocket.close()
        return

    session_config = None

    try:
        while True:
            data = await websocket.receive()

            if "text" in data:
                msg = json.loads(data["text"])
                if msg.get("type") == "config":
                    session_config = msg
                    continue

            if "bytes" in data:
                audio_chunk = data["bytes"]
                results = pipeline.transcribe_chunk(
                    audio_chunk,
                    language=session_config.get("language", "ko") if session_config else "ko",
                )

                for result in results:
                    await websocket.send_json({
                        "type": "transcript",
                        "text": result["text"],
                        "is_final": result.get("is_final", False),
                        "confidence": result.get("confidence", 0.0),
                    })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "text": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    get_asr_pipeline()
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level="info",
    )
