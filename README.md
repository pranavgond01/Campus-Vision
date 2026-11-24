# 🎓 Smart Campus Vision

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js%2016-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV" />
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

**Smart Campus Vision** is an enterprise-ready, AI-powered campus surveillance, biometric facial recognition, and student identity management system. 

It seamlessly bridges **physical college ID cards** with **live CCTV/webcam streams** using state-of-the-art deep learning models (OpenCV YuNet & SFace) combined with RapidOCR text extraction, 5-point facial landmark canonical alignment (`alignCrop`), multi-sample biometrics, and intelligent anti-spam cooldowns.

---

## 🌟 Key Features

### 🪪 1. Smart College ID Card Scanner & Auto-OCR
* **1-by-1 ID Card Image Upload**: Upload any photo or scan of a student or faculty ID card (JPEG, PNG, WebP).
* **Multi-Orientation Auto-Rotation**: Automatically scans all 4 orientations (0°, 90°, 180°, 270°) using OCR confidence heuristics to correct rotated or upside-down ID cards.
* **Intelligent Data Parsing**: Automatically extracts:
  * **Full Name** (e.g., `MR. PRANAV SUNIL GOND`)
  * **Student / Roll ID Number** (e.g., `PBE23054`)
  * **Branch / Department** (e.g., `Computer Science and Engineering`)
  * **Date of Birth (DOB)** (e.g., `30.10.2005`)
  * **Contact Phone Number** (e.g., `9881733506`)
  * **Card Validity Period** (e.g., `2023-2027`)
  * **Permanent Address** (e.g., `Ibrahimgur Post Kothali Tq.Motala Dist.Buldana`)
* **Automated Face Extraction**: Detects and crops the portrait face image directly from the ID card for instant biometric enrollment.

### 📸 2. Landmark Face Alignment & Multi-Sample Biometrics
* **5-Point Landmark Canonical Alignment (`alignCrop`)**: Uses YuNet's 5 facial landmarks (left eye, right eye, nose tip, left mouth corner, right mouth corner) to affine-transform and normalize every face to a canonical 112×112 frontal alignment.
* **Cross-Domain Recognition Optimization**: Passport/ID card printed photos and live webcam video have vastly different lighting, camera sensors, and angles. With our calibrated cosine threshold (`FACE_MATCH_THRESHOLD = 0.310`), the system accurately verifies identity across domains.
* **Multi-Sample Enrollment (`+ Snap Webcam`)**: Enroll an individual with their ID card photo, and easily add an instant live webcam snapshot to achieve near 100% recognition accuracy under diverse real-world lighting conditions.

### 🎥 3. Real-Time CCTV & Webcam Recognition (Multi-Camera Switcher)
* **Single RTSP Stream URI Configuration**: College NVRs (Hikvision, CP Plus, Dahua, Matrix, etc.) share a single base IP and credentials. Configure the RTSP URI once with channel template (e.g. `rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/{ch}02`).
* **Instant 1-by-1 Camera Switcher**: Seamlessly switch between campus cameras (`CAM 01: Main Gate`, `CAM 02: Library`, `CAM 03: CS Dept`, `CAM 04: Canteen`, etc.) with single-click buttons or `< Prev` / `Next >` navigation.
* **Bounding Box Overlays**: Real-time visual feedback:
  * 🟢 **Green Bounding Box**: Verified enrolled student/faculty member with name and confidence percentage.
  * 🔴 **Red Bounding Box**: Unknown visitor or unregistered face.
* **Location-Aware Audit Logs**: Every recognition event is automatically tagged and stored with the specific camera name and location where the face was spotted.

### ⏱️ 4. Intelligent Anti-Spam Recognition Cooldown
* **No More Duplicate Log Flooding**: When a person stands in front of the camera or glances around, standard systems record dozens of duplicate entries.
* **Per-Person Cooldown Window**: Automatically silences duplicate database logging for 30 seconds per individual while maintaining real-time on-screen tracking.

### 👤 5. Student & Faculty Directory with ID Card Modal
* **Interactive Directory**: Search, filter, and inspect enrolled members at `/people`.
* **Full ID Card Details Modal**: Clicking on any person row (or eye icon) opens an ID Card modal showing all extracted metadata (ID No, Branch, DOB, Phone, Validity, Address, Enrolled Faces).
* **Live Feed Popups**: Click directly on the recognized person's name or Active Match card on the `/live` page to view their complete dossier without leaving the camera feed.

### 🌓 6. Adaptive Dark & White (Light) Theme
* **One-Click Theme Toggle**: Switch between Dark Mode and crisp White (Light) Mode via the Sun/Moon icon on both the Topbar and Sidebar.
* **Persistent Preference**: Automatically saves your choice in `localStorage` so it persists across reloads.

---

## 🏛️ System Architecture

```text
┌────────────────────────┐      ┌─────────────────────────┐
│  College ID Card Scan  │      │   Live CCTV / Webcam    │
└───────────┬────────────┘      └────────────┬────────────┘
            │                                │
            ▼                                ▼
   [RapidOCR Pipeline]              [OpenCV YuNet ONNX]
   - 4-Way Auto Rotation            - Face Detection
   - Text Pattern Regex             - 5 Facial Landmarks
            │                                │
            ▼                                ▼
   [Face Cropping]                  [alignCrop 112x112]
            │                                │
            └───────────────┬────────────────┘
                            ▼
                  [OpenCV SFace ONNX]
                  - 128D Feature Embeddings
                            │
                            ▼
              [Cosine Distance Matcher]
              - Threshold: 0.310 (Calibrated)
              - 30s Anti-Spam Cooldown
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    [SQLite Database]             [FastAPI REST Backend]
    - People & Credentials        - Video Streaming (MJPEG)
    - Multi-Face Vectors          - Live Results & Audits
    - Recognition Logs                      │
                                            ▼
                              [Next.js 16 Web Dashboard]
                              - Live Camera View & Overlay
                              - ID Card Details Popup Modal
                              - Dark / White Theme Toggle
```

---

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12, FastAPI, Uvicorn, SQLite, OpenCV (`opencv-python`), RapidOCR, NumPy, Pydantic |
| **Deep Learning Models** | YuNet (`face_detection_yunet_2023mar.onnx`), SFace (`face_recognition_sface_2021dec.onnx`) |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Axios |
| **Tooling & Scripts** | PowerShell (`start.ps1`), Windows Batch (`start.bat`), Git |

---

## 📂 Project Structure

```text
Smart-Campus-Vision/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── camera.py          # Camera streaming & status endpoints
│   │   │   ├── enrollment.py      # Face enrollment APIs
│   │   │   ├── people.py          # People CRUD & multi-sample biometrics
│   │   │   ├── recognition.py     # Live frame recognition & cooldown
│   │   │   ├── schemas.py         # Pydantic data models
│   │   │   └── statistics.py      # Dashboard analytics metrics
│   │   ├── core/
│   │   │   └── config.py          # Settings, thresholds, and camera configuration
│   │   ├── database/
│   │   │   ├── database.py        # SQLite engine & session management
│   │   │   └── models.py          # SQLAlchemy tables (Person, FaceSample, RecognitionLog)
│   │   ├── vision/
│   │   │   ├── detector.py        # YuNet face detector wrapper
│   │   │   ├── recognizer.py      # SFace face recognizer wrapper
│   │   │   ├── live_recognition.py# Real-time frame processing pipeline
│   │   │   └── camera_manager.py  # Thread-safe webcam capture
│   │   └── main.py                # FastAPI application entrypoint
│   ├── data/
│   │   └── smart_campus.db        # SQLite database
│   ├── models/
│   │   ├── sface/                 # SFace ONNX model (128D embeddings)
│   │   └── yunet/                 # YuNet ONNX model (detection + 5 landmarks)
│   ├── services/
│   │   ├── face_service.py        # Landmark alignment, feature extraction, matching
│   │   ├── id_card_service.py     # 4-orientation RapidOCR ID card parser
│   │   └── pdf_import_service.py  # Bulk student PDF parser
│   ├── requirements.txt           # Python dependencies
│   └── run.py                     # Backend startup script
│
├── smart-campus-web/
│   ├── app/
│   │   ├── dashboard/             # Overview dashboard & statistics
│   │   ├── enrollment/            # Single person, ID card, & PDF enrollment
│   │   ├── events/                # Recognition audit log trail
│   │   ├── live/                  # Real-time camera monitoring feed
│   │   ├── people/                # Enrolled students directory
│   │   ├── globals.css            # Dark and light theme CSS definitions
│   │   └── layout.tsx             # Root layout with ThemeProvider
│   ├── components/
│   │   ├── CameraPreview.tsx      # Video canvas with bounding box overlays
│   │   ├── PersonDetailsModal.tsx # Full college ID card details modal
│   │   ├── RecognitionCard.tsx    # Live face match card
│   │   ├── Sidebar.tsx            # Navigation sidebar with theme switcher
│   │   ├── ThemeProvider.tsx      # React theme context (dark/white)
│   │   ├── ThemeToggle.tsx        # Sun/moon toggle button
│   │   └── Topbar.tsx             # Header bar with real-time stats
│   ├── lib/
│   │   └── api.ts                 # Frontend API client and TypeScript definitions
│   ├── package.json               # Node.js dependencies
│   └── tsconfig.json              # TypeScript configuration
│
├── start.bat                      # One-click Windows launcher
├── start.ps1                      # One-click PowerShell launcher
├── .gitignore                     # Git ignore rules
└── README.md                      # Documentation
```

---

## ⚡ Quick Start

### Prerequisites
* **Python**: `3.10` or higher (`3.12` recommended)
* **Node.js**: `18.x` or higher (`v20+` recommended)
* **Hardware**: Standard USB Webcam, Laptop Integrated Camera, or RTSP Stream URL

---

### Method A: One-Click Launch (Windows)

Simply double-click:
```cmd
start.bat
```
*Or via PowerShell:*
```powershell
.\start.ps1
```
This automatically initializes the backend virtual environment, starts the FastAPI server on port `8000`, starts the Next.js frontend on port `3000`, and opens the dashboard in your default browser.

---

### Method B: Manual Setup

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Windows (CMD):
.\.venv\Scripts\activate.bat
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
python run.py
```
> The API will start at **`http://127.0.0.1:8000`**
> Interactive Swagger Documentation: **`http://127.0.0.1:8000/docs`**

#### 2. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd smart-campus-web

# Install packages
npm install

# Start Next.js development server
npm run dev
```
> The web application will be live at **`http://localhost:3000`**

---

## 📖 How to Use

### 1. Enrolling a Student via College ID Card
1. Navigate to **Enrollment** (`/enrollment`) from the sidebar.
2. Select the **College ID Card** tab.
3. Click or drag-and-drop an ID card image (e.g. photo taken from phone or scanner).
4. The system will automatically:
   * Rotate and align the image correctly.
   * Extract student details (Name, ID, Department, DOB, Phone, Validity, Address).
   * Detect and crop the portrait face.
5. Review the extracted data. Edit any field if desired.
6. Click **Confirm & Register Person**.
7. *(Pro Tip)* Click **`+ Snap Webcam`** right after enrolling to capture a quick live camera snapshot. This links both the printed ID card photo and live camera biometrics to the same profile for flawless recognition.

### 2. Live Monitoring & Face Recognition
1. Navigate to **Live Monitoring** (`/live`).
2. Click **Start Camera** (select Camera Index `0` or custom RTSP stream).
3. As people pass in front of the camera:
   * **Enrolled Members**: Outlined with a **Green Bounding Box** showing their Name and Confidence %.
   * **Unrecognized Visitors**: Outlined with a **Red Bounding Box** labeled `Unknown`.
4. The **Active Match** card updates on the right side.
5. **Click on the Match Card or Name**: Opens the full **ID Card Details Modal** showing the student's complete record, branch, phone number, and enrolled face samples!

### 3. Managing Enrolled Directory
1. Navigate to **People** (`/people`).
2. Search by name, roll number, or department.
3. Click on any student's row or the **Eye Icon** to open the ID Card popup modal.
4. Add secondary face samples (`+ Snap Webcam`) or remove profiles if needed.

### 4. Switching Dark & Light Themes
* Click the **Sun / Moon icon** in the top navigation bar or bottom of the sidebar.
* The interface instantly updates its palette between dark mode and clean white (light) mode.

---

## ⚙️ Configuration

Key settings can be adjusted in [`backend/app/core/config.py`](file:///C:/Smart-Campus-Vision/backend/app/core/config.py):

| Setting | Default | Description |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | `0.310` | Cosine similarity threshold for SFace (calibrated for ID card & live camera matching) |
| `RECOGNITION_COOLDOWN_SECONDS` | `30.0` | Cooldown period to prevent duplicate rapid-fire logging for the same individual |
| `DEFAULT_CAMERA_ID` | `0` | Default video capture device index (`0`, `1`, or RTSP URL) |
| `YUNET_CONFIDENCE_THRESHOLD` | `0.6` | Minimum face detection confidence for YuNet |
| `DATABASE_URL` | `sqlite:///./data/smart_campus.db` | SQLite database connection string |

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and greeting |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/api/statistics` | Dashboard summary (enrolled count, recognition count) |
| `GET` | `/api/people` | Retrieve list of all enrolled students and staff |
| `POST` | `/api/people` | Enroll a new person with metadata and face image |
| `POST` | `/api/people/{id}/add-sample` | Add an additional biometric sample to an existing profile |
| `DELETE` | `/api/people/{id}` | Delete a person and their biometrics |
| `POST` | `/api/id-card/preview` | Upload ID card image, auto-rotate, OCR extract, and crop face |
| `GET` | `/api/camera/status` | Current camera status and FPS |
| `POST` | `/api/camera/start` | Start live camera capture thread |
| `POST` | `/api/camera/stop` | Stop camera capture |
| `GET` | `/api/camera/stream` | MJPEG live camera stream |
| `POST` | `/api/recognition/recognize-frame` | Detect and recognize faces in an individual frame |
| `GET` | `/api/recognition/events` | Audit trail of past recognition events |

---

## ❓ Troubleshooting

### 1. Camera Not Opening (`Camera Error: Could not open camera`)
* Make sure no other application (Zoom, Teams, Skype, Windows Camera App) is currently using the camera.
* If using an external USB camera, change the camera index from `0` to `1` in `backend/app/core/config.py`.

### 2. Live Face Marked as "Unknown" Despite ID Card Enrollment
* Printed ID cards often have faded ink, low DPI, or years-old photos.
* Simply go to `/people` or `/enrollment`, find the person, and click **`+ Snap Webcam`** once. Adding one live webcam face sample guarantees immediate high-confidence matching.

### 3. Port Conflicts
* **Backend (Port 8000)**: If port 8000 is occupied, run `uvicorn main:app --port 8001` and update `smart-campus-web/lib/api.ts`.
* **Frontend (Port 3000)**: Next.js will automatically prompt to run on port 3001 if 3000 is busy.

---

## 📄 License
This project is developed for educational and campus security management purposes. Licensed under the MIT License.
