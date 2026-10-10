
import multer from "multer";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

// Hoạt động cả khi chạy từ src và khi build sang dist.
export const TEMP_DIR = resolve(currentDir, "../../temp");

mkdirSync(TEMP_DIR, { recursive: true });

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, TEMP_DIR);
  },

  filename: (_req, _file, callback) => {
    callback(null, `${randomUUID()}.upload`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },

  fileFilter: (_req, file, callback) => {
    // Đây chỉ là kiểm tra sơ bộ. Bộ xác thực ZIP/DOCX
    // ở bước sau mới kiểm tra cấu trúc file thực tế.
    if (!file.originalname.toLowerCase().endsWith(".docx")) {
      callback(new Error("Chỉ chấp nhận file có đuôi .docx."));
      return;
    }

    callback(null, true);
  },
});

export const uploadDocx = upload.single("file");
