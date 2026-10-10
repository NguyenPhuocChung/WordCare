
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import JSZip from "jszip";
import { formatDocx } from "./docx-formatter.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(currentDir, "../../../temp-tests");

async function createSampleDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun("WordCare kiểm thử định dạng"),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun("Đây là đoạn văn thứ hai."),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const original = await createSampleDocx();

  const rules = {
    fontName: "Times New Roman",
    fontSize: 13,
    alignment: "justify" as const,
    lineSpacing: 1.5,
    firstLineIndentCm: 1,
    marginTopCm: 2,
    marginBottomCm: 2,
    marginLeftCm: 3,
    marginRightCm: 2,
  };

  const formatted = await formatDocx(original, rules);

  assert.ok(Buffer.isBuffer(formatted), "Kết quả phải là Buffer.");
  assert.ok(formatted.length > 0, "File kết quả không được rỗng.");

  // Xác minh file đầu ra vẫn là ZIP/DOCX có thể đọc.
  const outputZip = await JSZip.loadAsync(formatted, {
    checkCRC32: true,
  });

  const documentFile = outputZip.file("word/document.xml");
  assert.ok(documentFile, "Thiếu word/document.xml.");

  const documentXml = await documentFile.async("string");

  assert.ok(
    documentXml.includes("WordCare kiểm thử định dạng"),
    "Không tìm thấy nội dung gốc trong file đầu ra.",
  );

  assert.ok(
    documentXml.includes('w:val="justify"'),
    "Chưa tìm thấy quy tắc căn đều trong XML.",
  );

  assert.ok(
    documentXml.includes('w:val="26"'),
    "Chưa tìm thấy cỡ chữ 13 pt (26 half-points).",
  );

  // Xác minh bộ xử lý không thay đổi Buffer nguồn.
  const originalZip = await JSZip.loadAsync(original, {
    checkCRC32: true,
  });

  const originalXml = await originalZip
    .file("word/document.xml")!
    .async("string");

  assert.ok(
    !originalXml.includes('w:val="justify"'),
    "File gốc đã bị thay đổi ngoài dự kiến.",
  );

  const outputPath = path.join(outputDir, "wordcare-test-output.docx");
  await writeFile(outputPath, formatted);

  // Kiểm tra trường hợp quy tắc không hợp lệ.
  await assert.rejects(
    () => formatDocx(original, { fontSize: 500 }),
    /Cỡ chữ phải từ 6 đến 96 pt/,
  );

  console.log("PASS: DOCX đầu ra có cấu trúc ZIP hợp lệ.");
  console.log("PASS: Nội dung văn bản gốc được giữ lại.");
  console.log("PASS: Quy tắc căn đều và cỡ chữ đã được ghi.");
  console.log("PASS: Buffer tài liệu gốc không bị ghi đè.");
  console.log("PASS: Quy tắc không hợp lệ bị từ chối.");
  console.log(`File kiểm thử: ${outputPath}`);
}

main().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
