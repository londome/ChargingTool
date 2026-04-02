import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import ProjectWizard from './pages/wizard/ProjectWizard';
import TourUpload from './pages/upload/TourUpload';
import FleetResults from './pages/results/FleetResults';
import TourResults from './pages/results/TourResults';
import InfrastructureResults from './pages/results/InfrastructureResults';
import ScenarioManager from './pages/scenarios/ScenarioManager';
import EVLibrary from './pages/evLibrary/EVLibrary';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="wizard" element={<Navigate to="/projekte/neu" replace />} />
          <Route path="projekte/neu" element={<ProjectWizard />} />
          <Route path="projekte/:projectId/wizard" element={<ProjectWizard />} />
          <Route path="projekte/:projectId/upload" element={<TourUpload />} />
          <Route path="projekte/:projectId/ergebnisse" element={<FleetResults />} />
          <Route path="projekte/:projectId/ergebnisse/touren" element={<TourResults />} />
          <Route path="projekte/:projectId/ergebnisse/infrastruktur" element={<InfrastructureResults />} />
          <Route path="projekte/:projectId/szenarien" element={<ScenarioManager />} />
          <Route path="ergebnisse" element={<FleetResults />} />
          <Route path="fahrzeuge" element={<EVLibrary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
