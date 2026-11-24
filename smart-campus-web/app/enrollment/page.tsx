"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import {
  IDCardData,
  PDFImportRecord,
  createPerson,
  addFaceSample,
  previewIDCard,
  previewPeoplePDF,
} from "@/lib/api";

export default function EnrollmentPage() {
  const [activeTab, setActiveTab] = useState<"id-card" | "manual" | "pdf">("id-card");

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
            Campus Enrollment
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Enroll People</h2>
          <p className="mt-1 text-xs text-[#747c90]">
            Enroll members using their College ID Card, webcam snapshot, or bulk PDF import.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#0c101a] p-1">
          <button
            onClick={() => setActiveTab("id-card")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "id-card"
                ? "bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/30"
                : "text-[#8a92a6] hover:text-white"
            }`}
          >
            <CreditCard size={15} />
            <span>College ID Card</span>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "manual"
                ? "bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/30"
                : "text-[#8a92a6] hover:text-white"
            }`}
          >
            <Users size={15} />
            <span>Manual Form &amp; Webcam</span>
          </button>

          <button
            onClick={() => setActiveTab("pdf")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "pdf"
                ? "bg-[#6d5dfc] text-white shadow-md shadow-[#6d5dfc]/30"
                : "text-[#8a92a6] hover:text-white"
            }`}
          >
            <FileText size={15} />
            <span>Bulk PDF</span>
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === "id-card" && <SingleIDCardEnrollment />}
      {activeTab === "manual" && <ManualEnrollment />}
      {activeTab === "pdf" && <BulkPDFEnrollment />}
    </div>
  );
}

// ============================================================
// SINGLE ID CARD ENROLLMENT COMPONENT
// ============================================================

function SingleIDCardEnrollment() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [extractedData, setExtractedData] = useState<IDCardData | null>(null);

  // Editable Form Details
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [cardImage, setCardImage] = useState<string | null>(null);

  // Optional Live Webcam Snapshot to Enrich Biometrics
  const [liveFaceImage, setLiveFaceImage] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  async function startWebcam() {
    try {
      setIsWebcamOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      webcamStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
    } catch {
      setError("Webcam permission denied. Please allow camera access in browser.");
      setIsWebcamOpen(false);
    }
  }

  function stopWebcam() {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
    setIsWebcamOpen(false);
  }

  function captureWebcam() {
    if (!webcamVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = webcamVideoRef.current.videoWidth || 640;
    canvas.height = webcamVideoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(webcamVideoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setLiveFaceImage(dataUrl);
    stopWebcam();
  }

  const [submitting, setSubmitting] = useState(false);
  const [successPerson, setSuccessPerson] = useState<{
    name: string;
    role: string;
    id: number;
    hasMultipleSamples?: boolean;
  } | null>(null);

  async function handleCardSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSelectedFile(file);
    setExtractedData(null);
    setSuccessPerson(null);

    try {
      setAnalyzing(true);
      const res = await previewIDCard(file);

      if (res.cards && res.cards.length > 0 && res.cards[0].data) {
        const card = res.cards[0].data;
        setExtractedData(card);

        // Pre-fill fields from ID card
        if (card.full_name) setFullName(card.full_name);
        if (card.role) setRole(card.role.toLowerCase());
        if (card.enrollment_no) setEnrollmentNo(card.enrollment_no);
        if (card.branch) setBranch(card.branch);
        if (card.year) setYear(card.year);
        if (card.contact_number) setContactNumber(card.contact_number);
        if (card.face_image) setFaceImage(card.face_image);
        if (card.card_image) setCardImage(card.card_image);
      } else {
        setError("Could not parse ID card. You can fill in the details manually.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ID card analysis failed. You can still enter details manually.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirmEnrollment() {
    if (!fullName.trim()) {
      setError("Please provide a Full Name.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const created = await createPerson({
        full_name: fullName.trim(),
        role: role.toLowerCase().trim(),
        enrollment_no: enrollmentNo.trim() || undefined,
        branch: branch.trim() || undefined,
        year: year.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        face_image: faceImage || undefined,
        consent_status: true,
      });

      let addedLiveSample = false;
      if (liveFaceImage && created.id) {
        try {
          await addFaceSample(created.id, liveFaceImage);
          addedLiveSample = true;
        } catch (sampleErr) {
          console.warn("Could not register live face sample:", sampleErr);
        }
      }

      setSuccessPerson({
        name: created.full_name,
        role: created.role,
        id: created.id,
        hasMultipleSamples: addedLiveSample,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setExtractedData(null);
    setFullName("");
    setRole("student");
    setEnrollmentNo("");
    setBranch("");
    setYear("");
    setContactNumber("");
    setFaceImage(null);
    setCardImage(null);
    setLiveFaceImage(null);
    stopWebcam();
    setSuccessPerson(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d5dfc]/15 text-[#9185ff]">
            <CreditCard size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">College ID Card Enrollment</h3>
            <p className="mt-0.5 text-xs text-[#6f778b]">
              Upload a single ID card photo. Face and student details are extracted automatically.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#6d5dfc]/10 px-3 py-1 text-[11px] font-bold text-[#a69eff]">
          1-By-1 Card Scan
        </span>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-3.5 text-xs text-[#fca5a5]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {successPerson ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#4ade80] shadow-xl shadow-[#22c55e]/10">
            <CheckCircle2 size={36} />
          </div>

          <h4 className="text-xl font-bold text-white">ID Card Enrolled Successfully!</h4>
          <p className="mt-1 text-sm text-[#8a92a6]">
            <span className="font-semibold text-white">{successPerson.name}</span> has been enrolled as a{" "}
            <span className="capitalize text-[#86efac]">{successPerson.role}</span>.
          </p>

          {faceImage && (
            <div className="my-5 inline-block overflow-hidden rounded-2xl border-2 border-[#22c55e] p-1 bg-black">
              <img
                src={faceImage}
                alt="Enrolled portrait"
                className="h-32 w-32 rounded-xl object-cover"
              />
            </div>
          )}

          <div className="mx-auto max-w-md rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-[#717a8e]">
            Facial features registered from college ID card. Ready for live camera verification!
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="rounded-xl bg-[#6d5dfc] px-5 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-[#7b6bff]"
            >
              + Enroll Another ID Card
            </button>
            <a
              href="/live"
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs text-[#bcc2d4] transition hover:bg-white/[0.07]"
            >
              Test on Live Camera ➔
            </a>
          </div>
        </div>
      ) : (
        /* UPLOAD & VERIFY WORKFLOW */
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Left Column: ID Card Upload & Portrait Preview */}
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleCardSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-6 text-center transition hover:border-[#6d5dfc]/50 hover:bg-[#6d5dfc]/[0.03]"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6d5dfc]/10 text-[#9185ff] transition group-hover:scale-105">
                  <Upload size={28} />
                </div>
                <div className="text-base font-semibold text-white">Upload College ID Card</div>
                <div className="mt-1.5 text-xs text-[#717a8e]">
                  Click or drag photo of college ID (any orientation: portrait, landscape, phone photo)
                </div>
                <div className="mt-4 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] text-[#8a92a6]">
                  Supports: JPG, PNG, WEBP, PDF (up to 20 MB)
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                {/* Uploaded Card Preview */}
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                  {cardImage || selectedFile ? (
                    <div className="relative max-h-[320px] flex items-center justify-center p-2 bg-[#090d14]">
                      <img
                        src={cardImage || URL.createObjectURL(selectedFile)}
                        alt="ID Card Preview"
                        className="max-h-[300px] w-auto rounded-lg object-contain"
                      />
                    </div>
                  ) : null}

                  {analyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
                      <RefreshCw size={28} className="animate-spin text-[#6d5dfc] mb-2" />
                      <div className="text-xs font-semibold text-white">Analyzing ID Card...</div>
                      <div className="text-[11px] text-[#8a92a6]">Detecting orientation &amp; extracting face</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#0c101a] p-3 text-xs">
                    <span className="truncate max-w-[200px] text-[#8b93a7]">
                      {selectedFile.name}
                    </span>
                    <button
                      onClick={handleReset}
                      className="text-[#ef4444] hover:underline"
                    >
                      Change File
                    </button>
                  </div>
                </div>

                {/* Extracted Face Photo Badge */}
                {faceImage && (
                  <div className="flex items-center gap-3.5 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/[0.06] p-3.5">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-[#22c55e]">
                      <img
                        src={faceImage}
                        alt="Extracted face"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 rounded-full bg-[#22c55e] p-0.5 text-black">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#86efac]">
                        Face Portrait Extracted ({((extractedData?.face_confidence || 0.9) * 100).toFixed(0)}% Match)
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#717a8e]">
                        Auto-oriented and landmark-aligned for high-accuracy recognition.
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Webcam Face Enrichment (Recommended for matching real appearance) */}
                {faceImage && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Camera size={16} className="text-[#a69eff]" />
                        <div>
                          <div className="text-xs font-semibold text-white">Live Camera Photo (Optional)</div>
                          <div className="text-[11px] text-[#717a8e]">
                            Captures your current look so lighting/hair changes don&apos;t cause &quot;unknown&quot;
                          </div>
                        </div>
                      </div>

                      {!isWebcamOpen && !liveFaceImage && (
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="rounded-xl bg-[#6d5dfc]/15 px-3 py-1.5 text-xs font-semibold text-[#a69eff] hover:bg-[#6d5dfc]/25 transition"
                        >
                          + Snap Webcam
                        </button>
                      )}
                    </div>

                    {/* Live Stream View */}
                    {isWebcamOpen && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-black">
                        <video
                          ref={webcamVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-44 w-full object-cover"
                        />
                        <div className="flex items-center justify-end gap-2 p-2 bg-[#0c101a]">
                          <button
                            type="button"
                            onClick={stopWebcam}
                            className="rounded-lg px-2.5 py-1 text-xs text-[#8a92a6] hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={captureWebcam}
                            className="rounded-lg bg-[#22c55e] px-3 py-1 text-xs font-bold text-black hover:bg-[#16a34a]"
                          >
                            Capture Photo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Captured Live Face Badge */}
                    {liveFaceImage && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/[0.05] p-2.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={liveFaceImage}
                            alt="Live face snapshot"
                            className="h-12 w-12 rounded-lg object-cover border border-[#22c55e]"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#86efac]">Live Face Linked</div>
                            <div className="text-[10px] text-[#717a8e]">Both ID Card + Live appearance registered</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLiveFaceImage(null)}
                          className="text-xs text-[#ef4444] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Editable Profile Fields */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="text-xs font-semibold text-[#aab0bf] uppercase tracking-wider">
                  Profile Information
                </div>
                {extractedData && (
                  <span className="flex items-center gap-1 text-[11px] text-[#6d5dfc]">
                    <Sparkles size={12} />
                    <span>Auto-scanned</span>
                  </span>
                )}
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="mb-1 text-xs font-medium text-[#9299aa]">
                    Full Name <span className="text-[#ef4444]">*</span>
                  </div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Pranav Sunil Gond"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-[#9299aa]">Role</div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.07] bg-[#111726] px-3 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher / Faculty</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-[#9299aa]">ID / Enrollment No.</div>
                    <input
                      value={enrollmentNo}
                      onChange={(e) => setEnrollmentNo(e.target.value)}
                      placeholder="e.g. PBE23054"
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-[#9299aa]">Department / Branch</div>
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Computer Science &amp; Engg"
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-[#9299aa]">Year / Semester</div>
                    <input
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g. First Year / 4th Year"
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-[#9299aa]">Contact / Phone Number</div>
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 9881733506"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
                  />
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="mt-5 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleConfirmEnrollment}
                disabled={submitting || analyzing || !fullName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-bold text-black shadow-lg shadow-[#22c55e]/25 transition hover:bg-[#34d399] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Enrolling Face &amp; Profile...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={17} />
                    <span>Complete Enrollment from ID Card</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MANUAL ENROLLMENT COMPONENT
// ============================================================

function ManualEnrollment() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form details
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [consentStatus, setConsentStatus] = useState(true);

  // Face Photo
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successPerson, setSuccessPerson] = useState<{
    id: number;
    name: string;
    role: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera helper
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start webcam helper
  const startWebcam = async () => {
    setCameraError("");
    try {
      stopWebcam();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera access error: ${err.message}`
          : "Webcam could not be accessed. You can upload an image file instead.",
      );
      setCameraActive(false);
    }
  };

  // When step 2 is activated, try opening webcam automatically
  useEffect(() => {
    if (step === 2 && !faceImage) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [step, faceImage]);

  // Capture frame from webcam
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setFaceImage(dataUrl);
    stopWebcam();
  };

  // Upload photo from disk
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file (JPG or PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFaceImage(reader.result);
        stopWebcam();
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setErrorMessage("Please enter a full name.");
      setStep(1);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      const created = await createPerson({
        full_name: fullName.trim(),
        role: role.toLowerCase().trim(),
        enrollment_no: enrollmentNo.trim() || undefined,
        year: year.trim() || undefined,
        branch: branch.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        face_image: faceImage || undefined,
        consent_status: consentStatus,
      });

      setSuccessPerson({
        id: created.id,
        name: created.full_name,
        role: created.role,
      });
      setStep(3);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Enrollment failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFullName("");
    setRole("student");
    setEnrollmentNo("");
    setYear("");
    setBranch("");
    setContactNumber("");
    setFaceImage(null);
    setSuccessPerson(null);
    setErrorMessage("");
    setStep(1);
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22c55e]/10 text-[#6ee7a0]">
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Manual Profile &amp; Webcam</h3>
            <p className="mt-0.5 text-xs text-[#6f778b]">
              Type details manually and snap a live webcam snapshot.
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => setStep(1)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              step === 1
                ? "bg-[#6d5dfc] text-white"
                : "bg-white/[0.04] text-[#8b93a7] hover:bg-white/[0.08]"
            }`}
          >
            1
          </button>
          <span className="text-[#4b5366]">/</span>
          <button
            onClick={() => {
              if (fullName.trim()) setStep(2);
            }}
            disabled={!fullName.trim()}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              step === 2
                ? "bg-[#6d5dfc] text-white"
                : "bg-white/[0.04] text-[#8b93a7] disabled:opacity-40"
            }`}
          >
            2
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-3 text-xs text-[#fca5a5]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Personal Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-[#9299aa]">
              Full Name <span className="text-[#ef4444]">*</span>
            </div>
            <input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrorMessage("");
              }}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/50"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-[#9299aa]">Role</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-white/[0.07] bg-[#111726] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6d5dfc]/50"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher / Faculty</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-[#9299aa]">
                Enrollment / ID No.
              </div>
              <input
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                placeholder="e.g. 0187CS211054"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/50"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-[#9299aa]">Department / Branch</div>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. Computer Science (CSE)"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/50"
              />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-[#9299aa]">Year / Semester</div>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 3rd Year"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/50"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-[#9299aa]">Contact Number</div>
            <input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/50"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentStatus}
              onChange={(e) => setConsentStatus(e.target.checked)}
              className="mt-0.5 accent-[#6d5dfc]"
            />
            <span className="text-xs leading-5 text-[#8c94a8]">
              Consent verified: I confirm this individual has consented to face recognition for campus verification.
            </span>
          </label>

          <button
            type="button"
            onClick={() => {
              if (!fullName.trim()) {
                setErrorMessage("Please enter a full name to continue.");
                return;
              }
              setErrorMessage("");
              setStep(2);
            }}
            disabled={!fullName.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6d5dfc]/25 transition hover:bg-[#7b6bff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Next: Face Photo Capture</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* STEP 2: Face Capture / Photo */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                stopWebcam();
                setStep(1);
              }}
              className="flex items-center gap-1.5 text-xs text-[#8b93a7] transition hover:text-white"
            >
              <ArrowLeft size={14} />
              <span>Back to Details</span>
            </button>

            <span className="text-xs text-[#6ee7a0] font-medium">
              Profile: {fullName} ({role})
            </span>
          </div>

          {faceImage ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/5 p-4 text-center">
              <div className="relative mb-3 h-48 w-48 overflow-hidden rounded-2xl border-2 border-[#22c55e] shadow-xl">
                <img
                  src={faceImage}
                  alt="Captured face"
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 right-2 rounded-full bg-[#22c55e] p-1 text-black shadow">
                  <Check size={14} strokeWidth={3} />
                </div>
              </div>

              <div className="text-xs font-semibold text-[#86efac]">
                Face Photo Ready
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFaceImage(null);
                    startWebcam();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs text-[#c5cbe0] transition hover:bg-white/[0.1]"
                >
                  <RefreshCw size={13} />
                  <span>Retake Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
              <div className="relative aspect-video flex items-center justify-center bg-[#0a0d14]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`}
                />

                {!cameraActive && (
                  <div className="p-6 text-center">
                    <Camera size={36} className="mx-auto mb-2 text-[#4b5366]" />
                    <div className="text-sm font-medium text-[#8b93a7]">
                      {cameraError || "Webcam is not active"}
                    </div>
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#6d5dfc] px-3.5 py-2 text-xs font-semibold text-white shadow"
                    >
                      <Camera size={14} />
                      <span>Start Webcam</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[#0c101a] p-3">
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-[#22c55e]/20 transition hover:bg-[#34d399]"
                  >
                    <Camera size={15} />
                    <span>Capture Snapshot</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-xs text-[#aab1c3] transition hover:bg-white/[0.08]"
                >
                  <ImageIcon size={14} />
                  <span>Upload File</span>
                </button>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-bold text-black shadow-lg shadow-[#22c55e]/25 transition hover:bg-[#34d399] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Saving &amp; Extracting Embeddings...</span>
                </>
              ) : (
                <>
                  <UserCheck size={17} />
                  <span>Complete Enrollment</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Success Confirmation */}
      {step === 3 && successPerson && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#4ade80] shadow-xl shadow-[#22c55e]/10">
            <CheckCircle2 size={36} />
          </div>

          <h4 className="text-xl font-bold text-white">Enrollment Successful!</h4>
          <p className="mt-1 text-sm text-[#8a92a6]">
            <span className="font-semibold text-white">{successPerson.name}</span> has been enrolled as a{" "}
            <span className="capitalize text-[#86efac]">{successPerson.role}</span>.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl bg-[#6d5dfc] px-5 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-[#7b6bff]"
            >
              + Enroll Another Person
            </button>
            <a
              href="/people"
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs text-[#bcc2d4] transition hover:bg-white/[0.07]"
            >
              View People Directory
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BULK PDF ENROLLMENT COMPONENT
// ============================================================

function BulkPDFEnrollment() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [records, setRecords] = useState<PDFImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState<number | null>(null);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    setRecords([]);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("PDF must be smaller than 20 MB.");
      return;
    }

    setSelectedFile(file);
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError("Select a PDF first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const result = await previewPeoplePDF(selectedFile);
      setRecords(result.records);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse PDF.");
    } finally {
      setUploading(false);
    }
  }

  const handleBulkImport = async () => {
    try {
      setImporting(true);
      setError("");
      let count = 0;
      for (const rec of records) {
        if (!rec.full_name) continue;
        try {
          await createPerson({
            full_name: rec.full_name,
            role: (rec.role || "student").toLowerCase(),
            enrollment_no: rec.enrollment_no || undefined,
            year: rec.year || undefined,
            branch: rec.branch || undefined,
            contact_number: rec.contact_number || undefined,
            consent_status: true,
          });
          count++;
        } catch {
          // ignore duplicate errors during bulk import
        }
      }
      setImportCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d5dfc]/10 text-[#9185ff]">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Bulk PDF Roster Import</h3>
            <p className="mt-0.5 text-xs text-[#6f778b]">
              Import multiple students or teachers from institution PDF rosters.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-3 text-xs text-[#fca5a5]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/10 p-3 text-xs text-[#86efac]">
          <Check size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={selectFile}
        className="hidden"
      />

      {!selectedFile ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="group flex min-h-[200px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] px-6 text-center transition hover:border-[#6d5dfc]/40 hover:bg-[#6d5dfc]/[0.025]"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6d5dfc]/10 text-[#9185ff] transition group-hover:scale-105">
            <Upload size={22} />
          </div>
          <div className="font-medium text-white">Upload student/teacher PDF</div>
          <div className="mt-1.5 text-xs text-[#626a7e]">Click to choose a PDF file (up to 20 MB)</div>
        </button>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef4444]/10 text-[#f87171]">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{selectedFile.name}</div>
              <div className="text-xs text-[#626a7e]">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setRecords([]);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#626a7e] hover:bg-white/[0.05] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={handlePreview}
            disabled={uploading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#7b6bff] disabled:opacity-50"
          >
            <FileText size={15} />
            <span>{uploading ? "Analyzing PDF..." : "Analyze PDF"}</span>
          </button>
        </div>
      )}

      {/* Detected Records Table */}
      {records.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
          <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
            <div className="text-sm font-semibold text-white">
              {records.length} Records Detected
            </div>
            {importCount !== null ? (
              <span className="text-xs text-[#86efac]">
                Successfully imported {importCount} records!
              </span>
            ) : (
              <button
                onClick={handleBulkImport}
                disabled={importing}
                className="rounded-xl bg-[#22c55e] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#34d399] disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import ${records.length} Records`}
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] text-[#717a8e] uppercase text-[10px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">ID / Enrollment</th>
                  <th className="p-3">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {records.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="p-3 text-[#555d70]">{i + 1}</td>
                    <td className="p-3 font-semibold text-white">{r.full_name || "—"}</td>
                    <td className="p-3 capitalize text-[#8a92a6]">{r.role}</td>
                    <td className="p-3 font-mono text-[#8a92a6]">{r.enrollment_no || "—"}</td>
                    <td className="p-3 text-[#8a92a6]">{r.branch || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
