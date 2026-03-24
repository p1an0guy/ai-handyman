import { useState, useEffect, useCallback } from 'react';

interface OfflineIndicatorProps {
  onReconnect?: () => void;
}

export function OfflineIndicator({ onReconnect }: OfflineIndicatorProps) {
  const [online, setOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    setOnline(true);
    if (wasOffline && onReconnect) {
      onReconnect();
    }
    setWasOffline(false);
  }, [wasOffline, onReconnect]);

  const handleOffline = useCallback(() => {
    setOnline(false);
    setWasOffline(true);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  if (online) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#ff9800', color: '#fff', padding: '10px',
      textAlign: 'center', zIndex: 1000,
    }}>
      You are offline. Changes will sync when connection is restored.
    </div>
  );
}
