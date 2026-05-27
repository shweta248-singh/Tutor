import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { googleLogin } from "../store/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { toast } from "react-toastify";

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        email,
        password,
        role: role || "student",
        secretKey: role === "admin" || role === "teacher" ? secretKey : undefined,
      };

      const { data: res } = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        payload,
        { withCredentials: true }
      );

      dispatch({ type: "auth/LoginSuccess", payload: res.user });
      localStorage.setItem("user", JSON.stringify(res.user));
      toast.success("Logged in successfully");
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      setError(message);
      toast.error(message);
      dispatch({ type: "auth/LoginFailed", payload: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === "admin") {
        navigate("/admin-dashboard");
      } else if (user?.role === "teacher") {
        navigate("/teacher-dashboard");
      } else {
        navigate("/student-dashboard");
      }
    }
  }, [isAuthenticated, user?.role, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#dfe6da] px-4">
      <div className="bg-white shadow-xl rounded-3xl p-10 w-full max-w-md border-none">
        {/* Title */}
        <h2 className="text-3xl font-bold text-center mb-2 text-[#4f6f52]">
          Welcome Back
        </h2>

        <p className="text-center text-gray-500 mb-6">
          Login to your EduNova account
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9caf88] transition"
            required
          />

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-3 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9caf88] transition"
            required
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-5 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#9caf88] transition"
          >
            <option value="">Select Role (optional)</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>

          {(role === "admin" || role === "teacher") && (
            <input
              type="password"
              placeholder={
                role === "admin"
                  ? "Enter Admin Secret Code"
                  : "Enter Teacher Secret Code"
              }
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full px-5 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#9caf88] transition"
              required
            />
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#9caf88] hover:bg-[#87a977] text-white py-3 rounded-xl font-semibold shadow-md transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {error && (
            <p className="text-red-500 text-center text-sm">{error}</p>
          )}
        </form>

        {/* Google Login */}
        <div className="mt-4 flex justify-center">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              dispatch(googleLogin(credentialResponse.credential));
            }}
            onError={() => {
              console.log("Login Failed");
              toast.error("Google login failed");
            }}
            theme="outline"
            shape="circle"
            text="continue_with"
          />
        </div>

        {/* Register */}
        <p className="mt-6 text-center text-gray-600 text-sm">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-[#9caf88] font-semibold hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
