import { User } from "../models/User.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import { ErrorHandler } from "../middleware/errormiddleware.js";
import jwt from "jsonwebtoken";
import cloudinary from "../utils/cloudinary.js";
import validator from "validator";
import { OAuth2Client } from "google-auth-library";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT and send cookie
const sendToken = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

  // res.cookie("token", token, {
  //   httpOnly: true,
  //   secure: false, // dev MUST false
  //   sameSite: "lax",
  //   maxAge: 7 * 24 * 60 * 60 * 1000,
  // });

  res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

  res.status(statusCode).json({
    success: true,
    message: statusCode === 201 ? "User Registered" : "Logged in",
    user,
    token,
  });
};

export const register = catchAsyncError(async (req, res, next) => {
  const { name, email, password, role, secretKey } = req.body;

  if (!name || !email || !password) {
    return next(new ErrorHandler("All fields are required", 400));
  }

  if (!validator.isEmail(email)) {
    return next(new ErrorHandler("Invalid email", 400));
  }

  if (password.length < 8) {
    return next(new ErrorHandler("Password must be at least 8 characters", 400));
  }

  const userExists = await User.findOne({ email });
  if (userExists) return next(new ErrorHandler("User already exists", 400));

  if (role === "admin") {
    if (!secretKey || secretKey !== process.env.ADMIN_SECRET) {
      return next(new ErrorHandler("Invalid Admin Secret", 403));
    }
  }

  if (role === "teacher") {
    if (!secretKey || secretKey !== process.env.TEACHER_SECRET) {
      return next(new ErrorHandler("Invalid Teacher Secret", 403));
    }
  }

  let avatarData = { public_id: null, url: "" };

  if (req.file) {
    const result = await cloudinary.v2.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      { folder: "profiles" }
    );
    avatarData = { public_id: result.public_id, url: result.secure_url };
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    avatar: avatarData,
    authProvider: "local"
  });

  // ========================================
  // EMAIL NOTIFICATION SYSTEM
  // ========================================
  const verificationToken = user.generateEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  // For testing/production link
  const frontendVerifyUrl = `http://localhost:5173/verify-email/${verificationToken}`;

  const htmlMessage = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
        .header { background: #4f6f52; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; line-height: 1.6; color: #2d3748; }
        .button { display: inline-block; padding: 12px 24px; background: #9caf88; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .footer { text-align: center; font-size: 12px; color: #a0aec0; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>Welcome to EduNova!</h1></div>
        <div class="content">
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>Thank you for joining EduNova as a <strong>${user.role}</strong>. We're excited to have you on board!</p>
          <p>To get started and unlock all features, please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${frontendVerifyUrl}" class="button">Verify My Email</a>
          </div>
          <p style="margin-top: 20px; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #4a5568;">${frontendVerifyUrl}</p>
          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;">
          <p><strong>Registration Details:</strong></p>
          <ul>
            <li><strong>Role:</strong> ${user.role}</li>
            <li><strong>Login Method:</strong> Email/Password</li>
          </ul>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EduNova LMS. All rights reserved.</p>
          <p>You received this because you recently signed up for an account.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    console.log(`🚀 Triggering Welcome Email for ${user.email}...`);
    const emailResult = await sendEmail({
      email: user.email,
      subject: "Welcome to EduNova - Verify Your Account",
      html: htmlMessage,
      message: `Welcome to EduNova, ${user.name}! Please verify your email here: ${frontendVerifyUrl}`
    });

    if (emailResult.success) {
      console.log(`✅ Welcome Email Sent to ${user.email}`);
    } else {
      console.error(`⚠️ Email could not be sent: ${emailResult.error}`);
    }
  } catch (error) {
    console.error("❌ Critical Error in email sending flow:", error.message);
  }

  sendToken(user, 201, res);
});

// ========================================
// VERIFY EMAIL CONTROLLER
// ========================================
export const verifyEmail = catchAsyncError(async (req, res, next) => {
  const verificationToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    emailVerificationToken: verificationToken,
    emailVerificationExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorHandler("Invalid or expired verification token", 400));
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Email verified successfully! You can now log in.",
  });
});

// ========================================
// RESEND VERIFICATION CONTROLLER
// ========================================
export const resendVerificationToken = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new ErrorHandler("Email is required", 400));

  const user = await User.findOne({ email });

  if (!user) return next(new ErrorHandler("User not found", 404));

  if (user.emailVerified) {
    return next(new ErrorHandler("This email is already verified", 400));
  }

  const verificationToken = user.generateEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  const frontendVerifyUrl = `http://localhost:5173/verify-email/${verificationToken}`;

  const htmlMessage = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
      <h2>Verify Your Email - EduNova</h2>
      <p>Hello ${user.name},</p>
      <p>Click the button below to verify your account. This link expires in 15 minutes.</p>
      <a href="${frontendVerifyUrl}" style="padding: 10px 20px; background: #4f6f52; color: white; text-decoration: none; border-radius: 5px;">Verify Now</a>
    </div>
  `;

  const emailResult = await sendEmail({
    email: user.email,
    subject: "EduNova - New Verification Link",
    html: htmlMessage,
    message: `Verify your account here: ${frontendVerifyUrl}`
  });

  if (!emailResult.success) {
    return next(new ErrorHandler("Could not send email. Please try later.", 500));
  }

  res.status(200).json({
    success: true,
    message: "Verification email resent successfully.",
  });
});

export const login = catchAsyncError(async (req, res, next) => {
  const { email, password, role, secretKey } = req.body;

  if (!email || !password || !role) {
    return next(new ErrorHandler("All fields required", 400));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) return next(new ErrorHandler("Invalid credentials", 404));

  if (user.isBlocked) {
    return next(new ErrorHandler("Your account is blocked", 403));
  }

  const isMatched = await user.matchPassword(password);
  if (!isMatched) return next(new ErrorHandler("Invalid credentials", 400));

  if (user.role !== role) {
    return next(new ErrorHandler("Role mismatch", 403));
  }

  if (role === "admin") {
    if (!secretKey || secretKey !== process.env.ADMIN_SECRET) {
      return next(new ErrorHandler("Invalid Admin Secret", 403));
    }
  }

  if (role === "teacher") {
    if (!secretKey || secretKey !== process.env.TEACHER_SECRET) {
      return next(new ErrorHandler("Invalid Teacher Secret", 403));
    }
  }

  sendToken(user, 200, res);
});

export const logout = catchAsyncError(async (req, res, next) => {
  res.cookie("token", "", { expires: new Date(Date.now()), httpOnly: true });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

export const changePassword = catchAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!oldPassword || !newPassword) return next(new ErrorHandler("Both passwords required", 400));

  const isMatched = await user.matchPassword(oldPassword);
  if (!isMatched) return next(new ErrorHandler("Old password incorrect", 400));

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: "Password changed successfully" });
});

export const googleAuth = catchAsyncError(async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return next(new ErrorHandler("Google credential is required", 400));
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    return next(new ErrorHandler("Invalid Google token or origin mismatch", 401));
  }

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture: avatarUrl } = payload;

  let user = await User.findOne({ email }).select("+password");

  if (user) {
    if (!user.googleId) user.googleId = googleId;
    user.name = name || user.name;
    user.role = "student";
    user.authProvider = "google";
    user.emailVerified = true;
    user.avatar = { public_id: null, url: avatarUrl || user.avatar?.url || "" };
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      googleId,
      authProvider: "google",
      avatar: { public_id: null, url: avatarUrl },
      role: "student",
      emailVerified: true,
    });
  }

  if (user.isBlocked) {
    return next(new ErrorHandler("Your account is blocked", 403));
  }

  sendToken(user, 200, res);
});
