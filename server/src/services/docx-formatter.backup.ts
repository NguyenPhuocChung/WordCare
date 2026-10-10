
import JSZip from "jszip";
import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
} from "@xmldom/xmldom";

export interface DocxFormattingRules {
  fontName?: string;
  fontSize?: number;
  alignment?: "left" | "center" | "right" | "justify";
  lineSpacing?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  firstLineIndentCm?: number;
  marginTopCm?: number;
  marginBottomCm?: number;
  marginLeftCm?: number;
  marginRightCm?: number;
}

const W_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const CM_TO_TWIPS = 1440 / 2.54;
const PT_TO_TWIPS = 20;

function cmToTwips(cm: number): string {
  return String(Math.round(cm * CM_TO_TWIPS));
}

function ptToTwips(pt: number): string {
  return String(Math.round(pt * PT_TO_TWIPS));
}

function assertRules(rules: DocxFormattingRules): void {
  if (Object.keys(rules).length === 0) {
    throw new Error("Cần chọn ít nhất một thuộc tính định dạng.");
  }

  if (
    rules.fontName !== undefined &&
    (typeof rules.fontName !== "string" ||
      rules.fontName.trim().length === 0 ||
      rules.fontName.length > 100)
  ) {
    throw new Error("Tên phông chữ không hợp lệ.");
  }

  if (
    rules.fontSize !== undefined &&
    (!Number.isFinite(rules.fontSize) ||
      rules.fontSize < 6 ||
      rules.fontSize > 96)
  ) {
    throw new Error("Cỡ chữ phải từ 6 đến 96 pt.");
  }

  if (
    rules.alignment !== undefined &&
    !["left", "center", "right", "justify"].includes(
      rules.alignment,
    )
  ) {
    throw new Error("Kiểu căn đoạn không hợp lệ.");
  }

  if (
    rules.lineSpacing !== undefined &&
    (!Number.isFinite(rules.lineSpacing) ||
      rules.lineSpacing < 0.5 ||
      rules.lineSpacing > 5)
  ) {
    throw new Error("Giãn dòng phải từ 0,5 đến 5.");
  }

  const paragraphKeys = [
    "spaceBeforePt",
    "spaceAfterPt",
  ] as const;

  for (const key of paragraphKeys) {
    const value = rules[key];

    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 1584)
    ) {
      throw new Error(`${key} phải nằm trong khoảng 0–1584 pt.`);
    }
  }

  const dimensionKeys = [
    "firstLineIndentCm",
    "marginTopCm",
    "marginBottomCm",
    "marginLeftCm",
    "marginRightCm",
  ] as const;

  for (const key of dimensionKeys) {
    const value = rules[key];

    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 10)
    ) {
      throw new Error(`${key} phải nằm trong khoảng 0–10 cm.`);
    }
  }
}


function parseXml(
  xml: string,
  partName: string,
): XmlDocument {
  const doc = new DOMParser().parseFromString(
    xml,
    "application/xml",
  );

  const parserErrors = doc.getElementsByTagName("parsererror");

  if (!doc.documentElement || parserErrors.length > 0) {
    throw new Error(`XML không hợp lệ: ${partName}`);
  }

  return doc;
}


function elementsByTag(
  root: XmlDocument | XmlElement,
  localName: string,
): XmlElement[] {
  const nodes = root.getElementsByTagNameNS(W_NS, localName);
  const result: XmlElement[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const element = nodes.item(i);
    if (element) result.push(element as XmlElement);
  }

  return result;
}

function directChild(
  parent: XmlElement,
  localName: string,
): XmlElement | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes.item(i);

    if (
      node?.nodeType === 1 &&
      (node as XmlElement).namespaceURI === W_NS &&
      (node as XmlElement).localName === localName
    ) {
      return node as XmlElement;
    }
  }

  return null;
}

/**
 * Giữ thứ tự phần tử phổ biến theo cấu trúc WordprocessingML.
 * Các phần tử chưa biết thứ tự sẽ được giữ lại, không bị xóa.
 */
const CHILD_ORDER: Record<string, string[]> = {
  p: [
    "pPr",
  ],
  r: [
    "rPr",
  ],
  pPr: [
    "pStyle",
    "keepNext",
    "keepLines",
    "pageBreakBefore",
    "framePr",
    "widowControl",
    "numPr",
    "suppressLineNumbers",
    "pBdr",
    "shd",
    "tabs",
    "suppressAutoHyphens",
    "kinsoku",
    "wordWrap",
    "overflowPunct",
    "topLinePunct",
    "autoSpaceDE",
    "autoSpaceDN",
    "bidi",
    "adjustRightInd",
    "snapToGrid",
    "spacing",
    "ind",
    "contextualSpacing",
    "mirrorIndents",
    "suppressOverlap",
    "jc",
    "textDirection",
    "textAlignment",
    "textboxTightWrap",
    "outlineLvl",
    "divId",
    "cnfStyle",
    "rPr",
    "sectPr",
    "pPrChange",
  ],
  rPr: [
    "rStyle",
    "rFonts",
    "b",
    "bCs",
    "i",
    "iCs",
    "caps",
    "smallCaps",
    "strike",
    "dstrike",
    "outline",
    "shadow",
    "emboss",
    "imprint",
    "noProof",
    "snapToGrid",
    "vanish",
    "webHidden",
    "color",
    "spacing",
    "w",
    "kern",
    "position",
    "sz",
    "szCs",
    "highlight",
    "u",
    "effect",
    "bdr",
    "shd",
    "fitText",
    "vertAlign",
    "rtl",
    "cs",
    "em",
    "lang",
    "eastAsianLayout",
    "specVanish",
    "oMath",
    "rPrChange",
  ],
  sectPr: [
    "footnotePr",
    "endnotePr",
    "type",
    "pgSz",
    "pgMar",
    "paperSrc",
    "pgBorders",
    "lnNumType",
    "pgNumType",
    "cols",
    "formProt",
    "vAlign",
    "noEndnote",
    "titlePg",
    "textDirection",
    "bidi",
    "rtlGutter",
    "docGrid",
    "printerSettings",
    "sectPrChange",
  ],
};


function insertInSchemaOrder(
  parent: XmlElement,
  element: XmlElement,
): void {
  const parentName = parent.localName;

  if (!parentName) {
    parent.appendChild(element);
    return;
  }

  const order = CHILD_ORDER[parentName];

  if (!order) {
    parent.appendChild(element);
    return;
  }

  const elementName = element.localName;

  if (!elementName) {
    parent.appendChild(element);
    return;
  }

  const newIndex = order.indexOf(elementName);

  if (newIndex < 0) {
    parent.appendChild(element);
    return;
  }

  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes.item(i);

    if (node?.nodeType !== 1) continue;

    const sibling = node as XmlElement;

    if (sibling === element) continue;

    const siblingName = sibling.localName;

    if (!siblingName) continue;

    const siblingIndex = order.indexOf(siblingName);

    if (siblingIndex >= 0 && siblingIndex > newIndex) {
      parent.insertBefore(element, sibling);
      return;
    }
  }

  parent.appendChild(element);
}

function getOrCreateChild(
  doc: XmlDocument,
  parent: XmlElement,
  localName: string,
): XmlElement {
  const existing = directChild(parent, localName);
  if (existing) return existing;

  const element = doc.createElementNS(W_NS, `w:${localName}`);
  insertInSchemaOrder(parent, element);

  return element;
}

function setWAttribute(
  element: XmlElement,
  name: string,
  value: string,
): void {
  element.setAttributeNS(W_NS, `w:${name}`, value);
}

function setChildValue(
  doc: XmlDocument,
  parent: XmlElement,
  name: string,
  value: string,
): void {
  const child = getOrCreateChild(doc, parent, name);
  setWAttribute(child, "val", value);
}

function applyRunFormatting(
  doc: XmlDocument,
  runProperties: XmlElement,
  rules: DocxFormattingRules,
): void {
  if (rules.fontName !== undefined) {
    const fonts = getOrCreateChild(doc, runProperties, "rFonts");

    for (const attribute of [
      "ascii",
      "hAnsi",
      "eastAsia",
      "cs",
    ]) {
      setWAttribute(fonts, attribute, rules.fontName);
    }
  }

  if (rules.fontSize !== undefined) {
    const halfPoints = String(Math.round(rules.fontSize * 2));

    setChildValue(doc, runProperties, "sz", halfPoints);
    setChildValue(doc, runProperties, "szCs", halfPoints);
  }
}

function applyParagraphFormatting(
  doc: XmlDocument,
  paragraph: XmlElement,
  rules: DocxFormattingRules,
): void {
  const pPr = getOrCreateChild(doc, paragraph, "pPr");

  if (rules.alignment !== undefined) {
    setChildValue(doc, pPr, "jc", rules.alignment);
  }

  if (rules.firstLineIndentCm !== undefined) {
    const ind = getOrCreateChild(doc, pPr, "ind");

    setWAttribute(
      ind,
      "firstLine",
      cmToTwips(rules.firstLineIndentCm),
    );

    ind.removeAttributeNS(W_NS, "hanging");
  }

  const hasSpacingRules =
    rules.lineSpacing !== undefined ||
    rules.spaceBeforePt !== undefined ||
    rules.spaceAfterPt !== undefined;

  if (hasSpacingRules) {
    const spacing = getOrCreateChild(doc, pPr, "spacing");

    if (rules.lineSpacing !== undefined) {
      setWAttribute(
        spacing,
        "line",
        String(Math.round(rules.lineSpacing * 240)),
      );

      setWAttribute(spacing, "lineRule", "auto");
    }

    if (rules.spaceBeforePt !== undefined) {
      setWAttribute(
        spacing,
        "before",
        ptToTwips(rules.spaceBeforePt),
      );
    }

    if (rules.spaceAfterPt !== undefined) {
      setWAttribute(
        spacing,
        "after",
        ptToTwips(rules.spaceAfterPt),
      );
    }
  }
}

function applyPageMargins(
  doc: XmlDocument,
  rules: DocxFormattingRules,
): void {
  const marginRules = [
    ["marginTopCm", "top"],
    ["marginBottomCm", "bottom"],
    ["marginLeftCm", "left"],
    ["marginRightCm", "right"],
  ] as const;

  const hasMarginRules = marginRules.some(
    ([key]) => rules[key] !== undefined,
  );

  if (!hasMarginRules) return;

  const sections = elementsByTag(doc, "sectPr");

  if (sections.length === 0) {
    throw new Error(
      "Không tìm thấy cấu hình trang (sectPr) trong tài liệu Word.",
    );
  }

  for (const sectPr of sections) {
    const pgMar = getOrCreateChild(doc, sectPr, "pgMar");

    for (const [ruleKey, attribute] of marginRules) {
      const value = rules[ruleKey];

      if (value !== undefined) {
        setWAttribute(pgMar, attribute, cmToTwips(value));
      }
    }
  }
}

function serializeXml(doc: XmlDocument): string {
  return new XMLSerializer().serializeToString(doc);
}

export async function formatDocx(
  input: Buffer,
  rules: DocxFormattingRules,
): Promise<Buffer> {
  assertRules(rules);

  const zip = await JSZip.loadAsync(input, {
    checkCRC32: true,
  });

  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("DOCX không có word/document.xml.");
  }

  const xml = await documentFile.async("string");
  const document = parseXml(xml, "word/document.xml");

  const runRules: DocxFormattingRules = {
    fontName: rules.fontName,
    fontSize: rules.fontSize,
  };

  const paragraphs = elementsByTag(document, "p");

  for (const paragraph of paragraphs) {
    applyParagraphFormatting(document, paragraph, rules);

    // Chỉ định dạng các run thuộc đoạn hiện tại, tránh áp dụng lặp
    // lên run nằm trong các đoạn con của textbox hoặc thành phần lồng nhau.
    for (let i = 0; i < paragraph.childNodes.length; i++) {
      const node = paragraph.childNodes.item(i);

      if (
        node?.nodeType !== 1 ||
        (node as XmlElement).namespaceURI !== W_NS ||
        (node as XmlElement).localName !== "r"
      ) {
        continue;
      }

      const run = node as XmlElement;
      const rPr = getOrCreateChild(document, run, "rPr");

      applyRunFormatting(document, rPr, runRules);
    }
  }

  applyPageMargins(document, rules);

  zip.file("word/document.xml", serializeXml(document));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
