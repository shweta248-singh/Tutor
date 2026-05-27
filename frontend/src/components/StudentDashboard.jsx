import React, { useState, useEffect } from "react";
import { FaUserCircle, FaPaperPlane } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";

/* ---------------- AI CHAT ---------------- */
const API_URL = import.meta.env.VITE_API_URL;

export const AIChatSection = () => {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const tempText = inputText;
    setInputText("");

    try {
      const res = await axios.post(
        `${API_URL}/chat/send`,
        { inputText: tempText, action: "explain" },
        { withCredentials: true }
      );

      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "⚠️ AI error occurred" },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#dfe6da]">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-4 shadow-md bg-gradient-to-r from-[#4f6f52] to-[#9caf88] text-white">
        <h2 className="text-lg font-semibold">AI Chat Assistant</h2>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {messages.length === 0 ? (
          <p className="text-center text-lg">
            <span className="text-2xl font-semibold">
              Welcome {user?.name}
            </span>
            <br />
            How may I help you?
          </p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "ai" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`px-4 py-3 rounded-xl max-w-[80%] whitespace-pre-wrap shadow text-sm ${
                  msg.role === "ai"
                    ? "bg-white text-gray-800"
                    : "bg-gradient-to-r from-[#4f6f52] to-[#9caf88] text-white"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}

      </div>

      {/* INPUT */}
      <div className="border-t bg-[#dfe6da] p-3">
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">

          <textarea
            rows={1}
            className="flex-1 outline-none resize-none text-sm"
            placeholder="Send a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), handleSend())
            }
          />

          <button
            onClick={handleSend}
            className="w-10 h-10 bg-[#4f6f52] text-white rounded-lg"
          >
            <FaPaperPlane />
          </button>

        </div>
      </div>

    </div>
  );
};

/* ---------------- DASHBOARD ---------------- */

const StudentDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const studentId = user?._id;
  const avatarUrl =
    typeof user?.avatar === "string" ? user.avatar : user?.avatar?.url;

  const [profileImage, setProfileImage] = useState(avatarUrl);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setProfileImage(avatarUrl || "");
    setImageLoadFailed(false);
  }, [avatarUrl]);

  return (
    <div className="flex h-screen pt-16 bg-[#dfe6da] overflow-hidden">

      {/* ☰ ONLY MOBILE BUTTON */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-[#4f6f52] text-white p-2 rounded-lg"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      {/* OVERLAY (MOBILE ONLY) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 md:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full w-72
          bg-gradient-to-b from-[#4f6f52] via-[#6f8f6a] to-[#9caf88]
          text-white p-4 sm:p-6 flex flex-col overflow-y-auto gap-3
          transition-transform duration-300 z-50
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >

        <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 mt-16 md:mt-0">
          Student Dashboard
        </h2>

        {/* PROFILE */}
        <div className="flex flex-col items-center">

          {profileImage && !imageLoadFailed ? (
            <img
              src={profileImage}
              alt="Profile"
              referrerPolicy="no-referrer"
              onError={() => setImageLoadFailed(true)}
              className="w-24 sm:w-32 h-24 sm:h-32 rounded-full object-cover border-4 border-[#dfe6da]"
            />
          ) : (
            <FaUserCircle className="w-24 sm:w-32 h-24 sm:h-32 text-white" />
          )}

          <h3 className="mt-3 font-semibold">{user?.name}</h3>

        </div>

        {/* LINKS */}
        <ul className="space-y-3 mt-6">

          <li><Link onClick={() => setSidebarOpen(false)} to="/student/questions">Assignments</Link></li>
          <li><Link onClick={() => setSidebarOpen(false)} to="/student/change-password">Change Password</Link></li>
          <li><Link onClick={() => setSidebarOpen(false)} to="/student/change-profile">Change Profile</Link></li>
          <li><Link onClick={() => setSidebarOpen(false)} to={`/student/${studentId}/leaderboard`}>Leaderboard</Link></li>
          <li><Link onClick={() => setSidebarOpen(false)} to="/student-content">Contents/Notes</Link></li>
          <li><Link onClick={() => setSidebarOpen(false)} to="/student/quiz">Quiz</Link></li>

        </ul>

      </div>

      {/* CHAT AREA (UNCHANGED) */}
      <div className="flex-1 h-full">
        <AIChatSection />
      </div>

    </div>
  );
};

export default StudentDashboard;
