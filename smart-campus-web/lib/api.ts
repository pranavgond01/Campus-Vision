const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export interface Person {
  id: number;
  full_name: string;
  role: string;
  enrollment_no: string | null;
  year: string | null;
  branch: string | null;
  date_of_birth?: string | null;
  contact_number: string | null;
  validity?: string | null;
  face_image?: string | null;
  source_filename?: string | null;
  consent_status: boolean;
  created_at: string;
}

export interface Statistics {
  total_people: number;
  total_students: number;
  total_teachers: number;
  total_recognition_events: number;
  events_today: number;
}

export interface RecognitionResult {
  person_id: number | null;
  full_name: string | null;
  role: string | null;
  enrollment_no: string | null;
  year: string | null;
  branch: string | null;
  date_of_birth?: string | null;
  contact_number?: string | null;
  validity?: string | null;
  face_image?: string | null;
  confidence: number;
  status: string;
}

export interface CameraStatus {
  success?: boolean;
  running: boolean;
  camera_id: string;
  camera_name?: string;
  source?: string;
  is_simulated?: boolean;
  error?: string | null;
  detections?: number;
  camera?: {
    running: boolean;
    source: string;
    width: number;
    height: number;
    fps: number;
    last_error: string | null;
  };
}

export interface CameraPreset {
  id: string;
  name: string;
  source: string;
  location: string;
  type: string;
}

export interface DiscoveredCamera {
  channel: number;
  name: string;
  source: string;
  status: string;
  resolution?: string;
  location?: string;
  type: string;
}

export interface CameraScanResponse {
  success: boolean;
  detected_count: number;
  cameras: DiscoveredCamera[];
  host?: string;
  is_simulated?: boolean;
  message: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    },
  );

  if (!response.ok) {
    let message = "Request failed.";

    try {
      const data = await response.json();

      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Ignore JSON parsing errors.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function getStatistics() {
  return request<Statistics>(
    "/api/statistics",
  );
}

export async function getPeople() {
  return request<Person[]>(
    "/api/people",
  );
}

export interface CreatePersonInput {
  full_name: string;
  role: string;
  enrollment_no?: string | null;
  year?: string | null;
  branch?: string | null;
  contact_number?: string | null;
  face_image?: string | null;
  consent_status?: boolean;
}

export async function createPerson(data: CreatePersonInput): Promise<Person> {
  return request<Person>("/api/people", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      consent_status: data.consent_status ?? true,
    }),
  });
}

export async function addFaceSample(
  personId: number,
  faceImage: string,
): Promise<{ success: boolean; person_id: number; total_samples: number; message: string }> {
  return request(`/api/people/${personId}/add-sample`, {
    method: "POST",
    body: JSON.stringify({ face_image: faceImage }),
  });
}

export interface RecognitionApiResponse {
  success: boolean;
  detected: boolean;
  matched: boolean;
  message: string;
  confidence?: number | null;
  person?: {
    person_id: number;
    full_name: string;
    enrollment_no?: string | null;
    role: string;
    branch?: string | null;
    year?: string | null;
    date_of_birth?: string | null;
    contact_number?: string | null;
    validity?: string | null;
    face_image?: string | null;
    confidence: number;
    matched: boolean;
  } | null;
  face_count: number;
  camera_id: string;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export async function recognizeFrame(
  imageBase64: string,
  cameraId: string = "LOCAL-CAMERA-01",
): Promise<RecognitionApiResponse> {
  return request<RecognitionApiResponse>("/api/recognition", {
    method: "POST",
    body: JSON.stringify({
      image: imageBase64,
      camera_id: cameraId,
    }),
  });
}

export async function getPerson(
  id: number,
) {
  return request<Person>(
    `/api/people/${id}`,
  );
}

export async function deletePerson(
  id: number,
) {
  return request<{
    success: boolean;
    message: string;
  }>(
    `/api/people/${id}`,
    {
      method: "DELETE",
    },
  );
}

export async function getCameraStatus() {
  return request<CameraStatus>(
    "/api/camera/status",
  );
}

export async function startCamera(params?: {
  source?: string;
  camera_id?: string;
  camera_name?: string;
}) {
  return request("/api/camera/start", {
    method: "POST",
    body: JSON.stringify(params || {}),
  });
}

export async function getCameraPresets(): Promise<CameraPreset[]> {
  return request<CameraPreset[]>("/api/camera/presets");
}

export async function scanCameras(
  source: string,
  maxChannels: number = 16,
  allowSimulationFallback: boolean = false,
): Promise<CameraScanResponse> {
  return request<CameraScanResponse>("/api/camera/scan", {
    method: "POST",
    body: JSON.stringify({
      source,
      max_channels: maxChannels,
      allow_simulation_fallback: allowSimulationFallback,
    }),
  });
}

export async function stopCamera() {
  return request(
    "/api/camera/stop",
    {
      method: "POST",
    },
  );
}

export async function getCameraResults() {
  return request<RecognitionResult[]>(
    "/api/camera/results",
  );
}

export interface RecognitionEventRecord {
  id: number;
  person_id: number | null;
  camera_id: string;
  confidence: number;
  status: string;
  timestamp: string | null;
  person?: {
    id: number;
    full_name: string;
    role: string;
    enrollment_no: string | null;
    branch: string | null;
    year: string | null;
  } | null;
}

export async function getRecognitionEvents(): Promise<RecognitionEventRecord[]> {
  return request<RecognitionEventRecord[]>(
    "/api/recognition/events",
  );
}

export interface PDFImportRecord {
  import_index: number;
  full_name: string | null;
  role: string;
  enrollment_no: string | null;
  year: string | null;
  branch: string | null;
  contact_number: string | null;
}

export interface PDFImportResponse {
  filename: string;
  success: boolean;
  message: string;
  records: PDFImportRecord[];
  raw_text: string;
}

export async function previewPeoplePDF(
  file: File,
): Promise<PDFImportResponse> {
  const formData = new FormData();

  formData.append(
    "file",
    file,
  );

  const response = await fetch(
    `${API_URL}/api/import/pdf/preview`,
    {
      method: "POST",
      body: formData,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message =
      "PDF upload failed.";

    try {
      const data =
        await response.json();

      if (data?.detail) {
        message = data.detail;
      }
    } catch {
      // Ignore JSON parsing error.
    }

    throw new Error(message);
  }

  return response.json();
}

export interface IDCardData {
  full_name: string | null;
  enrollment_no: string | null;
  role: string;
  year: string | null;
  branch: string | null;
  date_of_birth: string | null;
  contact_number: string | null;
  address?: string | null;
  validity: string | null;
  face_detected: boolean;
  face_count: number;
  face_confidence: number | null;
  face_image: string | null;
  card_image?: string | null;
}

export interface IDCardResult {
  success: boolean;
  page: number;
  data?: IDCardData;
  error?: string;
  ocr_text?: string;
}

export interface IDCardPreviewResponse {
  filename: string;
  success: boolean;
  total_pages: number;
  successful_pages: number;
  cards: IDCardResult[];
}

export async function previewIDCard(
  file: File,
): Promise<IDCardPreviewResponse> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  const response =
    await fetch(
      `${API_URL}/api/id-card/preview`,
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      },
    );

  if (!response.ok) {
    let message =
      "ID card processing failed.";

    try {
      const body =
        await response.json();

      if (body?.detail) {
        message =
          body.detail;
      }
    } catch {
      // Ignore invalid JSON.
    }

    throw new Error(
      message,
    );
  }

  return response.json();
}

export { API_URL };