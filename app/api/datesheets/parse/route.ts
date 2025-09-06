import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '@/lib/ai';
import { auth } from '@clerk/nextjs/server';

const MODEL = 'anthropic/claude-sonnet-4';

type SubjectSchema = z.ZodType<string>;

function makeParsedSchema(subject: SubjectSchema) {
  return z.object({
    title: z.string().optional().default(''),
    items: z
      .array(
        z.object({
          subject,
          examDate: z
            .string()
            .describe('ISO date string YYYY-MM-DD. If year missing, infer.'),
          syllabus: z.array(z.string()).optional().default([]),
        }),
      )
      .min(1),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fileUrl?: string;
      imageUrl?: string;
      fileUrls?: string[];
      imageUrls?: string[];
    };
    const urls: string[] = [];
    if (Array.isArray(body.fileUrls)) urls.push(...body.fileUrls);
    if (Array.isArray(body.imageUrls)) urls.push(...body.imageUrls);
    if (body.fileUrl) urls.push(body.fileUrl);
    if (body.imageUrl) urls.push(body.imageUrl);
    if (urls.length === 0) {
      return NextResponse.json(
        { error: 'Missing fileUrl(s) or imageUrl(s)' },
        { status: 400 },
      );
    }

    const system =
      'You are an expert at reading exam schedules (datesheets) and syllabi from PDFs and images. Extract normalized data. When an allowed subjects list is provided, map any detected subject to the closest allowed subject and emit only that canonical value.';

    // Load allowed subjects from Clerk public metadata (if present)
    const { sessionClaims } = await auth();
    const allowedSubjects = Array.isArray(
      (sessionClaims?.metadata as any)?.subjects,
    )
      ? ((sessionClaims?.metadata as any).subjects as string[])
      : [];

    const prompt = [
      'Return ONLY valid JSON (no markdown/code fences).',
      'Output shape: { "items": [{ "subject": string, "examDate": "YYYY-MM-DD", "syllabus": string[] }] }.',
      'If multiple subjects share a date, create one item per subject.',
      'Syllabus is optional and often empty.',
      'Multiple files may be provided (e.g., a datesheet and a syllabus). Combine information across files, merge syllabus bullets for the same subject, and deduplicate subjects/dates. Prefer exam dates from datesheet/timetable documents when conflicts arise.',
      'Normalize dates to ISO YYYY-MM-DD.',
      'Ignore headers/footers/watermarks.',
      allowedSubjects.length
        ? `Subjects allowed: ${JSON.stringify(
            allowedSubjects,
          )}. For each detected subject, choose the CLOSEST match from this list using case-insensitive, punctuation-insensitive fuzzy matching (including abbreviations, acronyms, plurals, spacing, truncated names). OUTPUT the exact canonical value from the list. If nothing is reasonably close, SKIP that item.`
        : '',
      'The datesheet may include subjects outside the allowed list; ignore them.',
      'If the same exam date is linked to multiple subjects (e.g., OPT-A and OPT-B), include only one by default (prioritize OPT-A). If onboarding specifies that the student has both, then include both. Ensure no duplicate exam dates are created.',
      'Only include subjects that are part of the student’s chosen subset during onboarding, even if they exist in the allowed subjects list.',
      'Format the syllabus concisely and consistently: do not repeat book names or other common prefixes for each chapter/topic. Preserve chapter numbers if present (e.g., Ch-1, Ch-2), and keep all subjects following the same style.',
    ]
      .filter(Boolean)
      .join(' ');

    // Build dynamic schema with enum when allowed subjects provided
    const uniqueAllowed = Array.from(
      new Set(
        allowedSubjects
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s) => s.length > 0),
      ),
    );

    let subjectSchema: SubjectSchema;
    if (uniqueAllowed.length === 0) {
      subjectSchema = z.string();
    } else if (uniqueAllowed.length === 1) {
      subjectSchema = z.literal(uniqueAllowed[0]);
    } else {
      const literals = uniqueAllowed.map((s) => z.literal(s)) as [
        z.ZodLiteral<string>,
        ...z.ZodLiteral<string>[],
      ];
      subjectSchema = z.union(literals);
    }

    const attachments = urls.map((u) => {
      const pathname = new URL(u).pathname.toLowerCase();
      return pathname.endsWith('.pdf')
        ? ({
            type: 'file',
            data: new URL(u),
            mediaType: 'application/pdf',
          } as const)
        : ({ type: 'image', image: new URL(u) } as const);
    });

    const { object } = await generateObject({
      model: openrouter.chat(MODEL),
      system,
      schema: makeParsedSchema(subjectSchema),
      mode: 'json',
      schemaName: 'Datesheet',
      schemaDescription:
        'Flattened list of exam entries with optional syllabus.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...attachments],
        },
      ],
      // Encourage compact outputs
      temperature: 0.2,
    });

    return NextResponse.json({ parsed: object });
  } catch (error) {
    console.error('Failed to parse datesheet', error);
    return NextResponse.json({ error: 'Failed to parse' }, { status: 500 });
  }
}
