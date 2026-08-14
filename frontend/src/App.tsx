import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SorobanProvider } from './context/SorobanContext';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { FunderDashboard } from './pages/FunderDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { VerifierDashboard } from './pages/VerifierDashboard';

function App() {
  return (
    <ThemeProvider>
      <SorobanProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="funders" element={<FunderDashboard />} />
              <Route path="recipients" element={<RecipientDashboard />} />
              <Route path="verifiers" element={<VerifierDashboard />} />
            </Route>
          </Routes>
        </Router>
      </SorobanProvider>
    </ThemeProvider>
  );
}

export default App;
