import threading
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as functional

from app.services.preprocessing import bgr_to_rgb_pil, dinov2_transform


class LayerScale(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.gamma = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.gamma


class PatchEmbed(nn.Module):
    def __init__(self, dim: int = 768, patch_size: int = 14):
        super().__init__()
        self.proj = nn.Conv2d(3, dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.proj(x).flatten(2).transpose(1, 2)


class Attention(nn.Module):
    def __init__(self, dim: int = 768, heads: int = 12):
        super().__init__()
        self.heads = heads
        self.scale = (dim // heads) ** -0.5
        self.qkv = nn.Linear(dim, dim * 3)
        self.proj = nn.Linear(dim, dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, tokens, channels = x.shape
        qkv = self.qkv(x).reshape(batch, tokens, 3, self.heads, channels // self.heads)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        query, key, value = qkv.unbind(0)
        attention = (query @ key.transpose(-2, -1)) * self.scale
        attention = attention.softmax(dim=-1)
        output = (attention @ value).transpose(1, 2).reshape(batch, tokens, channels)
        return self.proj(output)


class Mlp(nn.Module):
    def __init__(self, dim: int = 768, ratio: float = 4.0):
        super().__init__()
        hidden = int(dim * ratio)
        self.fc1 = nn.Linear(dim, hidden)
        self.fc2 = nn.Linear(hidden, dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.fc2(functional.gelu(self.fc1(x)))


class Block(nn.Module):
    def __init__(self, dim: int = 768, heads: int = 12):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = Attention(dim, heads)
        self.ls1 = LayerScale(dim)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        self.mlp = Mlp(dim)
        self.ls2 = LayerScale(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.ls1(self.attn(self.norm1(x)))
        x = x + self.ls2(self.mlp(self.norm2(x)))
        return x


class DINOv2VisionTransformer(nn.Module):
    def __init__(self, dim: int = 768, depth: int = 12, heads: int = 12, patch_size: int = 14):
        super().__init__()
        self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, 1370, dim))
        self.mask_token = nn.Parameter(torch.zeros(1, dim))
        self.patch_embed = PatchEmbed(dim, patch_size)
        self.blocks = nn.ModuleList([Block(dim, heads) for _ in range(depth)])
        self.norm = nn.LayerNorm(dim, eps=1e-6)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        patch_tokens = self.patch_embed(x)
        tokens = torch.cat([self.cls_token.expand(patch_tokens.shape[0], -1, -1), patch_tokens], dim=1)
        tokens = tokens + self.pos_embed
        for block in self.blocks:
            tokens = block(tokens)
        tokens = self.norm(tokens)
        return tokens[:, 0], tokens[:, 1:].mean(dim=1)


class DINOv2ClassifierHead(nn.Module):
    def __init__(self, feature_dim: int = 1536, num_classes: int = 196):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(feature_dim, 1024),
            nn.LayerNorm(1024),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(1024, 512),
            nn.LayerNorm(512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class DINOv2Model:
    id = "dinov2"
    name = "DINOv2 ViT-B/14"
    short_name = "DINOv2"
    approach = "Approach 2 — Deep Learning"
    approach_key = "deep_learning"
    architecture = "DINOv2 ViT-B/14 backbone (CLS + patch-mean features) with a 1536 → 1024 → 512 → 196 MLP head"
    description = (
        "Vision Transformer with self-supervised DINOv2 pretraining, fine-tuned for fine-grained "
        "Stanford Cars classification at 518 × 518 resolution."
    )
    training_approach = "Fine-tuning of the final four transformer blocks plus a two-layer LayerNorm MLP classification head."
    feature_extraction = "Concatenation of the normalised CLS token and the mean of the 1,369 patch tokens (1,536 features)."
    input_size = "518 × 518"
    num_classes = 196
    framework = "PyTorch · custom DINOv2 ViT-B/14 implementation"
    parameters = "≈ 86.6M backbone parameters"

    def __init__(self, path: Path, class_names: list[str], device: torch.device):
        self.path = path
        self.class_names = class_names
        self.device = device
        self.available = False
        self.error: str | None = None
        self.load_time_ms: float | None = None
        self.checkpoint_metadata: dict = {}
        self._lock = threading.Lock()
        self.backbone: DINOv2VisionTransformer | None = None
        self.classifier: DINOv2ClassifierHead | None = None
        self.transform = dinov2_transform()

    def load(self) -> None:
        started = time.perf_counter()
        try:
            if not self.path.exists():
                raise FileNotFoundError(f"Checkpoint not found: {self.path.name}")
            checkpoint = torch.load(self.path, map_location="cpu", weights_only=False)
            if not isinstance(checkpoint, dict) or "backbone_state_dict" not in checkpoint:
                raise ValueError("Checkpoint does not contain a DINOv2 backbone_state_dict")
            if "classifier_state_dict" not in checkpoint:
                raise ValueError("Checkpoint does not contain a classifier_state_dict")

            names = list(checkpoint.get("class_names", []))
            if len(names) != 196:
                raise ValueError("Checkpoint class mapping is missing or incomplete")
            if names != self.class_names:
                raise ValueError("Checkpoint class mapping does not match the canonical Stanford Cars mapping")

            self.checkpoint_metadata = {
                "epoch": checkpoint.get("epoch"),
                "best_val_accuracy": checkpoint.get("best_val_accuracy"),
                "best_val_loss": checkpoint.get("best_val_loss"),
                "feature_dim": checkpoint.get("feature_dim"),
                "num_classes": checkpoint.get("num_classes"),
                "unfrozen_blocks": checkpoint.get("unfrozen_blocks"),
            }

            backbone = DINOv2VisionTransformer()
            backbone.load_state_dict(checkpoint["backbone_state_dict"], strict=True)
            classifier = DINOv2ClassifierHead(
                feature_dim=int(checkpoint.get("feature_dim", 1536)),
                num_classes=int(checkpoint.get("num_classes", 196)),
            )
            classifier.load_state_dict(checkpoint["classifier_state_dict"], strict=True)

            if int(checkpoint.get("feature_dim", 1536)) != 1536:
                raise ValueError("Unexpected DINOv2 feature dimension")

            backbone.to(self.device).eval()
            classifier.to(self.device).eval()
            self.backbone = backbone
            self.classifier = classifier
            self.available = True
            self.error = None
        except Exception as exc:
            self.available = False
            self.error = str(exc)
        finally:
            self.load_time_ms = round((time.perf_counter() - started) * 1000, 2)

    def predict(self, image_bgr: np.ndarray) -> dict:
        if not self.available or self.backbone is None or self.classifier is None:
            raise RuntimeError(self.error or "DINOv2 is unavailable")
        with self._lock:
            started = time.perf_counter()
            image = bgr_to_rgb_pil(image_bgr)
            tensor = self.transform(image).unsqueeze(0).to(self.device)
            with torch.inference_mode():
                cls_token, patch_mean = self.backbone(tensor)
                features = torch.cat([cls_token, patch_mean], dim=1)
                logits = self.classifier(features)
                probabilities = torch.softmax(logits, dim=1)[0]
            values, indices = torch.topk(probabilities, k=5)
            values = values.detach().cpu().numpy()
            indices = indices.detach().cpu().numpy()
            elapsed = round((time.perf_counter() - started) * 1000, 2)
            top_5 = [
                {
                    "rank": rank + 1,
                    "class_id": int(class_id),
                    "class_name": self.class_names[int(class_id)],
                    "score": float(value),
                    "confidence": float(value),
                    "relative_score": float(value),
                }
                for rank, (class_id, value) in enumerate(zip(indices, values))
            ]
            best = int(indices[0])
            return {
                "model_id": self.id,
                "model_name": self.name,
                "approach": self.approach,
                "predicted_class": self.class_names[best],
                "predicted_class_id": best,
                "confidence": float(values[0]),
                "confidence_type": "softmax",
                "top_5": top_5,
                "inference_time_ms": elapsed,
                "note": None,
            }
