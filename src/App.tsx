
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  FileCheck2,
  FileUp,
  FileText,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  X,
  UploadCloud,
  RotateCcw,
} from "lucide-react";
import "./App.css";
import FormatRequest from "./FormatRequest";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ValidationResult = {
  success: boolean;
  code?: string;
  message: string;
  file?: {
    originalName: string;
    sizeBytes: number;
    sizeMB: number;
  };
};

type ViewState =
  | "idle"
  | "ready"
  | "uploading"
  | "success"
  | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function resetResult() {
    setResult(null);
    setErrorMessage("");
    setViewState("idle");
  }

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;

    if (viewState === "uploading") return;

    resetResult();

    if (!nextFile.name.toLowerCase().endsWith(".docx")) {
      setFile(null);
      setViewState("error");
      setErrorMessage("Vui lòng chọn file có phần mở rộng .docx.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (nextFile.size === 0) {
      setFile(null);
      setViewState("error");
      setErrorMessage("File đang trống. Hãy chọn tài liệu khác.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setViewState("error");
      setErrorMessage("File vượt giới hạn 10 MB. Hãy chọn file nhỏ hơn.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(nextFile);
    setViewState("ready");

    // Cho phép chọn lại chính file đó nếu cần.
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (viewState !== "uploading") setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (viewState === "uploading") return;

    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function validateFile() {
    if (!file || viewState === "uploading") return;

    setViewState("uploading");
    setResult(null);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/documents/validate`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = (await response.json().catch(() => null)) as
        | ValidationResult
        | null;

      if (!response.ok) {
        setViewState("error");
        setErrorMessage(
          data?.message ??
          `Không thể kiểm tra file (HTTP ${response.status}).`,
        );
        setResult(data);
        return;
      }

      if (!data?.success) {
        setViewState("error");
        setErrorMessage(
          data?.message ?? "Máy chủ không xác nhận được file.",
        );
        setResult(data);
        return;
      }

      setResult(data);
      setViewState("success");
    } catch {
      setViewState("error");
      setErrorMessage(
        "Không kết nối được máy chủ. Hãy kiểm tra API tại localhost:3000.",
      );
    }
  }

  function removeFile() {
    if (viewState === "uploading") return;

    setFile(null);
    resetResult();

    if (inputRef.current) inputRef.current.value = "";
  }

  function selectAnotherFile() {
    setFile(null);
    resetResult();
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }

  const isUploading = viewState === "uploading";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="WordCare trang chủ"
          onClick={(event) => {
            event.preventDefault();
            removeFile();
          }}
        >
          <span className="brand-mark">
            <FileCheck2 size={25} strokeWidth={2.4} />
          </span>
          <span className="brand-name">WordCare</span>
        </a>

        <span className="topbar-label">
          <ShieldCheck size={16} />
          Kiểm tra tài liệu an toàn
        </span>
      </header>

      <section className="hero">
        <span className="eyebrow">
          <span className="eyebrow-dot" />
          TRỢ LÝ TÀI LIỆU WORD
        </span>

        <h1>
          Tài liệu chuẩn chỉnh,
          <br />
          <span>chỉ bắt đầu từ một file.</span>
        </h1>

        <p className="hero-description">
          Tải lên tài liệu Word để WordCare kiểm tra cấu trúc
          DOCX trước khi chúng ta định dạng tài liệu ở bước tiếp theo.
        </p>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <h2>Kiểm tra tài liệu</h2>
            <p>Chọn file DOCX từ máy tính của bạn.</p>
          </div>
          <span className="format-badge">.DOCX</span>
        </div>

        <div
          className={`dropzone ${isDragging ? "dropzone-active" : ""} ${file ? "dropzone-has-file" : ""
            } ${isUploading ? "dropzone-disabled" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="region"
          aria-label="Khu vực chọn hoặc kéo thả file DOCX"
        >
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".docx"
            onChange={handleInputChange}
            disabled={isUploading}
            aria-label="Chọn file DOCX"
          />

          {file ? (
            <div className="selected-file">
              <div className="file-icon">
                <FileText size={29} />
              </div>

              <div className="file-details">
                <p className="file-name" title={file.name}>
                  {file.name}
                </p>
                <p className="file-size">
                  {formatBytes(file.size)} · DOCX
                </p>
              </div>

              {!isUploading && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={removeFile}
                  aria-label="Bỏ chọn file"
                >
                  <X size={19} />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="upload-icon">
                <UploadCloud size={31} strokeWidth={1.8} />
              </div>

              <h3>Kéo thả tài liệu vào đây</h3>
              <p className="dropzone-description">
                Hoặc chọn file từ thiết bị của bạn
              </p>

              <button
                className="button button-secondary"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                <FileUp size={17} />
                Chọn file DOCX
              </button>
            </>
          )}
        </div>

        <div className="upload-hints">
          <span>
            <ShieldCheck size={16} />
            Giới hạn 10 MB
          </span>
          <span>
            <FileCheck2 size={16} />
            Chỉ nhận .docx
          </span>
        </div>

        {file && viewState === "ready" && (
          <button
            className="button button-primary full-width"
            type="button"
            onClick={validateFile}
          >
            <ShieldCheck size={18} />
            Kiểm tra tài liệu
          </button>
        )}

        {isUploading && (
          <div className="upload-progress" role="status" aria-live="polite">
            <LoaderCircle className="spinner" size={20} />
            <div>
              <strong>Đang kiểm tra tài liệu...</strong>
              <p>Đang gửi file và xác thực cấu trúc DOCX.</p>
            </div>
          </div>
        )}

        {viewState === "success" && result && (
          <div className="result-panel result-success" role="status">
            <div className="result-icon">
              <CheckCircle2 size={23} />
            </div>
            <div className="result-content">
              <h3>Kiểm tra thành công</h3>
              <p>{result.message}</p>

              {result.file && (
                <dl className="result-metadata">
                  <div>
                    <dt>Tên file</dt>
                    <dd>{result.file.originalName}</dd>
                  </div>
                  <div>
                    <dt>Dung lượng</dt>
                    <dd>{formatBytes(result.file.sizeBytes)}</dd>
                  </div>
                </dl>
              )}

              <p className="result-note">
                File đã vượt qua bước xác thực ban đầu. Điều này
                không đồng nghĩa với việc file đã được kiểm tra
                mã độc hoặc định dạng hoàn chỉnh.
              </p>

              <button
                className="button button-secondary result-action"
                type="button"
                onClick={selectAnotherFile}
              >
                <RotateCcw size={16} />
                Kiểm tra file khác
              </button>
            </div>
          </div>
        )}

        {viewState === "error" && (
          <div className="result-panel result-error" role="alert">
            <div className="result-icon">
              <AlertCircle size={23} />
            </div>
            <div className="result-content">
              <h3>Chưa thể kiểm tra file</h3>
              <p>{errorMessage}</p>
              {result?.code && (
                <p className="error-code">Mã lỗi: {result.code}</p>
              )}

              <div className="result-actions">
                {file && (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={validateFile}
                  >
                    Thử lại
                  </button>
                )}

                <button
                  className="button button-secondary"
                  type="button"
                  onClick={selectAnotherFile}
                >
                  Chọn file khác
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      <FormatRequest file={file} />
            <section className="steps-section">
        <h2>Ba bước đơn giản</h2>

        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <FileUp size={22} />
            <h3>Tải tài liệu</h3>
            <p>Chọn file Word định dạng .docx từ thiết bị.</p>
          </article>

          <article className="step-card">
            <span className="step-number">02</span>
            <ShieldCheck size={22} />
            <h3>Xác thực cấu trúc</h3>
            <p>Máy chủ kiểm tra ZIP, thành phần DOCX và giới hạn.</p>
          </article>

          <article className="step-card">
            <span className="step-number">03</span>
            <CheckCircle2 size={22} />
            <h3>Nhận kết quả</h3>
            <p>Hiển thị trạng thái và hướng xử lý khi có lỗi.</p>
          </article>
        </div>
      </section>

      <footer className="footer">
        <a className="footer-brand" href="#top">
          <FileCheck2 size={17} />
          WordCare
        </a>
        <p>Tài liệu của bạn, quy trình rõ ràng hơn.</p>
      </footer>
    </main>
  );
}

export default App;
