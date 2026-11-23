import { Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import Layout from './components/Layout';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Browse from './pages/Browse';
import Dashboard from './pages/Dashboard';
import { DealerPublicPage, DealerSettingsPage } from './pages/Dealers';
import Favorites from './pages/Favorites';
import ListingForm from './pages/ListingForm';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import VehicleDetail from './pages/VehicleDetail';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/Auth';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vehicles" element={<Browse />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/vehicles/:id/edit" element={<RequireAuth roles={['seller', 'dealer', 'admin']}><ListingForm /></RequireAuth>} />
        <Route path="/sell" element={<RequireAuth roles={['seller', 'dealer']}><ListingForm /></RequireAuth>} />
        <Route path="/dealers/:id" element={<DealerPublicPage />} />
        <Route path="/dealer" element={<RequireAuth roles={['dealer']}><DealerSettingsPage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
