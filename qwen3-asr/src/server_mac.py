import asyncio
import json
import os
import platform

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

asr_model = None
MODEL_NAME = os.environ.get("QWEN3_ASR_MODEL", "mlx-community/Qwen3-ASR-1.7B-6bit")
HOST = os.environ.get("QWEN3_ASR_HOST", "0.0.0.0")
PORT = int(os.environ.get("QWEN3_ASR_PORT", "8001"))


def get_asr_model():
    global asr_model
    if asr_model is not None:
        return asr_model

    try:
        from mlx_audio.stt.utils import load_model

        asr_model = load_model(MODEL_NAME)
        return asr_model
    except ImportError:
        print("mlx-qwen3-asr or mlx-audio not installed. Run: pip install mlx-qwen3-asr")
        return None


@app.get("/health")
async def health():
    is_apple_silicon = platform.processor() == "arm" or platform.machine() == "arm64"
    return JSONResponse(
        content={
            "healthy": asr_model is not None and is_apple_silicon,
            "platform": platform.machine(),
            "apple_silicon": is_apple_silicon,
            "model_loaded": asr_model is not None,
            "model_name": MODEL_NAME,
            "backend": "mlx",
        },
        status_code=200 if asr_model is not None else 503,
    )


@app.websocket("/ws/transcribe")
async def transcribe(websocket: WebSocket):
    await websocket.accept()
    model = get_asr_model()

    if model is None:
        await websocket.send_json({"type": "error", "text": "ASR model not loaded"})
        await websocket.close()
        return

    session_config = None
    audio_buffer = bytearray()
    chunk_size_bytes = 32000  # 1 second of 16kHz PCM16

    try:
        while True:
            data = await websocket.receive()

            if "text" in data:
                msg = json.loads(data["text"])
                if msg.get("type") == "config":
                    session_config = msg
                    continue

            if "bytes" in data:
                audio_buffer.extend(data["bytes"])

                while len(audio_buffer) >= chunk_size_bytes:
                    chunk = bytes(audio_buffer[:chunk_size_bytes])
                    audio_buffer = audio_buffer[chunk_size_bytes:]

                    result = await asyncio.to_thread(
                        _transcribe_chunk, model, chunk, session_config
                    )

                    if result and result.get("text"):
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


def _transcribe_chunk(model, audio_bytes, session_config):
    import numpy as np
    from mlx_audio.stt.generate import generate_transcription

    pcm16 = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    language = session_config.get("language", "ko") if session_config else "ko"

    try:
        result = generate_transcription(
            model=model,
            audio=pcm16,
            language=language,
        )
        return {
            "text": result.text if hasattr(result, "text") else str(result),
            "is_final": True,
            "confidence": 0.9,
        }
    except Exception:
        return None


if __name__ == "__main__":
    print(f"Loading MLX ASR model: {MODEL_NAME}")
    get_asr_model()
    print(f"Starting Mac ASR server on {HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
