import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

type DocDetail = {
	title: string;
	description: string;
	content: string[];
};

const docDetails: Record<string, DocDetail> = {
	"getting-started": {
		title: "快速开始：5 分钟跑通项目",
		description: "本地开发初始化步骤与常见问题处理。",
		content: [
			"安装依赖并确认环境变量后，先运行开发模式验证页面是否可访问。",
			"优先熟悉 src/routes 与 src/components 的组织结构，明确路由和页面职责边界。",
			"新增功能时先补路由，再补页面内容，最后统一检查导航入口与可达性。",
		],
	},
	routing: {
		title: "文档路由设计规范",
		description: "如何规划列表与详情的文件式路由结构。",
		content: [
			"列表页使用 /docs，详情页使用 /docs/$id，保持语义清晰。",
			"详情参数 id 建议使用稳定字符串，不依赖数组下标，避免链接失效。",
			"页面内跳转统一通过 Link + params，确保类型与路径一致。",
		],
	},
	deploy: {
		title: "生产部署检查清单",
		description: "上线前必须完成的关键确认项。",
		content: [
			"检查构建产物、静态资源路径和环境变量是否与目标环境一致。",
			"预先准备健康检查与日志观测，出现异常可快速定位问题。",
			"发布前后保留回滚方案，确保故障时可在短时间恢复服务。",
		],
	},
};

function DocDetailPage() {
	const { id } = Route.useParams();
	const doc = docDetails[id];

	return (
		<main className="mx-auto w-full max-w-[960px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<Badge variant="secondary" className="w-fit">
						文档详情
					</Badge>
					<CardTitle className="text-2xl sm:text-3xl">{doc?.title ?? "未找到文档"}</CardTitle>
					<CardDescription>{doc?.description ?? `当前文档 ID：${id}`}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to="/docs">返回文档列表</Link>
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">正文</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
					{doc ? (
						doc.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
					) : (
						<p>该文档不存在或已下线，请返回列表选择其他文档。</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}

export const Route = createFileRoute("/docs/$id/")({
	component: DocDetailPage,
});