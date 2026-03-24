import { useParams } from 'react-router-dom';
export function SessionPage() {
  const { sessionId } = useParams();
  return <div><h1>Assembly Session</h1><p>Session: {sessionId}</p></div>;
}
