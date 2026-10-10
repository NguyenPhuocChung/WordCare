
import yauzl from "yauzl";
import { stat } from "node:fs/promises";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 5000;

export class DocxValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DocxValidationError";
  }
}

type ZipEntryInfo = {
  fileName: string;
  uncompressedSize: number;
};

function inspectZip(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      {
        lazyEntries: true,
        autoClose: true,
        validateEntrySizes: true,
        strictFileNames: true,
      },
      (openError, zipFile) => {
        if (openError || !zipFile) {
          reject(
            new DocxValidationError(
              "File không phải ZIP hợp lệ hoặc đã bị hỏng.",
              "INVALID_ZIP",
            ),
          );
          return;
        }

        let finished = false;
        let entryCount = 0;
        let totalUncompressed = 0;

        const requiredEntries = new Set([
          "[Content_Types].xml",
          "_rels/.rels",
          "word/document.xml",
        ]);

        const foundEntries = new Set<string>();
        const seenNames = new Set<string>();

        const fail = (error: Error) => {
          if (finished) return;
          finished = true;
          zipFile.close();
          reject(error);
        };

        zipFile.on("error", () => {
          fail(
            new DocxValidationError(
              "Không thể đọc cấu trúc file DOCX.",
              "ZIP_READ_ERROR",
            ),
          );
        });

        zipFile.on("entry", (entry) => {
          if (finished) return;

          entryCount += 1;

          if (entryCount > MAX_ENTRIES) {
            fail(
              new DocxValidationError(
                "DOCX chứa quá nhiều thành phần.",
                "TOO_MANY_ENTRIES",
              ),
            );
            return;
          }

          const name = entry.fileName;

          if (
            name.startsWith("/") ||
            name.includes("\\") ||
            name.split("/").includes("..") ||
            name.includes("\0")
          ) {
            fail(
              new DocxValidationError(
                "DOCX chứa đường dẫn thành phần không an toàn.",
                "UNSAFE_ENTRY_PATH",
              ),
            );
            return;
          }

          if (seenNames.has(name)) {
            fail(
              new DocxValidationError(
                "DOCX chứa tên thành phần bị trùng.",
                "DUPLICATE_ENTRY",
              ),
            );
            return;
          }

          seenNames.add(name);

          const size = entry.uncompressedSize;

          if (
            !Number.isSafeInteger(size) ||
            size < 0 ||
            size > MAX_ENTRY_BYTES
          ) {
            fail(
              new DocxValidationError(
                "Một thành phần trong DOCX vượt giới hạn cho phép.",
                "ENTRY_TOO_LARGE",
              ),
            );
            return;
          }

          totalUncompressed += size;

          if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
            fail(
              new DocxValidationError(
                "Tổng dung lượng giải nén của DOCX quá lớn.",
                "EXPANDED_SIZE_TOO_LARGE",
              ),
            );
            return;
          }

          if (requiredEntries.has(name)) {
            foundEntries.add(name);
          }

          zipFile.readEntry();
        });

        zipFile.on("end", () => {
          if (finished) return;
          finished = true;

          const missing = [...requiredEntries].filter(
            (name) => !foundEntries.has(name),
          );

          if (missing.length > 0) {
            reject(
              new DocxValidationError(
                "File ZIP thiếu thành phần bắt buộc của tài liệu Word.",
                "NOT_A_DOCX",
              ),
            );
            return;
          }

          resolve();
        });

        zipFile.readEntry();
      },
    );
  });
}

export async function validateDocxFile(
  filePath: string,
): Promise<void> {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new DocxValidationError(
      "Đầu vào không phải file thông thường.",
      "NOT_A_FILE",
    );
  }

  if (fileStat.size === 0) {
    throw new DocxValidationError(
      "File tải lên đang trống.",
      "EMPTY_FILE",
    );
  }

  if (fileStat.size > MAX_FILE_BYTES) {
    throw new DocxValidationError(
      "File vượt giới hạn 50 MB.",
      "FILE_TOO_LARGE",
    );
  }

  await inspectZip(filePath);
}
