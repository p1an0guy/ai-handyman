export type ErrorDetails = { current_state?: string; attempted_transition?: string; affected_pages?: number[]; retry_after_ms?: number };
export type ErrorResponse = { error: { code: string; message: string; details: ErrorDetails } };
