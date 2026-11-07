import base64
import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


class ImageValidationError(ValueError):
    pass


ALLOWED_FORMATS = {"JPEG", "PNG"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/pjpeg"}


@dataclass
class DecodedImage:
    image: np.ndarray
    filename: str
    width: int
    height: int
    format: str


def safe_filename(name: str | None) -> str:
    raw = (name or "vehicle.jpg").replace("\\", "/").split("/")[-1].strip()
    cleaned = "".join(ch for ch in raw if ch.isalnum() or ch in {"-", "_", ".", " ", "(", ")"})
    cleaned = cleaned.strip(". ")
    return cleaned[:180] or "vehicle.jpg"


def decode_upload(
    data: bytes,
    filename: str | None,
    max_bytes: int,
    max_pixels: int,
    min_side: int,
    content_type: str | None = None,
) -> DecodedImage:
    if not data:
        raise ImageValidationError("The uploaded file is empty.")
    if len(data) > max_bytes:
        raise ImageValidationError(f"Image exceeds the {max_bytes // (1024 * 1024)} MB upload limit.")
    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise ImageValidationError("Unsupported media type. Upload a JPG or PNG image.")

    Image.MAX_IMAGE_PIXELS = max_pixels
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format or ""
            if fmt.upper() not in ALLOWED_FORMATS:
                raise ImageValidationError("Unsupported image format. Upload a JPG or PNG image.")
            probe.verify()
        with Image.open(io.BytesIO(data)) as opened:
            opened = ImageOps.exif_transpose(opened)
            if opened.mode not in {"RGB", "L"}:
                opened = opened.convert("RGB")
            else:
                opened = opened.convert("RGB")
            width, height = opened.size
            if width * height > max_pixels:
                raise ImageValidationError("Image resolution is too large.")
            if width < min_side or height < min_side:
                raise ImageValidationError(f"Image must be at least {min_side}x{min_side} pixels.")
            rgb = np.asarray(opened, dtype=np.uint8)
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("The file could not be decoded as a valid image.") from exc

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return DecodedImage(
        image=bgr,
        filename=safe_filename(filename),
        width=width,
        height=height,
        format=fmt.upper(),
    )


def resize_max_side(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    if max(width, height) <= max_side:
        return image
    scale = max_side / float(max(width, height))
    return cv2.resize(
        image,
        (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
        interpolation=cv2.INTER_AREA,
    )


def encode_jpeg_bytes(image: np.ndarray, quality: int = 85, max_side: int | None = None) -> bytes:
    working = resize_max_side(image, max_side) if max_side else image
    ok, buffer = cv2.imencode(".jpg", working, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    if not ok:
        raise ImageValidationError("Failed to encode image.")
    return buffer.tobytes()


def encode_jpeg_data_url(image: np.ndarray, quality: int = 85, max_side: int | None = None) -> str:
    payload = encode_jpeg_bytes(image, quality=quality, max_side=max_side)
    return "data:image/jpeg;base64," + base64.b64encode(payload).decode("ascii")


def crop_with_padding(
    image: np.ndarray,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    padding_ratio: float = 0.06,
) -> tuple[np.ndarray, dict[str, int]]:
    height, width = image.shape[:2]
    box_w = max(1.0, x2 - x1)
    box_h = max(1.0, y2 - y1)
    pad_x = box_w * padding_ratio
    pad_y = box_h * padding_ratio
    left = int(max(0, min(width - 1, round(x1 - pad_x))))
    top = int(max(0, min(height - 1, round(y1 - pad_y))))
    right = int(max(left + 2, min(width, round(x2 + pad_x))))
    bottom = int(max(top + 2, min(height, round(y2 + pad_y))))
    crop = image[top:bottom, left:right].copy()
    return crop, {"x1": left, "y1": top, "x2": right, "y2": bottom}


def draw_detection_boxes(image: np.ndarray, detections: list[dict]) -> np.ndarray:
    canvas = image.copy()
    line_width = max(2, int(round(max(canvas.shape[:2]) / 420)))
    font_scale = max(0.45, min(1.0, max(canvas.shape[:2]) / 1100))
    thickness = max(1, int(round(font_scale * 1.8)))
    for item in detections:
        box = item["bounding_box"]
        x1, y1, x2, y2 = (int(box["x1"]), int(box["y1"]), int(box["x2"]), int(box["y2"]))
        color = (235, 190, 40)
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, line_width, cv2.LINE_AA)
        label = f"{item['detection_class']} {item['detection_confidence']:.0%}"
        (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        top = max(0, y1 - text_h - baseline - 10)
        cv2.rectangle(canvas, (x1, top), (x1 + text_w + 14, top + text_h + baseline + 10), color, -1)
        cv2.putText(
            canvas,
            label,
            (x1 + 7, top + text_h + 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (12, 18, 28),
            thickness,
            cv2.LINE_AA,
        )
    return canvas


def make_thumbnail(image: np.ndarray, size: int) -> np.ndarray:
    height, width = image.shape[:2]
    scale = size / float(max(width, height))
    target = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    return cv2.resize(image, target, interpolation=cv2.INTER_AREA)
