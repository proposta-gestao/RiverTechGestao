import { BrowserRouter, Routes, Route } from 'react-router';
import { AdminClientList } from './pages/AdminClientList';
import { AdminClientForm } from './pages/AdminClientForm';
import { AdminMenuProfiles } from './pages/AdminMenuProfiles';
import { ClientMenu } from './pages/ClientMenu';
import { AttendantPanel } from './pages/AttendantPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminClientList />} />
        <Route path="/admin/client/:id" element={<AdminClientForm />} />
        <Route path="/admin/profiles" element={<AdminMenuProfiles />} />
        <Route path="/client/menu" element={<ClientMenu />} />
        <Route path="/attendant" element={<AttendantPanel />} />
      </Routes>
    </BrowserRouter>
  );
}