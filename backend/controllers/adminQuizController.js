import { AdminQuiz } from "../models/QuizSchema.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import  {ErrorHandler}  from "../middleware/errormiddleware.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { User } from "../models/User.js";
import { createAndSendNotification, notifyAllStudents } from "./notificationController.js";

export const createQuiz = catchAsyncError(async (req, res, next) => {
  const { title, subject, questions, duration, isActive } = req.body;

  if (!title || !subject || !questions || questions.length === 0) {
    return next(new ErrorHandler("All fields required", 400));
  }

  const quiz = await AdminQuiz.create({
    title,
    subject,
    questions,
    duration,
    isActive: isActive || false,
    startedAt: isActive ? new Date() : null,
    createdBy: req.user._id,
  });

  if (!isActive) {
    await notifyAllStudents({
      title: "New Quiz Added",
      message: `A new quiz "${quiz.title}" for ${quiz.subject} has been added.`,
      type: "quiz",
      link: "/student/quiz",
    });
  }

  if (isActive) {
    console.log(`🚀 Quiz Created & Active: Triggering notifications for ${quiz.title}`);
    // Notify all students
    const students = await User.find({ role: "student" });
    for (const student of students) {
      await createAndSendNotification({
        recipient: student._id,
        title: "New Quiz Published! 🎯",
        message: `A new quiz "${quiz.title}" for ${quiz.subject} has been published. Start now!`,
        type: "quiz",
        link: "/student/quiz",
      });
    }
  }

  res.status(201).json({
    success: true,
    quiz,
  });
});

export const startQuiz = catchAsyncError(async (req, res, next) => {
  const quiz = await AdminQuiz.findById(req.params.id);

  if (!quiz) {
    return next(new ErrorHandler("Quiz not found", 404));
  }

  // ek time me ek hi quiz active rahe
  await AdminQuiz.updateMany({ isActive: true }, { isActive: false });

  quiz.isActive = true;
  quiz.startedAt = new Date();

  await quiz.save();
  console.log(`🔥 Quiz Started: Triggering notifications for ${quiz.title}`);

  // Notify all students
  const students = await User.find({ role: "student" });
  for (const student of students) {
    await createAndSendNotification({
      recipient: student._id,
      title: "New Quiz Published! 🎯",
      message: `A new quiz "${quiz.title}" for ${quiz.subject} has been published. Start now!`,
      type: "quiz",
      link: "/student/quiz",
    });
  }

  res.status(200).json({
    success: true,
    message: "Quiz started successfully",
    quiz,
  });
});

export const getStudentQuizzes = catchAsyncError(async (req, res) => {
  const studentId = req.user._id;

  const quizzes = await AdminQuiz.find().lean();
  const attempts = await QuizAttempt.find({ student: studentId }).lean();

  const attemptMap = new Map();
  attempts.forEach(a => {
    attemptMap.set(a.quiz.toString(), a);
  });

  const result = quizzes
    .map(q => {
      const attempt = attemptMap.get(q._id.toString());

      if (attempt?.submitted) return null;

      return {
        ...q,
        attemptId: attempt?._id || null,
        isOngoing: attempt ? !attempt.submitted : false,
      };
    })
    .filter(Boolean);

  res.status(200).json({
    success: true,
    quizzes: result,
  });
});
export const getActiveQuiz = catchAsyncError(async (req, res, next) => {
  const quiz = await AdminQuiz.findOne({ isActive: true });

  if (!quiz) {
    return next(new ErrorHandler("No active quiz", 404));
  }

  res.status(200).json({
    success: true,
    quiz,
  });
});

export const submitQuiz = catchAsyncError(async (req, res, next) => {
  const { quizId, answers } = req.body;

  const quiz = await AdminQuiz.findById(quizId);

  if (!quiz) {
    return next(new ErrorHandler("Quiz not found", 404));
  }

  let score = 0;

  const details = quiz.questions.map((q) => {
    const userAns = answers.find(
      (a) => a.questionId.toString() === q._id.toString()
    );

    const isCorrect =
      userAns && userAns.selectedOption === q.correctOption;

    if (isCorrect) score++;

    return {
      question: q.question,
      selected: userAns?.selectedOption || "Not Answered",
      correct: q.correctOption,
      isCorrect,
    };
  });

  const percent = (score / quiz.questions.length) * 100;

  let title = "";
  if (percent === 100) title = "🏆 Excellent";
  else if (percent >= 80) title = "🔥 Awesome";
  else if (percent >= 60) title = "👍 Good";
  else title = "🙂 Nice";

  const updatedAnswers = answers.map((ans) => {
    const question = quiz.questions.id(ans.questionId);

    const isCorrect =
      question && question.correctOption === ans.selectedOption;

    return {
      ...ans,
      isCorrect,
    };
  });

  // ✅ FIXED HERE (field names consistent)
  await QuizAttempt.create({
    studentId: req.user._id,
    quizId: quizId,
    answers: updatedAnswers,
    score,
    total: quiz.questions.length,
    title,
    submitted: true,
  });

  res.status(200).json({
    success: true,
    score,
    total: quiz.questions.length,
    title,
    details,
  });
});

export const getMyResult = catchAsyncError(async (req, res, next) => {
  const { quizId } = req.params;

  const attempt = await QuizAttempt.findOne({
    student: req.user._id,
    quiz: quizId,
  }).populate("quiz");

  if (!attempt) {
    return next(new ErrorHandler("No result found", 404));
  }

  res.status(200).json({
    success: true,
    attempt,
  });
});


export const startStudentQuiz = catchAsyncError(async (req, res, next) => {
  const { quizId } = req.body;

  const quiz = await AdminQuiz.findById(quizId);
  if (!quiz) return next(new ErrorHandler("Quiz not found", 404));

  if (!quiz.questions || quiz.questions.length === 0) {
    return next(new ErrorHandler("No questions in quiz", 400));
  }

  let attempt = await QuizAttempt.findOne({
    student: req.user._id,
    quiz: quizId,
  });

  if (!attempt) {
    attempt = await QuizAttempt.create({
      student: req.user._id,
      quiz: quizId,
      duration: quiz.duration || 10,
      startedAt: new Date(),
      total: quiz.questions.length,
      currentQuestionIndex: 0,
      score: 0,
      answers: [],
    });
  }

  const index = attempt.currentQuestionIndex;

  const question = quiz.questions[index];

  if (!question) {
    return next(new ErrorHandler("No question found", 404));
  }

  res.status(200).json({
    success: true,
    attemptId: attempt._id,
    question: {
      _id: question._id,
      question: question.question,
      options: question.options,
    },
  });
});



export const submitQuestion = catchAsyncError(async (req, res, next) => {
  const { attemptId, questionId, selectedOption } = req.body;

  const attempt = await QuizAttempt.findById(attemptId).populate("quiz");
  if (!attempt || attempt.submitted) {
    return next(new ErrorHandler("Invalid attempt", 400));
  }

  const quiz = attempt.quiz;

  const question = quiz.questions.id(questionId);
  const isCorrect = question.correctOption === selectedOption;

  attempt.answers.push({ questionId, selectedOption, isCorrect });

  if (isCorrect) attempt.score++;

  attempt.currentQuestionIndex++;

  if (attempt.currentQuestionIndex >= attempt.total) {
    const percent = (attempt.score / attempt.total) * 100;

    let title = "";
    if (percent === 100) title = "🏆 Excellent";
    else if (percent >= 80) title = "🔥 Awesome";
    else if (percent >= 60) title = "👍 Good";
    else title = "🙂 Nice";

    attempt.title = title;
    attempt.submitted = true;
  }

  await attempt.save();

  const nextQuestion =
    !attempt.submitted
      ? quiz.questions[attempt.currentQuestionIndex]
      : null;

  res.status(200).json({
    success: true,
    nextQuestion: nextQuestion
      ? {
          _id: nextQuestion._id,
          question: nextQuestion.question,
          options: nextQuestion.options,
        }
      : null,
    finished: attempt.submitted,
    score: attempt.submitted ? attempt.score : undefined,
    title: attempt.submitted ? attempt.title : undefined,
  });
});

