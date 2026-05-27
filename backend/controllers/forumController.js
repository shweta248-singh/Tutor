import { Forum } from "../models/Forum.js";
import { Progress } from "../models/Progress.js";
import { Leaderboard } from "../models/LeaderBoard.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import { ErrorHandler } from "../middleware/errormiddleware.js";
import mongoose from "mongoose";
import {v2 as cloudinary} from "cloudinary"
import axios from "axios";
import { Content } from "../models/contentSchema.js";
import { Subject } from "../models/SubjectSchema.js";
import { User } from "../models/User.js";
import { createAndSendNotification, notifyAllStudents } from "./notificationController.js";
import { sendToGeminiAI } from "../utils/sendToGemini.js";


export const postQuestion = catchAsyncError(async (req, res, next) => {
  const { question, type, subject, options, correctOption } = req.body;

  if (!question || !type || !subject) {
    return next(new ErrorHandler("Question, type and subject are required", 400));
  }

  if (type === "mcq") {
    if (!options || !correctOption) {
      return next(new ErrorHandler("MCQ must have options and correctOption", 400));
    }
  }

  const newQuestion = await Forum.create({
    user: req.user._id,
    question,
    type,
    subject,
    options: type === "mcq" ? options : [],
    correctOption: type === "mcq" ? correctOption : null
  });

  await notifyAllStudents({
    title: "New Assignment Added",
    message: `A new ${type === "mcq" ? "MCQ" : "long answer"} assignment has been added in ${subject}.`,
    type: "assignment",
    link: "/student/questions",
  });

  res.status(201).json({ success: true, question: newQuestion });
});

export const addMultipleQuestions = catchAsyncError(async (req, res, next) => {
  const { questions } = req.body; // Array of questions

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return next(new ErrorHandler("Questions array is required", 400));
  }

  const questionsToInsert = questions.map(q => {
    if (!q.question || !q.type || !q.subject) {
      throw new Error("Each question must have 'question', 'type', 'subject'");
    }
    if (q.type === "mcq") {
      if (!q.options || !q.correctOption) {
        throw new Error("MCQ must have options and correctOption");
      }
    }
    return {
      user: req.user._id,
      question: q.question,
      type: q.type,
      subject: q.subject,
      options: q.type === "mcq" ? q.options : [],
      correctOption: q.type === "mcq" ? q.correctOption : null
    };
  });

  const insertedQuestions = await Forum.insertMany(questionsToInsert);

  await notifyAllStudents({
    title: "New Assignments Added",
    message: `${insertedQuestions.length} new assignments have been added.`,
    type: "assignment",
    link: "/student/questions",
  });

  res.status(201).json({
    success: true,
    message: `${insertedQuestions.length} questions added successfully`,
    questions: insertedQuestions
  });
});


export const postAnswer = catchAsyncError(async (req, res, next) => {
  const { answer } = req.body;

  // ✅ 1. Validate answer
  if (!answer) {
    return next(new ErrorHandler("Answer is required", 400));
  }

  // ✅ 2. Find question
  const forum = await Forum.findById(req.params.questionId);
  if (!forum) {
    return next(new ErrorHandler("Question not found", 404));
  }

  // ✅ 3. Prevent duplicate answer
  const alreadyAnswered = forum.answers.find(
    (a) => a.user.toString() === req.user._id.toString()
  );

  if (alreadyAnswered) {
    return next(new ErrorHandler("You already answered this question", 400));
  }

  // ✅ 4. Check correctness (only for MCQ)
  let isCorrect = null; // better for long answers
  let points = 0;

  if (forum.type === "mcq") {
    isCorrect = answer === forum.correctOption;
    points = isCorrect ? 1 : 0;
  }

  // ✅ 5. Save answer
  forum.answers.push({
    user: req.user._id,
    answer,
    isCorrect,
    isEvaluated: forum.type === "mcq" ? true : false, // MCQ is auto-evaluated, Long is not
  });

  await forum.save();

  // ✅ 6. Send response
  res.status(200).json({
    success: true,
    message: "Answer submitted successfully",
    data: {
      questionId: forum._id,
      answer,
      isCorrect,
      points,
    },
  });
});




export const markLongAnswer = catchAsyncError(async (req, res, next) => {
  const { questionId, answerId } = req.params;
  const { marks } = req.body;

  const forum = await Forum.findById(questionId);
  if (!forum) return next(new ErrorHandler("Question not found", 404));

  const studentAnswer = forum.answers.id(answerId);
  if (!studentAnswer) return next(new ErrorHandler("Answer not found", 404));

  if (studentAnswer.isCorrect) {
    return next(new ErrorHandler("Already evaluated", 400));
  }

  // total marks per question (default 5)
  const totalMarks = forum.totalMarks || 5;

  studentAnswer.isCorrect = marks > 0; // Mark as correct if marks are given
  studentAnswer.isEvaluated = true; // Mark as evaluated regardless of marks (marks can be 0)
  studentAnswer.marks = marks;

  await forum.save();

  let progress = await Progress.findOne({
    user: studentAnswer.user,
    subject: forum.subject,
    date: {
      $gte: new Date().setHours(0, 0, 0, 0),
      $lte: new Date().setHours(23, 59, 59, 999),
    },
  });

  if (!progress) {
    progress = await Progress.create({
      user: studentAnswer.user,
      subject: forum.subject,
      correctAnswers: 1,
      wrongAnswers: 0,
      score: marks,
    });
  } else {
    progress.correctAnswers += 1;
    progress.score += marks;
    await progress.save();
  }

  const totalScoreAgg = await Progress.aggregate([
    { $match: { user: studentAnswer.user } },
    { $group: { _id: "$user", totalPoints: { $sum: "$score" } } }
  ]);

  await Leaderboard.findOneAndUpdate(
    { student: studentAnswer.user },
    {
      totalPoints: totalScoreAgg[0]?.totalPoints || 0,
      lastActivity: new Date()
    },
    { upsert: true, new: true }
  );

  // Notify the student
  await createAndSendNotification({
    recipient: studentAnswer.user,
    title: "Answer Evaluated! 📝",
    message: `Your answer for the question in ${forum.subject} has been marked. You received ${marks} marks.`,
    type: "evaluation",
    link: "/student-dashboard", // Or specific progress page
  });

  res.status(200).json({
    success: true,
    message: `${marks} out of ${totalMarks} marks given successfully`,
    data: {
      marksObtained: marks,
      totalMarks,
    },
  });
});

export const evaluateLongAnswerAI = catchAsyncError(async (req, res, next) => {
  const { questionId, answerId } = req.params;
  console.log(`🤖 AI Evaluation Request: Question ${questionId}, Answer ${answerId}`);

  if (!mongoose.Types.ObjectId.isValid(questionId) || !mongoose.Types.ObjectId.isValid(answerId)) {
    console.error("❌ Invalid IDs provided");
    return next(new ErrorHandler("Invalid Question or Answer ID", 400));
  }

  const forum = await Forum.findById(questionId);
  if (!forum) {
    console.error(`❌ Question ${questionId} not found in DB`);
    return next(new ErrorHandler("Question not found", 404));
  }

  const studentAnswer = forum.answers.id(answerId);
  if (!studentAnswer) {
    console.error(`❌ Answer ${answerId} not found in question ${questionId}`);
    return next(new ErrorHandler("Answer not found", 404));
  }

  if (forum.type !== "long") {
    console.warn(`⚠️ Question ${questionId} is not a long answer type`);
    return next(new ErrorHandler("This is not a long answer question", 400));
  }

  console.log("📝 Answer text found:", studentAnswer.answer.substring(0, 50) + "...");

  // Trigger AI Evaluation
  const aiData = {
    question: forum.question,
    answer: studentAnswer.answer,
    maxMarks: forum.totalMarks || 5,
  };

  console.log("🚀 Calling AI utility...");
  const aiResult = await sendToGeminiAI("evaluate", aiData);
  console.log("✅ AI utility returned:", aiResult ? "Success (JSON Object)" : "Failure (Null/String)");

  if (!aiResult || typeof aiResult === "string") {
    return next(
      new ErrorHandler(
        "AI Evaluation failed. Please try again or check manually.",
        500
      )
    );
  }

  // Save AI results to DB
  studentAnswer.aiEvaluation = {
    ...aiResult,
    evaluatedByAI: true,
  };

  await forum.save();

  res.status(200).json({
    success: true,
    message: "AI Evaluation completed",
    aiEvaluation: studentAnswer.aiEvaluation,
  });
});

export const getSingleQuestion = catchAsyncError(async (req, res, next) => {
  const question = await Forum.findById(req.params.id)
    .populate("answers.user", "name");

  if (!question) {
    return next(new ErrorHandler("Question not found", 404));
  }

  res.status(200).json({
    success: true,
    question,
  });
});

export const getAllQuestions = catchAsyncError(async (req, res, next) => {
  const questions = await Forum.find()
    .populate("user", "name role")
    .populate("answers.user", "name");

  res.status(200).json({ success: true, questions });
});



export const getMyQuestions = catchAsyncError(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("User not authenticated", 401));
  }

  const teacherId = req.user._id;

  const questions = await Forum.find({ user: teacherId })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: questions.length,
    questions,
  });
});


export const updateQuestion = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorHandler("Invalid question ID", 400));
  }

  const question = await Forum.findById(id);

  if (!question) {
    return next(new ErrorHandler("Question not found", 404));
  }

  if (question.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Not authorized", 403));
  }

  const updated = await Forum.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    question: updated,
  });
});

export const deleteQuestion = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorHandler("Invalid question ID", 400));
  }

  const question = await Forum.findById(id);

  if (!question) {
    return next(new ErrorHandler("Question not found", 404));
  }

  if (question.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Not authorized", 403));
  }

  await question.deleteOne();

  res.status(200).json({
    success: true,
    message: "Question deleted successfully",
  });
});


export const getTeacherSubjects = catchAsyncError(async (req, res, next) => {
  const subjects = await Subject.find({ teacher: req.user._id });

  res.status(200).json({
    success: true,
    subjects,
  });
});
export const getTeacherSubjectContent = catchAsyncError(async (req, res, next) => {
  const content = await Content.find({
    teacher: req.user._id,
  }).populate("subject");

  const grouped = Object.values(
    content.reduce((acc, item) => {
      const subjectId = item.subject?._id;

      if (!subjectId) return acc;

      if (!acc[subjectId]) {
        acc[subjectId] = {
          subject: item.subject,
          content: [],
        };
      }

      acc[subjectId].content.push(item);

      return acc;
    }, {})
  );

  res.status(200).json({
    success: true,
    grouped,
  });
});

export const createSubject = catchAsyncError(async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    return next(new ErrorHandler("Subject name is required", 400));
  }

  const exists = await Subject.findOne({
    name,
    teacher: req.user._id,
  });

  if (exists) {
    return next(new ErrorHandler("Subject already exists", 400));
  }

  const subject = await Subject.create({
    name,
    teacher: req.user._id,
  });

  res.status(201).json({
    success: true,
    subject,
  });
});

export const uploadContent = catchAsyncError(async (req, res, next) => {
  const { subject, title, type } = req.body;

  if (!subject || !title || !type) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  if (!req.file) {
    return next(new ErrorHandler("File is required", 400));
  }

  // 🔥 normalize type (VERY IMPORTANT)
  const cleanType = type.toLowerCase().trim();

  const resourceType = cleanType === "pdf" ? "raw" : "video";

  const result = await cloudinary.uploader.upload(
    `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
    {
      resource_type: resourceType,
      folder: "lms-content",
    }
  );

  const content = await Content.create({
    subject,
    teacher: req.user._id,
    title,
    type: cleanType,
    fileUrl: result.secure_url,
    public_id: result.public_id,
  });

  // Notify all students
  const students = await User.find({ role: "student" });
  for (const student of students) {
    await createAndSendNotification({
      recipient: student._id,
      title: "New Content Uploaded! 📚",
      message: `New ${cleanType} content "${title}" has been uploaded in ${subject}.`,
      type: "content",
      link: "/student-content",
    });
  }

  res.status(201).json({
    success: true,
    content,
  });
});

export const deleteContent = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const content = await Content.findById(id);
  if (!content) {
    return next(new ErrorHandler("Content not found", 404));
  }

  // 🔥 correct resource type mapping
  const resourceType = content.type === "pdf" ? "raw" : "video";

  await cloudinary.uploader.destroy(content.public_id, {
    resource_type: resourceType,
  });

  await content.deleteOne();

  res.status(200).json({
    success: true,
    message: "Content deleted successfully",
  });
});



export const downloadContent = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await Content.findById(id);
    if (!content) {
      return res.status(404).json({ message: "Not found" });
    }

    // 🔥 fetch as buffer (NOT stream)
    const response = await axios.get(content.fileUrl, {
      responseType: "arraybuffer",
    });

    const ext = content.type === "pdf" ? "pdf" : "mp4";

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${content.title}.${ext}"`
    );

    res.setHeader(
      "Content-Type",
      response.headers["content-type"]
    );

    return res.send(response.data);

  } catch (error) {
    console.log("DOWNLOAD ERROR:", error.message);

    return res.status(500).json({
      message: "Download failed",
      error: error.message,
    });
  }
};
export const deleteSubject = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorHandler("Invalid subject ID", 400));
  }

  const subject = await Subject.findById(id);

  if (!subject) {
    return next(new ErrorHandler("Subject not found", 404));
  }

  if (subject.teacher.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Not authorized", 403));
  }

  await Content.deleteMany({ subject: id });

  await subject.deleteOne();

  res.status(200).json({
    success: true,
    message: "Subject deleted successfully",
  });
});

export const getStudentSubjectContent = catchAsyncError(async (req, res, next) => {
  const content = await Content.find()
    .populate("subject")
    .populate("teacher", "name email");

  const grouped = Object.values(
    content.reduce((acc, item) => {
      if (!item.subject) return acc;

      // ✅ GROUP BY SUBJECT NAME
      const subjectName = item.subject.name;

      if (!acc[subjectName]) {
        acc[subjectName] = {
          subject: item.subject,
          content: [],
        };
      }

      acc[subjectName].content.push(item);

      return acc;
    }, {})
  );

  res.status(200).json({
    success: true,
    grouped,
  });
});
