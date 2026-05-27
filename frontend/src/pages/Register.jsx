import { Navigate } from 'react-router-dom';

// Registration is handled by the unified auth page.
const Register = () => <Navigate to="/login?mode=signup" replace />;

export { Register };
export default Register;
