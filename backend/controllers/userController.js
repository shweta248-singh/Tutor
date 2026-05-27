import { User } from "../models/User.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import { ErrorHandler } from "../middleware/errormiddleware.js";
import cloudinary from "../utils/cloudinary.js";
import sendEmail from "../utils/sendEmail.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import bcrypt from "bcrypt";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const updateProfile = catchAsyncError(async (req, res, next) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) return next(new ErrorHandler("User not found", 404));

  let emailChanged = false;

  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) return next(new ErrorHandler("Email already in use", 400));

    user.email = email;
    user.emailVerified = false;
    emailChanged = true;
  }

  if (name) user.name = name;

  // 🔥 IMPORTANT FIX: ensure avatar object exists
  if (!user.avatar) {
    user.avatar = { public_id: null, url: "" };
  }

  // ✅ Avatar upload
  if (req.file && req.file.buffer) {
    try {
      // delete old avatar if exists
      if (user.avatar.public_id) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
      }

      // upload new avatar
      const result = await cloudinary.v2.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "profiles" }
      );

      user.avatar = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return next(new ErrorHandler("Avatar upload failed", 500));
    }
  }

  if (emailChanged) {
    const verifyToken = user.generateEmailVerifyToken();
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verifyToken}`;
    await sendEmail({
      email: user.email,
      subject: "Verify your new email",
      message: `Click: ${verifyUrl}`,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated. Verification email sent.",
      user,
    });
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});


// VERIFY EMAIL
export const verifyEmail = catchAsyncError(async (req, res, next) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() },
  });
  if (!user) return next(new ErrorHandler("Invalid or expired token", 400));

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();

  res.status(200).json({ success: true, message: "Email verified successfully" });
});

// ADMIN UPDATE USER
export const adminUpdateUser = catchAsyncError(async (req, res, next) => {
  const { name, email, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler("User not found", 404));

  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) return next(new ErrorHandler("Email already in use", 400));
    user.email = email;
    user.emailVerified = false;
  }

  if (name) user.name = name;
  if (role) user.role = role;

  await user.save();
  res.status(200).json({ success: true, message: "User updated successfully", user });
});
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { sub, email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId: sub,
        avatar: picture,
        authProvider: "google",
        isVerified: true,
        role: "student",
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);

    res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};
