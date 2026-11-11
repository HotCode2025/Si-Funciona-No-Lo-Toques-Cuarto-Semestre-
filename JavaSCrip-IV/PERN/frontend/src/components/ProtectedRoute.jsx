import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute({ isAuth, redirectTo = "/login" }) {
  if (!isAuth) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;