import { Link } from "@tanstack/react-router";

export default function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-rose-100 bg-white/85 px-4 shadow-[0_4px_20px_rgba(255,36,66,0.08)] backdrop-blur">
			<nav className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
				<h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 no-underline shadow-sm transition hover:bg-rose-100 sm:px-4 sm:py-2"
					>
						<span className="h-2 w-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-400" />
						小红书 AI 自动运营平台
					</Link>
				</h2>

				<div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
					<Link
						to="/"
						className="text-sm font-semibold text-zinc-600 no-underline transition hover:text-rose-600"
						activeProps={{
							className:
								"text-sm font-semibold text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-8",
						}}
					>
						工作台
					</Link>
					<Link
						to="/about"
						className="text-sm font-semibold text-zinc-600 no-underline transition hover:text-rose-600"
						activeProps={{
							className:
								"text-sm font-semibold text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-8",
						}}
					>
						项目说明
					</Link>
					<a
						href="https://github.com/seolhw/open-rednote"
						className="text-sm font-semibold text-zinc-600 no-underline transition hover:text-rose-600"
						target="_blank"
						rel="noreferrer"
					>
						GitHub
					</a>
					{/* <details className="relative w-full sm:w-auto">
						<summary className="list-none cursor-pointer text-sm font-semibold text-zinc-500 transition hover:text-zinc-900">
							功能入口
						</summary>
						<div className="mt-2 min-w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg sm:absolute sm:right-0">
							{[
								["/demo/prisma", "Prisma"],
								["/chat", "Chat"],
								["/demo/better-auth", "认证"],
								["/demo/db-chat", "DB 聊天"],
								["/demo/form/simple", "简单表单"],
								["/demo/form/address", "地址表单"],
								["/demo/table", "表格"],
								["/demo/store", "Store"],
								["/demo/ai-image", "AI 图像"],
								["/demo/ai-structured", "AI 结构化"],
							].map(([href, label]) => (
								<a
									key={href}
									href={href}
									className="block rounded-lg px-3 py-2 text-sm text-zinc-500 no-underline transition hover:bg-zinc-50 hover:text-zinc-900"
								>
									{label}
								</a>
							))}
						</div>
					</details> */}
				</div>
			</nav>
		</header>
	);
}
