// This file is populated at build time via the inject-config.js script
// For local development, set values in .env.local

const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  userPoolId: import.meta.env.VITE_USER_POOL_ID ?? '',
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? '',
  region: import.meta.env.VITE_REGION ?? 'us-east-1',
};

export default config;
