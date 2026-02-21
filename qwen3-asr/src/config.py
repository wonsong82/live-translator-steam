import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Qwen3ASRConfig:
    model: str
    host: str
    port: int
    gpu_memory_utilization: float


def get_config() -> Qwen3ASRConfig:
    return Qwen3ASRConfig(
        model=os.environ.get("QWEN3_ASR_MODEL", "Qwen/Qwen3-ASR-1.7B"),
        host=os.environ.get("QWEN3_ASR_HOST", "0.0.0.0"),
        port=int(os.environ.get("QWEN3_ASR_PORT", "8001")),
        gpu_memory_utilization=float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.9")),
    )
