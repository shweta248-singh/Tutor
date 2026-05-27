import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { googleLogin } from "../store/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { toast } from "react-toastify";

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const [name, setName] = useState("");
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
      const data = {
        name,
        email,
        password,
        role: role || "student",
        secretKey: role === "admin" || role === "teacher" ? secretKey : undefined,
      };

      const { data: res } = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/register`,
        data,
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
      );

      dispatch({ type: "auth/RegisterSuccess", payload: res.user });
      localStorage.setItem("user", JSON.stringify(res.user));
      toast.success("Registered successfully");
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      setError(message);
      toast.error(message);
      dispatch({ type: "auth/RegisterFailed", payload: message });
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
    <div className="min-h-screen flex items-center justify-center bg-[#dfe6da] px-4 py-6">
      <div className="bg-white shadow-xl rounded-2xl sm:rounded-3xl p-6 sm:p-10 w-full max-w-md">
        {/* TITLE */}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#4f6f52]">
          Create Account
        </h2>

        <p className="text-center text-gray-500 mt-2 mb-6 text-sm sm:text-base">
          Register to start learning with EduNova
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 sm:px-5 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#9caf88] outline-none"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 sm:px-5 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#9caf88] outline-none"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 sm:px-5 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#9caf88] outline-none"
            required
          />

          {/* ROLE */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 sm:px-5 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#9caf88] outline-none"
          >
            <option value="">Select Role (optional)</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>

          {/* SECRET KEY */}
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
              className="w-full px-4 sm:px-5 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#9caf88] outline-none"
              required
            />
          )}

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#9caf88] hover:bg-[#87a977] text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Register"}
          </button>
        </form>

        {/* ERROR */}
        {error && (
          <p className="text-red-500 text-center text-sm mt-4 font-medium bg-red-50 py-2 rounded-lg border border-red-100 animate-pulse">
            {error}
          </p>
        )}

        {/* SUCCESS MESSAGE */}
        {isAuthenticated && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center animate-in fade-in duration-700">
            <p className="text-green-800 font-bold">Registration Successful! 🎉</p>
            <p className="text-green-700 text-sm mt-1">
              Please check your inbox to verify your email address.
            </p>
          </div>
        )}

        {/* Google Login */}
        <div className="mt-4 flex justify-center">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              dispatch(googleLogin(credentialResponse.credential));
            }}
            onError={() => {
              console.log("Login Failed");
              toast.error("Google registration failed");
            }}
            theme="outline"
            shape="circle"
            text="continue_with"
          />
        </div>

        {/* LOGIN LINK */}
        <p className="mt-6 text-center text-gray-600 text-sm">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[#4f6f52] font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
