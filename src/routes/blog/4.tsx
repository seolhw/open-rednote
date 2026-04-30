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
						这次技术方案把中心放在 AI Agent：平台并不是“单次问答页面”，而是把意图理解、任务编排、模型调用、外部工具执行、结果落库串成闭环。
					</p>

					<h2 className="text-lg font-semibold">1. AI Agent 的职责边界</h2>
					<p>
						Agent 负责三件事：第一，理解用户目标并拆成可执行步骤；第二，根据任务选择模型或 skill；第三，把执行轨迹回传给前端并写入会话记录。这样对话不仅有答案，还有可复盘的执行过程。
					</p>

					<h2 className="text-lg font-semibold">2. 模型层：文本与图像双引擎</h2>
					<p>
						主文本模型使用 Minimax 2.7，承担策略规划、内容生成、结构化输出。文生图使用 Minimax image-01 与 image-01-live：前者用于高质量封面生成，后者用于更快的交互式预览与迭代。
					</p>

					<h2 className="text-lg font-semibold">3. Skill 层：把 Agent 接到真实世界</h2>
					<p>
						Skill 是 Agent 的“执行手脚”。在本项目中，重点 skill 是小红书 CLI（xiaohongshu-cli），用于登录态检查、内容读取、互动与发布相关动作。Agent 通过 skill 把“建议”变成“可执行操作”。
					</p>
					<p>
						项目地址：
						<a
							href="https://github.com/jackwener/xiaohongshu-cli"
							target="_blank"
							rel="noreferrer"
							className="underline"
						>
							jackwener/xiaohongshu-cli
						</a>
					</p>

					<h2 className="text-lg font-semibold">4. Agent 与平台连接方式</h2>
					<p>
						平台层提供统一 API 与会话容器，Agent 运行时通过 WebSocket 建立流式通道。用户消息先进入平台会话，再由 Agent 编排并调用模型/skill，增量结果实时推送到消息区，最终答案与关键执行信息落库。
					</p>

					<h2 className="text-lg font-semibold">5. 关键数据流</h2>
					<p>
						输入：用户目标与上下文。编排：Agent 生成子任务。执行：Minimax 2.7 或 image-01/image-01-live + xiaohongshu-cli。回传：流式文本与工具状态。沉淀：AgentSession 与 AgentMessage。复盘：基于历史会话优化下一轮策略。
					</p>

					<h2 className="text-lg font-semibold">6. 为什么这个连接方式有效</h2>
					<p>
						它把“模型能力”和“平台能力”分层：模型负责理解与生成，skill 负责执行与对接，小红书能力通过 CLI 统一封装，平台负责权限、会话与可观测性。这样既保证可扩展，也能快速接入新工具链。
					</p>

					<h2 className="text-lg font-semibold">7. 当前方案的不足与改进方向</h2>
					<p>
						目前方案并不完美，尤其在工程化与安全边界上仍有明显短板。
					</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>
							zeroclaw 的隔离性较差：当多个账号或多任务并发运行时，运行时上下文、缓存与工具状态容易互相影响，存在串号与误操作风险。
						</li>
						<li>
							登录态安全压力大：小红书登录信息（如 a1、web_session）一旦明文存储或日志泄露，会直接带来账号被盗用风险。
						</li>
						<li>
							可观测性仍偏弱：目前更偏“结果可见”，但对每次工具调用的耗时、失败原因、重试路径记录不足，问题定位成本高。
						</li>
						<li>
							回滚与熔断策略不完整：当平台接口抖动或 CLI 行为异常时，缺少统一降级、暂停发布与人工接管机制。
						</li>
					</ul>
					<p>
						下一步建议：按“单账号单执行沙箱”重构隔离模型；登录态做加密与最小化暴露；补齐调用链指标与告警；为发布链路增加熔断、审批和一键回滚。
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
