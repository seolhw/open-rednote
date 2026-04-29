import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

type BlogPost = {
	id: string;
	title: string;
	summary: string;
	readingMinutes: number;
	category: "内容策略" | "AI 提效" | "运营复盘";
	publishedAt: string;
};

const blogPosts: BlogPost[] = [
	{
		id: "1",
		title: "新手 7 天起号：从 0 到稳定更新",
		summary: "拆解每天该做什么，避免“不会写、写不完、发不出”的常见卡点。",
		readingMinutes: 6,
		category: "内容策略",
		publishedAt: "2026-04-20",
	},
	{
		id: "2",
		title: "用 AI 生成图文初稿，再人工润色的标准流程",
		summary: "给出可复用提示词结构，减少空话和模板味，提升发布效率。",
		readingMinutes: 8,
		category: "AI 提效",
		publishedAt: "2026-04-22",
	},
	{
		id: "3",
		title: "发布后怎么复盘：数据指标与下一轮优化",
		summary: "从曝光、互动到收藏转化，建立可执行的内容迭代闭环。",
		readingMinutes: 7,
		category: "运营复盘",
		publishedAt: "2026-04-25",
	},
];

function BlogPage() {
	return (
		<main className="mx-auto w-full max-w-[1160px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<Badge variant="secondary" className="w-fit">
						Blog
					</Badge>
					<CardTitle className="text-2xl sm:text-3xl">Blog：帮助用户学会内容运营</CardTitle>
					<CardDescription>
						聚焦“能直接照着做”的实操文章，帮助用户更快上手并持续优化。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline" size="sm">
						<Link to="/">返回工作台</Link>
					</Button>
				</CardContent>
			</Card>

			<section className="grid gap-3">
				{blogPosts.map((post) => (
					<Card key={post.id} className="gap-2">
						<CardHeader className="pb-2">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">{post.category}</Badge>
								<span className="text-xs text-muted-foreground">{post.publishedAt}</span>
								<span className="text-xs text-muted-foreground">约 {post.readingMinutes} 分钟</span>
							</div>
							<CardTitle className="text-lg">{post.title}</CardTitle>
							<CardDescription>{post.summary}</CardDescription>
						</CardHeader>
						<CardContent className="pt-0">
							<Button asChild variant="outline" size="sm">
								<Link to="/blog/$id" params={{ id: post.id }}>
									查看详情
								</Link>
							</Button>
						</CardContent>
					</Card>
				))}
			</section>
		</main>
	);
}

export const Route = createFileRoute("/blog/")({
	component: BlogPage,
});