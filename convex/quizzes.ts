import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const createQuiz = mutation({
  args: {
    videoId: v.id('videos'),
    createdByUserId: v.id('users'),
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
  },
  returns: v.id('quizzes'),
  handler: async (ctx, args) => {
    // Ensure the caller is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const quizId = await ctx.db.insert('quizzes', {
      createdByUserId: args.createdByUserId,
      videoId: args.videoId,
      spec: args.spec,
      meta: args.meta,
      numQuestions: args.numQuestions,
      choicesCount: args.choicesCount,
      difficulty: args.difficulty,
      model: args.model,
      status: 'active',
    });
    return quizId;
  },
});

export const saveQuestions = internalMutation({
  args: {
    quizId: v.id('quizzes'),
    questions: v.array(
      v.object({
        prompt: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        explanation: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const q of args.questions) {
      await ctx.db.insert('quiz_questions', {
        quizId: args.quizId,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    }
    return null;
  },
});

export const createQuizWithQuestions = mutation({
  args: {
    videoId: v.id('videos'),
    createdByUserId: v.id('users'),
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
    questions: v.array(
      v.object({
        prompt: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        explanation: v.optional(v.string()),
      }),
    ),
  },
  returns: v.id('quizzes'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');
    const quizId = await ctx.db.insert('quizzes', {
      createdByUserId: args.createdByUserId,
      videoId: args.videoId,
      spec: args.spec,
      meta: args.meta,
      numQuestions: args.numQuestions,
      choicesCount: args.choicesCount,
      difficulty: args.difficulty,
      model: args.model,
      status: 'active',
    });
    for (const q of args.questions) {
      await ctx.db.insert('quiz_questions', {
        quizId,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    }
    return quizId;
  },
});

export const createSession = mutation({
  args: { quizId: v.id('quizzes'), userId: v.id('users') },
  returns: v.id('quiz_sessions'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');
    const sessionId = await ctx.db.insert('quiz_sessions', {
      quizId: args.quizId,
      userId: args.userId,
      status: 'in_progress',
      startedAtMs: Date.now(),
    });
    return sessionId;
  },
});

export const getNextQuestion = query({
  args: {
    quizId: v.id('quizzes'),
    sessionId: v.id('quiz_sessions'),
    userId: v.id('users'),
  },
  returns: v.union(
    v.object({
      _id: v.id('quiz_questions'),
      prompt: v.string(),
      options: v.array(v.string()),
      index: v.number(),
      total: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      session.userId !== args.userId ||
      session.quizId !== args.quizId
    ) {
      throw new Error('Invalid session');
    }

    const questions = await ctx.db
      .query('quiz_questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', args.quizId))
      .collect();
    const total = questions.length;

    const answered = await ctx.db
      .query('quiz_answers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();
    const answeredIds = new Set(answered.map((a) => a.questionId));

    const next = questions.find((q) => !answeredIds.has(q._id));
    if (!next) return null;

    const index = questions.findIndex((q) => q._id === next._id);
    return {
      _id: next._id,
      prompt: next.prompt,
      options: next.options,
      index,
      total,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('quiz_sessions'),
    questionId: v.id('quiz_questions'),
    selectedIndex: v.number(),
    userId: v.id('users'),
  },
  returns: v.object({
    acknowledged: v.boolean(),
    progress: v.object({ answered: v.number(), total: v.number() }),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId)
      throw new Error('Invalid session');

    // prevent duplicate answer
    const existing = await ctx.db
      .query('quiz_answers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();
    if (existing.some((a) => a.questionId === args.questionId)) {
      // idempotent acknowledge
      const total = await ctx.db
        .query('quiz_questions')
        .withIndex('by_quiz', (q) => q.eq('quizId', session.quizId))
        .collect()
        .then((l) => l.length);
      return {
        acknowledged: true,
        progress: { answered: existing.length, total },
      };
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error('Question not found');

    await ctx.db.insert('quiz_answers', {
      sessionId: args.sessionId,
      questionId: args.questionId,
      selectedIndex: args.selectedIndex,
      isCorrect: args.selectedIndex === question.correctIndex,
    });

    const answered = await ctx.db
      .query('quiz_answers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
      .then((l) => l.length);
    const total = await ctx.db
      .query('quiz_questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', session.quizId))
      .collect()
      .then((l) => l.length);

    return { acknowledged: true, progress: { answered, total } };
  },
});

export const getSessionResults = query({
  args: { sessionId: v.id('quiz_sessions'), userId: v.id('users') },
  returns: v.object({
    total: v.number(),
    correct: v.number(),
    details: v.array(
      v.object({
        questionId: v.id('quiz_questions'),
        prompt: v.string(),
        options: v.array(v.string()),
        selectedIndex: v.number(),
        correctIndex: v.number(),
        isCorrect: v.boolean(),
        explanation: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId)
      throw new Error('Invalid session');

    const questions = await ctx.db
      .query('quiz_questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', session.quizId))
      .collect();

    const answers = await ctx.db
      .query('quiz_answers')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();
    const byQ: Record<string, (typeof answers)[number]> = {};
    for (const a of answers) byQ[a.questionId] = a;

    let correct = 0;
    const details = questions.map((q) => {
      const a = byQ[q._id as Id<'quiz_questions'>];
      const selectedIndex = a ? a.selectedIndex : -1;
      const isCorrect = a ? a.isCorrect : false;
      if (isCorrect) correct += 1;
      return {
        questionId: q._id,
        prompt: q.prompt,
        options: q.options,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    return { total: questions.length, correct, details };
  },
});

export const finishSession = mutation({
  args: { sessionId: v.id('quiz_sessions'), userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId)
      throw new Error('Invalid session');
    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      finishedAtMs: Date.now(),
    });
    return null;
  },
});
