import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

type DocItem = {
	id: string;
	title: string;
	summary: string;
	category: "快速开始" | "路由" | "部署";
	updatedAt: string;
};

const docs: DocItem[] = [
	{
		id: "getting-started",
		title: "快速开始：5 分钟跑通项目",
		summary: "介绍本地安装、启动和基础目录结构，帮助你快速进入开发状态。",
		category: "快速开始",
		updatedAt: "2026-04-29",
	},
	{
		id: "routing",
		title: "文档路由设计规范",
		summary: "说明列表页、详情页以及动态参数的推荐组织方式与命名约定。",
		category: "路由",
		updatedAt: "2026-04-29",
	},
	{
		id: "deploy",
		title: "生产部署检查清单",
		summary: "覆盖构建、环境变量、静态资源与回滚策略等关键步骤。",
		category: "部署",
		updatedAt: "2026-04-29",
	},
];

function DocsPage() {
	return (
		<main className="mx-auto w-full max-w-[1160px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<Badge variant="secondary" className="w-fit">
						Docs
					</Badge>
					<CardTitle className="text-2xl sm:text-3xl">项目文档</CardTitle>
					<CardDescription>集中管理使用说明、规范与最佳实践。</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline" size="sm">
						<Link to="/">返回工作台</Link>
					</Button>
				</CardContent>
			</Card>

			<section className="grid gap-3">
				{docs.map((doc) => (
					<Card key={doc.id} className="gap-2">
						<CardHeader className="pb-2">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">{doc.category}</Badge>
								<span className="text-xs text-muted-foreground">更新于 {doc.updatedAt}</span>
							</div>
							<CardTitle className="text-lg">{doc.title}</CardTitle>
							<CardDescription>{doc.summary}</CardDescription>
						</CardHeader>
						<CardContent className="pt-0">
							<Button asChild variant="outline" size="sm">
								<Link to="/docs/$id" params={{ id: doc.id }}>
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

export const Route = createFileRoute("/docs/")({
	component: DocsPage,
});