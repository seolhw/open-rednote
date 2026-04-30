import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";

export const Route = createFileRoute("/blog/4")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<main className="mx-auto w-full max-w-[920px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader className="space-y-3">
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="outline">技术方案</Badge>
						<span>2026-04-30</span>
						<span>约 12 分钟</span>
					</div>
					<CardTitle className="text-2xl sm:text-3xl">
						从 0 到 1：小红书 AI 自动运营平台的技术方案
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm leading-7 text-foreground sm:text-base">
					<p>
						这篇文章介绍整个项目的技术落地方案：为什么选择 TanStack Start
						作为基础框架，如何把 AI 会话、Agent
						运行时、数据库持久化串成一个稳定闭环，以及如何在 Vercel
						上完成自动化部署。
					</p>

					<h2 className="text-lg font-semibold">1. 技术选型</h2>
					<p>
						前端采用 TanStack Start + TanStack Router，数据层使用 TanStack
						Query，数据库层使用 Prisma + PostgreSQL，鉴权使用 Better
						Auth。这个组合的核心价值是：类型一致、路由清晰、数据状态可控。
					</p>

					<h2 className="text-lg font-semibold">2. 系统分层</h2>
					<p>
						系统分为三层：页面交互层、平台 API
						层、运行时与数据层。前端页面只调用平台 API，平台 API
						再去访问数据库与
						ZeroClaw，避免前端直接依赖外部服务细节，降低耦合与泄漏风险。
					</p>

					<h2 className="text-lg font-semibold">3. 聊天链路</h2>
					<p>
						聊天页由会话列表、消息区、输入区组成。发送消息后，先写入用户消息，再建立
						WebSocket 通道接收增量响应，流式内容实时渲染，结束后落库为 assistant
						消息，保证“体验实时 + 数据可追踪”。
					</p>

					<h2 className="text-lg font-semibold">4. 数据模型</h2>
					<p>
						核心模型是 Agent、AgentSession、AgentMessage。Agent
						负责运行时连接配置；AgentSession 负责会话生命周期；AgentMessage
						负责消息明细与元数据。这样可以支持后续审计、复盘、检索与统计。
					</p>

					<h2 className="text-lg font-semibold">5. 安全边界</h2>
					<p>
						所有敏感 API
						在服务端统一做会话校验，未登录请求直接拒绝。环境变量通过 zod
						做类型约束，避免“本地能跑、线上崩溃”。
					</p>

					<h2 className="text-lg font-semibold">6. 部署策略</h2>
					<p>
						当前部署到 Vercel，构建流程为：Prisma Generate → Prisma DB Push →
						Vite Build。这样每次发布可自动同步数据库结构，适合快速迭代阶段。
					</p>

					<h2 className="text-lg font-semibold">7. 下一步规划</h2>
					<p>
						后续会继续完善：消息分页与历史归档、Agent
						多实例调度、细粒度权限控制，以及从 db push 迁移到 migrate deploy
						的生产级变更管理。
					</p>

					<div className="pt-2">
						<Button asChild variant="outline" size="sm">
							<Link to="/blog">返回博客列表</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
