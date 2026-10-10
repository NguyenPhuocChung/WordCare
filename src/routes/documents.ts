
import { Router } from "express";
import { unlink } from "node:fs/promises";
import { uploadDocx } from "../middleware/upload.js";
import { validateDocxFile } from "../utils/docx-validator.js";

import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { formatDocx } from "../services/docx-formatter.js";

const router = Router();

const formattingRulesSchema = z.object({
  fontName: z.string().trim().min(1).max(100).optional(),
  fontSize: z.number().min(6).max(96).finite().optional(),
  alignment: z.enum(["left", "center", "right", "justify"]).optional(),
  lineSpacing: z.number().min(0.5).max(5).finite().optional(),
  firstLineIndentCm: z.number().min(0).max(10).finite().optional(),
  marginTopCm: z.number().min(0).max(10).finite().optional(),
  marginBottomCm: z.number().min(0).max(10).finite().optional(),
  marginLeftCm: z.number().min(0).max(10).finite().optional(),
  marginRightCm: z.number().min(0).max(10).finite().optional(),
}).strict().refine(
  (rules) => Object.keys(rules).length > 0,
  { message: "Cần ít nhất một quy tắc định dạng." },
);

router.post("/format", (req, res, next) => {
  uploadDocx(req, res, async (uploadError) => {
    if (uploadError) {
      next(uploadError);
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        code: "FILE_REQUIRED",
        message: "Vui lòng chọn một file DOCX.",
      });
      return;
    }

    let outputPath: string | undefined;

    try {
      // Quy tắc được gửi qua HTTP header để không cần thêm
      // trường multipart vào middleware upload hiện tại.
      const rulesHeader = req.get("X-WordCare-Rules");

      if (!rulesHeader) {
        res.status(400).json({
          success: false,
          code: "RULES_REQUIRED",
          message: "Vui lòng gửi các quy tắc định dạng đã xác nhận.",
        });
        return;
      }

      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rulesHeader);
      } catch {
        res.status(400).json({
          success: false,
          code: "INVALID_RULES_JSON",
          message: "Quy tắc định dạng không phải JSON hợp lệ.",
        });
        return;
      }

      const validation = formattingRulesSchema.safeParse(parsedJson);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          code: "INVALID_FORMATTING_RULES",
          message: "Một hoặc nhiều quy tắc định dạng không hợp lệ.",
          errors: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      // Kiểm tra DOCX đầu vào trước khi xử lý.
      await validateDocxFile(file.path);

      const originalBuffer = await readFile(file.path);
      const formattedBuffer = await formatDocx(
        originalBuffer,
        validation.data,
      );

      // Ghi tạm file đầu ra để kiểm tra cấu trúc DOCX.
      outputPath = path.join(
        path.dirname(file.path),
        `${randomUUID()}.formatted.upload`,
      );

      await writeFile(outputPath, formattedBuffer, { flag: "wx" });

      await validateDocxFile(outputPath);

      // Đọc lại file đã vượt qua kiểm tra trước khi trả về.
      const verifiedBuffer = await readFile(outputPath);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="wordcare-formatted.docx"',
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(verifiedBuffer);
    } catch (error) {
      next(error);
    } finally {
      // Xóa cả file gốc tạm và file kết quả tạm.
      await Promise.all([
        unlink(file.path).catch(() => undefined),
        outputPath
          ? unlink(outputPath).catch(() => undefined)
          : Promise.resolve(),
      ]);
    }
  });
});

router.post("/validate", (req, res, next) => {
  uploadDocx(req, res, async (uploadError) => {
    if (uploadError) {
      next(uploadError);
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        code: "FILE_REQUIRED",
        message: "Vui lòng chọn một file DOCX.",
      });
      return;
    }

    try {
      await validateDocxFile(file.path);

      res.status(200).json({
        success: true,
        message: "File DOCX đã vượt qua bước kiểm tra ban đầu.",
        file: {
          originalName: file.originalname,
          sizeBytes: file.size,
          sizeMB: Number(
            (file.size / (1024 * 1024)).toFixed(2),
          ),
        },
      });
    } catch (error) {
      next(error);
    } finally {
      // Đây mới là API kiểm tra: không giữ file sau khi xử lý.
      await unlink(file.path).catch(() => undefined);
    }
  });
});

export default router;
