import JSZip from "jszip";
import {
    DOMParser,
    XMLSerializer,
    type Document as XmlDocument,
    type Element as XmlElement,
} from "@xmldom/xmldom";

export interface DocxFormattingRules {
    // Định dạng chữ và đoạn văn
    fontName?: string;
    fontSize?: number;
    alignment?: "left" | "center" | "right" | "justify";
    lineSpacing?: number;
    spaceBeforePt?: number;
    spaceAfterPt?: number;
    firstLineIndentCm?: number;

    // Lề trang
    marginTopCm?: number;
    marginBottomCm?: number;
    marginLeftCm?: number;
    marginRightCm?: number;

    // Đánh số trang
    pageNumbering?: {
        enabled: boolean;
        position?: "header" | "footer";
        alignment?: "left" | "center" | "right";
        startAt?: number;
        hideFirstPage?: boolean;
    };

    // Đánh số tiêu đề nhiều cấp
    headingNumbering?: {
        enabled: boolean;
        maxLevel?: 1 | 2 | 3;
    };

    // Mục lục tự động
    tableOfContents?: {
        enabled: boolean;
        maxLevel?: 1 | 2 | 3;
        title?: string;
    };
}

const W_NS =
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS =
    "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPES_NS =
    "http://schemas.openxmlformats.org/package/2006/content-types";
const R_NS =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NUMBERING_NS = W_NS;

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
        !["left", "center", "right", "justify"].includes(rules.alignment)
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

    for (const key of ["spaceBeforePt", "spaceAfterPt"] as const) {
        const value = rules[key];
        if (
            value !== undefined &&
            (!Number.isFinite(value) || value < 0 || value > 1584)
        ) {
            throw new Error(`${key} phải nằm trong khoảng 0–1584 pt.`);
        }
    }

    for (const key of [
        "firstLineIndentCm",
        "marginTopCm",
        "marginBottomCm",
        "marginLeftCm",
        "marginRightCm",
    ] as const) {
        const value = rules[key];
        if (
            value !== undefined &&
            (!Number.isFinite(value) || value < 0 || value > 10)
        ) {
            throw new Error(`${key} phải nằm trong khoảng 0–10 cm.`);
        }
    }

    if (rules.pageNumbering !== undefined) {
        const page = rules.pageNumbering;
        if (typeof page.enabled !== "boolean") {
            throw new Error("Tùy chọn đánh số trang không hợp lệ.");
        }
        if (
            page.position !== undefined &&
            !["header", "footer"].includes(page.position)
        ) {
            throw new Error("Vị trí đánh số trang không hợp lệ.");
        }
        if (
            page.alignment !== undefined &&
            !["left", "center", "right"].includes(page.alignment)
        ) {
            throw new Error("Căn lề số trang không hợp lệ.");
        }
        if (
            page.startAt !== undefined &&
            (!Number.isInteger(page.startAt) ||
                page.startAt < 1 ||
                page.startAt > 32767)
        ) {
            throw new Error("Số trang bắt đầu phải từ 1 đến 32767.");
        }
        if (
            page.hideFirstPage !== undefined &&
            typeof page.hideFirstPage !== "boolean"
        ) {
            throw new Error("Tùy chọn ẩn số trang đầu không hợp lệ.");
        }
    }

    if (rules.headingNumbering !== undefined) {
        const heading = rules.headingNumbering;
        if (typeof heading.enabled !== "boolean") {
            throw new Error("Tùy chọn đánh số tiêu đề không hợp lệ.");
        }
        if (
            heading.maxLevel !== undefined &&
            ![1, 2, 3].includes(heading.maxLevel)
        ) {
            throw new Error("Cấp đánh số tiêu đề phải là 1, 2 hoặc 3.");
        }
    }

    if (rules.tableOfContents !== undefined) {
        const toc = rules.tableOfContents;
        if (typeof toc.enabled !== "boolean") {
            throw new Error("Tùy chọn mục lục không hợp lệ.");
        }
        if (
            toc.maxLevel !== undefined &&
            ![1, 2, 3].includes(toc.maxLevel)
        ) {
            throw new Error("Cấp mục lục phải là 1, 2 hoặc 3.");
        }
        if (
            toc.title !== undefined &&
            (typeof toc.title !== "string" ||
                toc.title.trim().length === 0 ||
                toc.title.length > 100)
        ) {
            throw new Error("Tiêu đề mục lục phải từ 1 đến 100 ký tự.");
        }
    }
}

function parseXml(xml: string, partName: string): XmlDocument {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
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
        const el = nodes.item(i);
        if (el) result.push(el as XmlElement);
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

const CHILD_ORDER: Record<string, string[]> = {
    p: ["pPr"],
    r: ["rPr"],
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
        "headerReference",
        "footerReference",
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

/** Ghi thuộc tính w: ổn định với xmldom */
function setWAttribute(
    element: XmlElement,
    name: string,
    value: string,
): void {
    element.setAttribute(`w:${name}`, value);
    if (element.hasAttribute(name)) {
        element.removeAttribute(name);
    }
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

function removeThemeFontAttributes(fonts: XmlElement): void {
    const themeAttrs = [
        "asciiTheme",
        "hAnsiTheme",
        "eastAsiaTheme",
        "cstheme",
        "csTheme",
    ];
    for (const attr of themeAttrs) {
        fonts.removeAttribute(`w:${attr}`);
        fonts.removeAttributeNS(W_NS, attr);
        fonts.removeAttribute(attr);
    }
}

function applyRunFormatting(
    doc: XmlDocument,
    runProperties: XmlElement,
    rules: DocxFormattingRules,
): void {
    if (rules.fontName !== undefined) {
        const fonts = getOrCreateChild(doc, runProperties, "rFonts");
        removeThemeFontAttributes(fonts);

        for (const attribute of ["ascii", "hAnsi", "eastAsia", "cs"]) {
            setWAttribute(fonts, attribute, rules.fontName);
        }
    }

    if (rules.fontSize !== undefined) {
        const halfPoints = String(Math.round(rules.fontSize * 2));
        setChildValue(doc, runProperties, "sz", halfPoints);
        setChildValue(doc, runProperties, "szCs", halfPoints);
    }
}

/** Áp font/size cho mọi run trong đoạn (kể cả hyperlink, sdt…) */
function applyRunFormattingToParagraph(
    doc: XmlDocument,
    paragraph: XmlElement,
    rules: DocxFormattingRules,
): void {
    function visit(element: XmlElement): void {
        for (let i = 0; i < element.childNodes.length; i++) {
            const node = element.childNodes.item(i);
            if (
                !node ||
                node.nodeType !== 1 ||
                (node as XmlElement).namespaceURI !== W_NS
            ) {
                continue;
            }

            const child = node as XmlElement;

            if (child.localName === "p") continue;

            if (child.localName === "r") {
                const rPr = getOrCreateChild(doc, child, "rPr");
                applyRunFormatting(doc, rPr, rules);
                continue;
            }

            visit(child);
        }
    }

    visit(paragraph);
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
        setWAttribute(ind, "firstLine", cmToTwips(rules.firstLineIndentCm));
        ind.removeAttribute(`w:hanging`);
        ind.removeAttributeNS(W_NS, "hanging");
        ind.removeAttribute("hanging");
    }

    const hasSpacing =
        rules.lineSpacing !== undefined ||
        rules.spaceBeforePt !== undefined ||
        rules.spaceAfterPt !== undefined;

    if (hasSpacing) {
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

    const hasMargin = marginRules.some(([key]) => rules[key] !== undefined);
    if (!hasMargin) return;

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

/**
 * Ghi đè styles.xml: docDefaults + Normal + Heading + xóa toàn bộ theme font.
 */
async function applyDefaultStyles(
    zip: JSZip,
    rules: DocxFormattingRules,
): Promise<void> {
    if (rules.fontName === undefined && rules.fontSize === undefined) {
        return;
    }

    const stylesPath = "word/styles.xml";
    const stylesFile = zip.file(stylesPath);
    if (!stylesFile) return;

    const stylesDoc = parseXml(
        await stylesFile.async("string"),
        stylesPath,
    );

    const runRules: DocxFormattingRules = {
        fontName: rules.fontName,
        fontSize: rules.fontSize,
    };

    // 1. docDefaults
    const docDefaultsList = elementsByTag(stylesDoc, "docDefaults");
    if (docDefaultsList.length > 0) {
        const docDefaults = docDefaultsList[0];
        const rPrDefault = getOrCreateChild(
            stylesDoc,
            docDefaults,
            "rPrDefault",
        );
        const rPr = getOrCreateChild(stylesDoc, rPrDefault, "rPr");
        applyRunFormatting(stylesDoc, rPr, runRules);
    }

    // 2. Style Normal + Heading 1-9
    const styles = elementsByTag(stylesDoc, "style");
    for (const style of styles) {
        const styleId = getAttributeByLocalName(style, "styleId") ?? "";
        const isNormal = styleId.toLowerCase() === "normal";
        const isHeading = /^Heading[1-9]$/i.test(styleId);
        if (!isNormal && !isHeading) continue;

        const rPr = getOrCreateChild(stylesDoc, style, "rPr");
        applyRunFormatting(stylesDoc, rPr, runRules);
    }

    // 3. Xóa theme + ép font trên MỌI rFonts trong styles.xml
    if (rules.fontName !== undefined) {
        const allFonts = elementsByTag(stylesDoc, "rFonts");
        for (const fonts of allFonts) {
            removeThemeFontAttributes(fonts);
            for (const attribute of ["ascii", "hAnsi", "eastAsia", "cs"]) {
                setWAttribute(fonts, attribute, rules.fontName);
            }
        }
    }

    // 4. Ép size trên mọi sz / szCs trong styles (để đồng bộ)
    if (rules.fontSize !== undefined) {
        const halfPoints = String(Math.round(rules.fontSize * 2));
        for (const sz of elementsByTag(stylesDoc, "sz")) {
            setWAttribute(sz, "val", halfPoints);
        }
        for (const sz of elementsByTag(stylesDoc, "szCs")) {
            setWAttribute(sz, "val", halfPoints);
        }
    }

    zip.file(stylesPath, serializeXml(stylesDoc));
}

function createXmlDocument(
    rootName: string,
    namespace: string,
): XmlDocument {
    const doc = new DOMParser().parseFromString(
        `<root xmlns="${namespace}"/>`,
        "application/xml",
    );
    const oldRoot = doc.documentElement;
    if (!oldRoot) throw new Error("Không thể tạo XML document.");

    const element = doc.createElementNS(namespace, rootName);
    doc.replaceChild(element, oldRoot);
    return doc;
}

function getAttributeByLocalName(
    element: XmlElement,
    localName: string,
): string | null {
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i);
        if (attr?.localName === localName) return attr.value;
    }
    return null;
}

function getOrCreatePackageRelationship(
    doc: XmlDocument,
    root: XmlElement,
    type: string,
    target: string,
): string {
    const relationships = root.getElementsByTagNameNS(
        REL_NS,
        "Relationship",
    );

    for (let i = 0; i < relationships.length; i++) {
        const rel = relationships.item(i) as XmlElement | null;
        if (
            rel &&
            rel.getAttribute("Type") === type &&
            rel.getAttribute("Target") === target
        ) {
            const id = rel.getAttribute("Id");
            if (id) return id;
        }
    }

    let index = 1;
    const usedIds = new Set<string>();
    for (let i = 0; i < relationships.length; i++) {
        const rel = relationships.item(i) as XmlElement | null;
        const id = rel?.getAttribute("Id");
        if (id) usedIds.add(id);
    }

    while (usedIds.has(`rId${index}`)) index++;

    const relationship = doc.createElementNS(REL_NS, "Relationship");
    relationship.setAttribute("Id", `rId${index}`);
    relationship.setAttribute("Type", type);
    relationship.setAttribute("Target", target);
    root.appendChild(relationship);

    return `rId${index}`;
}

function ensureContentTypeOverride(
    doc: XmlDocument,
    root: XmlElement,
    partName: string,
    contentType: string,
): void {
    const overrides = root.getElementsByTagNameNS(
        CONTENT_TYPES_NS,
        "Override",
    );

    for (let i = 0; i < overrides.length; i++) {
        const override = overrides.item(i) as XmlElement | null;
        if (override?.getAttribute("PartName") === partName) {
            override.setAttribute("ContentType", contentType);
            return;
        }
    }

    const override = doc.createElementNS(CONTENT_TYPES_NS, "Override");
    override.setAttribute("PartName", partName);
    override.setAttribute("ContentType", contentType);
    root.appendChild(override);
}

function createPageNumberPart(
    partType: "header" | "footer",
    alignment: "left" | "center" | "right",
): string {
    const rootName = partType === "header" ? "hdr" : "ftr";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:${rootName} xmlns:w="${W_NS}">
  <w:p>
    <w:pPr>
      <w:jc w:val="${alignment}"/>
    </w:pPr>
    <w:r>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:instrText xml:space="preserve"> PAGE </w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
</w:${rootName}>`;
}

async function applyPageNumbering(
    zip: JSZip,
    document: XmlDocument,
    rules: DocxFormattingRules,
): Promise<void> {
    const options = rules.pageNumbering;
    if (!options?.enabled) return;

    const position = options.position ?? "footer";
    const alignment = options.alignment ?? "center";
    const partName = position === "header" ? "header1.xml" : "footer1.xml";
    const partPath = `word/${partName}`;

    const relsPath = "word/_rels/document.xml.rels";
    const relsFile = zip.file(relsPath);

    const relsDoc = relsFile
        ? parseXml(await relsFile.async("string"), relsPath)
        : createXmlDocument("Relationships", REL_NS);

    const relsRoot = relsDoc.documentElement;
    if (!relsRoot) throw new Error("Không thể đọc document relationships.");

    const relationshipType =
        position === "header"
            ? "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header"
            : "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";

    const relationshipId = getOrCreatePackageRelationship(
        relsDoc,
        relsRoot,
        relationshipType,
        partName,
    );

    zip.file(relsPath, serializeXml(relsDoc));
    zip.file(partPath, createPageNumberPart(position, alignment));

    const typesPath = "[Content_Types].xml";
    const typesFile = zip.file(typesPath);
    if (!typesFile) throw new Error("DOCX thiếu [Content_Types].xml.");

    const typesDoc = parseXml(await typesFile.async("string"), typesPath);
    const typesRoot = typesDoc.documentElement;
    if (!typesRoot) throw new Error("Không thể đọc Content Types.");

    ensureContentTypeOverride(
        typesDoc,
        typesRoot,
        `/${partPath}`,
        position === "header"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
    );
    zip.file(typesPath, serializeXml(typesDoc));

    const sections = elementsByTag(document, "sectPr");
    if (sections.length === 0) {
        throw new Error("Không tìm thấy section trong tài liệu Word.");
    }

    const referenceName =
        position === "header" ? "headerReference" : "footerReference";

    for (const section of sections) {
        let reference = directChild(section, referenceName);
        if (!reference) {
            reference = document.createElementNS(
                W_NS,
                `w:${referenceName}`,
            );
            // headerReference / footerReference phải đứng trước pgSz, pgMar…
            const first = section.firstChild;
            if (first) section.insertBefore(reference, first);
            else section.appendChild(reference);
        }

        setWAttribute(reference, "type", "default");
        reference.setAttributeNS(R_NS, "r:id", relationshipId);

        if (options.hideFirstPage) {
            getOrCreateChild(document, section, "titlePg");
        }

        if (options.startAt !== undefined) {
            const pgNumType = getOrCreateChild(
                document,
                section,
                "pgNumType",
            );
            setWAttribute(pgNumType, "start", String(options.startAt));
        }
    }

    // Bật cập nhật field khi mở file
    const settingsPath = "word/settings.xml";
    const settingsFile = zip.file(settingsPath);
    if (settingsFile) {
        const settingsDoc = parseXml(
            await settingsFile.async("string"),
            settingsPath,
        );
        const settingsRoot = settingsDoc.documentElement;
        if (settingsRoot) {
            const updateFields = getOrCreateChild(
                settingsDoc,
                settingsRoot,
                "updateFields",
            );
            setWAttribute(updateFields, "val", "true");
            zip.file(settingsPath, serializeXml(settingsDoc));
        }
    }

    if (options.hideFirstPage && sections[0]) {
        getOrCreateChild(document, sections[0], "titlePg");
    }
}

function createHeadingNumberingXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${NUMBERING_NS}">
  <w:abstractNum w:abstractNumId="99">
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1.%2"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:tabs><w:tab w:val="num" w:pos="1080"/></w:tabs>
        <w:ind w:left="1080" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="2">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1.%2.%3"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:tabs><w:tab w:val="num" w:pos="1440"/></w:tabs>
        <w:ind w:left="1440" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="99">
    <w:abstractNumId w:val="99"/>
  </w:num>
</w:numbering>`;
}

async function applyHeadingNumbering(
    zip: JSZip,
    document: XmlDocument,
    rules: DocxFormattingRules,
): Promise<void> {
    const options = rules.headingNumbering;
    if (!options?.enabled) return;

    const numberingPath = "word/numbering.xml";
    const numberingFile = zip.file(numberingPath);

    let numberingDoc: XmlDocument;
    if (numberingFile) {
        numberingDoc = parseXml(
            await numberingFile.async("string"),
            numberingPath,
        );
    } else {
        numberingDoc = parseXml(
            createHeadingNumberingXml(),
            numberingPath,
        );
    }

    const numberingRoot = numberingDoc.documentElement;
    if (!numberingRoot) {
        throw new Error("Không thể tạo cấu hình đánh số tiêu đề.");
    }

    // Tìm numId / abstractNumId chưa dùng
    let numId = 1;
    for (const num of elementsByTag(numberingDoc, "num")) {
        const v = getAttributeByLocalName(num, "numId");
        if (v && Number(v) >= numId) numId = Number(v) + 1;
    }

    let abstractNumId = 1;
    for (const abs of elementsByTag(numberingDoc, "abstractNum")) {
        const v = getAttributeByLocalName(abs, "abstractNumId");
        if (v && Number(v) >= abstractNumId) abstractNumId = Number(v) + 1;
    }

    const generatedXml = parseXml(
        createHeadingNumberingXml(),
        numberingPath,
    );
    const abstractNumTemplate =
        elementsByTag(generatedXml, "abstractNum")[0];
    const numTemplate = elementsByTag(generatedXml, "num")[0];

    if (!abstractNumTemplate || !numTemplate) {
        throw new Error("Mẫu đánh số tiêu đề không hợp lệ.");
    }

    const abstractNum = numberingDoc.importNode(
        abstractNumTemplate,
        true,
    ) as XmlElement;
    setWAttribute(abstractNum, "abstractNumId", String(abstractNumId));

    const num = numberingDoc.importNode(numTemplate, true) as XmlElement;
    setWAttribute(num, "numId", String(numId));

    const abstractIdChild = directChild(num, "abstractNumId");
    if (abstractIdChild) {
        setWAttribute(abstractIdChild, "val", String(abstractNumId));
    }

    numberingRoot.appendChild(abstractNum);
    numberingRoot.appendChild(num);

    // Gắn numbering vào các đoạn Heading1/2/3
    const maxLevel = options.maxLevel ?? 3;
    for (const paragraph of elementsByTag(document, "p")) {
        const pPr = directChild(paragraph, "pPr");
        const pStyle = pPr ? directChild(pPr, "pStyle") : null;
        if (!pStyle) continue;

        const styleValue = getAttributeByLocalName(pStyle, "val");
        if (!styleValue) continue;

        const match = styleValue.match(/^Heading([1-3])$/i);
        if (!match) continue;

        const level = Number(match[1]);
        if (level > maxLevel) continue;

        const paragraphProperties = getOrCreateChild(
            document,
            paragraph,
            "pPr",
        );
        const numPr = getOrCreateChild(
            document,
            paragraphProperties,
            "numPr",
        );
        setChildValue(document, numPr, "ilvl", String(level - 1));
        setChildValue(document, numPr, "numId", String(numId));
    }

    zip.file(numberingPath, serializeXml(numberingDoc));

    // Relationship
    const relsPath = "word/_rels/document.xml.rels";
    const relsFile = zip.file(relsPath);
    if (!relsFile) {
        throw new Error(
            "Không tìm thấy document.xml.rels để đăng ký numbering.",
        );
    }

    const relsDoc = parseXml(await relsFile.async("string"), relsPath);
    const relsRoot = relsDoc.documentElement;
    if (!relsRoot) throw new Error("Không thể đọc document relationships.");

    getOrCreatePackageRelationship(
        relsDoc,
        relsRoot,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering",
        "numbering.xml",
    );
    zip.file(relsPath, serializeXml(relsDoc));

    // Content type
    const typesPath = "[Content_Types].xml";
    const typesFile = zip.file(typesPath);
    if (!typesFile) throw new Error("DOCX thiếu [Content_Types].xml.");

    const typesDoc = parseXml(await typesFile.async("string"), typesPath);
    const typesRoot = typesDoc.documentElement;
    if (!typesRoot) throw new Error("Không thể đọc Content Types.");

    ensureContentTypeOverride(
        typesDoc,
        typesRoot,
        "/word/numbering.xml",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml",
    );
    zip.file(typesPath, serializeXml(typesDoc));
}

function createTableOfContentsParagraphs(
    doc: XmlDocument,
    title: string,
    maxLevel: 1 | 2 | 3,
): XmlElement[] {
    const paragraphs: XmlElement[] = [];

    // Tiêu đề mục lục
    const titleParagraph = doc.createElementNS(W_NS, "w:p");
    const titlePPr = doc.createElementNS(W_NS, "w:pPr");
    const titleStyle = doc.createElementNS(W_NS, "w:pStyle");
    setWAttribute(titleStyle, "val", "Title");
    titlePPr.appendChild(titleStyle);
    titleParagraph.appendChild(titlePPr);

    const titleRun = doc.createElementNS(W_NS, "w:r");
    const titleText = doc.createElementNS(W_NS, "w:t");
    titleText.appendChild(doc.createTextNode(title));
    titleRun.appendChild(titleText);
    titleParagraph.appendChild(titleRun);
    paragraphs.push(titleParagraph);

    // Trường TOC
    const tocParagraph = doc.createElementNS(W_NS, "w:p");

    const beginRun = doc.createElementNS(W_NS, "w:r");
    const beginField = doc.createElementNS(W_NS, "w:fldChar");
    setWAttribute(beginField, "fldCharType", "begin");
    beginRun.appendChild(beginField);
    tocParagraph.appendChild(beginRun);

    const instrRun = doc.createElementNS(W_NS, "w:r");
    const instr = doc.createElementNS(W_NS, "w:instrText");
    instr.setAttributeNS(
        "http://www.w3.org/XML/1998/namespace",
        "xml:space",
        "preserve",
    );
    instr.appendChild(
        doc.createTextNode(` TOC \\o "1-${maxLevel}" \\h \\z \\u `),
    );
    instrRun.appendChild(instr);
    tocParagraph.appendChild(instrRun);

    const sepRun = doc.createElementNS(W_NS, "w:r");
    const sepField = doc.createElementNS(W_NS, "w:fldChar");
    setWAttribute(sepField, "fldCharType", "separate");
    sepRun.appendChild(sepField);
    tocParagraph.appendChild(sepRun);

    const placeholderRun = doc.createElementNS(W_NS, "w:r");
    const placeholderText = doc.createElementNS(W_NS, "w:t");
    placeholderText.appendChild(
        doc.createTextNode(
            "Nhấn chuột phải → Update Field để cập nhật mục lục.",
        ),
    );
    placeholderRun.appendChild(placeholderText);
    tocParagraph.appendChild(placeholderRun);

    const endRun = doc.createElementNS(W_NS, "w:r");
    const endField = doc.createElementNS(W_NS, "w:fldChar");
    setWAttribute(endField, "fldCharType", "end");
    endRun.appendChild(endField);
    tocParagraph.appendChild(endRun);

    paragraphs.push(tocParagraph);
    return paragraphs;
}

async function applyTableOfContents(
    zip: JSZip,
    document: XmlDocument,
    rules: DocxFormattingRules,
): Promise<void> {
    const options = rules.tableOfContents;
    if (!options?.enabled) return;

    const body = elementsByTag(document, "body")[0];
    if (!body) {
        throw new Error(
            "Không tìm thấy nội dung chính của tài liệu Word.",
        );
    }

    // Tránh chèn trùng
    const existingInstructions = elementsByTag(document, "instrText");
    const hasExistingToc = existingInstructions.some((el) =>
        (el.textContent ?? "").includes("TOC"),
    );
    if (hasExistingToc) {
        throw new Error(
            "Tài liệu đã có trường mục lục. Vui lòng cập nhật mục lục hiện có trong Word trước khi tạo lại.",
        );
    }

    const title = options.title?.trim() || "MỤC LỤC";
    const maxLevel = options.maxLevel ?? 3;

    const paragraphs = createTableOfContentsParagraphs(
        document,
        title,
        maxLevel,
    );

    const firstContent = body.firstChild;
    for (const paragraph of paragraphs) {
        if (firstContent) {
            body.insertBefore(paragraph, firstContent);
        } else {
            body.appendChild(paragraph);
        }
    }

    // Bật updateFields
    const settingsPath = "word/settings.xml";
    const settingsFile = zip.file(settingsPath);
    if (settingsFile) {
        const settingsDoc = parseXml(
            await settingsFile.async("string"),
            settingsPath,
        );
        const settingsRoot = settingsDoc.documentElement;
        if (settingsRoot) {
            const updateFields = getOrCreateChild(
                settingsDoc,
                settingsRoot,
                "updateFields",
            );
            setWAttribute(updateFields, "val", "true");
            zip.file(settingsPath, serializeXml(settingsDoc));
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

    const zip = await JSZip.loadAsync(input, { checkCRC32: true });

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

    // 1. Đoạn văn + font/size trực tiếp trên mọi run
    const paragraphs = elementsByTag(document, "p");
    for (const paragraph of paragraphs) {
        applyParagraphFormatting(document, paragraph, rules);
        applyRunFormattingToParagraph(document, paragraph, runRules);
    }

    // 2. Ghi đè styles.xml (docDefaults + Normal + Heading + xóa theme)
    await applyDefaultStyles(zip, rules);

    // 3. Lề trang
    applyPageMargins(document, rules);

    // 4. Các tính năng còn lại
    await applyPageNumbering(zip, document, rules);
    await applyHeadingNumbering(zip, document, rules);
    await applyTableOfContents(zip, document, rules);

    zip.file("word/document.xml", serializeXml(document));

    return zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}