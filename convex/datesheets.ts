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

    const effectiveTitle = args.title.trim();
    const id = await ctx.db.insert('datesheets', {
      userId: user._id,
      title: effectiveTitle,
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

export const listUpcomingItemsByUser = query({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      datesheetId: v.id('datesheets'),
      title: v.string(),
      subject: v.string(),
      examDate: v.string(),
      syllabus: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const today = new Date().toISOString().slice(0, 10);

    const docs = await ctx.db
      .query('datesheets')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();

    const flattened = docs.flatMap((d) => {
      const firstSubject = d.items?.[0]?.subject?.trim() ?? '';
      const rawTitle = d.title?.trim() ?? '';
      const normalizedTitle =
        rawTitle && rawTitle !== firstSubject ? rawTitle : '';
      return (d.items ?? []).map((it) => ({
        datesheetId: d._id,
        title: normalizedTitle,
        subject: it.subject,
        examDate: it.examDate,
        syllabus: (it.syllabus ?? []).filter((s) => s.length > 0),
      }));
    });

    return flattened
      .filter((x) => x.examDate >= today)
      .sort((a, b) =>
        a.examDate < b.examDate ? -1 : a.examDate > b.examDate ? 1 : 0,
      )
      .slice(0, Math.max(0, args.limit));
  },
});

export const removeExam = mutation({
  args: {
    datesheetId: v.id('datesheets'),
    subject: v.string(),
    examDate: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const sheet = await ctx.db.get(args.datesheetId);
    if (!sheet) throw new Error('Datesheet not found');
    if (sheet.userId !== user._id) throw new Error('Forbidden');

    const targetSubject = args.subject.trim();
    const targetDate = args.examDate.trim();
    const newItems = sheet.items.filter(
      (it) =>
        !(
          it.subject.trim() === targetSubject &&
          it.examDate.trim() === targetDate
        ),
    );

    if (newItems.length !== sheet.items.length) {
      await ctx.db.patch(args.datesheetId, { items: newItems });
    }
    return null;
  },
});
