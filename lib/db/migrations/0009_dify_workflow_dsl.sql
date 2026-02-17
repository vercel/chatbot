CREATE TABLE IF NOT EXISTS "DifyWorkflowDsl" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"messageId" uuid,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	"version" integer NOT NULL,
	"workflowName" text,
	"mode" varchar,
	"dslYaml" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DifyWorkflowDsl" ADD CONSTRAINT "DifyWorkflowDsl_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DifyWorkflowDsl" ADD CONSTRAINT "DifyWorkflowDsl_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DifyWorkflowDsl" ADD CONSTRAINT "DifyWorkflowDsl_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

