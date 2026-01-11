/**
 * Firebase authentication utilities.
 * Ported from backend/common/auth.py
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, ErrorResponse } from './types';
import { config } from './config';
import logger from './logger';

// Firebase Admin SDK - will be undefined if not available
let firebaseAdmin: typeof import('firebase-admin') | null = null;
let auth: import('firebase-admin/auth').Auth | null = null;

// Initialize Firebase (lazy)
function initFirebase(): void {
  if (firebaseAdmin !== null) {
    return; // Already initialized
  }

  try {
    firebaseAdmin = require('firebase-admin');
    auth = firebaseAdmin!.auth();

    if (!firebaseAdmin!.apps.length) {
      firebaseAdmin!.initializeApp({
        credential: firebaseAdmin!.credential.applicationDefault(),
      });
    }
    logger.info('Firebase Admin initialized successfully');
  } catch (error) {
    const err = error as Error;
    logger.warn(`firebase-admin not available: ${err.message}. Authentication will be disabled.`);

    if (config.FIREBASE_REQUIRED) {
      throw new Error(
        'Firebase authentication is required but initialization failed. ' +
          'Set GOOGLE_APPLICATION_CREDENTIALS or disable FIREBASE_REQUIRED.'
      );
    }
  }
}

/**
 * Verify Firebase ID token from request headers.
 * Returns decoded token or throws error.
 */
export async function get_current_user(request: FastifyRequest): Promise<User | null> {
  initFirebase();

  if (auth === null) {
    // Firebase not available, return null (no auth)
    return null;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header');
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken as User;
  } catch (error) {
    const err = error as Error;
    logger.error(`Token verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Fastify pre-handler for authentication.
 * Returns 401 if authentication fails and is required.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await get_current_user(request);

  if (user === null) {
    reply.status(401).send({
      detail: 'Invalid authentication credentials',
    } as ErrorResponse);
  } else {
    // Attach user to request for use in handlers
    (request as unknown as { user: User }).user = user;
  }
}

/**
 * Get user from request (after auth middleware).
 */
export function getUserFromRequest(request: FastifyRequest): User | null {
  return (request as unknown as { user: User }).user || null;
}
