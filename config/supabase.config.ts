/**
 * Supabase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://supabase.com and create a new project
 * 2. Get your project URL and anon key from Settings > API
 * 3. Replace the placeholder values below with your actual keys
 */

export const supabaseConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://drshtkrhszeaxpmectex.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyc2h0a3Joc3plYXhwbWVjdGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTUwNTAsImV4cCI6MjA3NzgzMTA1MH0.TAz9TFcCogE66Ivvkr06wJGaILQQHBxk2ldF6Tj8-oU',
};
/**
 * Database Tables Structure
 * 
 * You'll need to create these tables in Supabase:
 * 
 * 1. users
 *    - id (uuid, primary key, references auth.users)
 *    - email (text)
 *    - full_name (text)
 *    - phone (text)
 *    - location (text)
 *    - bio (text, nullable)
 *    - areas_of_expertise (text[], nullable)
 *    - education (text, nullable)
 *    - avatar_url (text, nullable)
 *    - role (text, default 'volunteer')
 *    - total_hours (integer, default 0)
 *    - activities_completed (integer, default 0)
 *    - organizations_helped (integer, default 0)
 *    - created_at (timestamp)
 *    - updated_at (timestamp)
 * 
 * 2. opportunities
 *    - id (uuid, primary key)
 *    - title (text)
 *    - description (text)
 *    - organization_name (text)
 *    - organization_verified (boolean, default false)
 *    - category (text)
 *    - location (text)
 *    - latitude (float, nullable)
 *    - longitude (float, nullable)
 *    - date (timestamp)
 *    - duration (text)
 *    - spots_available (integer)
 *    - spots_total (integer)
 *    - requirements (text[], nullable)
 *    - skills_needed (text[], nullable)
 *    - impact_statement (text, nullable)
 *    - image_url (text, nullable)
 *    - status (text, default 'active')
 *    - created_by (uuid, references users)
 *    - created_at (timestamp)
 *    - updated_at (timestamp)
 * 
 * 3. opportunity_signups
 *    - id (uuid, primary key)
 *    - opportunity_id (uuid, references opportunities)
 *    - user_id (uuid, references users)
 *    - status (text, default 'confirmed')
 *    - hours_completed (float, nullable)
 *    - signed_up_at (timestamp)
 *    - completed_at (timestamp, nullable)
 * 
 * 4. posts
 *    - id (uuid, primary key)
 *    - user_id (uuid, references users)
 *    - text (text)
 *    - media_urls (text[], nullable)
 *    - media_types (text[], nullable)
 *    - likes (text[], default array)
 *    - shares (integer, default 0)
 *    - opportunity_id (uuid, nullable, references opportunities)
 *    - created_at (timestamp)
 *    - updated_at (timestamp)
 * 
 * 5. comments
 *    - id (uuid, primary key)
 *    - post_id (uuid, references posts)
 *    - user_id (uuid, references users)
 *    - text (text)
 *    - created_at (timestamp)
 * 
 * 6. conversations
 *    - id (uuid, primary key)
 *    - participants (text[], array of user IDs)
 *    - updated_at (timestamp)
 * 
 * 7. messages
 *    - id (uuid, primary key)
 *    - conversation_id (uuid, references conversations)
 *    - sender_id (uuid, references users)
 *    - text (text)
 *    - read (boolean, default false)
 *    - created_at (timestamp)
 * 
 * 8. achievements
 *    - id (uuid, primary key)
 *    - user_id (uuid, references users)
 *    - name (text)
 *    - description (text)
 *    - icon (text)
 *    - earned_at (timestamp)
 * 
 * 9. notifications
 *    - id (uuid, primary key)
 *    - user_id (uuid, references users)
 *    - type (text)
 *    - title (text)
 *    - body (text)
 *    - read (boolean, default false)
 *    - post_id (uuid, nullable)
 *    - opportunity_id (uuid, nullable)
 *    - conversation_id (uuid, nullable)
 *    - created_at (timestamp)
 */
