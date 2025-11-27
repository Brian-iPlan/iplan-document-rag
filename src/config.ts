const isProduction = process.env.NODE_ENV === 'production';

export const API_BASE_URL = isProduction 
  ? 'https://your-production-api-url.com' 
  : 'http://localhost:8000';