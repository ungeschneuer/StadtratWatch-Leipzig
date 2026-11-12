import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LeipzigSessionReview, LeipzigSessions } from './leipzig/LeipzigReview';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/leipzig" element={<LeipzigSessions />} />
        <Route path="/leipzig/:sessionDate" element={<LeipzigSessionReview />} />
        <Route path="*" element={<Navigate to="/leipzig" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
