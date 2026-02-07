-- Add profile columns to users table (persists across sessions)
ALTER TABLE "users" ADD COLUMN "display_name" text;
ALTER TABLE "users" ADD COLUMN "about" text;
ALTER TABLE "users" ADD COLUMN "profile_pic_url" text;
