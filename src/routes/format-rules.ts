
import { Router } from "express";
import { ZodError } from "zod";
import { analyzeFormatInstructions } from "../utils/format-parser.js";
import { FormatRequestSchema } from "../utils/format-rules.js";

const router = Router();

router.post("/analyze", (req, res) => {
  const input = FormatRequestSchema.safeParse(req.body);

  if (!input.success) {
    res.status(400).json({
      success: false,
      code: "INVALID_INSTRUCTIONS",
      message:
        "Yêu cầu phải là văn bản từ 1 đến 5000 ký tự.",
    });
    return;
  }

  try {
    const analysis = analyzeFormatInstructions(
      input.data.instructions,
    );

    res.status(200).json({
      success: true,
      message: "Đã phân tích yêu cầu. Hãy kiểm tra các quy tắc trước khi xác nhận.",
      analysis,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        code: "INVALID_RULES",
        message: "Yêu cầu tạo ra dữ liệu định dạng không hợp lệ.",
      });
      return;
    }

    console.error("Format analysis error:", error);

    res.status(500).json({
      success: false,
      code: "ANALYSIS_FAILED",
      message: "Không thể phân tích yêu cầu lúc này.",
    });
  }
});

export default router;
