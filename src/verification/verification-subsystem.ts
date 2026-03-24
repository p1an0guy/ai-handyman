import type { AIAdapter } from '../ai/ai-adapter.js';
import type { VisualCue, MismatchClassification, MismatchType } from '../models/index.js';

export interface VerificationResult {
  passed: boolean;
  confidence_score: number;
  mismatch_detected: boolean;
  mismatch_classification?: MismatchClassification;
  guidance?: string;
}

export interface DiagramReference {
  diagram_id: string;
  image_ref: string;
  description?: string;
}

export class VerificationSubsystem {
  constructor(private readonly aiAdapter: AIAdapter) {}

  async compareEvidence(
    evidenceBase64: string,
    expectedCues: VisualCue[],
    diagramRef?: DiagramReference,
  ): Promise<VerificationResult> {
    const cueDescriptions = expectedCues.map(c => c.description).join('; ');
    const prompt = `Compare this assembly evidence image against the expected visual cues.\n\nExpected cues: ${cueDescriptions}${diagramRef ? `\nDiagram: ${diagramRef.description ?? diagramRef.diagram_id}` : ''}\n\nReturn JSON: { "passed": <bool>, "confidence_score": <0.0-1.0>, "mismatch_detected": <bool>, "mismatch_type": "<wrong_part|wrong_orientation|missing_part|incomplete_step|other|null>", "mismatch_description": "<string_or_null>", "guidance": "<string_or_null>" }`;

    const response = await this.aiAdapter.sendMultimodalRequest({
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image', data: evidenceBase64 },
      ]}],
      response_format: 'json',
    });

    return this.parseVerificationResult(response.content);
  }

  async classifyMismatch(
    evidenceBase64: string,
    expectedCues: VisualCue[],
  ): Promise<MismatchClassification> {
    const cueDescriptions = expectedCues.map(c => c.description).join('; ');
    const prompt = `Classify the mismatch between this assembly evidence and the expected result.\n\nExpected: ${cueDescriptions}\n\nReturn JSON: { "type": "<wrong_part|wrong_orientation|missing_part|incomplete_step|other>", "description": "<description>", "confidence_score": <0.0-1.0> }`;

    const response = await this.aiAdapter.sendMultimodalRequest({
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image', data: evidenceBase64 },
      ]}],
      response_format: 'json',
    });

    return this.parseMismatchClassification(response.content);
  }

  private parseVerificationResult(content: string): VerificationResult {
    try {
      const parsed = JSON.parse(content);
      const result: VerificationResult = {
        passed: Boolean(parsed.passed),
        confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
        mismatch_detected: Boolean(parsed.mismatch_detected),
        guidance: parsed.guidance ?? undefined,
      };
      if (result.mismatch_detected && parsed.mismatch_type) {
        result.mismatch_classification = {
          type: this.normalizeMismatchType(parsed.mismatch_type),
          description: parsed.mismatch_description ?? 'Mismatch detected',
          confidence_score: result.confidence_score,
        };
      }
      return result;
    } catch {
      return { passed: false, confidence_score: 0, mismatch_detected: false, guidance: 'Unable to parse verification result' };
    }
  }

  private parseMismatchClassification(content: string): MismatchClassification {
    try {
      const parsed = JSON.parse(content);
      return {
        type: this.normalizeMismatchType(parsed.type),
        description: parsed.description ?? 'Unknown mismatch',
        confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
      };
    } catch {
      return { type: 'other', description: 'Unable to classify mismatch', confidence_score: 0 };
    }
  }

  private normalizeMismatchType(type: string): MismatchType {
    const valid: MismatchType[] = ['wrong_part', 'wrong_orientation', 'missing_part', 'incomplete_step', 'other'];
    return valid.includes(type as MismatchType) ? (type as MismatchType) : 'other';
  }
}
