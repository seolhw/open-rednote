import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/auth/login")({
	component: LoginPage,
});

function LoginPage() {
	const { data: session, isPending } = authClient.useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async ({
		event,
	}: {
		event: React.FormEvent<HTMLFormElement>;
	}) => {
		event.preventDefault();
		setErrorMessage("");
		setSubmitting(true);

		const result = await authClient.signIn.email({
			email,
			password,
		});

		setSubmitting(false);

		if (result.error) {
			setErrorMessage(result.error.message || "登录失败");
			return;
		}

		window.location.href = "/profile";
	};

	if (isPending) {
		return <div className="mx-auto w-full max-w-md px-4 py-10">加载中...</div>;
	}

	if (session?.user) {
		return (
			<div className="mx-auto w-full max-w-md px-4 py-10">
				<div className="rounded-lg border p-6">
					<h1 className="text-lg font-semibold">你已登录</h1>
					<p className="mt-2 text-sm text-neutral-500">{session.user.email}</p>
					<div className="mt-4">
						<Link to="/profile" className="text-sm underline">
							前往个人中心
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-md px-4 py-10">
			<div className="rounded-lg border p-6">
				<h1 className="text-lg font-semibold">登录</h1>
				<p className="mt-2 text-sm text-neutral-500">使用邮箱和密码登录</p>

				<form
					className="mt-6 space-y-4"
					onSubmit={(e) => onSubmit({ event: e })}
				>
					<div>
						<label htmlFor="email" className="mb-1 block text-sm">
							邮箱
						</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="h-10 w-full rounded-md border px-3 text-sm"
						/>
					</div>
					<div>
						<label htmlFor="password" className="mb-1 block text-sm">
							密码
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={8}
							className="h-10 w-full rounded-md border px-3 text-sm"
						/>
					</div>

					{errorMessage ? (
						<div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-600">
							{errorMessage}
						</div>
					) : null}

					<div className="bg-red-50 p-2 text-sm">
						可直接使用 test@qq.com 12345678 登录
					</div>

					<button
						type="submit"
						disabled={submitting}
						className="h-10 w-full rounded-md bg-black px-3 text-sm text-white disabled:opacity-50"
					>
						{submitting ? "登录中..." : "登录"}
					</button>
				</form>

				<p className="mt-4 text-sm text-neutral-500">
					还没有账号？{" "}
					<Link to="/auth/register" className="underline">
						去注册
					</Link>
				</p>
			</div>
		</div>
	);
}
