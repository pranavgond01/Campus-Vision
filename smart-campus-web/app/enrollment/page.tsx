"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  FileText,
  Upload,
  Users,
  X,
} from "lucide-react";

import {
  PDFImportRecord,
  previewPeoplePDF,
} from "@/lib/api";

export default function EnrollmentPage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [
    records,
    setRecords,
  ] = useState<PDFImportRecord[]>([]);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  function selectFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");
    setRecords([]);

    if (
      file.type !==
        "application/pdf" &&
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      setError(
        "Please select a PDF file.",
      );

      return;
    }

    if (
      file.size >
      20 * 1024 * 1024
    ) {
      setError(
        "PDF must be smaller than 20 MB.",
      );

      return;
    }

    setSelectedFile(file);
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError(
        "Select a PDF first.",
      );

      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const result =
        await previewPeoplePDF(
          selectedFile,
        );

      setRecords(
        result.records,
      );

      setSuccess(
        result.message,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not parse PDF.",
      );
    } finally {
      setUploading(false);
    }
  }

  function removeFile() {
    setSelectedFile(null);
    setRecords([]);
    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
          Enrollment
        </div>

        <h2 className="text-3xl font-bold tracking-tight">
          Enroll People
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#747c90]">
          Add individual test profiles or
          import a structured student and
          teacher PDF for bulk enrollment.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#fca5a5]">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-4 text-sm text-[#a7e7b8]">
          <Check
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ManualEnrollment />

        <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d5dfc]/10 text-[#9185ff]">
                  <FileText
                    size={20}
                  />
                </div>

                <div>
                  <h3 className="font-semibold">
                    Bulk PDF Import
                  </h3>

                  <p className="mt-1 text-xs text-[#6f778b]">
                    Import multiple records
                    at once.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-full border border-[#6d5dfc]/15 bg-[#6d5dfc]/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a69eff]">
              Bulk
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={selectFile}
            className="hidden"
          />

          {!selectedFile ? (
            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="group flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] px-6 text-center transition hover:border-[#6d5dfc]/40 hover:bg-[#6d5dfc]/[0.025]"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6d5dfc]/10 text-[#9185ff] transition group-hover:scale-105">
                <Upload size={23} />
              </div>

              <div className="font-medium">
                Upload student/teacher PDF
              </div>

              <div className="mt-2 text-xs text-[#626a7e]">
                Click to choose a PDF
              </div>

              <div className="mt-4 text-[10px] text-[#50586b]">
                Maximum size: 20 MB
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ef4444]/10 text-[#f87171]">
                  <FileText
                    size={22}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {selectedFile.name}
                  </div>

                  <div className="mt-1 text-xs text-[#626a7e]">
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </div>
                </div>

                <button
                  onClick={removeFile}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#626a7e] transition hover:bg-white/[0.05] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <button
                onClick={handlePreview}
                disabled={uploading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6d5dfc]/20 transition hover:bg-[#7b6bff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText size={17} />

                {uploading
                  ? "Analyzing PDF..."
                  : "Analyze PDF"}
              </button>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <div className="mb-3 text-xs font-semibold text-[#aab0bf]">
              Supported fields
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#626a7e]">
              <span>
                • Full name
              </span>

              <span>
                • Role
              </span>

              <span>
                • Enrollment / ID
              </span>

              <span>
                • Year
              </span>

              <span>
                • Branch
              </span>

              <span>
                • Contact
              </span>
            </div>
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <PDFPreview
          records={records}
        />
      )}
    </div>
  );
}

function ManualEnrollment() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22c55e]/10 text-[#6ee7a0]">
            <Users size={20} />
          </div>

          <div>
            <h3 className="font-semibold">
              Manual Enrollment
            </h3>

            <p className="mt-1 text-xs text-[#6f778b]">
              Add one test profile.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <Field
          label="Full Name"
          placeholder="Test Student"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Enrollment / ID"
            placeholder="TEST-CSE-001"
          />

          <Field
            label="Role"
            placeholder="Student"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Year"
            placeholder="3rd Year"
          />

          <Field
            label="Branch"
            placeholder="CSE"
          />
        </div>

        <Field
          label="Contact Number"
          placeholder="0000000000"
        />

        <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <input
            type="checkbox"
            defaultChecked
            className="mt-0.5"
          />

          <span className="text-xs leading-5 text-[#747c90]">
            This is a consented test profile
            and may be used for face-verification
            testing in this local development
            environment.
          </span>
        </label>

        <button
          disabled
          className="mt-1 rounded-xl bg-[#22c55e]/10 px-4 py-3 text-sm font-semibold text-[#86efac] opacity-60"
        >
          Face Capture — Next Step
        </button>

        <p className="text-center text-[10px] text-[#50586b]">
          Webcam enrollment will be connected
          in the next step.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label>
      <div className="mb-2 text-xs font-medium text-[#9299aa]">
        {label}
      </div>

      <input
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none placeholder:text-[#4f5769] focus:border-[#6d5dfc]/40"
      />
    </label>
  );
}

function PDFPreview({
  records,
}: {
  records: PDFImportRecord[];
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
      <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] p-5 md:flex-row md:items-center">
        <div>
          <div className="font-semibold">
            Import Preview
          </div>

          <div className="mt-1 text-xs text-[#6f778b]">
            {records.length} records detected
          </div>
        </div>

        <div className="rounded-full bg-[#22c55e]/10 px-3 py-1.5 text-[10px] font-bold text-[#86efac]">
          READY FOR REVIEW
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.05] text-left text-[10px] uppercase tracking-wider text-[#626a7e]">
              <th className="px-5 py-4">
                #
              </th>

              <th className="px-5 py-4">
                Name
              </th>

              <th className="px-5 py-4">
                Role
              </th>

              <th className="px-5 py-4">
                Enrollment / ID
              </th>

              <th className="px-5 py-4">
                Year
              </th>

              <th className="px-5 py-4">
                Branch
              </th>

              <th className="px-5 py-4">
                Contact
              </th>

              <th className="px-5 py-4">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {records.map(
              (record, index) => (
                <tr
                  key={
                    record.import_index
                  }
                  className="border-b border-white/[0.04] hover:bg-white/[0.015]"
                >
                  <td className="px-5 py-4 text-xs text-[#626a7e]">
                    {index + 1}
                  </td>

                  <td className="px-5 py-4 text-sm font-medium">
                    {record.full_name ||
                      "Missing"}
                  </td>

                  <td className="px-5 py-4 text-sm capitalize text-[#aab0bf]">
                    {record.role}
                  </td>

                  <td className="px-5 py-4 font-mono text-xs text-[#8e96aa]">
                    {record.enrollment_no ||
                      "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-[#8e96aa]">
                    {record.year ||
                      "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-[#8e96aa]">
                    {record.branch ||
                      "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-[#8e96aa]">
                    {record.contact_number ||
                      "—"}
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22c55e]/10 px-2.5 py-1 text-[10px] font-bold text-[#86efac]">
                      <Check
                        size={11}
                      />

                      DETECTED
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col justify-between gap-4 border-t border-white/[0.07] p-5 md:flex-row md:items-center">
        <div className="text-xs text-[#626a7e]">
          Review the detected records before
          adding them to the local database.
        </div>

        <button
          disabled
          className="rounded-xl bg-[#6d5dfc]/10 px-5 py-2.5 text-sm font-semibold text-[#a69eff] opacity-60"
        >
          Import {records.length} Records
        </button>
      </div>
    </div>
  );
}