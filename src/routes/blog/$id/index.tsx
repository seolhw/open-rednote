import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

function BlogDetailPage() {
	const { id } = Route.useParams();

	return (
		<main className="mx-auto w-full max-w-[960px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<Badge variant="secondary" className="w-fit">
						文章
					</Badge>
					<CardTitle className="text-2xl sm:text-3xl">文章详情</CardTitle>
					<CardDescription>当前文章 ID：{id}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to="/blog">返回 Blog 列表</Link>
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">如何高效产出内容</CardTitle>
					<CardDescription>适用于知识科普、教程拆解、运营经验沉淀类内容。</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
					<p>
						先定义读者场景：他们当前卡在哪里、最急需解决什么问题。不要一上来讲概念，
						先给一个“可直接执行”的步骤，让用户在 5 分钟内获得反馈。
					</p>
					<p>
						再组织内容结构：问题背景、执行步骤、常见误区、复盘方法。每一段都尽量给出可量化标准，
						例如“发布后 24 小时关注收藏率和完播率”，避免只有结论没有动作。
					</p>
					<p>
						最后沉淀复用模板：把标题公式、正文骨架、结尾引导语整理成固定模版，
						下一篇只替换业务信息即可，稳定输出并持续优化。
					</p>
				</CardContent>
			</Card>
		</main>
	);
}

export const Route = createFileRoute("/blog/$id/")({
	component: BlogDetailPage,
});