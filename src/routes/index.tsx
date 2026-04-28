import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="mx-auto w-full max-w-[1160px] px-4 pb-14 pt-8 sm:pt-10">
			<section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
				<p className="mb-3 text-sm font-bold tracking-wide text-rose-500">
					小红书自动运营平台
				</p>
				<h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-5xl">
					让内容生产、发布、复盘，一套流程自动跑起来
				</h1>
				<p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">
					对标你提供的 UI 视觉：左侧导航 +
					中间对话工作流。这里先落地首页工作台样式，突出“会话、执行步骤、发布结果”三个核心区域。
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<a
						href="/about"
						className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-rose-600"
					>
						查看项目说明
					</a>
					<a
						href="/chat"
						className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-50"
					>
						打开 AI 助手
					</a>
				</div>
			</section>

			<section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[
					["会话任务", "128"],
					["今日发布", "36"],
					["成功率", "97.2%"],
					["平均耗时", "2m 14s"],
				].map(([label, value]) => (
					<article
						key={label}
						className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
					>
						<p className="text-xs text-zinc-500">{label}</p>
						<h2 className="mt-1 text-2xl font-semibold text-zinc-900">
							{value}
						</h2>
					</article>
				))}
			</section>

			<section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
				<h3 className="text-lg font-semibold text-zinc-900">自动运营流程</h3>
				<div className="mt-4 grid gap-3">
					{[
						["输入选题", "输入关键词或目标账号，系统自动拆解选题方向。"],
						["生成图文", "AI 自动输出标题、正文、配图建议与标签。"],
						["审核发布", "确认内容后，一键触发发布与发布后监控。"],
					].map(([title, desc], idx) => (
						<article
							key={title}
							className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-zinc-200 p-3"
						>
							<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">
								{idx + 1}
							</span>
							<div>
								<h4 className="text-sm font-semibold text-zinc-900 sm:text-base">
									{title}
								</h4>
								<p className="mt-1 text-sm text-zinc-600">{desc}</p>
							</div>
						</article>
					))}
				</div>
			</section>
		</main>
	);
}
