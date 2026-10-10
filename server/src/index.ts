
import "dotenv/config";
import app from "./app.js";
import { startTempCleanup } from "./utils/temp-cleanup.js";
const PORT = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT không hợp lệ. Vui lòng kiểm tra file .env.");
}
startTempCleanup();
const server = app.listen(PORT, () => {
  console.log(`WordCare API đang chạy tại http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

function shutdown(signal: string) {
  console.log(`\nNhận tín hiệu ${signal}. Đang đóng máy chủ...`);

  server.close((error) => {
    if (error) {
      console.error("Không thể đóng máy chủ bình thường:", error);
      process.exitCode = 1;
      return;
    }

    console.log("WordCare API đã dừng an toàn.");
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
