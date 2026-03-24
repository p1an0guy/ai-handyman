import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage';
import { IngestionPage } from './pages/IngestionPage';
import { SessionPage } from './pages/SessionPage';
import { OfflineIndicator } from './components/OfflineIndicator';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/ingestion/:jobId" element={<IngestionPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
      </Routes>
      <OfflineIndicator onReconnect={() => window.location.reload()} />
    </BrowserRouter>
  );
}

export default App;
