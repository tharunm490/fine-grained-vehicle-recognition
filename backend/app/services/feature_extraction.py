import cv2
import numpy as np
from skimage.feature import hog, local_binary_pattern


def extract_classical_features(
    image_bgr: np.ndarray,
    image_size: tuple[int, int],
    hog_orientations: int,
    lbp_radius: int,
    lbp_points: int,
    lbp_method: str,
    hsv_bins: tuple[int, int, int],
) -> np.ndarray:
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Empty image supplied for feature extraction")

    resized = cv2.resize(image_bgr, (int(image_size[0]), int(image_size[1])))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    hog_features = hog(
        gray,
        orientations=int(hog_orientations),
        pixels_per_cell=(16, 16),
        cells_per_block=(2, 2),
        block_norm="L2-Hys",
        feature_vector=True,
    )

    lbp = local_binary_pattern(gray, int(lbp_points), int(lbp_radius), str(lbp_method))
    lbp_hist, _ = np.histogram(lbp.ravel(), bins=19, range=(0, 19))
    lbp_hist = lbp_hist.astype(np.float64)
    total = lbp_hist.sum()
    lbp_hist = lbp_hist / total if total > 0 else lbp_hist

    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    hsv_hist = cv2.calcHist(
        [hsv],
        [0, 1, 2],
        None,
        [int(hsv_bins[0]), int(hsv_bins[1]), int(hsv_bins[2])],
        [0, 180, 0, 256, 0, 256],
    ).flatten()
    hsv_total = float(hsv_hist.sum())
    hsv_hist = hsv_hist / hsv_total if hsv_total > 0 else hsv_hist

    return np.hstack([hog_features, lbp_hist, hsv_hist]).astype(np.float64)
