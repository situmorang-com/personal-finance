<script lang="ts">
	import '../../app.css';
	import { signOut } from '@auth/sveltekit/client';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Receipt from '@lucide/svelte/icons/receipt';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Settings from '@lucide/svelte/icons/settings';

	let { data, children } = $props();

	let dark = $state(false);

	onMount(() => {
		dark = localStorage.getItem('theme') === 'dark' ||
			(!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
		applyTheme();
	});

	function toggleDark() {
		dark = !dark;
		localStorage.setItem('theme', dark ? 'dark' : 'light');
		applyTheme();
	}

	function applyTheme() {
		document.documentElement.classList.toggle('dark', dark);
	}

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
		{ href: '/expenses', label: 'Expenses', icon: Receipt },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];
</script>

<div class="relative min-h-screen bg-background text-foreground">
	<!-- Ambient gradient mesh — subtle, fixed, sits behind all content -->
	<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
		<div class="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[100px] dark:bg-primary/15"></div>
		<div class="absolute top-1/3 -right-32 h-[24rem] w-[24rem] rounded-full bg-violet-400/10 blur-[100px] dark:bg-violet-500/10"></div>
		<div class="absolute bottom-0 left-1/4 h-[22rem] w-[22rem] rounded-full bg-indigo-400/5 blur-[100px] dark:bg-indigo-500/10"></div>
	</div>

	<header class="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-6">
				<span class="text-base font-bold tracking-tight text-foreground">💰 Finance</span>
				<nav class="hidden items-center gap-1 sm:flex">
					{#each nav as item (item.href)}
						{@const active = page.url.pathname.startsWith(item.href)}
						<a
							href={item.href}
							class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {active
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={toggleDark}
					class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					aria-label="Toggle dark mode"
				>
					{#if dark}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4" />
					{/if}
				</button>

				{#if data.user?.image}
					<img
						src={data.user.image}
						alt={data.user.name ?? ''}
						class="h-7 w-7 rounded-full ring-1 ring-border"
					/>
				{:else}
					<div class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
						{data.user?.name?.charAt(0) ?? '?'}
					</div>
				{/if}

				<span class="hidden text-sm text-muted-foreground sm:block">{data.user?.name}</span>

				<button
					onclick={() => signOut({ callbackUrl: '/login' })}
					class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					aria-label="Sign out"
				>
					<LogOut class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Mobile nav -->
		<div class="flex border-t border-border sm:hidden">
			{#each nav as item (item.href)}
				{@const active = page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors {active
						? 'text-foreground'
						: 'text-muted-foreground'}"
				>
					<item.icon class="h-4 w-4" />
					{item.label}
				</a>
			{/each}
		</div>
	</header>

	<main class="relative z-10 mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
