import torch


def check_health(pipeline) -> dict:
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    gpu_memory_mb = round(torch.cuda.memory_allocated(0) / 1024 / 1024, 1) if gpu_available else 0

    return {
        "healthy": gpu_available and pipeline is not None,
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "gpu_memory_used_mb": gpu_memory_mb,
        "model_loaded": pipeline is not None,
    }
