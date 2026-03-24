import { v4 as uuidv4 } from 'uuid';
import type { ImageStore, ImageMetadata, ImageReference } from './interfaces.js';

export class InMemoryImageStore implements ImageStore {
  private store = new Map<string, { data: Buffer; metadata: ImageMetadata }>();

  async upload(image: Buffer, metadata: ImageMetadata): Promise<ImageReference> {
    const ref = uuidv4();
    this.store.set(ref, { data: Buffer.from(image), metadata });
    return { ref, path: `memory://${ref}` };
  }

  async retrieve(ref: ImageReference): Promise<Buffer> {
    const entry = this.store.get(ref.ref);
    if (!entry) throw new Error(`Image not found: ${ref.ref}`);
    return Buffer.from(entry.data);
  }
}
