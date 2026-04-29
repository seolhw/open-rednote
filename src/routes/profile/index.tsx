import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/profile/")({
	component: ProfilePage,
});

function ProfilePage() {
	const { data: session, isPending } = authClient.useSession();
	const [name, setName] = useState("");
	const [avatar, setAvatar] = useState("");
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const canShowForm = !!session?.user;

	const onInitProfileForm = () => {
		if (!session?.user) {
			return;
		}
		setName(session.user.name || "");
		setAvatar(session.user.image || "");
	};

	const onSaveProfile = async ({
		event,
	}: {
		event: React.FormEvent<HTMLFormElement>;
	}) => {
		event.preventDefault();
		if (!session?.user) {
			return;
		}

		setMessage("");
		setSubmitting(true);

		const result = await authClient.updateUser({
			name,
			image: avatar || null,
		});

		setSubmitting(false);

		if (result.error) {
			setMessage(result.error.message || "保存失败");
			return;
		}

		setMessage("保存成功");
	};

	if (isPending) {
		return <div className="mx-auto w-full max-w-2xl px-4 py-10">加载中...</div>;
	}

	if (!canShowForm) {
		return (
			<div className="mx-auto w-full max-w-2xl px-4 py-10">
				<div className="rounded-lg border p-6">
					<h1 className="text-lg font-semibold">个人中心</h1>
					<p className="mt-2 text-sm text-neutral-500">
						你还未登录，请先登录。
					</p>
					<div className="mt-4">
						<Link to="/auth/login" className="text-sm underline">
							前往登录
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (!name && !avatar) {
		onInitProfileForm();
	}

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<div className="rounded-lg border p-6">
				<h1 className="text-lg font-semibold">个人中心</h1>
				<p className="mt-2 text-sm text-neutral-500">管理你的账号信息</p>

				<div className="mt-6 rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-900/40">
					<div>账号 ID：{session.user.id}</div>
					<div className="mt-1">邮箱：{session.user.email}</div>
					<div className="mt-1">
						邮箱验证：{session.user.emailVerified ? "已验证" : "未验证"}
					</div>
				</div>

				<form
					className="mt-6 space-y-4"
					onSubmit={(e) => onSaveProfile({ event: e })}
				>
					<div>
						<label htmlFor="name" className="mb-1 block text-sm">昵称</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							className="h-10 w-full rounded-md border px-3 text-sm"
						/>
					</div>
					<div>
						<label htmlFor="avatar" className="mb-1 block text-sm">头像地址</label>
						<input
							type="url"
							value={avatar}
							onChange={(e) => setAvatar(e.target.value)}
							placeholder="https://example.com/avatar.png"
							className="h-10 w-full rounded-md border px-3 text-sm"
						/>
					</div>

					{message ? (
						<div className="rounded-md border p-2 text-sm">{message}</div>
					) : null}

					<div className="flex items-center gap-3">
						<button
							type="submit"
							disabled={submitting}
							className="h-10 rounded-md bg-black px-4 text-sm text-white disabled:opacity-50"
						>
							{submitting ? "保存中..." : "保存资料"}
						</button>
						<button
							type="button"
							onClick={() => {
								void authClient.signOut();
							}}
							className="h-10 rounded-md border px-4 text-sm"
						>
							退出登录
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
