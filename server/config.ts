import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

export const PORT = process.env.PORT || 3000;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const DATA_DIR = path.resolve(__dirname, '../../.agent');
export const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set in .env.local');
}
