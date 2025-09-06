import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    title: v.string(),
    sourceType: v.union(v.literal('upload'), v.literal('manual')),
    fileUrl: v.optional(v.string()),
    items: v.array(
      v.object({
        subject: v.string(),
        examDate: v.string(),
        syllabus: v.optional(v.array(v.string())),
      }),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.id('datesheets'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    // Lightweight normalization: trim strings, drop empty syllabus bullets
    const normalizedItems = args.items.map((it) => ({
      subject: it.subject.trim(),
      examDate: it.examDate.trim(),
      syllabus: (it.syllabus ?? [])
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    }));

    const id = await ctx.db.insert('datesheets', {
      userId: user._id,
      title: args.title.trim(),
      sourceType: args.sourceType,
      fileUrl: args.fileUrl,
      items: normalizedItems,
      notes: args.notes?.trim(),
    });
    return id;
  },
});

export const listByUser = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('datesheets'),
      _creationTime: v.number(),
      title: v.string(),
      sourceType: v.union(v.literal('upload'), v.literal('manual')),
      fileUrl: v.optional(v.string()),
      itemsCount: v.number(),
      firstExamDate: v.optional(v.string()),
      lastExamDate: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const docs = await ctx.db
      .query('datesheets')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();

    return docs.map((d) => {
      const dates = d.items
        .map((it) => it.examDate)
        .filter(Boolean)
        .sort();
      return {
        _id: d._id,
        _creationTime: d._creationTime,
        title: d.title,
        sourceType: d.sourceType,
        fileUrl: d.fileUrl,
        itemsCount: d.items.length,
        firstExamDate: dates[0],
        lastExamDate: dates[dates.length - 1],
      };
    });
  },
});
