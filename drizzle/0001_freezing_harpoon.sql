CREATE TABLE `currencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `currency_id` integer REFERENCES currencies(id);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `currency_id` integer REFERENCES currencies(id);--> statement-breakpoint
ALTER TABLE `users` ADD `main_currency_id` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `rates_updated_at` text;