import { useRef, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function openCamera() {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setCameraError('Camera access denied or unavailable.');
    }
  }

  function capture() {
    if (!videoRef.current || !stream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    stream.getTracks().forEach(t => t.stop());
    setStream(null);
    onCapture(base64);
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {cameraError && <p style={{ color: '#c62828' }}>{cameraError}</p>}
      {stream ? (
        <div>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', display: 'block' }} />
          <button onClick={capture} style={{ marginTop: '8px' }}>Capture Photo</button>
        </div>
      ) : (
        <button onClick={openCamera} disabled={disabled}>Open Camera</button>
      )}
    </div>
  );
}
