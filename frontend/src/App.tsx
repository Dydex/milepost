import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SorobanProvider } from './context/SorobanContext';
import { WalletProvider } from './context/WalletContext';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { FunderDashboard } from './pages/FunderDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { VerifierDashboard } from './pages/VerifierDashboard';
import { Standing } from './pages/Standing';
import { ApplicationTimeline } from './pages/ApplicationTimeline';
import { AwardProgress } from './pages/AwardProgress';

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <SorobanProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="funders" element={<FunderDashboard />} />
              <Route path="recipients" element={<RecipientDashboard />} />
              <Route path="verifiers" element={<VerifierDashboard />} />
              <Route path="standing" element={<Standing />} />
              <Route path="applications" element={<ApplicationTimeline />} />
              <Route path="award" element={<AwardProgress />} />
            </Route>
          </Routes>
        </Router>
      </SorobanProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
