import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="px-4 pb-10 pt-6">
			<Card className="mx-auto w-full max-w-[1160px] gap-0 py-0">
				<CardContent className="flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
					<p className="m-0 text-sm text-muted-foreground">
						&copy; {year} 小红书 AI 自动运营平台. All rights reserved.
					</p>
					<Button asChild variant="ghost" size="sm">
						<a href="https://github.com/seolhw/open-rednote" target="_blank" rel="noreferrer">
							GitHub
						</a>
					</Button>
				</CardContent>
			</Card>
		</footer>
	);
}
