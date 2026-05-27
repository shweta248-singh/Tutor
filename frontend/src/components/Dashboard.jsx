import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.role) {
      navigate("/login");
    } else if (user.role === "student") {
      navigate("/student-dashboard");
    } else if (user.role === "teacher") {
      navigate("/teacher-dashboard");
    } else if (user.role === "admin") {
      navigate("/admin-dashboard");
    } else {
      navigate("/student-dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-700">
          Redirecting...
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mt-2">
          Please wait while we take you to your dashboard
        </p>
        <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 mx-auto"></div>
      </div>
    </div>
  );
}

export default Dashboard;
