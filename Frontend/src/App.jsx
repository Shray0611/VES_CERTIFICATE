import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import CertificateGenerator from "./components/CertificateGenerator";
import CertificateList from "./components/CertificateList";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminCertificates from "./components/AdminCertificates";
import AdminUsers from "./components/AdminUsers";
import VerifyCertificate from "./components/VerifyCertificate";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Auth isLogin={false} />} />
        <Route path="/login" element={<Auth isLogin={true} />} />

        <Route
          path="/certificates"
          element={
            <ProtectedRoute allowedRoles={["student", "admin"]}>
              <CertificateList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/generate"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CertificateGenerator />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/certificates"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminCertificates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route path="/verify/:code" element={<VerifyCertificate />} />
      </Routes>
    </Router>
  );
}
export default App;
