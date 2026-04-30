import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { useCurrentUser } from "#/hooks/use-current-user";

export default function Header() {
	const { isPending, isLoggedIn, displayName, signOut } = useCurrentUser();

	return (
		<header className="sticky top-0 z-50 border-b bg-background/90 px-4 backdrop-blur">
			<nav className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-2 py-3">
				<Button asChild variant="outline" className="rounded-full">
					<Link to="/">小红书 AI 自动运营平台</Link>
				</Button>
				<div className="ml-auto flex flex-wrap items-center gap-1">
					<Button asChild variant="ghost" size="sm">
						<Link to="/">工作台</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link to="/chat">AI 助手</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link to="/agents">Agent 管理</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link to="/docs">文档</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link to="/blog">Blog</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<a
							href="https://github.com/seolhw/open-rednote"
							target="_blank"
							rel="noreferrer"
						>
							GitHub
						</a>
					</Button>
					{isPending ? (
						<Button variant="ghost" size="sm" disabled>
							加载中
						</Button>
					) : isLoggedIn ? (
						<>
							<Button asChild variant="ghost" size="sm">
								<Link to="/profile">{displayName}</Link>
							</Button>
							<Button variant="ghost" size="sm" onClick={signOut}>
								退出登录
							</Button>
						</>
					) : (
						<>
							<Button asChild variant="ghost" size="sm">
								<Link to="/auth/login">登录</Link>
							</Button>
							<Button asChild size="sm">
								<Link to="/auth/register">注册</Link>
							</Button>
						</>
					)}
				</div>
			</nav>
		</header>
	);
}
