
import { useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Download,
    FileText,
    LoaderCircle,
    RotateCcw,
    WandSparkles,
} from "lucide-react";
import "./FormatRequest.css";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Alignment = "left" | "center" | "right" | "justify";
type PageAlignment = "left" | "center" | "right";
type PagePosition = "header" | "footer";
type HeadingLevel = 1 | 2 | 3;

type FormatRules = {
    fontName?: string;
    fontSize?: number;
    alignment?: Alignment;
    lineSpacing?: number;
    spaceBeforePt?: number;
    spaceAfterPt?: number;
    firstLineIndentCm?: number;
    marginTopCm?: number;
    marginBottomCm?: number;
    marginLeftCm?: number;
    marginRightCm?: number;
    pageNumbering?: {
        enabled: boolean;
        position?: PagePosition;
        alignment?: PageAlignment;
        startAt?: number;
        hideFirstPage?: boolean;
    };
    headingNumbering?: {
        enabled: boolean;
        maxLevel?: HeadingLevel;
    };
    tableOfContents?: {
        enabled: boolean;
        maxLevel?: HeadingLevel;
        title?: string;
    };
};

type FormatRequestProps = {
    file: File | null;
};

const alignmentLabels: Record<Alignment, string> = {
    left: "Căn trái",
    center: "Căn giữa",
    right: "Căn phải",
    justify: "Căn đều hai bên",
};

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
            // Phản hồi không phải JSON.
        }
    }

    return `Không thể xử lý tài liệu (HTTP ${response.status}).`;
}

function NumberField({
    label,
    value,
    min,
    max,
    step = 0.5,
    unit,
    onChange,
}: {
    label: string;
    value: number | undefined;
    min: number;
    max: number;
    step?: number;
    unit: string;
    onChange: (value: number | undefined) => void;
}) {
    return (
        <div className="wc-field">
            <label>{label}</label>
            <div className="wc-number-control">
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value ?? ""}
                    placeholder="Giữ nguyên"
                    onChange={(event) => {
                        const raw = event.target.value;

                        if (raw === "") {
                            onChange(undefined);
                            return;
                        }

                        const next = Number(raw);

                        if (
                            Number.isFinite(next) &&
                            next >= min &&
                            next <= max
                        ) {
                            onChange(next);
                        }
                    }}
                />
                <span>{unit}</span>
            </div>
        </div>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string | number | undefined;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string | undefined) => void;
}) {
    return (
        <div className="wc-field">
            <label>{label}</label>
            <select
                value={value === undefined ? "" : String(value)}
                onChange={(event) =>
                    onChange(event.target.value || undefined)
                }
            >
                <option value="">Giữ nguyên tài liệu gốc</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function FeatureToggle({
    title,
    description,
    checked,
    onChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="wc-feature-toggle">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span>
                <strong>{title}</strong>
                <small>{description}</small>
            </span>
        </label>
    );
}

export default function FormatRequest({ file }: FormatRequestProps) {
    const [rules, setRules] = useState<FormatRules>({});
    const [confirmed, setConfirmed] = useState(false);
    const [formatting, setFormatting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        setRules({});
        setConfirmed(false);
        setError("");
        setSuccess("");
    }, [file]);

    function updateRule<K extends keyof FormatRules>(
        key: K,
        value: FormatRules[K],
    ) {
        setRules((current) => {
            const next = { ...current };

            if (value === undefined || value === "") {
                delete next[key];
            } else {
                next[key] = value;
            }

            return next;
        });

        setConfirmed(false);
        setError("");
        setSuccess("");
    }

    function updatePageNumbering(
        enabled: boolean,
        patch: Partial<NonNullable<FormatRules["pageNumbering"]>> = {},
    ) {
        setRules((current) => {
            const next = { ...current };

            if (!enabled) {
                delete next.pageNumbering;
            } else {
                next.pageNumbering = {
                    enabled: true,
                    position: "footer",
                    alignment: "center",
                    ...current.pageNumbering,
                    ...patch,
                };
            }

            return next;
        });

        setConfirmed(false);
        setError("");
        setSuccess("");
    }

    function updateHeadingNumbering(
        enabled: boolean,
        patch: Partial<NonNullable<FormatRules["headingNumbering"]>> = {},
    ) {
        setRules((current) => {
            const next = { ...current };

            if (!enabled) {
                delete next.headingNumbering;
            } else {
                next.headingNumbering = {
                    enabled: true,
                    maxLevel: 3,
                    ...current.headingNumbering,
                    ...patch,
                };
            }

            return next;
        });

        setConfirmed(false);
        setError("");
        setSuccess("");
    }

    function updateTableOfContents(
        enabled: boolean,
        patch: Partial<NonNullable<FormatRules["tableOfContents"]>> = {},
    ) {
        setRules((current) => {
            const next = { ...current };

            if (!enabled) {
                delete next.tableOfContents;
            } else {
                next.tableOfContents = {
                    enabled: true,
                    maxLevel: 3,
                    ...current.tableOfContents,
                    ...patch,
                };
            }

            return next;
        });

        setConfirmed(false);
        setError("");
        setSuccess("");
    }

    function resetRules() {
        setRules({});
        setConfirmed(false);
        setError("");
        setSuccess("");
    }

    function confirmRules() {
        if (Object.keys(rules).length === 0) {
            setError("Hãy chọn ít nhất một thuộc tính cần định dạng.");
            return;
        }

        setError("");
        setSuccess("");
        setConfirmed(true);
    }

    async function formatDocument() {
        if (!file) {
            setError("Vui lòng chọn file DOCX ở khu vực tải lên.");
            return;
        }

        if (!confirmed) {
            setError("Vui lòng kiểm tra và xác nhận quy tắc trước.");
            return;
        }

        if (Object.keys(rules).length === 0) {
            setError("Không có quy tắc định dạng để gửi.");
            return;
        }

        setFormatting(true);
        setError("");
        setSuccess("");

        let downloadUrl: string | null = null;

        try {
            const formData = new FormData();
            formData.append("file", file, file.name);
            formData.append("rules", JSON.stringify(rules));

            const response = await fetch(
                `${API_BASE_URL}/api/documents/format`,
                {
                    method: "POST",
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
            link.download =
                file.name.replace(/\.docx$/i, "") + "-wordcare.docx";
            link.style.display = "none";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setSuccess(
                "Đã nhận file từ máy chủ. Hãy mở bằng Microsoft Word để kiểm tra kết quả.",
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Đã xảy ra lỗi khi định dạng tài liệu.",
            );
        } finally {
            if (downloadUrl) {
                window.setTimeout(() => {
                    URL.revokeObjectURL(downloadUrl!);
                }, 1000);
            }

            setFormatting(false);
        }
    }

    const selectedCount = Object.keys(rules).length;

    return (
        <section className="wc-format">
            <header className="wc-heading">
                <div className="wc-heading-icon">
                    <WandSparkles size={23} />
                </div>
                <div>
                    <p className="wc-eyebrow">WORDCARE · DOCX TOOLS</p>
                    <h2>Định dạng tài liệu Word</h2>
                    <p className="wc-description">
                        Chọn thuộc tính bạn muốn thay đổi. Các mục không được
                        chọn sẽ được giữ nguyên theo tài liệu gốc.
                    </p>
                </div>
            </header>

            <div className="wc-file-status">
                <FileText size={21} />
                <div className="wc-file-info">
                    <strong>{file ? file.name : "Chưa chọn tài liệu"}</strong>
                    <span>
                        {file
                            ? `${(file.size / 1024).toFixed(1)} KB · ${file.name.toLowerCase().endsWith(".docx")
                                ? "Tệp DOCX"
                                : "Hãy chọn tệp DOCX"
                            }`
                            : "Chọn file Word tại khu vực tải lên phía trên."}
                    </span>
                </div>
                {file && file.name.toLowerCase().endsWith(".docx") && (
                    <CheckCircle2 className="wc-file-check" size={20} />
                )}
            </div>

            <div className="wc-section">
                <div className="wc-section-title">
                    <span className="wc-step">01</span>
                    <div>
                        <h3>Chữ và đoạn văn</h3>
                        <p>Chỉ thay đổi các thuộc tính bạn chọn.</p>
                    </div>
                </div>

                <div className="wc-fields-grid">
                    <div className="wc-field">
                        <label>Phông chữ</label>
                        <select
                            value={rules.fontName ?? ""}
                            onChange={(event) =>
                                updateRule("fontName", event.target.value || undefined)
                            }
                        >
                            <option value="">Giữ nguyên tài liệu gốc</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Arial">Arial</option>
                            <option value="Calibri">Calibri</option>
                            <option value="Tahoma">Tahoma</option>
                        </select>
                    </div>

                    <NumberField
                        label="Cỡ chữ"
                        value={rules.fontSize}
                        min={6}
                        max={96}
                        step={1}
                        unit="pt"
                        onChange={(value) => updateRule("fontSize", value)}
                    />

                    <SelectField
                        label="Căn đoạn"
                        value={rules.alignment}
                        options={Object.entries(alignmentLabels).map(
                            ([value, label]) => ({ value, label }),
                        )}
                        onChange={(value) =>
                            updateRule("alignment", value as Alignment | undefined)
                        }
                    />

                    <SelectField
                        label="Giãn dòng"
                        value={rules.lineSpacing}
                        options={[
                            { value: "1", label: "1.0 dòng" },
                            { value: "1.15", label: "1.15 dòng" },
                            { value: "1.5", label: "1.5 dòng" },
                            { value: "2", label: "2.0 dòng" },
                        ]}
                        onChange={(value) =>
                            updateRule(
                                "lineSpacing",
                                value === undefined ? undefined : Number(value),
                            )
                        }
                    />

                    <NumberField
                        label="Khoảng cách Before"
                        value={rules.spaceBeforePt}
                        min={0}
                        max={1584}
                        step={1}
                        unit="pt"
                        onChange={(value) => updateRule("spaceBeforePt", value)}
                    />

                    <NumberField
                        label="Khoảng cách After"
                        value={rules.spaceAfterPt}
                        min={0}
                        max={1584}
                        step={1}
                        unit="pt"
                        onChange={(value) => updateRule("spaceAfterPt", value)}
                    />

                    <NumberField
                        label="Thụt đầu dòng"
                        value={rules.firstLineIndentCm}
                        min={0}
                        max={10}
                        step={0.25}
                        unit="cm"
                        onChange={(value) =>
                            updateRule("firstLineIndentCm", value)
                        }
                    />
                </div>
            </div>

            <div className="wc-section">
                <div className="wc-section-title">
                    <span className="wc-step">02</span>
                    <div>
                        <h3>Lề trang</h3>
                        <p>Đơn vị centimet (cm).</p>
                    </div>
                </div>

                <div className="wc-fields-grid wc-margin-grid">
                    <NumberField
                        label="Lề trên"
                        value={rules.marginTopCm}
                        min={0}
                        max={10}
                        step={0.25}
                        unit="cm"
                        onChange={(value) => updateRule("marginTopCm", value)}
                    />
                    <NumberField
                        label="Lề dưới"
                        value={rules.marginBottomCm}
                        min={0}
                        max={10}
                        step={0.25}
                        unit="cm"
                        onChange={(value) => updateRule("marginBottomCm", value)}
                    />
                    <NumberField
                        label="Lề trái"
                        value={rules.marginLeftCm}
                        min={0}
                        max={10}
                        step={0.25}
                        unit="cm"
                        onChange={(value) => updateRule("marginLeftCm", value)}
                    />
                    <NumberField
                        label="Lề phải"
                        value={rules.marginRightCm}
                        min={0}
                        max={10}
                        step={0.25}
                        unit="cm"
                        onChange={(value) => updateRule("marginRightCm", value)}
                    />
                </div>
            </div>

            <div className="wc-section">
                <div className="wc-section-title">
                    <span className="wc-step">03</span>
                    <div>
                        <h3>Đánh số trang</h3>
                        <p>Chọn vị trí và cách hiển thị số trang.</p>
                    </div>
                </div>

                <FeatureToggle
                    title="Bật đánh số trang"
                    description="Thêm trường số trang vào đầu hoặc cuối trang."
                    checked={Boolean(rules.pageNumbering?.enabled)}
                    onChange={(enabled) => updatePageNumbering(enabled)}
                />

                {rules.pageNumbering?.enabled && (
                    <div className="wc-fields-grid wc-feature-fields">
                        <SelectField
                            label="Vị trí số trang"
                            value={rules.pageNumbering.position}
                            options={[
                                { value: "header", label: "Đầu trang" },
                                { value: "footer", label: "Cuối trang" },
                            ]}
                            onChange={(value) =>
                                updatePageNumbering(true, {
                                    position: value as PagePosition | undefined,
                                })
                            }
                        />

                        <SelectField
                            label="Căn số trang"
                            value={rules.pageNumbering.alignment}
                            options={[
                                { value: "left", label: "Căn trái" },
                                { value: "center", label: "Căn giữa" },
                                { value: "right", label: "Căn phải" },
                            ]}
                            onChange={(value) =>
                                updatePageNumbering(true, {
                                    alignment: value as PageAlignment | undefined,
                                })
                            }
                        />

                        <NumberField
                            label="Số trang bắt đầu"
                            value={rules.pageNumbering.startAt}
                            min={1}
                            max={32767}
                            step={1}
                            unit="số"
                            onChange={(value) =>
                                updatePageNumbering(true, { startAt: value })
                            }
                        />

                        <FeatureToggle
                            title="Ẩn số trang đầu"
                            description="Ẩn header/footer trên trang đầu của section."
                            checked={Boolean(rules.pageNumbering.hideFirstPage)}
                            onChange={(checked) =>
                                updatePageNumbering(true, {
                                    hideFirstPage: checked,
                                })
                            }
                        />
                    </div>
                )}
            </div>

            <div className="wc-section">
                <div className="wc-section-title">
                    <span className="wc-step">04</span>
                    <div>
                        <h3>Đánh số tiêu đề nhiều cấp</h3>
                        <p>Đánh số tự động cho các đoạn dùng style Heading 1–3.</p>
                    </div>
                </div>

                <FeatureToggle
                    title="Bật đánh số tiêu đề"
                    description="Ví dụ: 1, 1.1, 1.1.1."
                    checked={Boolean(rules.headingNumbering?.enabled)}
                    onChange={(enabled) => updateHeadingNumbering(enabled)}
                />

                {rules.headingNumbering?.enabled && (
                    <div className="wc-feature-fields">
                        <SelectField
                            label="Cấp tiêu đề tối đa"
                            value={rules.headingNumbering.maxLevel}
                            options={[
                                { value: "1", label: "Cấp 1 — Heading 1" },
                                { value: "2", label: "Cấp 2 — Heading 1–2" },
                                { value: "3", label: "Cấp 3 — Heading 1–3" },
                            ]}
                            onChange={(value) =>
                                updateHeadingNumbering(true, {
                                    maxLevel: value
                                        ? (Number(value) as HeadingLevel)
                                        : undefined,
                                })
                            }
                        />
                    </div>
                )}
            </div>

            <div className="wc-section">
                <div className="wc-section-title">
                    <span className="wc-step">05</span>
                    <div>
                        <h3>Mục lục tự động</h3>
                        <p>Tạo trường TOC dựa trên các tiêu đề trong tài liệu.</p>
                    </div>
                </div>

                <FeatureToggle
                    title="Bật mục lục tự động"
                    description="Microsoft Word có thể cần cập nhật trường mục lục sau khi mở file."
                    checked={Boolean(rules.tableOfContents?.enabled)}
                    onChange={(enabled) => updateTableOfContents(enabled)}
                />

                {rules.tableOfContents?.enabled && (
                    <div className="wc-fields-grid wc-feature-fields">
                        <div className="wc-field">
                            <label>Tiêu đề mục lục</label>
                            <input
                                type="text"
                                maxLength={100}
                                value={rules.tableOfContents.title ?? ""}
                                placeholder="MỤC LỤC"
                                onChange={(event) =>
                                    updateTableOfContents(true, {
                                        title: event.target.value || undefined,
                                    })
                                }
                            />
                        </div>

                        <SelectField
                            label="Cấp mục lục tối đa"
                            value={rules.tableOfContents.maxLevel}
                            options={[
                                { value: "1", label: "Cấp 1 — Heading 1" },
                                { value: "2", label: "Cấp 2 — Heading 1–2" },
                                { value: "3", label: "Cấp 3 — Heading 1–3" },
                            ]}
                            onChange={(value) =>
                                updateTableOfContents(true, {
                                    maxLevel: value
                                        ? (Number(value) as HeadingLevel)
                                        : undefined,
                                })
                            }
                        />
                    </div>
                )}
            </div>

            <div className="wc-selection-summary">
                <div className="wc-summary-icon">
                    <ClipboardCheck size={20} />
                </div>
                <div>
                    <strong>{selectedCount} nhóm thuộc tính đã chọn</strong>
                    <p>
                        {selectedCount === 0
                            ? "Chưa có thay đổi nào được chọn."
                            : "Chỉ các nhóm đã chọn mới được gửi lên máy chủ."}
                    </p>
                </div>
                <button
                    type="button"
                    className="wc-reset-button"
                    onClick={resetRules}
                    disabled={formatting || selectedCount === 0}
                    title="Xóa các lựa chọn"
                >
                    <RotateCcw size={15} />
                    Đặt lại
                </button>
            </div>

            {error && (
                <div className="wc-message wc-error" role="alert">
                    <AlertTriangle size={19} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="wc-message wc-success" role="status">
                    <CheckCircle2 size={19} />
                    <span>{success}</span>
                </div>
            )}

            <div className="wc-actions">
                {!confirmed ? (
                    <button
                        type="button"
                        className="wc-primary-button"
                        onClick={confirmRules}
                        disabled={formatting || selectedCount === 0}
                    >
                        <ClipboardCheck size={18} />
                        Kiểm tra và xác nhận
                    </button>
                ) : (
                    <div className="wc-confirm-panel">
                        <div className="wc-confirm-heading">
                            <CheckCircle2 size={21} />
                            <div>
                                <strong>Vui lòng xác nhận lần cuối</strong>
                                <p>
                                    Hệ thống sẽ áp dụng {selectedCount} nhóm thuộc tính
                                    đã chọn lên tài liệu.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="wc-primary-button"
                            onClick={formatDocument}
                            disabled={!file || formatting}
                        >
                            {formatting ? (
                                <LoaderCircle className="wc-spinner" size={18} />
                            ) : (
                                <Download size={18} />
                            )}
                            {!file
                                ? "Vui lòng chọn file DOCX"
                                : formatting
                                    ? "Đang định dạng..."
                                    : "Định dạng và tải file Word"}
                        </button>

                        <button
                            type="button"
                            className="wc-secondary-button"
                            onClick={() => setConfirmed(false)}
                            disabled={formatting}
                        >
                            Quay lại chỉnh sửa
                        </button>
                    </div>
                )}
            </div>

            <p className="wc-footnote">
                <AlertTriangle size={15} />
                Hãy mở file kết quả bằng Microsoft Word để kiểm tra trước
                khi sử dụng chính thức.
            </p>
        </section>
    );
}
