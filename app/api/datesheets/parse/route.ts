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
    const body = (await req.json()) as { fileUrl?: string; imageUrl?: string };
    const fileUrl = body.fileUrl || body.imageUrl;
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Missing fileUrl or imageUrl' },
        { status: 400 },
      );
    }

    // Detect content type from URL pathname extension
    const pathname = new URL(fileUrl).pathname.toLowerCase();
    const isPdf = pathname.endsWith('.pdf');

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
      'Normalize dates to ISO YYYY-MM-DD.',
      'Ignore headers/footers/watermarks.',
      allowedSubjects.length
        ? `Subjects allowed: ${JSON.stringify(
            allowedSubjects,
          )}. For each detected subject, choose the CLOSEST match from this list using case-insensitive, punctuation-insensitive fuzzy matching (e.g., abbreviations, plurals, spacing). OUTPUT the exact canonical value from the list. If nothing is reasonably close, SKIP that item.`
        : '',
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

    console.log(subjectSchema);

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
          content: [
            { type: 'text', text: prompt },
            isPdf
              ? ({
                  type: 'file',
                  data: new URL(fileUrl),
                  mediaType: 'application/pdf',
                } as const)
              : ({ type: 'image', image: new URL(fileUrl) } as const),
          ],
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
