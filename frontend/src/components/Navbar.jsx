import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Bell } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import socket from "../services/socket";
import { getMyNotifications, markAsRead } from "../services/notificationApi";
import { toast } from "react-toastify";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await getMyNotifications();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch {
      console.error("Failed to fetch notifications");
    }
  }, []);

  const handleNotificationClick = useCallback(async (notif) => {
    try {
      if (!notif.isRead) {
        await markAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
      }
      setShowNotifications(false);
      setIsOpen(false);
      if (notif.link) navigate(notif.link);
    } catch {
      console.error("Error marking notification as read");
      toast.error("Could not update notification");
    }
  }, [navigate]);

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      fetchNotifications();

      // Socket connection
      socket.connect();
      socket.emit("join_user_room", user._id);
      console.log(`📡 Frontend: Joining notification room for user ${user._id}`);

      socket.on("new_notification", (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        toast.info(`🔔 ${notification.title}`, {
          onClick: () => handleNotificationClick(notification)
        });
      });

      return () => {
        socket.off("new_notification");
        socket.disconnect();
      };
    }
  }, [fetchNotifications, handleNotificationClick, isAuthenticated, user?._id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
    setIsOpen(false);
    setShowNotifications(false);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setShowNotifications(false);
  };

  const notificationDropdown = (
    <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Notifications</h3>
        <button
          type="button"
          onClick={() => setShowNotifications(false)}
          className="text-xs text-gray-500 hover:text-[#9CAF88]"
        >
          Close
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No notifications yet</p>
        ) : (
          notifications.map((notif) => (
            <button
              type="button"
              key={notif._id}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full text-left p-4 border-b transition hover:bg-gray-50 ${
                !notif.isRead ? "bg-blue-50/50" : ""
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <h4 className={`text-sm font-bold ${!notif.isRead ? "text-blue-700" : "text-gray-800"}`}>
                  {notif.title}
                </h4>
                {!notif.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 shrink-0" />}
              </div>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
              <span className="text-[10px] text-gray-400 mt-2 block">
                {new Date(notif.createdAt).toLocaleTimeString()}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <nav className="bg-white/90 backdrop-blur-md shadow-sm border-b fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            to="/"
            className="text-xl sm:text-2xl font-bold tracking-wide text-gray-800 ml-12"
            onClick={closeMenu}
          >
            Edu<span className="text-[#9CAF88]">Nova</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">

            <Link
              to="/"
              className="text-gray-700 hover:text-[#9CAF88] font-medium transition"
            >
              Home
            </Link>

            <Link
              to="/about"
              className="text-gray-700 hover:text-[#9CAF88] font-medium transition"
            >
              About
            </Link>

            <Link
              to="/dashboard"
              className="text-gray-700 hover:text-[#9CAF88] font-medium transition"
            >
              Dashboard
            </Link>

            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="text-gray-700 hover:text-[#9CAF88] transition relative mt-2"
                  aria-label="Notifications"
                >
                  <Bell size={24} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && notificationDropdown}
              </div>
            )}

            {!isAuthenticated ? (
              <Link
                to="/login"
                className="bg-[#9CAF88] text-white px-4 py-2 rounded-full font-semibold shadow hover:bg-[#88b07a] transition"
              >
                Login
              </Link>
            ) : (
              <button
                onClick={handleLogout}
                className="bg-[#9CAF88] text-white px-4 py-2 rounded-full font-semibold shadow hover:bg-[#758467] transition"
              >
                Logout
              </button>
            )}

          </div>

          {/* Mobile Button */}
          <div className="md:hidden flex items-center space-x-4">
            {isAuthenticated && (
              <div className="relative">
               <button
                 type="button"
                 onClick={() => setShowNotifications((prev) => !prev)}
                 className="text-gray-700 relative"
                 aria-label="Notifications"
               >
                 <Bell size={24} />
                 {unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                     {unreadCount}
                   </span>
                 )}
               </button>
               {showNotifications && notificationDropdown}
             </div>
            )}
            <button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden bg-white border-t px-6 py-4 space-y-4 transition-all duration-300 ${
          isOpen ? "block" : "hidden"
        }`}
      >

        <Link
          to="/"
          onClick={closeMenu}
          className="block text-gray-700 hover:text-[#9CAF88]"
        >
          Home
        </Link>

        <Link
          to="/about"
          onClick={closeMenu}
          className="block text-gray-700 hover:text-[#9CAF88]"
        >
          About
        </Link>

        <Link
          to="/dashboard"
          onClick={closeMenu}
          className="block text-gray-700 hover:text-[#9CAF88]"
        >
          Dashboard
        </Link>

        {!isAuthenticated ? (
          <Link
            to="/login"
            onClick={closeMenu}
            className="block text-center bg-[#9CAF88] text-white py-2 rounded-full font-semibold"
          >
            Login
          </Link>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full bg-[#9CAF88] text-white py-2 rounded-full font-semibold"
          >
            Logout
          </button>
        )}

      </div>
    </nav>
  );
}

export default Navbar;
