CREATE TABLE IF NOT EXISTS "chat_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" varchar(32) DEFAULT 'manual' NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"usage_percent" integer DEFAULT 0 NOT NULL,
	"conversation_summary" text,
	"message_ids" jsonb DEFAULT '[]'::jsonb,
	"model_id" varchar(64),
	"context_window" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "handoff_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_message_id" text,
	"user_id" uuid,
	"repo" text,
	"goal" text,
	"v2_session_id" text,
	"v2_sandbox_id" text,
	"status" text DEFAULT 'spawning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"pr_url" text,
	"deploy_url" text,
	"result_summary" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_connectors" (
	"name" text PRIMARY KEY NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"mcp_enabled" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"primary_domain" text,
	"also_in" jsonb DEFAULT '[]'::jsonb,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"tools" integer DEFAULT 0 NOT NULL,
	"tool_names" jsonb DEFAULT '[]'::jsonb,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_node" text NOT NULL,
	"from_type" text NOT NULL,
	"to_node" text NOT NULL,
	"to_type" text NOT NULL,
	"edge_type" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_evals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_name" text NOT NULL,
	"domain" text DEFAULT 'general' NOT NULL,
	"query" text NOT NULL,
	"expected_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_model" text,
	"success_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"severity" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_id" uuid NOT NULL,
	"session_id" text,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"skills_loaded" jsonb DEFAULT '[]'::jsonb,
	"connectors_used" jsonb DEFAULT '[]'::jsonb,
	"model_used" text,
	"quality_grade" text,
	"quality_score" integer,
	"sub_scores" jsonb,
	"latency_ms" integer,
	"cost_usd" numeric(14, 8),
	"tokens_in" integer,
	"tokens_out" integer,
	"error_message" text,
	"raw_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_functions" (
	"name" text PRIMARY KEY NOT NULL,
	"signature" text,
	"skill_name" text,
	"description" text DEFAULT '' NOT NULL,
	"domain" text,
	"also_in" jsonb DEFAULT '[]'::jsonb,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"context_tokens_estimated" integer,
	"typical_latency_ms" integer,
	"cost_per_invocation_usd" jsonb,
	"incompatible_with" jsonb DEFAULT '[]'::jsonb,
	"optimal_for" jsonb DEFAULT '[]'::jsonb,
	"suboptimal_for" jsonb DEFAULT '[]'::jsonb,
	"file_path" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_models" (
	"identifier" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"family" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"release_date" timestamp with time zone,
	"context_window_tokens" integer DEFAULT 0 NOT NULL,
	"max_output_tokens" integer DEFAULT 0 NOT NULL,
	"input_price_per_million" numeric DEFAULT '0' NOT NULL,
	"output_price_per_million" numeric DEFAULT '0' NOT NULL,
	"cached_input_price" numeric,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning_score" integer DEFAULT 0,
	"coding_score" integer DEFAULT 0,
	"vision_score" integer DEFAULT 0,
	"speed_score" integer DEFAULT 0,
	"cost_score" integer DEFAULT 0,
	"benchmark_scores" jsonb,
	"best_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"not_good_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_model_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text,
	"model_used" text NOT NULL,
	"playbook_routed_from" text,
	"skill_routed_to" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"cost_usd" numeric(14, 8),
	"success_marker" boolean DEFAULT true NOT NULL,
	"user_rating" integer DEFAULT 0,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"phases" jsonb DEFAULT '[]'::jsonb,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb,
	"files_affected" jsonb DEFAULT '[]'::jsonb,
	"skills_loaded" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"context_goal" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_playbooks" (
	"name" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'domain' NOT NULL,
	"scope_connectors" jsonb DEFAULT '[]'::jsonb,
	"triggers" jsonb DEFAULT '[]'::jsonb,
	"workflows" jsonb DEFAULT '[]'::jsonb,
	"description" text DEFAULT '' NOT NULL,
	"file_path" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_skills" (
	"name" text NOT NULL,
	"type" text DEFAULT 'connector' NOT NULL,
	"connector_name" text,
	"description" text DEFAULT '' NOT NULL,
	"file_path" text,
	"content" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"context_tokens_estimated" integer,
	"typical_latency_ms" integer,
	"cost_per_invocation_usd" jsonb,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"incompatible_with" jsonb DEFAULT '[]'::jsonb,
	"optimal_for" jsonb DEFAULT '[]'::jsonb,
	"suboptimal_for" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_skills_name_type_pk" PRIMARY KEY("name","type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text,
	"skill_loaded" text NOT NULL,
	"skill_type" text DEFAULT 'connector' NOT NULL,
	"playbook_routed_from" text,
	"success_marker" boolean DEFAULT true NOT NULL,
	"tokens_actual" integer,
	"latency_actual_ms" integer,
	"cost_actual_usd" jsonb,
	"co_loaded_with" jsonb DEFAULT '[]'::jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_v2_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"session_id" text NOT NULL,
	"status" text DEFAULT 'spawning' NOT NULL,
	"progress" integer DEFAULT 0,
	"skills_loaded" jsonb DEFAULT '[]'::jsonb,
	"parallel_group" text,
	"validation_results" jsonb,
	"error_message" text,
	"pr_url" text,
	"deploy_url" text,
	"stream_url" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_workflows" (
	"name" text PRIMARY KEY NOT NULL,
	"playbook_name" text,
	"durable" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "parent_chat_id" uuid;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "checkpoint_id" uuid;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "token_count" integer;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "artifact_spec" text;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "artifact_model" varchar(64);--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "artifact_draft" text;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "stream_position" integer DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_checkpoints" ADD CONSTRAINT "chat_checkpoints_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_checkpoints" ADD CONSTRAINT "chat_checkpoints_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "handoff_sessions" ADD CONSTRAINT "handoff_sessions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_eval_runs" ADD CONSTRAINT "library_eval_runs_eval_id_library_evals_id_fk" FOREIGN KEY ("eval_id") REFERENCES "public"."library_evals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_v2_sessions" ADD CONSTRAINT "library_v2_sessions_plan_id_library_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."library_plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
