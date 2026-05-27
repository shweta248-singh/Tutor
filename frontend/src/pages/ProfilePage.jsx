import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateProfile } from "../store/slices/profileSlice";

const ProfilePage = () => {
  const dispatch = useDispatch();

  const { user: authUser } = useSelector((state) => state.auth);
  const { loading, user: updatedUser } = useSelector((state) => state.prof);
  const authAvatar =
    typeof authUser?.avatar === "string" ? authUser.avatar : authUser?.avatar?.url;

  const [name, setName] = useState(authUser?.name || "");
  const [email, setEmail] = useState(authUser?.email || "");
  const [avatar, setAvatar] = useState(authAvatar || "");
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);

      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (updatedUser) {
      setName(updatedUser.name || "");
      setEmail(updatedUser.email || "");
      setAvatar(
        typeof updatedUser.avatar === "string"
          ? updatedUser.avatar
          : updatedUser.avatar?.url || ""
      );
      setAvatarLoadFailed(false);
    }
  }, [updatedUser]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    dispatch(updateProfile(formData));
  };

  return (
    <div className="min-h-screen bg-[#dfe6da] flex items-center justify-center px-4 pt-24">

      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-10">

        <h2 className="text-3xl font-bold text-center text-[#758467] mb-8">
          Update Your Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center">

            <div className="relative">

              {avatar && !avatarLoadFailed ? (
                <img
                  src={avatar}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarLoadFailed(true)}
                  className="w-32 h-32 rounded-full object-cover border-4 border-[#9caf88] shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-[#dfe6da] flex items-center justify-center text-[#758467] text-4xl shadow">
                  ?
                </div>
              )}

              <label
                htmlFor="avatarUpload"
                className="absolute bottom-0 right-0 bg-[#758467] text-white p-2 rounded-full cursor-pointer hover:bg-[#9caf88] transition shadow-lg"
              >
                ✎
              </label>

              <input
                type="file"
                id="avatarUpload"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
              />

            </div>

            <p className="text-gray-500 mt-3 text-sm">
              Click pencil to change avatar
            </p>

          </div>

          {/* Name */}
          <div>
            <label className="block mb-2 text-gray-700 font-medium">
              Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#9caf88]/40 rounded-lg p-3 focus:ring-2 focus:ring-[#9caf88] focus:outline-none"
              placeholder="Your Name"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block mb-2 text-gray-700 font-medium">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#9caf88]/40 rounded-lg p-3 focus:ring-2 focus:ring-[#9caf88] focus:outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition ${
              loading
                ? "bg-[#9caf88] cursor-not-allowed"
                : "bg-[#758467] hover:bg-[#9caf88]"
            }`}
          >
            {loading ? "Updating..." : "Update Profile"}
          </button>

        </form>
      </div>

    </div>
  );
};

export default ProfilePage;
