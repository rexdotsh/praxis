'use server';

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set');
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function generateTextOnce(args: {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const { model, system, prompt, temperature = 0.4, maxTokens } = args;
  const { text } = await generateText({
    model: openrouter.chat(model),
    system,
    prompt,
    temperature,
    ...(maxTokens ? { maxTokens } : {}),
  });
  return text;
}
