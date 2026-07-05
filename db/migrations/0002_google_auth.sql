-- 0002_google_auth.sql — sign-in moved from email+password to Google OAuth.
-- The password column goes away entirely; identity is the Google-verified
-- email matched against the users table (see lib/google.ts + callback route).
ALTER TABLE users DROP COLUMN password_hash;
