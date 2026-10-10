
import { readdir, stat, unlink } from "node:fs/promises";
import { TEMP_DIR } from "../middleware/upload.js";

const MAX_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export async function cleanupTempFiles(): Promise<void> {
  let names: string[];

  try {
    names = await readdir(TEMP_DIR);
  } catch (error) {
    console.error("Không thể đọc thư mục temp:", error);
    return;
  }

  const now = Date.now();

  for (const name of names) {
    // Chỉ đụng đến file tạm do WordCare tạo.
    if (!name.endsWith(".upload")) continue;

    const path = `${TEMP_DIR}/${name}`;

    try {
      const info = await stat(path);

      if (
        info.isFile() &&
        now - info.mtimeMs > MAX_AGE_MS
      ) {
        await unlink(path);
      }
    } catch (error) {
      console.error("Không thể dọn file tạm:", error);
    }
  }
}

export function startTempCleanup(): void {
  void cleanupTempFiles();

  const timer = setInterval(() => {
    void cleanupTempFiles();
  }, CLEANUP_INTERVAL_MS);

  // Timer không giữ tiến trình Node.js sống chỉ vì việc dọn file.
  timer.unref();
}
