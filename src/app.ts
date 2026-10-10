
import express, {
  type ErrorRequestHandler,
} from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import formatRulesRouter from "./routes/format-rules.js";
import documentsRouter from "./routes/documents.js";
import { DocxValidationError } from "./utils/docx-validator.js";

const app = express();

const allowedOrigin =
  process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    name: "WordCare API",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});
app.use("/api/format-rules", formatRulesRouter);
app.use("/api/documents", documentsRouter);

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        code: "FILE_TOO_LARGE",
        message: "File vượt giới hạn 10 MB.",
      });
      return;
    }

    res.status(400).json({
      success: false,
      code: error.code,
      message: "Yêu cầu tải file không hợp lệ.",
    });
    return;
  }

  if (error instanceof DocxValidationError) {
    res.status(422).json({
      success: false,
      code: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof Error) {
    // Lỗi do người dùng gửi file không đúng định dạng.
    if (error.message.startsWith("Chỉ chấp nhận file")) {
      res.status(400).json({
        success: false,
        code: "INVALID_EXTENSION",
        message: error.message,
      });
      return;
    }
  }

  // Không trả stack trace hoặc chi tiết nội bộ cho client.
  console.error("WordCare API error:", error);

  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại.",
  });
};

app.use(errorHandler);

export default app;
