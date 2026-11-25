"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Eye,
  Laptop,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Video,
  Wifi,
  X,
} from "lucide-react";

import {
  API_URL,
  CameraStatus,
  DiscoveredCamera,
  RecognitionApiResponse,
  RecognitionResult,
  getCameraResults,
  getCameraStatus,
  recognizeFrame,
  scanCameras,
  startCamera,
  stopCamera,
} from "@/lib/api";
import PersonDetailsModal, { PersonModalData } from "@/components/PersonDetailsModal";

export interface CameraChannel {
  channel: number;
  name: string;
  location: string;
}

export function getStreamUrlForChannel(uri: string, channel: number): string {
  const trimmed = (uri || "").trim();
  if (!trimmed || trimmed === "0" || trimmed === "1") {
    return trimmed || "0";
  }
  if (trimmed.includes("{ch}")) {
    return trimmed.replace(/\{ch\}/g, String(channel));
  }
  if (trimmed.includes("{channel}")) {
    return trimmed.replace(/\{channel\}/g, String(channel));
  }
  if (/\/Channels\/\d+/i.test(trimmed)) {
    return trimmed.replace(/\/Channels\/\d+/i, `/Channels/${channel}02`);
  }
  if (/channel=\d+/i.test(trimmed)) {
    return trimmed.replace(/channel=\d+/i, `channel=${channel}`);
  }
  if (/\/ch\d+\//i.test(trimmed)) {
    return trimmed.replace(/\/ch\d+\//i, `/ch${channel}/`);
  }
  return trimmed;
}

const DEFAULT_CHANNELS: CameraChannel[] = [
  { channel: 1, name: "Main Entrance Gate", location: "Campus Gate 1" },
  { channel: 2, name: "Central Library", location: "Library 1st Floor" },
  { channel: 3, name: "Computer Science Dept", location: "CS Block 2nd Floor" },
  { channel: 4, name: "Canteen & Cafeteria", location: "Student Center" },
  { channel: 5, name: "Main Academic Corridor", location: "Admin Building" },
  { channel: 6, name: "Campus Parking Area", location: "East Parking" },
  { channel: 7, name: "Auditorium / Seminar Hall", location: "Block C" },
  { channel: 8, name: "Sports Complex & Ground", location: "Ground Area" },
];

const DEFAULT_RTSP_URI = "rtsp://admin:college123@192.168.1.100:554/Streaming/Channels/{ch}02";

export default function LivePage() {
  // Mode: "browser" (Device webcam) or "backend" (OpenCV CCTV)
  const [mode, setMode] = useState<"browser" | "backend">("browser");

  // Browser Webcam state
  const [browserRunning, setBrowserRunning] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [lastRecognition, setLastRecognition] = useState<RecognitionApiResponse | null>(null);
  const [selectedModalPerson, setSelectedModalPerson] = useState<PersonModalData | null>(null);
  const [recentDetections, setRecentDetections] = useState<
    Array<{
      id: string;
      personId?: number | null;
      name: string;
      role: string;
      enrollment_no?: string | null;
      branch?: string | null;
      year?: string | null;
      date_of_birth?: string | null;
      contact_number?: string | null;
      validity?: string | null;
      face_image?: string | null;
      confidence: number;
      matched: boolean;
      timestamp: string;
    }>
  >([]);

  // Backend OpenCV Camera state
  const [backendStatus, setBackendStatus] = useState<CameraStatus | null>(null);
  const [backendResults, setBackendResults] = useState<RecognitionResult[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState("");

  // Single RTSP Stream URI & Auto-Detected Channels
  const [rtspUri, setRtspUri] = useState<string>(DEFAULT_RTSP_URI);
  const [channels, setChannels] = useState<CameraChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<number>(1);
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [tempRtspUri, setTempRtspUri] = useState<string>(DEFAULT_RTSP_URI);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>("");
  const [discoveredList, setDiscoveredList] = useState<DiscoveredCamera[]>([]);

  const activeChannelObj = channels.find((c) => c.channel === activeChannel) || channels[0] || {
    channel: activeChannel,
    name: `Camera ${activeChannel}`,
    location: "Active",
  };

  const handleScanCameras = async (targetUri?: string, fallback: boolean = false) => {
    const uri = (targetUri || tempRtspUri || rtspUri).trim();
    if (!uri) return;
    setIsScanning(true);
    setScanMessage("");
    try {
      const res = await scanCameras(uri, 16, fallback);
      if (res.success && res.cameras.length > 0) {
        setDiscoveredList(res.cameras);
        const newChannels: CameraChannel[] = res.cameras.map((c) => ({
          channel: c.channel,
          name: c.name || `CCTV Camera ${c.channel}`,
          location: c.location || (c.resolution ? `Online (${c.resolution})` : "Active Stream"),
        }));
        setChannels(newChannels);
        const targetChannel = newChannels[0].channel;
        setActiveChannel(targetChannel);
        setScanMessage(res.message);
        try {
          localStorage.setItem("smart_campus_detected_channels", JSON.stringify(newChannels));
        } catch {}

        if (backendStatus?.running) {
          const resolvedUrl = getStreamUrlForChannel(uri, targetChannel);
          await startCamera({
            source: resolvedUrl,
            camera_id: `CAM-${String(targetChannel).padStart(2, "0")}`,
            camera_name: newChannels[0].name,
          });
          setStreamKey(Date.now());
          await refreshBackend();
        }
      } else {
        setDiscoveredList([]);
        setChannels([]);
        setScanMessage(res.message || "No active CCTV cameras detected on this stream.");
        try {
          localStorage.removeItem("smart_campus_detected_channels");
        } catch {}
      }
    } catch (err) {
      setDiscoveredList([]);
      setChannels([]);
      setScanMessage(err instanceof Error ? err.message : "Scanning failed. Could not reach stream or server.");
      try {
        localStorage.removeItem("smart_campus_detected_channels");
      } catch {}
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let uriToScan = DEFAULT_RTSP_URI;
    try {
      const savedUri = localStorage.getItem("smart_campus_rtsp_uri");
      if (savedUri && savedUri.trim()) {
        uriToScan = savedUri.trim();
        setRtspUri(savedUri.trim());
        setTempRtspUri(savedUri.trim());
      }
      const savedChannels = localStorage.getItem("smart_campus_detected_channels");
      if (savedChannels) {
        const parsed = JSON.parse(savedChannels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChannels(parsed);
          setActiveChannel(parsed[0].channel);
          setDiscoveredList(
            parsed.map((c: CameraChannel) => ({
              channel: c.channel,
              name: c.name,
              source: getStreamUrlForChannel(uriToScan, c.channel),
              status: "online",
              location: c.location,
              type: "cctv",
            }))
          );
          return;
        }
      }
    } catch {}

    // Auto-detect cameras on first load
    handleScanCameras(uriToScan, false);
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);
  const lastLoggedRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });

  // ============================================================
  // BROWSER WEBCAM LOGIC
  // ============================================================

  const stopBrowserCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setBrowserRunning(false);
  }, []);

  const startBrowserCamera = useCallback(async () => {
    setBrowserError("");
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setBrowserRunning(true);
    } catch (err) {
      setBrowserError(
        err instanceof Error
          ? err.message
          : "Could not access device webcam. Please check browser camera permissions.",
      );
      setBrowserRunning(false);
    }
  }, []);

  // Frame capture and AI recognition loop for browser webcam
  useEffect(() => {
    if (mode !== "browser" || !browserRunning) return;

    let active = true;

    const captureAndAnalyze = async () => {
      if (!active || !videoRef.current || isProcessingRef.current) return;

      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      try {
        isProcessingRef.current = true;

        const offscreen = document.createElement("canvas");
        offscreen.width = video.videoWidth;
        offscreen.height = video.videoHeight;
        const ctx = offscreen.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        const dataUrl = offscreen.toDataURL("image/jpeg", 0.75);

        const response = await recognizeFrame(dataUrl);

        if (!active) return;

        if (!response.detected) {
          // No face in frame - clear overlays & active match state
          setLastRecognition(null);
          if (canvasRef.current) {
            const overlay = canvasRef.current;
            const overlayCtx = overlay.getContext("2d");
            if (overlayCtx) {
              overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            }
          }
        } else {
          setLastRecognition(response);

          // Draw bounding box overlay
          if (canvasRef.current) {
            const overlay = canvasRef.current;
            overlay.width = video.clientWidth;
            overlay.height = video.clientHeight;
            const overlayCtx = overlay.getContext("2d");

            if (overlayCtx) {
              overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

              if (response.box) {
                const scaleX = overlay.width / offscreen.width;
                const scaleY = overlay.height / offscreen.height;

                const bx = response.box.x * scaleX;
                const by = response.box.y * scaleY;
                const bw = response.box.width * scaleX;
                const bh = response.box.height * scaleY;

                const isMatched = response.matched && response.person;
                const color = isMatched ? "#22c55e" : "#ef4444";

                // Bounding box
                overlayCtx.strokeStyle = color;
                overlayCtx.lineWidth = 3;
                overlayCtx.strokeRect(bx, by, bw, bh);

                // Label badge
                const labelText = isMatched
                  ? `${response.person?.full_name} (${((response.confidence || 0) * 100).toFixed(0)}%)`
                  : `UNKNOWN (${((response.confidence || 0) * 100).toFixed(0)}%)`;

                overlayCtx.font = "bold 13px sans-serif";
                const textWidth = overlayCtx.measureText(labelText).width;

                overlayCtx.fillStyle = color;
                overlayCtx.fillRect(bx, Math.max(0, by - 26), textWidth + 16, 24);

                overlayCtx.fillStyle = isMatched ? "#000000" : "#ffffff";
                overlayCtx.fillText(labelText, bx + 8, Math.max(16, by - 8));
              }
            }
          }

          // Update unique detection entry per face (one entry per person)
          const isMatched = Boolean(response.matched && response.person);
          const nowStr = new Date().toLocaleTimeString();
          const targetName = isMatched ? response.person?.full_name || "Enrolled" : "Unknown Person";

          setRecentDetections((prev) => {
            const existing = prev.find((item) => item.name === targetName);
            const updatedItem = {
              id: existing ? existing.id : `${Date.now()}-${Math.random()}`,
              personId: response.person?.person_id,
              name: targetName,
              role: isMatched ? response.person?.role || "student" : "unknown",
              enrollment_no: response.person?.enrollment_no,
              branch: response.person?.branch,
              year: response.person?.year,
              date_of_birth: response.person?.date_of_birth,
              contact_number: response.person?.contact_number,
              validity: response.person?.validity,
              face_image: response.person?.face_image,
              confidence: Math.max(response.confidence || 0, existing?.confidence || 0),
              matched: isMatched,
              timestamp: nowStr,
            };

            // Deduplicate: Keep exactly ONE entry per face
            const remaining = prev.filter((item) => item.name !== targetName);
            return [updatedItem, ...remaining.slice(0, 8)];
          });
        }
      } catch {
        // Silently continue polling on network glitch
      } finally {
        isProcessingRef.current = false;
      }
    };

    const interval = setInterval(captureAndAnalyze, 500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [mode, browserRunning]);

  // Auto-start browser camera on mount
  useEffect(() => {
    if (mode === "browser") {
      startBrowserCamera();
    }
    return () => {
      stopBrowserCamera();
    };
  }, [mode, startBrowserCamera, stopBrowserCamera]);

  // ============================================================
  // BACKEND CCTV LOGIC
  // ============================================================

  const refreshBackend = useCallback(async () => {
    try {
      const s = await getCameraStatus();
      setBackendStatus(s);
      if (s.running) {
        const results = await getCameraResults();
        setBackendResults(results);
      } else {
        setBackendResults([]);
      }
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Backend unavailable.");
    }
  }, []);

  useEffect(() => {
    if (mode === "backend") {
      refreshBackend();
      const interval = setInterval(refreshBackend, 1000);
      return () => clearInterval(interval);
    }
  }, [mode, refreshBackend]);

  const handleSwitchChannel = async (channelNum: number) => {
    try {
      stopBrowserCamera();
      setMode("backend");
      setBackendLoading(true);
      setBackendError("");
      setActiveChannel(channelNum);
      const chObj = channels.find((c) => c.channel === channelNum) || {
        channel: channelNum,
        name: `Camera ${channelNum}`,
        location: `Channel ${channelNum}`,
      };
      const foundDiscovered = discoveredList.find((c) => c.channel === channelNum);
      const resolvedUrl = foundDiscovered?.source || getStreamUrlForChannel(rtspUri, channelNum);

      await startCamera({
        source: resolvedUrl,
        camera_id: `CAM-${String(channelNum).padStart(2, "0")}`,
        camera_name: chObj.name,
      });

      setStreamKey(Date.now());
      await refreshBackend();
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Failed to switch camera.");
    } finally {
      setBackendLoading(false);
    }
  };

  const handleSelectAndSwitchCamera = async (cam: DiscoveredCamera) => {
    const cleanUri = tempRtspUri.trim() || rtspUri;
    setRtspUri(cleanUri);
    try {
      localStorage.setItem("smart_campus_rtsp_uri", cleanUri);
    } catch {}

    stopBrowserCamera();
    setMode("backend");
    setShowSettingsModal(false);
    setBackendLoading(true);
    setBackendError("");
    setActiveChannel(cam.channel);

    try {
      const resolvedUrl = cam.source || getStreamUrlForChannel(cleanUri, cam.channel);
      await startCamera({
        source: resolvedUrl,
        camera_id: `CAM-${String(cam.channel).padStart(2, "0")}`,
        camera_name: cam.name,
      });

      setStreamKey(Date.now());
      await refreshBackend();
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Failed to switch to selected camera.");
    } finally {
      setBackendLoading(false);
    }
  };

  const handleNextCamera = () => {
    const currentIndex = channels.findIndex((c) => c.channel === activeChannel);
    const nextIndex = (currentIndex + 1) % channels.length;
    handleSwitchChannel(channels[nextIndex].channel);
  };

  const handlePrevCamera = () => {
    const currentIndex = channels.findIndex((c) => c.channel === activeChannel);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    handleSwitchChannel(channels[prevIndex].channel);
  };

  async function handleBackendStart() {
    await handleSwitchChannel(activeChannel);
  }

  async function handleBackendStop() {
    try {
      setBackendLoading(true);
      await stopCamera();
      await refreshBackend();
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Could not stop camera.");
    } finally {
      setBackendLoading(false);
    }
  }

  const handleSaveRtspSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUri = tempRtspUri.trim() || DEFAULT_RTSP_URI;
    setRtspUri(cleanUri);
    try {
      localStorage.setItem("smart_campus_rtsp_uri", cleanUri);
    } catch {}

    stopBrowserCamera();
    setMode("backend");
    setShowSettingsModal(false);
    setBackendLoading(true);
    setBackendError("");

    try {
      let cams = discoveredList;
      if (cams.length === 0) {
        const res = await scanCameras(cleanUri, 16, false);
        if (res.success && res.cameras.length > 0) {
          cams = res.cameras;
          setDiscoveredList(res.cameras);
          const newChannels: CameraChannel[] = res.cameras.map((c) => ({
            channel: c.channel,
            name: c.name || `CCTV Camera ${c.channel}`,
            location: c.location || (c.resolution ? `Online (${c.resolution})` : "Active Stream"),
          }));
          setChannels(newChannels);
          try {
            localStorage.setItem("smart_campus_detected_channels", JSON.stringify(newChannels));
          } catch {}
        }
      }

      const targetCam = cams.find((c) => c.channel === activeChannel) || cams[0];
      const targetNum = targetCam ? targetCam.channel : 1;
      setActiveChannel(targetNum);
      const targetUrl = targetCam?.source || getStreamUrlForChannel(cleanUri, targetNum);
      const targetName = targetCam?.name || `CAM ${targetNum}`;

      await startCamera({
        source: targetUrl,
        camera_id: `CAM-${String(targetNum).padStart(2, "0")}`,
        camera_name: targetName,
      });

      setStreamKey(Date.now());
      await refreshBackend();
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Failed to connect to camera stream.");
    } finally {
      setIsScanning(false);
      setBackendLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
            Live Monitoring
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Live Camera</h2>
          <p className="mt-1 text-xs text-[#747c90]">
            Real-time face detection and consent-based verification.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#0c101a] p-1">
          <button
            onClick={() => {
              setMode("browser");
              startBrowserCamera();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              mode === "browser"
                ? "bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/30"
                : "text-[#8a92a6] hover:text-white"
            }`}
          >
            <Laptop size={15} />
            <span>Device Webcam</span>
          </button>

          <button
            onClick={() => {
              stopBrowserCamera();
              setMode("backend");
              refreshBackend();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              mode === "backend"
                ? "bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/30"
                : "text-[#8a92a6] hover:text-white"
            }`}
          >
            <Server size={15} />
            <span>Backend CCTV Feed</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream (Left) + Recognition Results (Right) */}
      <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
        {/* Left Column: Live Video */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
          {/* Multi-CCTV Camera Switcher Bar */}
          {mode === "backend" && (
            <div className="border-b border-white/[0.08] bg-[#0c101a] p-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Video size={16} className="text-[#6d5dfc]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    College CCTV Switcher ({channels.length} Detected {channels.length === 1 ? "Camera" : "Cameras"})
                  </span>
                  {channels.length > 0 && activeChannelObj && (
                    <span className="rounded-md bg-[#6d5dfc]/15 px-2 py-0.5 text-[11px] font-semibold text-[#a594fd]">
                      Active: CAM {String(activeChannel).padStart(2, "0")} ({activeChannelObj.name})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevCamera}
                    disabled={backendLoading || channels.length <= 1}
                    className="flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-[#8b93a7] hover:bg-white/[0.08] hover:text-white transition disabled:opacity-40"
                    title="Previous Camera"
                  >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                  </button>

                  <button
                    onClick={handleNextCamera}
                    disabled={backendLoading || channels.length <= 1}
                    className="flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-[#8b93a7] hover:bg-white/[0.08] hover:text-white transition disabled:opacity-40"
                    title="Next Camera"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>

                  <button
                    onClick={() => handleScanCameras()}
                    disabled={isScanning || backendLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-[#8b93a7] hover:bg-white/[0.08] hover:text-white transition disabled:opacity-40"
                    title="Auto-Detect Active CCTV Cameras"
                  >
                    <RefreshCw size={13} className={isScanning ? "animate-spin text-[#6d5dfc]" : ""} />
                    <span>{isScanning ? "Scanning..." : "Detect Cameras"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setTempRtspUri(rtspUri);
                      setShowSettingsModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#6d5dfc]/15 px-3 py-1 text-xs font-semibold text-[#a594fd] hover:bg-[#6d5dfc]/25 hover:text-white transition"
                  >
                    <Settings size={13} />
                    <span>Stream URI</span>
                  </button>
                </div>
              </div>

              {/* Numbered Camera Channel Buttons (1 by 1) */}
              {channels.length === 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-white/[0.1] bg-[#121724]/50 p-3.5 text-xs text-[#8b93a7]">
                  <div className="flex items-center gap-2.5">
                    <Search size={15} className="text-[#6d5dfc]" />
                    <div>
                      <span className="font-semibold text-white">No active CCTV cameras detected on this stream.</span>
                      <p className="text-[11px] text-[#71717a] mt-0.5">
                        {scanMessage || "Enter your College RTSP Stream URI to detect active channels."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleScanCameras()}
                      disabled={isScanning}
                      className="flex items-center gap-1.5 rounded-lg bg-[#6d5dfc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7b6bff]"
                    >
                      <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                      <span>{isScanning ? "Scanning..." : "Detect Active Cameras"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setTempRtspUri("0");
                        setRtspUri("0");
                        handleScanCameras("0");
                      }}
                      disabled={isScanning}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/[0.1]"
                    >
                      <Laptop size={12} />
                      <span>Use Laptop Webcam (0)</span>
                    </button>
                    <button
                      onClick={() => handleScanCameras(rtspUri, true)}
                      disabled={isScanning}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-[#a594fd] hover:bg-white/[0.1]"
                    >
                      <span>Load 4 Demo Channels</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {channels.map((ch) => {
                    const isCurrent = activeChannel === ch.channel;
                    const isLive = isCurrent && backendStatus?.running;
                    return (
                      <button
                        key={ch.channel}
                        onClick={() => handleSwitchChannel(ch.channel)}
                        disabled={backendLoading}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                          isCurrent
                            ? "border-[#6d5dfc] bg-[#6d5dfc]/20 text-white shadow-sm shadow-[#6d5dfc]/30 font-semibold"
                            : "border-white/[0.08] bg-[#121724] text-[#8b93a7] hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isLive
                              ? "bg-[#22c55e] animate-pulse"
                              : isCurrent
                              ? "bg-[#f59e0b]"
                              : "bg-[#4a5568]"
                          }`}
                        />
                        <span className="font-mono text-[11px] font-bold text-[#6d5dfc]">
                          CAM {String(ch.channel).padStart(2, "0")}
                        </span>
                        <span>{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Stream Bar */}
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  (mode === "browser" && browserRunning) ||
                  (mode === "backend" && backendStatus?.running)
                    ? "bg-[#22c55e] shadow-lg shadow-[#22c55e]/50 animate-pulse"
                    : "bg-[#ef4444]"
                }`}
              />
              <span className="text-sm font-semibold text-white">
                {mode === "browser"
                  ? "Device Webcam (Live AI)"
                  : `CAM ${String(activeChannel).padStart(2, "0")}: ${activeChannelObj.name}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {mode === "browser" ? (
                browserRunning ? (
                  <button
                    onClick={stopBrowserCamera}
                    className="flex items-center gap-1.5 rounded-lg bg-[#ef4444]/10 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#ef4444]/20"
                  >
                    <CircleStop size={14} />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={startBrowserCamera}
                    className="flex items-center gap-1.5 rounded-lg bg-[#22c55e]/15 px-3 py-1.5 text-xs font-semibold text-[#86efac] hover:bg-[#22c55e]/25"
                  >
                    <Play size={14} />
                    <span>Start Webcam</span>
                  </button>
                )
              ) : backendStatus?.running ? (
                <button
                  onClick={handleBackendStop}
                  disabled={backendLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-[#ef4444]/10 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#ef4444]/20"
                >
                  <CircleStop size={14} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={handleBackendStart}
                  disabled={backendLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-[#6d5dfc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7b6bff]"
                >
                  <Play size={14} />
                  <span>Start Feed</span>
                </button>
              )}
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video w-full bg-black">
            {mode === "browser" ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${browserRunning ? "block" : "hidden"}`}
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />

                {!browserRunning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Camera size={44} className="mb-3 text-[#3d4558]" />
                    <div className="text-sm font-medium text-[#8b93a7]">
                      {browserError || "Webcam is stopped"}
                    </div>

                    {browserError && browserError.toLowerCase().includes("permission") && (
                      <div className="mt-3 max-w-md rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-left text-xs text-[#fca5a5]">
                        <div className="font-semibold text-white mb-1">
                          Fix Camera Permission:
                        </div>
                        <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#f87171]">
                          <li>
                            <strong>Windows Settings:</strong> Open Windows Settings (Win + I) &gt; <em>Privacy &amp; security</em> &gt; <em>Camera</em> &gt; Turn ON <strong>&quot;Camera access&quot;</strong> and <strong>&quot;Let desktop apps access your camera&quot;</strong>.
                          </li>
                          <li>
                            <strong>Browser:</strong> Click the lock/tune icon beside the URL in your browser bar &gt; set <strong>Camera</strong> to <strong>Allow</strong> &gt; refresh page.
                          </li>
                          <li>
                            <strong>Or use Backend Feed:</strong> You can click the button below to switch to the server camera feed.
                          </li>
                        </ol>

                        <button
                          onClick={() => {
                            setMode("backend");
                            refreshBackend();
                          }}
                          className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/[0.1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.2]"
                        >
                          <Server size={13} />
                          <span>Switch to Backend CCTV Feed</span>
                        </button>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={startBrowserCamera}
                        className="flex items-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#6d5dfc]/25"
                      >
                        <Play size={15} />
                        <span>Try Turn On Webcam Again</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {backendLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <RefreshCw size={40} className="mb-3 text-[#6d5dfc] animate-spin" />
                    <div className="text-sm font-semibold text-white">
                      Connecting to CAM {String(activeChannel).padStart(2, "0")} ({activeChannelObj.name})...
                    </div>
                    <div className="mt-1 text-xs text-[#8b93a7]">
                      Initializing camera stream &amp; AI recognition models...
                    </div>
                  </div>
                ) : backendStatus?.running ? (
                  <img
                    key={streamKey}
                    src={`${API_URL}/api/camera/stream?t=${streamKey}`}
                    alt="Backend Live Feed"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Wifi size={44} className="mb-3 text-[#3d4558]" />
                    <div className="text-sm font-medium text-[#8b93a7]">
                      {backendError || `CAM ${String(activeChannel).padStart(2, "0")} (${activeChannelObj.name}) is offline or stream not started`}
                    </div>
                    <button
                      onClick={handleBackendStart}
                      disabled={backendLoading}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#6d5dfc]/25"
                    >
                      <Play size={15} />
                      <span>Start CAM {String(activeChannel).padStart(2, "0")} Feed</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Live Indicator Pill on Video */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <span>
                {mode === "browser"
                  ? lastRecognition?.detected
                    ? lastRecognition.matched
                      ? `MATCHED: ${lastRecognition.person?.full_name}`
                      : "UNKNOWN FACE"
                    : "SCANNING FOR FACES"
                  : backendStatus?.running
                    ? `LIVE: CAM ${String(activeChannel).padStart(2, "0")} - ${activeChannelObj.name} ${backendStatus.is_simulated ? "(SIMULATED)" : ""}`
                    : "DISCONNECTED"}
              </span>
            </div>
          </div>

          {/* Quick Help Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.015] px-5 py-3 text-xs text-[#6e778c]">
            <span>Model: YuNet (Detection) + SFace (Verification)</span>
            <Link
              href="/enrollment"
              className="inline-flex items-center gap-1.5 text-[#a69eff] hover:underline"
            >
              <UserPlus size={13} />
              <span>Enroll Person</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Live Recognition Results */}
        <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-[#0d111b] p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
            <div>
              <h3 className="font-semibold text-white">Recognition Feed</h3>
              <p className="mt-0.5 text-xs text-[#6f778b]">Live verification activity</p>
            </div>
            <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-[#86efac]">
              LIVE
            </span>
          </div>

          {/* Current / Active Match Card */}
          {mode === "browser" ? (
            <div className="space-y-4">
              {lastRecognition?.detected && lastRecognition.person ? (
                <div
                  onClick={() => {
                    if (lastRecognition.person) {
                      setSelectedModalPerson({
                        id: lastRecognition.person.person_id,
                        full_name: lastRecognition.person.full_name,
                        role: lastRecognition.person.role,
                        enrollment_no: lastRecognition.person.enrollment_no,
                        branch: lastRecognition.person.branch,
                        year: lastRecognition.person.year,
                        date_of_birth: lastRecognition.person.date_of_birth,
                        contact_number: lastRecognition.person.contact_number,
                        validity: lastRecognition.person.validity,
                        face_image: lastRecognition.person.face_image,
                        confidence: lastRecognition.confidence,
                      });
                    }
                  }}
                  className="group cursor-pointer rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/[0.08] p-4 text-white shadow-lg transition hover:border-[#22c55e]/60 hover:bg-[#22c55e]/[0.12]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#22c55e]/20 text-[#86efac]">
                        <UserCheck size={24} />
                      </div>
                      <div>
                        <div className="text-base font-bold text-white group-hover:text-[#a6f4c5] transition-colors">
                          {lastRecognition.person.full_name}
                        </div>
                        <div className="text-xs capitalize text-[#86efac]">
                          {lastRecognition.person.role} •{" "}
                          {lastRecognition.person.enrollment_no || "ID Enrolled"}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#22c55e]/20 px-2.5 py-1 text-[10px] font-bold text-[#86efac]">
                      MATCHED
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#b8c0d4]">
                    <div>
                      Dept: <span className="text-white">{lastRecognition.person.branch || "—"}</span>
                    </div>
                    <div>
                      Year: <span className="text-white">{lastRecognition.person.year || "—"}</span>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-[#9eb0cc]">
                      <span>Match Confidence</span>
                      <span className="font-bold text-[#86efac]">
                        {((lastRecognition.confidence || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.1]">
                      <div
                        className="h-full rounded-full bg-[#22c55e]"
                        style={{
                          width: `${Math.min((lastRecognition.confidence || 0) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Click affordance */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5 text-[11px] text-[#a6f4c5]">
                    <span className="flex items-center gap-1 font-medium">
                      <Eye size={12} />
                      <span>Click to view ID card details</span>
                    </span>
                    <span>➔</span>
                  </div>
                </div>
              ) : lastRecognition?.detected && !lastRecognition.matched ? (
                <div className="rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/[0.08] p-4 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ef4444]/20 text-[#fca5a5]">
                        <UserX size={22} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Unknown Person</div>
                        <div className="text-xs text-[#fca5a5]">
                          Face detected but not in campus database
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#ef4444]/20 px-2.5 py-1 text-[10px] font-bold text-[#fca5a5]">
                      UNKNOWN
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                    <span className="text-[#8e98ac]">
                      Score: {((lastRecognition.confidence || 0) * 100).toFixed(1)}%
                    </span>
                    <Link
                      href="/enrollment"
                      className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.15]"
                    >
                      + Enroll Now
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Recent Detections List */}
              <div>
                <div className="mb-2 text-xs font-semibold text-[#8a92a6]">Recent Detections</div>
                {recentDetections.length === 0 ? (
                  <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                    <Camera size={26} className="mb-2 text-[#444c60]" />
                    <div className="text-xs text-[#717a8e]">
                      Position your face in front of the camera to see live recognition.
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {recentDetections.map((det) => (
                      <div
                        key={det.id}
                        onClick={() => {
                          if (det.matched) {
                            setSelectedModalPerson({
                              id: det.personId,
                              full_name: det.name,
                              role: det.role,
                              enrollment_no: det.enrollment_no,
                              branch: det.branch,
                              year: det.year,
                              date_of_birth: det.date_of_birth,
                              contact_number: det.contact_number,
                              validity: det.validity,
                              face_image: det.face_image,
                              confidence: det.confidence,
                            });
                          }
                        }}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                          det.matched
                            ? "border-[#22c55e]/20 bg-[#22c55e]/[0.03] hover:bg-[#22c55e]/[0.08] cursor-pointer"
                            : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              det.matched ? "bg-[#22c55e]" : "bg-[#ef4444]"
                            }`}
                          />
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{det.name}</span>
                              {det.matched && <Eye size={12} className="text-[#a69eff] opacity-60" />}
                            </div>
                            <div className="text-[10px] text-[#717a8e]">
                              {det.timestamp} • {(det.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                            det.matched
                              ? "bg-[#22c55e]/15 text-[#86efac]"
                              : "bg-[#ef4444]/15 text-[#fca5a5]"
                          }`}
                        >
                          {det.matched ? "VIEW ID" : "UNKNOWN"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Backend Results List */
            <div className="space-y-3">
              {backendResults.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                  <Camera size={30} className="mb-2 text-[#444c60]" />
                  <div className="text-xs text-[#717a8e]">
                    {backendStatus?.running
                      ? "Waiting for faces in backend stream..."
                      : "Start the backend camera to view results."}
                  </div>
                </div>
              ) : (
                backendResults.map((result, idx) => (
                  <div
                    key={result.person_id ?? idx}
                    onClick={() => {
                      if (result.person_id) {
                        setSelectedModalPerson({
                          id: result.person_id,
                          full_name: result.full_name || "Person",
                          role: result.role,
                          enrollment_no: result.enrollment_no,
                          branch: result.branch,
                          year: result.year,
                          confidence: result.confidence,
                        });
                      }
                    }}
                    className={`rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs transition ${
                      result.person_id ? "hover:border-[#6d5dfc]/40 hover:bg-white/[0.04] cursor-pointer" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{result.full_name || "Unknown Person"}</span>
                          {result.person_id && <Eye size={12} className="text-[#a69eff]" />}
                        </div>
                        <div className="text-[11px] capitalize text-[#8a92a6]">
                          {result.role || "unknown"} • {result.enrollment_no || "N/A"}
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          result.status === "MATCHED"
                            ? "bg-[#22c55e]/15 text-[#86efac]"
                            : "bg-[#ef4444]/15 text-[#fca5a5]"
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ID Card Profile Details Modal */}
      <PersonDetailsModal
        person={selectedModalPerson}
        onClose={() => setSelectedModalPerson(null)}
      />

      {/* College CCTV RTSP Stream Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0f1422] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-[#6d5dfc]/15 p-2 text-[#6d5dfc]">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">College CCTV RTSP Stream Settings</h3>
                  <p className="text-[11px] text-[#8b93a7]">
                    Stream URI dalne pr system auto-detect karega ki kitne CCTV cameras active hain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-[#64748b] hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRtspSettings} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8b93a7]">
                  College NVR / Central RTSP Stream URI *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="rtsp://admin:password@192.168.1.100:554/Streaming/Channels/{ch}02"
                    value={tempRtspUri}
                    onChange={(e) => setTempRtspUri(e.target.value)}
                    className="flex-1 rounded-xl border border-white/[0.1] bg-[#161c2d] px-3.5 py-2.5 text-xs text-white font-mono placeholder-[#4b5563] outline-none focus:border-[#6d5dfc]"
                  />
                  <button
                    type="button"
                    onClick={() => handleScanCameras(tempRtspUri)}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#6d5dfc]/25 hover:bg-[#7b6bff] transition disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
                    <span>{isScanning ? "Detecting..." : "Detect Cameras"}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#71717a]">
                  Ye ek hi RTSP Stream URI saare college cameras ke liye use hogi. Channel switch ke liye <code className="text-[#a594fd]">&#123;ch&#125;</code> placeholder use karein. (e.g. <code>.../Channels/&#123;ch&#125;02</code>)
                </p>
              </div>

              {/* Scanning status banner */}
              {isScanning && (
                <div className="flex items-center gap-2.5 rounded-xl border border-[#6d5dfc]/30 bg-[#6d5dfc]/10 p-3 text-xs text-[#c4b5fd]">
                  <RefreshCw size={14} className="animate-spin text-[#6d5dfc] shrink-0" />
                  <span>Probing NVR on port 554 and scanning active camera channels... Please wait.</span>
                </div>
              )}

              {/* Scan Result Feedback Alert */}
              {!isScanning && scanMessage && (
                <div
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                    discoveredList.length > 0
                      ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#86efac]"
                      : "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#fca5a5]"
                  }`}
                >
                  {discoveredList.length > 0 ? (
                    <CheckCircle2 size={16} className="text-[#22c55e] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-[#ef4444] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{scanMessage}</div>
                    {discoveredList.length === 0 && (
                      <div className="mt-1 text-[11px] text-[#f87171]">
                        Check karein ki laptop aur NVR same Wi-Fi/LAN pr connected hain ya local test ke liye niche &quot;Laptop Webcam&quot; select karein.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Discovered Cameras Preview - Clickable to Switch */}
              {discoveredList.length > 0 && (
                <div className="rounded-xl border border-white/[0.08] bg-[#121724] p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-white">
                    <div className="flex items-center gap-1.5">
                      <Camera size={14} className="text-[#6d5dfc]" />
                      <span>Detected Active CCTV Cameras ({discoveredList.length})</span>
                    </div>
                    <span className="text-[11px] text-[#a594fd]">
                      Click any camera to switch &amp; view
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {discoveredList.map((cam) => {
                      const isCurrent = activeChannel === cam.channel;
                      return (
                        <button
                          key={cam.channel}
                          type="button"
                          onClick={() => handleSelectAndSwitchCamera(cam)}
                          disabled={backendLoading}
                          className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition cursor-pointer ${
                            isCurrent
                              ? "border-[#6d5dfc] bg-[#6d5dfc]/20 text-white shadow-sm shadow-[#6d5dfc]/30 font-semibold"
                              : "border-white/[0.08] bg-white/[0.03] text-[#8b93a7] hover:border-[#6d5dfc]/50 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                isCurrent && backendStatus?.running
                                  ? "bg-[#22c55e] animate-pulse"
                                  : isCurrent
                                  ? "bg-[#f59e0b]"
                                  : "bg-[#4a5568]"
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-[#6d5dfc]">
                                  CAM {String(cam.channel).padStart(2, "0")}
                                </span>
                                <span className="font-semibold text-white">{cam.name}</span>
                              </div>
                              <div className="text-[10px] text-[#71717a] font-mono truncate max-w-xs">
                                {cam.source}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#a594fd]">
                              {cam.resolution || "Active"}
                            </span>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                                isCurrent
                                  ? "bg-[#6d5dfc] text-white"
                                  : "bg-[#6d5dfc]/20 text-[#a594fd] hover:bg-[#6d5dfc] hover:text-white"
                              }`}
                            >
                              {isCurrent ? "Active" : "Switch Feed"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Brand Presets */}
              <div>
                <div className="mb-2 text-xs font-semibold text-[#8b93a7]">
                  Quick College Brand Templates:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const u = "rtsp://admin:college123@192.168.1.100:554/Streaming/Channels/{ch}02";
                      setTempRtspUri(u);
                      handleScanCameras(u);
                    }}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161c2d] p-2.5 text-left text-white hover:border-[#6d5dfc] transition"
                  >
                    <div className="font-semibold text-white text-xs">Hikvision NVR</div>
                    <div className="text-[10px] text-[#71717a] font-mono truncate">.../Channels/&#123;ch&#125;02</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const u = "rtsp://admin:college123@192.168.1.100:554/cam/realmonitor?channel={ch}&subtype=1";
                      setTempRtspUri(u);
                      handleScanCameras(u);
                    }}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161c2d] p-2.5 text-left text-white hover:border-[#6d5dfc] transition"
                  >
                    <div className="font-semibold text-white text-xs">CP Plus / Dahua</div>
                    <div className="text-[10px] text-[#71717a] font-mono truncate">channel=&#123;ch&#125;&amp;subtype=1</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const u = "rtsp://admin:college123@192.168.1.100:554/ch{ch}/sub/av_stream";
                      setTempRtspUri(u);
                      handleScanCameras(u);
                    }}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161c2d] p-2.5 text-left text-white hover:border-[#6d5dfc] transition"
                  >
                    <div className="font-semibold text-white text-xs">Generic XM NVR</div>
                    <div className="text-[10px] text-[#71717a] font-mono truncate">/ch&#123;ch&#125;/sub/av_stream</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempRtspUri("0");
                      handleScanCameras("0");
                    }}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#161c2d] p-2.5 text-left text-white hover:border-[#6d5dfc] transition"
                  >
                    <div className="font-semibold text-white text-xs">Laptop Webcam (0)</div>
                    <div className="text-[10px] text-[#71717a] font-mono">Index 0 (Local Test)</div>
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
                {discoveredList.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleScanCameras(tempRtspUri, true)}
                    disabled={isScanning}
                    className="text-xs text-[#a594fd] hover:underline"
                  >
                    Offline Test: Load 4 Demo Channels
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="rounded-xl border border-white/[0.1] px-4 py-2 text-xs font-semibold text-[#8b93a7] hover:bg-white/[0.05] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={backendLoading || isScanning}
                    className="flex items-center gap-1.5 rounded-xl bg-[#6d5dfc] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#6d5dfc]/30 hover:bg-[#7b6bff] transition disabled:opacity-50"
                  >
                    {(backendLoading || isScanning) && (
                      <RefreshCw size={13} className="animate-spin" />
                    )}
                    <span>
                      {backendLoading
                        ? "Connecting Feed..."
                        : isScanning
                        ? "Scanning..."
                        : discoveredList.length > 0
                        ? `Save & Apply (${discoveredList.length} Cameras)`
                        : "Detect & Apply"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
