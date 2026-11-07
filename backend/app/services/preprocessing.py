import numpy as np
from PIL import Image

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

EFFICIENTNET_SIZE = 260
EFFICIENTNET_RESIZE = 292
DINOV2_SIZE = 518


def bgr_to_rgb_pil(image_bgr: np.ndarray) -> Image.Image:
    return Image.fromarray(np.ascontiguousarray(image_bgr[:, :, ::-1]))


def torchvision_transform(size: int) -> "object":
    from torchvision import transforms

    return transforms.Compose(
        [
            transforms.Resize(size, interpolation=transforms.InterpolationMode.BICUBIC),
            transforms.CenterCrop(size),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def efficientnet_transform() -> "object":
    return torchvision_transform(EFFICIENTNET_SIZE)


def dinov2_transform() -> "object":
    return torchvision_transform(DINOV2_SIZE)
