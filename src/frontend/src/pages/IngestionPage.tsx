import { useParams } from 'react-router-dom';
export function IngestionPage() {
  const { jobId } = useParams();
  return <div><h1>Processing Manual</h1><p>Job: {jobId}</p></div>;
}
