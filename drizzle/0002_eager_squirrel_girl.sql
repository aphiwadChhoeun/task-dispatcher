CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_org_user_uq` ON `memberships` (`org_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_org_role_idx` ON `memberships` (`org_id`,`role`);--> statement-breakpoint
CREATE INDEX `memberships_org_status_idx` ON `memberships` (`org_id`,`status`);--> statement-breakpoint
INSERT INTO `memberships` (`id`, `org_id`, `user_id`, `role`, `status`, `created_at`, `updated_at`)
SELECT `id`, `org_id`, `id`, `role`, `status`, `created_at`, `updated_at` FROM `users`;--> statement-breakpoint
CREATE TABLE `__new_taskers` (
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`skills` text,
	`vehicle` text,
	`availability` text,
	`color` text DEFAULT '#0f766e' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `org_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_taskers`("user_id", "org_id", "skills", "vehicle", "availability", "color", "created_at") SELECT "user_id", "org_id", "skills", "vehicle", "availability", "color", "created_at" FROM `taskers`;--> statement-breakpoint
DROP TABLE `taskers`;--> statement-breakpoint
ALTER TABLE `__new_taskers` RENAME TO `taskers`;--> statement-breakpoint
CREATE INDEX `taskers_org_idx` ON `taskers` (`org_id`);