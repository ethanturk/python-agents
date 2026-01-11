/**
 * OpenAI client wrapper for LLM operations.
 * Ported from services/llm.py
 */

import OpenAI from 'openai';
import type { AgentResponse } from './types';
import { config } from './config';
import logger from './logger';

// Initialize OpenAI client
const openai = new OpenAI({
  baseURL: config.OPENAI_API_BASE,
  apiKey: config.OPENAI_API_KEY,
});

/**
 * Run synchronous agent (LLM chat completion).
 * @param prompt - User prompt
 * @returns LLM response
 */
export async function runSyncAgent(prompt: string): Promise<string> {
  try {
    logger.info({ prompt }, 'Running sync agent');

    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Provide clear, accurate, and concise responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    const result = response.choices[0]?.message?.content || '';

    logger.info({ responseLength: result.length }, 'Sync agent completed');

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Sync agent error');

    // Return error message in same format as Python
    return `Error: ${err.message}`;
  }
}

/**
 * Generate embedding for text using OpenAI embedding model.
 * @param text - Text to embed
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: config.OPENAI_EMBEDDING_MODEL,
      input: text,
    });

    const embedding = response.data[0]?.embedding || [];

    logger.info(
      { textLength: text.length, embeddingDimension: embedding.length },
      'Embedding generated'
    );

    return embedding;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Embedding generation error');
    throw err;
  }
}

/**
 * Run QA with context.
 * @param question - User question
 * @param context - Context information
 * @returns QA response
 */
export async function runQAAgent(
  question: string,
  context: string
): Promise<string> {
  try {
    logger.info({ question, contextLength: context.length }, 'Running QA agent');

    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Use the provided context to answer the question accurately.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    const result = response.choices[0]?.message?.content || '';

    logger.info({ responseLength: result.length }, 'QA agent completed');

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'QA agent error');

    // Return error message in same format as Python
    return `Error: ${err.message}`;
  }
}

export default openai;
