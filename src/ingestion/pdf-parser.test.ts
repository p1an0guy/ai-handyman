import { describe, it, expect } from 'vitest';
import { validatePDFUpload } from './pdf-parser.js';

describe('validatePDFUpload', () => {
  it('rejects empty buffer', () => {
    const result = validatePDFUpload(Buffer.alloc(0));
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('EMPTY_FILE');
  });

  it('rejects oversized buffer', () => {
    const big = Buffer.alloc(51 * 1024 * 1024);
    const result = validatePDFUpload(big);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects non-PDF files', () => {
    const result = validatePDFUpload(Buffer.from('not a pdf'));
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('INVALID_FORMAT');
  });

  it('accepts valid PDF header', () => {
    const result = validatePDFUpload(Buffer.from('%PDF-1.4 fake content'));
    expect(result.valid).toBe(true);
  });
});
