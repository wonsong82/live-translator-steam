import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import PresentationTranslate from './pages/PresentationTranslate';
import Settings from './pages/Settings';
import Translate from './pages/Translate';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/translate" element={<Translate />} />
        <Route path="/present" element={<PresentationTranslate />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
