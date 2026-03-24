export type BoundingBox = { x: number; y: number; width: number; height: number };
export type DiagramEntry = { diagram_id: string; step_id: string; page_number: number; bounding_box: BoundingBox; image_ref: string; description?: string };
export type DiagramIndex = { manual_id: string; entries: DiagramEntry[] };
