ALTER TABLE "User" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailVerified" timestamp;