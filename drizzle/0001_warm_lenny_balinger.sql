DROP INDEX `users_org_email_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_uq` ON `organizations` (`slug`);