import { Button } from "#/components/ui/button";

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-8 border-t border-border/60 bg-secondary/35 px-4 pb-2 pt-2 backdrop-blur-sm">
			<div className="mx-auto flex w-full max-w-[1160px] flex-col items-center justify-between gap-3 py-4 sm:flex-row">
				<p className="m-0 text-sm text-muted-foreground/90">
					&copy; {year} 小红书 AI 自动运营平台. All rights reserved.
				</p>
				<Button asChild variant="outline" size="sm" className="bg-background/80">
					<a href="https://github.com/seolhw/open-rednote" target="_blank" rel="noreferrer">
						GitHub
					</a>
				</Button>
			</div>
		</footer>
	);
}
