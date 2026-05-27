
import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { toast } from "react-toastify";


// ---- Load user from localStorage on startup ----
const savedUser = (localStorage.getItem("user") && localStorage.getItem("user") !== "undefined")
  ? JSON.parse(localStorage.getItem("user"))
  : null;

const authSlice = createSlice({
  name: "auth",
  initialState: {
    loading: false,
    user: savedUser || {},
    isAuthenticated: savedUser ? true : false,
    error: null,
    message: null,
  },

  reducers: {
    // ===== Login =====
    LoginRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    LoginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
    },
    LoginFailed: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = {};
      state.error = action.payload;
    },

    // ===== Register =====
    RegisterRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    RegisterSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
    },
    RegisterFailed: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = {};
      state.error = action.payload;
    },

    // ===== Logout =====
    LogoutRequest: (state) => {
      state.loading = true;
    },
    LogoutSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = {};
      state.message = action.payload;
      state.error = null;
    },
    LogoutFailed: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // ===== Change Password =====
ChangePasswordRequest: (state) => {
  state.loading = true;
  state.error = null;
},

ChangePasswordSuccess: (state, action) => {
  state.loading = false;
  state.message = action.payload;
  state.error = null;
},

ChangePasswordFailed: (state, action) => {
  state.loading = false;
  state.error = action.payload;
},


    clearAllErrors: (state) => {
      state.error = null;
    },
  },
});



// 👉 LOGIN
export const login = (data) => async (dispatch) => {
  dispatch(authSlice.actions.LoginRequest());
  try {
    const { email, password, role, secretKey } = data;

    const { data: res } = await axios.post(
      `${import.meta.env.VITE_API_URL}/auth/login`,
      { email, password, role, secretKey },
      { withCredentials: true }
    );

    dispatch(authSlice.actions.LoginSuccess(res.user));
    localStorage.setItem("user", JSON.stringify(res.user));
    toast.success("Logged in successfully");
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    localStorage.removeItem("user");
    toast.error(message);
    dispatch(authSlice.actions.LoginFailed(message));
  }
};

// 👉 GOOGLE LOGIN
export const googleLogin = (credential) => async (dispatch) => {
  dispatch(authSlice.actions.LoginRequest());
  try {
    const { data: res } = await axios.post(
      `${import.meta.env.VITE_API_URL}/auth/google`,
      { credential },
      { withCredentials: true }
    );

    const googleUser = { ...res.user, role: "student", authProvider: "google" };
    dispatch(authSlice.actions.LoginSuccess(googleUser));
    localStorage.setItem("user", JSON.stringify(googleUser));
    toast.success("Logged in successfully with Google");
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    localStorage.removeItem("user");
    toast.error(message);
    dispatch(authSlice.actions.LoginFailed(message));
  }
};

export const register = (data) => async (dispatch) => {
  dispatch(authSlice.actions.RegisterRequest());
  try {
    const { data: res } = await axios.post(
      `${import.meta.env.VITE_API_URL}/auth/register`,
      data,
      { headers: { "Content-Type": "application/json" }, withCredentials: true }
    );

    dispatch(authSlice.actions.RegisterSuccess(res.user));
    localStorage.setItem("user", JSON.stringify(res.user));
    toast.success("Registered successfully");
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    toast.error(message);
    dispatch(authSlice.actions.RegisterFailed(message));
  }
};

//  LOGOUT
export const logout = () => async (dispatch) => {
  dispatch(authSlice.actions.LogoutRequest());
  try {
    const { data } = await axios.delete(
      `${import.meta.env.VITE_API_URL}/auth/logout`,
      { withCredentials: true }
    );

    localStorage.clear();
    toast.success(data.message);
    dispatch(authSlice.actions.LogoutSuccess(data.message));
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    dispatch(authSlice.actions.LogoutFailed(message));
  }
};

//  CHANGE PASSWORD
export const changePassword = (passwordData) => async (dispatch) => {
  dispatch(authSlice.actions.ChangePasswordRequest());

  try {
    const { data } = await axios.put(
      `${import.meta.env.VITE_API_URL}/auth/student/change-password`,
      passwordData,
      { withCredentials: true }
    );

    dispatch(authSlice.actions.ChangePasswordSuccess(data.message));
    toast.success(data.message);
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    toast.error(message);
    dispatch(authSlice.actions.ChangePasswordFailed(message));
  }
};


export const clearErrors = () => (dispatch) => {
  dispatch(authSlice.actions.clearAllErrors());
};

export default authSlice.reducer;


