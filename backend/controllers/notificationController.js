import { Notification } from "../models/Notification.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import { ErrorHandler } from "../middleware/errormiddleware.js";
import { getIO } from "../utils/socket.js";
import { User } from "../models/User.js";

// Fetch my notifications
export const getMyNotifications = catchAsyncError(async (req, res, next) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  res.status(200).json({
    success: true,
    notifications,
  });
});

// Mark notification as read
export const markAsRead = catchAsyncError(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ErrorHandler("Notification not found", 404));
  }

  if (notification.recipient.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("You cannot update this notification", 403));
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
  });
});

// Helper function to create and send notification
export const createAndSendNotification = async (data) => {
  try {
    const { recipient, title, message, type, link } = data;

    const notification = await Notification.create({
      recipient,
      title,
      message,
      type,
      link,
    });
    console.log(`📝 Notification Created: "${title}" for recipient ${recipient}`);

    const io = getIO();
    // Emit to the user's private room
    io.to(recipient.toString()).emit("new_notification", notification);
    console.log(`📢 Notification Emitted: to room ${recipient.toString()}`);

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

export const notifyAllStudents = async (data) => {
  const students = await User.find({ role: "student" }).select("_id");

  await Promise.all(
    students.map((student) =>
      createAndSendNotification({
        ...data,
        recipient: student._id,
      })
    )
  );
};
