# AutoLens — Fine-Grained Vehicle Recognition

AutoLens is a full-stack vehicle recognition and analysis system built for the Stanford Cars
196-class task. It combines YOLO vehicle detection, three classification checkpoints, side-by-side
model comparison, model performance provenance, and a local analysis history.

The application never fabricates predictions or performance numbers. Every metric is labelled as
recorded, reported, checkpoint metadata, or measured, and unavailable values stay unavailable.

## Stack

- Frontend: Next.js 16.4.5, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Recharts
- Backend: FastAPI, Uvicorn, Pydantic, PyTorch, torchvision, scikit-learn, OpenCV, Ultralytics
- Storage: SQLite plus local JPEG files under `backend/data`
- Runtime: CPU by default, CUDA used automatically when available

## Project layout

```text
.
├── backend/
│   ├── app/                  FastAPI application, models, services, routes, schemas
│   ├── data/                 SQLite database, history images and calibration report (generated)
│   ├── scripts/              Offline calibration and evaluation scripts
│   ├── requirements.txt
│   ├── .env.example
│   └── yolo11n.pt            YOLO11n detector checkpoint
├── frontend/
│   ├── app/                  App Router pages
│   ├── components/           Layout, analysis, charts, history and UI components
│   ├── hooks/                Backend status, models and timing hooks
│   ├── lib/                  API client, types, formatting and model metadata
│   └── .env.example
├── classical_vehicle_recognition.pkl               calibrated model package
├── classical_vehicle_recognition_uncalibrated_backup.pkl  original checkpoint backup
├── efficientnet_b2_transfer.pth
├── dinov2_stanford_cars_finetuned_best.pth
├── test_images/hf/           120 labelled local validation images
└── README.md
```

## Quick start

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The calibrated classical package and the two deep-learning checkpoints must remain in the project
root. Keep `classical_vehicle_recognition_uncalibrated_backup.pkl` if you need to re-run calibration.
`backend/yolo11n.pt` is used if present; otherwise Ultralytics may download YOLO11n on first use.
API docs are available at `http://127.0.0.1:8000/docs`.

### 2. Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. For a production build:

```powershell
npm run build
npm run start
```

`NEXT_PUBLIC_API_URL` defaults to `http://127.0.0.1:8000`. The backend CORS origins accept
`http://localhost:3000` and `http://127.0.0.1:3000`.

## Models and accuracy provenance

| Model | Approach | Input | Accuracy shown in the app | Provenance |
| --- | --- | --- | --- | --- |
| Classical HOG/LBP/HSV + PCA + RBF SVM | Classical, sigmoid-calibrated | 128×128 | 5.71% top-1, 17.00% top-5 | Recorded from the original experiment |
| EfficientNet-B2 | Deep learning | 260×260 | 60.04% top-1, 83.18% top-5 | Reported for a fine-tuned run; checkpoint equivalence unverified |
| DINOv2 ViT-B/14 + MLP head | Deep learning | 518×518 | 93.33% top-1, 98.33% top-5 | Independently measured on 120 labelled local images |

The classical SVM now returns sigmoid (Platt) calibrated probabilities through
`CalibratedClassifierCV`, not raw `decision_function` scores. EfficientNet-B2 and DINOv2 still return
softmax probabilities. Every score type is labelled in the UI, and calibrated probabilities are
presented as estimates, not correctness guarantees.

### Classical SVM calibration and validation

The calibrated package is produced offline by `backend/scripts/calibrate_classical_svm.py`:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\calibrate_classical_svm.py
```

- Calibration method: `sklearn.calibration.CalibratedClassifierCV`, `method="sigmoid"` (Platt).
- Calibration data: 8,144 Stanford Cars training images (196 classes) from
  `backend/app/database/cars_train`, using 5-fold stratified cross-validation on the training split.
  The 120-image validation set was not used for calibration.
- Preserved pipeline: HOG + LBP + HSV features, `StandardScaler`, PCA (300 components) and the
  original RBF SVC configuration (`C=1.0`, `gamma="scale"`, 196 classes).
- Saved package: `classical_vehicle_recognition.pkl` contains the calibrated classifier, scaler, PCA
  and feature parameters. The original checkpoint is kept as
  `classical_vehicle_recognition_uncalibrated_backup.pkl`.
- Full report: `backend/data/classical_svm_calibration_eval.json`.

Validation on the untouched `test_images/hf` set (120 images, 4 classes):

| Metric | Result |
| --- | --- |
| Top-1 accuracy | 20.00% (24/120) |
| Top-5 accuracy | 32.50% (39/120) |
| Macro precision (4 classes) | 48.00% |
| Macro recall (4 classes) | 15.18% |
| Macro F1 (4 classes) | 19.25% |
| Expected calibration error (10 bins) | 16.77% |
| Multiclass Brier score | 0.974773 |
| Negative log-likelihood | 4.440047 |
| Mean top-1 confidence | 3.23% |
| Mean latency | 2,329.74 ms per image |

Classification accuracy and calibration quality are reported separately. Every calibrated prediction
was verified to return 196 finite probabilities in `[0, 1]` that sum to 1, with the Top-1 class equal
to the highest-probability class. The validation set covers four classes, so the calibration figures
are indicative rather than a full 196-class reliability estimate.

### DINOv2 independent validation

DINOv2 was evaluated locally with the supplied checkpoint on the 120 labelled images in
`test_images/hf`:

- Top-1 accuracy: **93.33%** (112/120)
- Top-5 accuracy: **98.33%** (118/120)
- Classes covered: 4 of 196 (Hummer SUV, Ford F-150, Honda Accord, Hyundai Veloster)
- Mean CPU latency during evaluation: 2,795 ms per image
- Detailed result: `backend/data/dinov2_hf_eval.json`

The official Stanford Cars test annotations (`cars_test_annos.mat`) do not contain class labels,
so a full 8,041-image test accuracy cannot be computed honestly from the supplied dataset. The
checkpoint metadata reports 94.35% on its original validation split, but that split was not
provided. The 93.33% figure covers four classes and is not presented as a full 196-class score.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Runtime, database, detector and model health |
| GET | `/api/models` | Model metadata, checkpoint facts and metric provenance |
| GET | `/api/models/benchmark` | Live latency benchmark on the current device |
| GET | `/api/models/{model_id}` | One model's metadata |
| POST | `/api/detect` | YOLO detection only |
| POST | `/api/recognize` | Detect and classify one or more vehicles |
| POST | `/api/recognize/compare` | Compare all available classifiers |
| GET | `/api/comparison` | Approach comparison information |
| GET | `/api/history` | Paginated saved analyses |
| GET | `/api/history/stats` | History aggregates |
| GET | `/api/history/{id}` | Full saved analysis |
| DELETE | `/api/history/{id}` | Delete one analysis and its images |
| DELETE | `/api/history` | Clear all local history |
| POST | `/api/evaluate` | Evaluate models against a labelled directory, when configured |

Recognition uses multipart form data: `file`, `models` (`all` or comma-separated model IDs),
`use_detection`, and `detection_confidence`.

## Configuration

Backend settings can be supplied in the project root `.env` or `backend/.env`. Important options:

- `DEVICE=auto` (use CUDA when available, otherwise CPU)
- `CORS_ORIGINS`
- `MAX_UPLOAD_MB=12`
- `DATABASE_PATH`
- `EVAL_DATASET_DIR` (optional, layout: `<directory>/<Stanford class name>/*.jpg`)

Frontend configuration:

- `NEXT_PUBLIC_API_URL`

## History and privacy

Analyses are stored only on the local backend: metadata and predictions in
`backend/data/vehicles.db`, images and annotations in `backend/data/history`. No third-party
upload service is involved. Deleting an analysis removes its database row and stored images.

## Known limitations

- DINOv2 at 518×518 is slow on CPU; three-model runs can take several seconds per vehicle.
- YOLO11n can detect background vehicles or miss partially occluded ones; adjust the confidence
  threshold or classify the full frame.
- The supplied EfficientNet-B2 file is named as a transfer checkpoint; its reported fine-tuned
  metrics are unverified.
- DINOv2's independent validation covers four classes, not all 196.
- The classical SVM is weak on fine-grained classes. Its sigmoid-calibrated probabilities are low
  (mean top-1 confidence 3.23%) and its ECE on the four-class local validation set is 16.77%;
  calibration was fitted on the full 196-class training distribution, so the four-class result is
  indicative rather than exhaustive.
- Approach 3 (ensemble weighting, advanced calibration and retrieval) is documented as a roadmap
  item and is not implemented.

## Validation commands

```powershell
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\calibrate_classical_svm.py
Invoke-RestMethod http://127.0.0.1:8000/api/health
Get-Content .\data\classical_svm_calibration_eval.json -Raw
```

The calibration script rebuilds the cached training features when needed, refits the 5-fold sigmoid
calibration, updates the calibrated package and rewrites the validation report.
