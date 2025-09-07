import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // Clerk subject identifier (stable user id from Clerk)
    subject: v.string(),
  }).index('by_subject', ['subject']),
  searches: defineTable({
    userId: v.id('users'),
    query: v.string(),
    refinedQuery: v.string(),
    candidatesCount: v.number(),
  }).index('by_user', ['userId']),
  videos: defineTable({
    youtubeId: v.string(),
    title: v.string(),
    url: v.string(),
    channel: v.string(),
    durationMs: v.optional(v.number()),
    views: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
  }).index('by_youtubeId', ['youtubeId']),
  selections: defineTable({
    userId: v.id('users'),
    searchId: v.id('searches'),
    videoId: v.id('videos'),
    reason: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_search', ['searchId']),
  datesheets: defineTable({
    userId: v.id('users'),
    title: v.string(),
    sourceType: v.union(v.literal('upload'), v.literal('manual')),
    fileUrl: v.optional(v.string()),
    items: v.array(
      v.object({
        subject: v.string(),
        // ISO date string YYYY-MM-DD
        examDate: v.string(),
        // Syllabus is optional and often empty
        syllabus: v.optional(v.array(v.string())),
      }),
    ),
    notes: v.optional(v.string()),
  }).index('by_user', ['userId']),
  video_suggestions: defineTable({
    youtubeId: v.string(),
    suggestions: v.array(v.string()),
  }).index('by_youtubeId', ['youtubeId']),
  quizzes: defineTable({
    createdByUserId: v.id('users'),
    videoId: v.id('videos'),
    spec: v.object({
      type: v.union(v.literal('last_minutes'), v.literal('last_chapter')),
      value: v.number(),
    }),
    meta: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      channel: v.optional(v.string()),
    }),
    numQuestions: v.number(),
    choicesCount: v.number(),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard'),
    ),
    model: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
    ),
  })
    .index('by_video', ['videoId'])
    .index('by_user', ['createdByUserId']),
  quiz_questions: defineTable({
    quizId: v.id('quizzes'),
    prompt: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    explanation: v.optional(v.string()),
  }).index('by_quiz', ['quizId']),
  quiz_sessions: defineTable({
    quizId: v.id('quizzes'),
    userId: v.id('users'),
    status: v.union(v.literal('in_progress'), v.literal('completed')),
    startedAtMs: v.number(),
    finishedAtMs: v.optional(v.number()),
  })
    .index('by_quiz', ['quizId'])
    .index('by_user', ['userId']),
  quiz_answers: defineTable({
    sessionId: v.id('quiz_sessions'),
    questionId: v.id('quiz_questions'),
    selectedIndex: v.number(),
    isCorrect: v.boolean(),
  })
    .index('by_session', ['sessionId'])
    .index('by_question', ['questionId']),
});
