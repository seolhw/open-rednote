import { createFileRoute } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="mx-auto w-full max-w-[1160px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<Badge variant="secondary" className="w-fit">小红书自动运营平台</Badge>
					<CardTitle className="text-3xl sm:text-5xl">让内容生产、发布、复盘，一套流程自动跑起来</CardTitle>
					<CardDescription className="max-w-3xl text-sm sm:text-base">
						突出“会话、执行步骤、发布结果”三个核心区域。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-3">
					<Button asChild><a href="/about">查看项目说明</a></Button>
					<Button asChild variant="outline"><a href="/chat">打开 AI 助手</a></Button>
					<Button asChild variant="secondary"><a href="/blog">阅读 Blog</a></Button>
					<Button asChild variant="secondary"><a href="/docs">阅读文档</a></Button>
				</CardContent>
			</Card>

			<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[["会话任务", "128"],["今日发布", "36"],["成功率", "97.2%"],["平均耗时", "2m 14s"]].map(([label, value]) => (
					<Card key={label} className="gap-2">
						<CardHeader className="px-4 pt-4"><CardDescription>{label}</CardDescription></CardHeader>
						<CardContent className="px-4 pb-4 pt-0"><CardTitle className="text-2xl">{value}</CardTitle></CardContent>
					</Card>
				))}
			</section>

			<Card>
				<CardHeader><CardTitle>自动运营流程</CardTitle></CardHeader>
				<CardContent className="grid gap-3">
					{[["输入选题", "输入关键词或目标账号，系统自动拆解选题方向。"],["生成图文", "AI 自动输出标题、正文、配图建议与标签。"],["审核发布", "确认内容后，一键触发发布与发布后监控。"]].map(([title, desc], idx) => (
						<div key={title} className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border p-3">
							<Badge className="h-8 w-8 justify-center rounded-full p-0">{idx + 1}</Badge>
							<div>
								<p className="text-sm font-semibold">{title}</p>
								<p className="text-sm text-muted-foreground">{desc}</p>
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		</main>
	);
}
