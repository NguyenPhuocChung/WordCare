
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  LoaderCircle,
  WandSparkles,
} from "lucide-react";
import "./FormatRequest.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Alignment = "left" | "center" | "right" | "justify";
type LineSpacing = "1.0" | "1.15" | "1.5" | "2.0";

type FormatRules = {
  fontFamily?: string;
  fontSizePt?: number;
  alignment?: Alignment;
  lineSpacing?: LineSpacing;
  firstLineIndentCm?: number;
  marginsCm?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
};

type Analysis = {
  rules: FormatRules;
  warnings: string[];
  unsupportedRequests: string[];
  requiresConfirmation: true;
};

type AnalyzeResponse = {
  success: boolean;
  message?: string;
  code?: string;
  analysis?: Analysis;
};

type FormatRequestProps = {
  file: File | null;
};

type BackendRules = {
  fontName?: string;
  fontSize?: number;
  alignment?: Alignment;
  lineSpacing?: number;
  firstLineIndentCm?: number;
  marginTopCm?: number;
  marginBottomCm?: number;
  marginLeftCm?: number;
  marginRightCm?: number;
};

const alignmentLabels: Record<Alignment, string> = {
  left: "Căn trái",
  center: "Căn giữa",
  right: "Căn phải",
  justify: "Căn đều hai bên",
};

function RuleRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="format-rule-row">
      <label className="format-rule-label">{label}</label>
      <div className="format-rule-control">{children}</div>
    </div>
  );
}

function AppNumberInput({
  value,
  min,
  max,
  step = 0.5,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => {
        const rawValue = event.target.value;
        const next = Number(rawValue);

        if (
          rawValue !== "" &&
          Number.isFinite(next) &&
          next >= min &&
          next <= max
        ) {
          onChange(next);
        }
      }}
    />
  );
}

function convertRules(rules: FormatRules): BackendRules {
  return {
    ...(rules.fontFamily !== undefined && {
      fontName: rules.fontFamily,
    }),
    ...(rules.fontSizePt !== undefined && {
      fontSize: rules.fontSizePt,
    }),
    ...(rules.alignment !== undefined && {
      alignment: rules.alignment,
    }),
    ...(rules.lineSpacing !== undefined && {
      lineSpacing: Number(rules.lineSpacing),
    }),
    ...(rules.firstLineIndentCm !== undefined && {
      firstLineIndentCm: rules.firstLineIndentCm,
    }),
    ...(rules.marginsCm?.top !== undefined && {
      marginTopCm: rules.marginsCm.top,
    }),
    ...(rules.marginsCm?.bottom !== undefined && {
      marginBottomCm: rules.marginsCm.bottom,
    }),
    ...(rules.marginsCm?.left !== undefined && {
      marginLeftCm: rules.marginsCm.left,
    }),
    ...(rules.marginsCm?.right !== undefined && {
      marginRightCm: rules.marginsCm.right,
    }),
  };
}

async function getErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (text) {
    try {
      const data = JSON.parse(text) as {
        message?: string;
        code?: string;
      };

      if (data.message) {
        return data.code
          ? `${data.message} (Mã lỗi: ${data.code})`
          : data.message;
      }
    } catch {
      // Response không phải JSON; dùng thông báo HTTP bên dưới.
    }
  }

  return `Không thể xử lý tài liệu (HTTP ${response.status}).`;
}

export default function FormatRequest({ file }: FormatRequestProps) {
  const [instructions, setInstructions] = useState(
    "Times New Roman, cỡ chữ 13 pt, căn đều hai bên, giãn dòng 1.5, lề trái 3 cm, lề phải 2 cm, lề trên 2 cm, lề dưới 2 cm, thụt đầu dòng 1 cm",
  );

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState("");

  // Khi đổi tài liệu, yêu cầu xác nhận quy tắc lại.
  useEffect(() => {
    setConfirmed(false);
    setDownloadError("");
    setDownloadSuccess("");
  }, [file]);

  async function analyzeInstructions() {
    if (!instructions.trim()) {
      setError("Vui lòng nhập yêu cầu định dạng.");
      return;
    }

    setLoading(true);
    setError("");
    setDownloadError("");
    setDownloadSuccess("");
    setAnalysis(null);
    setConfirmed(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/format-rules/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ instructions }),
        },
      );

      const data = (await response.json().catch(() => null)) as
        | AnalyzeResponse
        | null;

      if (!response.ok || !data?.success || !data.analysis) {
        setError(
          data?.message ??
            `Không thể phân tích yêu cầu (HTTP ${response.status}).`,
        );
        return;
      }

      setAnalysis(data.analysis);
    } catch {
      setError(
        "Không kết nối được máy chủ phân tích. Hãy kiểm tra backend.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateRule<K extends keyof FormatRules>(
    key: K,
    value: FormatRules[K],
  ) {
    setAnalysis((current) => {
      if (!current) return current;

      return {
        ...current,
        rules: {
          ...current.rules,
          [key]: value,
        },
      };
    });

    setConfirmed(false);
    setDownloadError("");
    setDownloadSuccess("");
  }

  function updateMargin(
    key: "top" | "bottom" | "left" | "right",
    value: number,
  ) {
    setAnalysis((current) => {
      if (!current) return current;

      return {
        ...current,
        rules: {
          ...current.rules,
          marginsCm: {
            ...current.rules.marginsCm,
            [key]: value,
          },
        },
      };
    });

    setConfirmed(false);
    setDownloadError("");
    setDownloadSuccess("");
  }

  function confirmRules() {
    if (!analysis || Object.keys(analysis.rules).length === 0) {
      setError("Chưa có quy tắc hợp lệ để xác nhận.");
      return;
    }

    setError("");
    setDownloadError("");
    setDownloadSuccess("");
    setConfirmed(true);
  }

  async function formatDocument() {
    if (formatting) return;

    if (!file) {
      setDownloadError("Vui lòng chọn file DOCX ở khu vực tải lên.");
      return;
    }

    if (!analysis || !confirmed) {
      setDownloadError("Vui lòng phân tích và xác nhận quy tắc trước.");
      return;
    }

    const backendRules = convertRules(analysis.rules);

    if (Object.keys(backendRules).length === 0) {
      setDownloadError("Không có quy tắc định dạng để gửi đến máy chủ.");
      return;
    }

    setFormatting(true);
    setDownloadError("");
    setDownloadSuccess("");

    let downloadUrl: string | null = null;

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch(
        `${API_BASE_URL}/api/documents/format`,
        {
          method: "POST",
          headers: {
            "X-WordCare-Rules": JSON.stringify(backendRules),
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("Máy chủ trả về file rỗng.");
      }

      downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "wordcare-formatted.docx";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setDownloadSuccess(
        "Đã nhận file kết quả từ máy chủ. Hãy mở file tải xuống bằng Word để kiểm tra định dạng.",
      );
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi khi định dạng tài liệu.",
      );
    } finally {
      if (downloadUrl) {
        // Chờ trình duyệt bắt đầu tải file rồi mới thu hồi URL.
        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl!);
        }, 1000);
      }

      setFormatting(false);
    }
  }

  const rules = analysis?.rules;

  return (
    <section className="format-request">
      <div className="format-section-heading">
        <span className="format-section-icon">
          <WandSparkles size={22} />
        </span>

        <div>
          <h2>Mô tả định dạng bạn muốn</h2>
          <p>
            Viết yêu cầu bằng tiếng Việt. WordCare sẽ chuyển
            các phần nhận dạng được thành quy tắc để bạn xem lại.
          </p>
        </div>
      </div>

      <label
        className="format-textarea-label"
        htmlFor="format-instructions"
      >
        Yêu cầu định dạng
      </label>

      <textarea
        id="format-instructions"
        className="format-textarea"
        value={instructions}
        maxLength={5000}
        onChange={(event) => {
          setInstructions(event.target.value);
          setConfirmed(false);
          setAnalysis(null);
          setError("");
          setDownloadError("");
          setDownloadSuccess("");
        }}
        placeholder="Ví dụ: dùng Times New Roman, cỡ chữ 13 pt, căn đều hai bên..."
        rows={5}
        disabled={loading || formatting}
      />

      <div className="format-input-footer">
        <span>
          Viết rõ tên thuộc tính và giá trị để dễ nhận dạng.
        </span>
        <span>{instructions.length}/5000</span>
      </div>

      <button
        className="format-analyze-button"
        type="button"
        onClick={analyzeInstructions}
        disabled={loading || formatting || !instructions.trim()}
      >
        {loading ? (
          <LoaderCircle className="format-spinner" size={18} />
        ) : (
          <WandSparkles size={18} />
        )}

        {loading ? "Đang phân tích..." : "Phân tích yêu cầu"}
      </button>

      {error && (
        <div className="format-error" role="alert">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="format-analysis">
          <div className="format-analysis-title">
            <div>
              <h3>Quy tắc định dạng dự kiến</h3>
              <p>Kiểm tra và chỉnh sửa trước khi xác nhận.</p>
            </div>

            <span className="format-pending-badge">
              {confirmed ? "Đã xác nhận" : "Chờ xác nhận"}
            </span>
          </div>

          {rules && Object.keys(rules).length > 0 ? (
            <div className="format-rules-list">
              {rules.fontFamily !== undefined && (
                <RuleRow label="Phông chữ">
                  <input
                    type="text"
                    maxLength={100}
                    value={rules.fontFamily}
                    onChange={(event) =>
                      updateRule("fontFamily", event.target.value)
                    }
                  />
                </RuleRow>
              )}

              {rules.fontSizePt !== undefined && (
                <RuleRow label="Cỡ chữ">
                  <div className="format-number-with-unit">
                    <AppNumberInput
                      value={rules.fontSizePt}
                      min={8}
                      max={72}
                      step={0.5}
                      onChange={(value) =>
                        updateRule("fontSizePt", value)
                      }
                    />
                    <span>pt</span>
                  </div>
                </RuleRow>
              )}

              {rules.alignment !== undefined && (
                <RuleRow label="Căn đoạn">
                  <select
                    value={rules.alignment}
                    onChange={(event) =>
                      updateRule(
                        "alignment",
                        event.target.value as Alignment,
                      )
                    }
                  >
                    {Object.entries(alignmentLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </RuleRow>
              )}

              {rules.lineSpacing !== undefined && (
                <RuleRow label="Giãn dòng">
                  <select
                    value={rules.lineSpacing}
                    onChange={(event) =>
                      updateRule(
                        "lineSpacing",
                        event.target.value as LineSpacing,
                      )
                    }
                  >
                    <option value="1.0">1.0 dòng</option>
                    <option value="1.15">1.15 dòng</option>
                    <option value="1.5">1.5 dòng</option>
                    <option value="2.0">2.0 dòng</option>
                  </select>
                </RuleRow>
              )}

              {rules.firstLineIndentCm !== undefined && (
                <RuleRow label="Thụt đầu dòng">
                  <div className="format-number-with-unit">
                    <AppNumberInput
                      value={rules.firstLineIndentCm}
                      min={0}
                      max={5}
                      step={0.25}
                      onChange={(value) =>
                        updateRule("firstLineIndentCm", value)
                      }
                    />
                    <span>cm</span>
                  </div>
                </RuleRow>
              )}

              {rules.marginsCm && (
                <>
                  {(
                    [
                      ["top", "Lề trên"],
                      ["bottom", "Lề dưới"],
                      ["left", "Lề trái"],
                      ["right", "Lề phải"],
                    ] as const
                  ).map(([key, label]) =>
                    rules.marginsCm?.[key] === undefined ? null : (
                      <RuleRow key={key} label={label}>
                        <div className="format-number-with-unit">
                          <AppNumberInput
                            value={rules.marginsCm[key]!}
                            min={0}
                            max={10}
                            step={0.25}
                            onChange={(value) =>
                              updateMargin(key, value)
                            }
                          />
                          <span>cm</span>
                        </div>
                      </RuleRow>
                    ),
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="format-empty-rules">
              Chưa nhận dạng được quy tắc nào. Hãy viết yêu cầu
              cụ thể hơn rồi phân tích lại.
            </div>
          )}

          {analysis.warnings.length > 0 && (
            <div className="format-warning">
              <AlertTriangle size={19} />
              <div>
                <strong>Cần lưu ý</strong>
                <ul>
                  {analysis.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {analysis.unsupportedRequests.length > 0 && (
            <div className="format-unsupported">
              <strong>Yêu cầu chưa được hỗ trợ</strong>
              <ul>
                {analysis.unsupportedRequests.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="format-confirm-button"
            type="button"
            onClick={confirmRules}
            disabled={
              !rules ||
              Object.keys(rules).length === 0 ||
              loading ||
              formatting
            }
          >
            <ClipboardCheck size={18} />
            Xác nhận quy tắc
          </button>

          {confirmed && (
            <div className="format-confirmed" role="status">
              <CheckCircle2 size={20} />
              <div>
                <strong>Đã xác nhận các quy tắc.</strong>
                <p>
                  Quy tắc đã được xác nhận. Nhấn nút bên dưới
                  để gửi tài liệu đến máy chủ định dạng.
                </p>
              </div>
            </div>
          )}

          {confirmed && (
            <div className="format-download-area">
              <button
                className="format-confirm-button"
                type="button"
                onClick={formatDocument}
                disabled={!file || formatting || loading}
              >
                {formatting ? (
                  <LoaderCircle
                    className="format-spinner"
                    size={18}
                  />
                ) : (
                  <Download size={18} />
                )}

                {!file
                  ? "Vui lòng chọn file Word"
                  : formatting
                    ? "Đang định dạng tài liệu..."
                    : "Định dạng và tải file Word"}
              </button>

              {!file && (
                <p>
                  Hãy chọn file DOCX ở khu vực tải tài liệu
                  phía trên.
                </p>
              )}

              {downloadError && (
                <div className="format-error" role="alert">
                  <AlertTriangle size={19} />
                  <span>{downloadError}</span>
                </div>
              )}

              {downloadSuccess && (
                <div className="format-confirmed" role="status">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Đã xử lý xong</strong>
                    <p>{downloadSuccess}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
