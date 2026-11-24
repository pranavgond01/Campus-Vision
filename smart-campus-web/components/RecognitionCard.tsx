import { RecognitionResult } from "@/lib/api";

interface RecognitionCardProps {
  result: RecognitionResult;
}

export default function RecognitionCard({ result }: RecognitionCardProps) {
  const matched =
    result.status?.toUpperCase() === "MATCHED" ||
    result.status?.toLowerCase() === "recognized";

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        matched
          ? "border-[#22c55e]/15 bg-[#22c55e]/[0.04]"
          : "border-[#ef4444]/15 bg-[#ef4444]/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">
            {result.full_name || "Unknown Person"}
          </div>

          {matched ? (
            <>
              <div className="mt-1 text-xs capitalize text-[#8b93a7]">
                {result.role || "student"}
              </div>

              <div className="mt-3 space-y-1 text-xs text-[#747c90]">
                <div>
                  Enrollment:{" "}
                  <span className="text-[#d7dbe5]">
                    {result.enrollment_no || "—"}
                  </span>
                </div>

                {result.branch && (
                  <div>
                    Branch:{" "}
                    <span className="text-[#d7dbe5]">{result.branch}</span>
                  </div>
                )}

                <div>
                  Confidence:{" "}
                  <span className="text-[#d7dbe5]">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-2 text-xs text-[#747c90]">
              Confidence:{" "}
              <span className="text-[#d7dbe5]">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            matched
              ? "bg-[#22c55e]/10 text-[#86efac]"
              : "bg-[#ef4444]/10 text-[#fca5a5]"
          }`}
        >
          {matched ? "MATCHED" : "UNKNOWN"}
        </span>
      </div>
    </div>
  );
}
