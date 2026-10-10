
import {
  FormatRequestSchema,
  FormatRulesSchema,
  type FormatRules,
  type RuleAnalysis,
} from "./format-rules.js";

type MutableRules = {
  fontFamily?: string;
  fontSizePt?: number;
  alignment?: "left" | "center" | "right" | "justify";
  lineSpacing?: "1.0" | "1.15" | "1.5" | "2.0";
  firstLineIndentCm?: number;
  marginsCm?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
};

function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("vi-VN")
    .replace(/[，]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

function readNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function addWarningOnce(list: string[], message: string) {
  if (!list.includes(message)) list.push(message);
}

export function analyzeFormatInstructions(
  rawInstructions: string,
): RuleAnalysis {
  const validatedInput = FormatRequestSchema.parse({
    instructions: rawInstructions,
  });

  const original = validatedInput.instructions;
  const text = normalizeText(original);

  const rules: MutableRules = {};
  const warnings: string[] = [];
  const unsupportedRequests: string[] = [];

  // 1. Phông chữ: nhận dạng một số tên thường dùng.
  const fontPatterns = [
    { pattern: /\btimes\s+new\s+roman\b/i, name: "Times New Roman" },
    { pattern: /\barial\b/i, name: "Arial" },
    { pattern: /\bcalibri\b/i, name: "Calibri" },
    { pattern: /\baptos\b/i, name: "Aptos" },
    { pattern: /\bverdana\b/i, name: "Verdana" },
    { pattern: /\btahoma\b/i, name: "Tahoma" },
  ];

  const matchedFonts = fontPatterns.filter(({ pattern }) =>
    pattern.test(text),
  );

  if (matchedFonts.length === 1) {
    rules.fontFamily = matchedFonts[0].name;
  } else if (matchedFonts.length > 1) {
    warnings.push(
      "Bạn đã nêu nhiều phông chữ. Hãy xác nhận phông chữ muốn dùng.",
    );
  }

  // 2. Cỡ chữ: ví dụ "cỡ chữ 13", "font size 12 pt".
  const fontSizeMatch = text.match(
    /(?:cỡ\s*chữ|kích\s*thước\s*chữ|font\s*size)\s*(?:là\s*)?(\d{1,2}(?:[.,]\d+)?)\s*(?:pt|điểm)?\b/i,
  );

  if (fontSizeMatch) {
    const value = readNumber(fontSizeMatch[1]);
    if (value !== null && value >= 8 && value <= 72) {
      rules.fontSizePt = value;
    } else {
      warnings.push("Cỡ chữ phải nằm trong khoảng 8–72 pt.");
    }
  }

  // 3. Căn lề đoạn văn.
  const alignments = [
    {
      value: "justify" as const,
      pattern: /\b(căn đều hai bên|căn đều 2 bên|justify)\b/i,
    },
    {
      value: "center" as const,
      pattern: /\b(căn giữa|canh giữa|center)\b/i,
    },
    {
      value: "right" as const,
      pattern: /\b(căn phải|canh phải|align right)\b/i,
    },
    {
      value: "left" as const,
      pattern: /\b(căn trái|canh trái|align left)\b/i,
    },
  ];

  const matchedAlignments = alignments.filter(({ pattern }) =>
    pattern.test(text),
  );

  if (matchedAlignments.length === 1) {
    rules.alignment = matchedAlignments[0].value;
  } else if (matchedAlignments.length > 1) {
    warnings.push(
      "Bạn đã yêu cầu nhiều kiểu căn đoạn. Hãy xác nhận kiểu căn muốn áp dụng.",
    );
  }

  // 4. Giãn dòng.
  const lineSpacingMatch = text.match(
    /(?:giãn dòng|dãn dòng|khoảng cách dòng|line spacing)\s*(?:là|=|:)?\s*(1[.,]0|1[.,]15|1[.,]5|2[.,]0)(?:\s*(?:dòng|lines?))?/i,
  );

  if (lineSpacingMatch) {
    const normalized = lineSpacingMatch[1].replace(",", ".");
    const supported = ["1.0", "1.15", "1.5", "2.0"] as const;

    if (supported.includes(normalized as (typeof supported)[number])) {
      rules.lineSpacing = normalized as FormatRules["lineSpacing"];
    }
  }

  // 5. Thụt đầu dòng.
  const indentMatch = text.match(
    /(?:thụt\s*đầu\s*dòng|lùi\s*đầu\s*dòng|first\s*line\s*indent)\s*(?:là|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|in)?/i,
  );

  if (indentMatch) {
    let value = readNumber(indentMatch[1]);
    const unit = indentMatch[2]?.toLowerCase() ?? "cm";

    if (value !== null) {
      if (unit === "mm") value /= 10;
      if (unit === "inch" || unit === "in") value *= 2.54;

      if (value >= 0 && value <= 5) {
        rules.firstLineIndentCm = Number(value.toFixed(2));
      } else {
        warnings.push("Thụt đầu dòng phải nằm trong khoảng 0–5 cm.");
      }
    }
  }

  // 6. Lề trang. Chỉ gán giá trị khi có nhãn lề cụ thể.
  const marginDefinitions = [
    {
      key: "top" as const,
      pattern: /(?:lề trên|margin top|top margin)\s*(?:là|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|in)?/i,
    },
    {
      key: "bottom" as const,
      pattern: /(?:lề dưới|margin bottom|bottom margin)\s*(?:là|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|in)?/i,
    },
    {
      key: "left" as const,
      pattern: /(?:lề trái|margin left|left margin)\s*(?:là|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|in)?/i,
    },
    {
      key: "right" as const,
      pattern: /(?:lề phải|margin right|right margin)\s*(?:là|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch|in)?/i,
    },
  ];

  for (const definition of marginDefinitions) {
    const match = text.match(definition.pattern);
    if (!match) continue;

    let value = readNumber(match[1]);
    const unit = match[2]?.toLowerCase() ?? "cm";

    if (value === null) continue;
    if (unit === "mm") value /= 10;
    if (unit === "inch" || unit === "in") value *= 2.54;

    if (value < 0 || value > 10) {
      warnings.push("Mỗi lề trang phải nằm trong khoảng 0–10 cm.");
      continue;
    }

    rules.marginsCm ??= {};
    rules.marginsCm[definition.key] = Number(value.toFixed(2));
  }

  // Cảnh báo một số yêu cầu ngoài phạm vi bản phân tích hiện tại.
  const unsupportedPatterns = [
    {
      pattern: /\b(in đậm|chữ đậm|bold|in nghiêng|italic|gạch chân|underline)\b/i,
      label: "Định dạng đậm, nghiêng hoặc gạch chân",
    },
    {
      pattern: /\b(đầu trang|chân trang|header|footer|đánh số trang|số trang)\b/i,
      label: "Đầu trang, chân trang hoặc số trang",
    },
    {
      pattern: /\b(mục lục|table of contents|heading|tiêu đề chương|đánh số đề mục)\b/i,
      label: "Mục lục, tiêu đề hoặc đánh số đề mục",
    },
    {
      pattern: /\b(bảng|table|hình ảnh|ảnh|image|công thức|equation)\b/i,
      label: "Định dạng bảng, hình ảnh hoặc công thức",
    },
    {
      pattern: /\b(giãn đoạn|khoảng cách trước đoạn|khoảng cách sau đoạn|before paragraph|after paragraph)\b/i,
      label: "Khoảng cách trước hoặc sau đoạn",
    },
  ];

  for (const item of unsupportedPatterns) {
    if (item.pattern.test(text)) {
      addWarningOnce(
        unsupportedRequests,
        `${item.label}: chưa được hỗ trợ ở phiên bản này.`,
      );
    }
  }

  const parsed = FormatRulesSchema.parse(rules);

  if (Object.keys(parsed).length === 0) {
    warnings.push(
      "Chưa nhận dạng được quy tắc định dạng nào. Hãy mô tả cụ thể hơn, ví dụ: cỡ chữ 13 pt, căn đều hai bên.",
    );
  }

  if (
    rules.marginsCm &&
    Object.keys(rules.marginsCm).length < 4
  ) {
    warnings.push(
      "Chỉ các lề được nêu rõ mới được nhận dạng. Các lề còn lại sẽ giữ nguyên.",
    );
  }

  return {
    rules: parsed,
    warnings,
    unsupportedRequests,
    requiresConfirmation: true,
  };
}
