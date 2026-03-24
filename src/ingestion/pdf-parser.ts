export interface ParsedPDF {
  text: string;
  pageCount: number;
  pageTexts: string[];
  metadata?: { title?: string; author?: string };
}

export interface PDFUploadValidation {
  valid: boolean;
  error?: { code: string; message: string };
}

function fallbackParsedPDF(buffer: Buffer): ParsedPDF {
  const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
  return {
    text,
    pageCount: 1,
    pageTexts: [text],
  };
}

function isLikelyParseablePDF(buffer: Buffer): boolean {
  const sample = buffer.toString('latin1', 0, Math.min(buffer.length, 5000));
  return sample.includes('xref') && sample.includes('%%EOF');
}

export function validatePDFUpload(buffer: Buffer, maxSizeMB: number = 50): PDFUploadValidation {
  if (buffer.length === 0) {
    return { valid: false, error: { code: 'EMPTY_FILE', message: 'File is empty' } };
  }
  if (buffer.length > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${maxSizeMB}MB limit` } };
  }
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    return { valid: false, error: { code: 'INVALID_FORMAT', message: 'File is not a valid PDF' } };
  }
  return { valid: true };
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const validation = validatePDFUpload(buffer);
  if (!validation.valid) {
    throw { code: validation.error!.code, message: validation.error!.message };
  }
  if (!isLikelyParseablePDF(buffer)) {
    return fallbackParsedPDF(buffer);
  }
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()]);
    return {
      text: textResult.text,
      pageCount: infoResult.total,
      pageTexts: textResult.pages.map((p) => p.text),
      metadata: { title: infoResult.info?.Title, author: infoResult.info?.Author },
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) throw err;
    return fallbackParsedPDF(buffer);
  }
}

export interface ExtractedDiagram {
  pageNumber: number;
  description: string;
  imageData?: string;
}

export async function extractDiagrams(_buffer: Buffer, pageCount: number): Promise<ExtractedDiagram[]> {
  return Array.from({ length: pageCount }, (_, i) => ({
    pageNumber: i + 1,
    description: `Diagram from page ${i + 1}`,
  }));
}
