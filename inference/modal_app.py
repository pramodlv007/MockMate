"""MockMate self-hosted inference on Modal. Both services scale to zero and run on one NVIDIA L4 each.

  llm      Qwen3-8B behind vLLM's OpenAI-compatible API (/v1/chat/completions), thinking off by default.
  whisper  faster-whisper large-v3-turbo; POST an audio/video file, get segments with word timestamps.

Both require  Authorization: Bearer <INFERENCE_TOKEN>  (from the Modal secret `mockmate-inference`).

  modal secret create mockmate-inference INFERENCE_TOKEN=<random>
  MODAL_IMAGE_BUILDER_VERSION=2025.06 modal deploy inference/modal_app.py
  modal run inference/modal_app.py::make_probe_adapter     # no-op LoRA used by the day-one check

LoRA adapters: every directory in the `mockmate-loras` volume is served as a model named after it,
so a fine-tuned adapter (Phase 5) goes live by copying it in and restarting the container.
"""
from __future__ import annotations  # the local client may run on Python 3.9

import hmac
import json
import os
import subprocess

import modal

MINUTES = 60
IDLE = 2 * MINUTES             # scale-to-zero after this much idle time; each idle window is billed
LLM_MODEL = "Qwen/Qwen3-8B-FP8"
LLM_NAME = "qwen3-8b"
FAST_BOOT = False              # compiled graphs are cached in the vllm-cache volume after the first boot
WHISPER_MODEL = "large-v3-turbo"
PORT = 8000
HF_CACHE = "/root/.cache/huggingface"
LORA_DIR = "/loras"

app = modal.App("mockmate-inference")
secret = modal.Secret.from_name("mockmate-inference")
hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)
loras = modal.Volume.from_name("mockmate-loras", create_if_missing=True)

vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0")
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

whisper_image = (
    # ctranslate2 (under faster-whisper) needs CUDA 12 + cuDNN 9, which this runtime image ships
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    # av 16+ dropped open(metadata_errors=...), which faster-whisper 1.2.1 still passes
    .uv_pip_install("faster-whisper==1.2.1", "av==15.1.0", "fastapi[standard]==0.115.12")
)


# ── LLM ──────────────────────────────────────────────────────────────────────
@app.function(
    image=vllm_image,
    gpu="L4",
    scaledown_window=IDLE,
    timeout=30 * MINUTES,
    max_containers=1,          # hard cap on concurrent GPUs: protects the $30/month credit
    volumes={HF_CACHE: hf_cache, "/root/.cache/vllm": vllm_cache, LORA_DIR: loras},
    secrets=[secret],
)
@modal.concurrent(max_inputs=32)
@modal.web_server(port=PORT, startup_timeout=15 * MINUTES)
def llm():
    adapters = [f"{d}={LORA_DIR}/{d}" for d in sorted(os.listdir(LORA_DIR))
                if os.path.isfile(f"{LORA_DIR}/{d}/adapter_config.json")]
    cmd = [
        "vllm", "serve", LLM_MODEL,
        "--served-model-name", LLM_NAME,
        "--host", "0.0.0.0", "--port", str(PORT),
        "--max-model-len", "8192",
        "--gpu-memory-utilization", "0.80",
        "--enable-prefix-caching",
        "--enable-lora", "--max-loras", "2", "--max-lora-rank", "16",
        "--default-chat-template-kwargs", json.dumps({"enable_thinking": False}),
        # JSON grammars allow unlimited whitespace; at temperature > 0 Qwen sometimes loops on newlines
        # until max_tokens (4/50 replies on day one). Only xgrammar/guidance support turning that off.
        "--structured-outputs-config", json.dumps({"backend": "xgrammar", "disable_any_whitespace": True}),
    ]
    if FAST_BOOT:  # skip torch.compile + CUDA graphs: shorter cold start, slower decoding
        cmd.append("--enforce-eager")
    if adapters:
        cmd += ["--lora-modules", *adapters]
    # vLLM checks VLLM_API_KEY on every /v1 route (/health stays open for readiness checks)
    env = {**os.environ, "VLLM_API_KEY": os.environ["INFERENCE_TOKEN"]}
    print("[llm]", " ".join(cmd))
    subprocess.Popen(cmd, env=env)


# ── Whisper ──────────────────────────────────────────────────────────────────
with whisper_image.imports():
    from fastapi import HTTPException, Request, UploadFile


def _authorized(header: str | None) -> bool:
    expected = f"Bearer {os.environ['INFERENCE_TOKEN']}".encode()
    return hmac.compare_digest((header or "").encode(), expected)


@app.cls(
    image=whisper_image,
    gpu="L4",
    scaledown_window=IDLE,
    timeout=30 * MINUTES,
    max_containers=1,
    volumes={HF_CACHE: hf_cache},
    secrets=[secret],
)
class Whisper:
    @modal.enter()
    def load(self):
        from faster_whisper import WhisperModel
        self.model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16",
                                  download_root=f"{HF_CACHE}/faster-whisper")
        used = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader"],
                              capture_output=True, text=True).stdout.strip()
        print(f"[whisper] {WHISPER_MODEL} loaded; GPU memory used/total: {used}")

    @modal.fastapi_endpoint(method="POST", docs=False)
    def transcribe(self, request: Request, file: UploadFile):
        if not _authorized(request.headers.get("authorization")):
            raise HTTPException(status_code=401, detail="bad token")
        import time
        t0 = time.monotonic()
        # PyAV inside faster-whisper decodes webm/mp4/ogg/wav directly; VAD drops silence (fewer hallucinations)
        segments, info = self.model.transcribe(file.file, word_timestamps=True, vad_filter=True)
        segs = [{
            "start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(),
            "words": [{"start": round(w.start, 2), "end": round(w.end, 2), "word": w.word} for w in (s.words or [])],
        } for s in segments]
        return {
            "language": info.language,
            "duration": round(info.duration, 2),
            "text": " ".join(s["text"] for s in segs),
            "segments": segs,
            "processing_seconds": round(time.monotonic() - t0, 2),
        }


# ── Day-one check helper ─────────────────────────────────────────────────────
@app.function(image=vllm_image, volumes={HF_CACHE: hf_cache, LORA_DIR: loras}, timeout=10 * MINUTES)
def make_probe_adapter(name: str = "probe-noop", rank: int = 8):
    """Write a rank-8 q/v LoRA whose B matrices are zero (output == base model) to the loras volume.
    It only proves vLLM can load and apply an adapter on top of the FP8 weights."""
    import torch
    from huggingface_hub import hf_hub_download
    from safetensors.torch import save_file

    cfg = json.load(open(hf_hub_download(LLM_MODEL, "config.json")))
    hidden, n_layers = cfg["hidden_size"], cfg["num_hidden_layers"]
    head_dim = cfg.get("head_dim", hidden // cfg["num_attention_heads"])
    out = {"q_proj": cfg["num_attention_heads"] * head_dim, "v_proj": cfg["num_key_value_heads"] * head_dim}
    tensors = {}
    for i in range(n_layers):
        for mod, out_dim in out.items():
            p = f"base_model.model.model.layers.{i}.self_attn.{mod}"
            tensors[f"{p}.lora_A.weight"] = torch.randn(rank, hidden, dtype=torch.bfloat16) * 0.01
            tensors[f"{p}.lora_B.weight"] = torch.zeros(out_dim, rank, dtype=torch.bfloat16)
    d = f"{LORA_DIR}/{name}"
    os.makedirs(d, exist_ok=True)
    save_file(tensors, f"{d}/adapter_model.safetensors")
    json.dump({"peft_type": "LORA", "task_type": "CAUSAL_LM", "base_model_name_or_path": "Qwen/Qwen3-8B",
               "r": rank, "lora_alpha": 2 * rank, "lora_dropout": 0.0, "bias": "none",
               "target_modules": list(out), "fan_in_fan_out": False, "modules_to_save": None},
              open(f"{d}/adapter_config.json", "w"), indent=2)
    loras.commit()
    print(f"wrote {d}: {len(tensors)} tensors, rank {rank}, layers {n_layers}")
