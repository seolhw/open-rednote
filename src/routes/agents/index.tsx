import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";

type AgentItem = {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

type AgentListResponse = {
	items: AgentItem[];
};

type AgentObserveResponse = {
	agent: {
		id: string;
		name: string;
		baseUrl: string;
		isEnabled: boolean;
	};
	probes: {
		health: { ok: boolean; status: number; url: string; body: string };
		status: { ok: boolean; status: number; url: string; body: string };
		apiHealth: { ok: boolean; status: number; url: string; body: string };
		runningSessions: { ok: boolean; status: number; url: string; body: string };
	};
};

type RequestResult = {
	ok: boolean;
	status: number;
	data: unknown;
};

const emptyCreateForm = {
	name: "",
	baseUrl: "",
	token: "",
	description: "",
};

const parseResponseData = async ({
	response,
}: {
	response: Response;
}): Promise<unknown> => {
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();

	if (raw.length === 0) {
		return null;
	}

	if (contentType.includes("application/json")) {
		return JSON.parse(raw);
	}

	return raw;
};

const requestJson = async ({
	url,
	method = "GET",
	body,
}: {
	url: string;
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
}): Promise<RequestResult> => {
	const settled = await Promise.allSettled([
		fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	]);

	const item = settled[0];
	if (item.status === "rejected") {
		return {
			ok: false,
			status: 0,
			data: {
				error: "请求失败",
				details:
					item.reason instanceof Error ? item.reason.message : "unknown error",
			},
		};
	}

	const data = await parseResponseData({ response: item.value });
	return {
		ok: item.value.ok,
		status: item.value.status,
		data,
	};
};

function AgentsPage() {
	const [items, setItems] = useState<AgentItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [createForm, setCreateForm] = useState(emptyCreateForm);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editBaseUrl, setEditBaseUrl] = useState("");
	const [editDescription, setEditDescription] = useState("");

	const [observeLoadingId, setObserveLoadingId] = useState<string | null>(null);
	const [observeResult, setObserveResult] =
		useState<AgentObserveResponse | null>(null);

	const selectedAgent = useMemo(
		() => items.find((item) => item.id === selectedId) ?? null,
		[items, selectedId],
	);

	const loadAgents = useCallback(async () => {
		setLoading(true);
		setMessage("");
		const result = await requestJson({ url: "/api/agents" });

		if (!result.ok) {
			setLoading(false);
			setMessage("加载 Agent 列表失败");
			return;
		}

		const payload = result.data as AgentListResponse;
		setItems(payload.items ?? []);
		setLoading(false);
	}, []);

	useEffect(() => {
		void loadAgents();
	}, [loadAgents]);

	useEffect(() => {
		if (!selectedAgent) {
			return;
		}
		setEditName(selectedAgent.name);
		setEditBaseUrl(selectedAgent.baseUrl);
		setEditDescription(selectedAgent.description ?? "");
	}, [selectedAgent]);

	const handleCreate = async () => {
		setMessage("");
		const result = await requestJson({
			url: "/api/agents",
			method: "POST",
			body: {
				name: createForm.name.trim(),
				baseUrl: createForm.baseUrl.trim(),
				token: createForm.token.trim(),
				description: createForm.description.trim() || undefined,
				isEnabled: true,
			},
		});

		if (!result.ok) {
			setMessage("创建 Agent 失败");
			return;
		}

		setCreateForm(emptyCreateForm);
		setMessage("创建成功");
		await loadAgents();
	};

	const handleSelect = ({ id }: { id: string }) => {
		setSelectedId(id);
		setObserveResult(null);
	};

	const handleToggleEnabled = async ({
		id,
		nextEnabled,
	}: {
		id: string;
		nextEnabled: boolean;
	}) => {
		setMessage("");
		const result = await requestJson({
			url: `/api/agents/${id}`,
			method: "PATCH",
			body: {
				isEnabled: nextEnabled,
			},
		});

		if (!result.ok) {
			setMessage("更新启用状态失败");
			return;
		}

		setMessage("状态已更新");
		await loadAgents();
	};

	const handleSaveEdit = async () => {
		if (!selectedId) {
			return;
		}

		setMessage("");
		const result = await requestJson({
			url: `/api/agents/${selectedId}`,
			method: "PATCH",
			body: {
				name: editName.trim(),
				baseUrl: editBaseUrl.trim(),
				description: editDescription.trim() || null,
			},
		});

		if (!result.ok) {
			setMessage("保存修改失败");
			return;
		}

		setMessage("保存成功");
		await loadAgents();
	};

	const handleDelete = async ({ id }: { id: string }) => {
		setMessage("");
		const result = await requestJson({
			url: `/api/agents/${id}`,
			method: "DELETE",
		});

		if (!result.ok) {
			setMessage("删除失败");
			return;
		}

		if (selectedId === id) {
			setSelectedId(null);
			setObserveResult(null);
		}

		setMessage("已删除");
		await loadAgents();
	};

	const handleObserve = async ({ id }: { id: string }) => {
		setObserveLoadingId(id);
		setMessage("");
		const result = await requestJson({
			url: `/api/agents/${id}/observe`,
		});

		if (!result.ok) {
			setObserveLoadingId(null);
			setMessage("观测失败");
			return;
		}

		setObserveResult(result.data as AgentObserveResponse);
		setObserveLoadingId(null);
		setMessage("观测完成");
	};

	return (
		<main className="mx-auto w-full max-w-[1160px] px-4 pb-14 pt-8 sm:pt-10">
			<section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
				<h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
					Agent 管理
				</h1>
				<p className="mt-2 text-sm text-zinc-600">
					新增 Agent 后，通过平台统一查询、观测、修改，不需要业务端直连 Agent。
				</p>
				{message ? (
					<p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
						{message}
					</p>
				) : null}
			</section>

			<section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
				<div className="space-y-4">
					<div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
						<h2 className="text-lg font-semibold text-zinc-900">新增 Agent</h2>
						<div className="mt-4 grid gap-3">
							<div className="grid gap-1.5">
								<Label htmlFor="name">名称</Label>
								<Input
									id="name"
									value={createForm.name}
									onChange={(event) =>
										setCreateForm((prev) => ({
											...prev,
											name: event.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="baseUrl">Gateway Base URL</Label>
								<Input
									id="baseUrl"
									placeholder="http://127.0.0.1:42617"
									value={createForm.baseUrl}
									onChange={(event) =>
										setCreateForm((prev) => ({
											...prev,
											baseUrl: event.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="token">Token</Label>
								<Input
									id="token"
									type="password"
									value={createForm.token}
									onChange={(event) =>
										setCreateForm((prev) => ({
											...prev,
											token: event.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="description">描述</Label>
								<Textarea
									id="description"
									rows={3}
									value={createForm.description}
									onChange={(event) =>
										setCreateForm((prev) => ({
											...prev,
											description: event.target.value,
										}))
									}
								/>
							</div>
							<div className="flex gap-2">
								<Button onClick={handleCreate}>创建 Agent</Button>
								<Button
									variant="outline"
									onClick={loadAgents}
									disabled={loading}
								>
									刷新列表
								</Button>
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
						<h2 className="text-lg font-semibold text-zinc-900">Agent 列表</h2>
						<div className="mt-4 grid gap-3">
							{items.map((agent) => (
								<article
									key={agent.id}
									className={`rounded-xl border p-3 ${
										selectedId === agent.id
											? "border-rose-300 bg-rose-50/60"
											: "border-zinc-200"
									}`}
								>
									<div className="flex items-center justify-between gap-3">
										<div>
											<h3 className="text-sm font-semibold text-zinc-900">
												{agent.name}
											</h3>
											<p className="text-xs text-zinc-500">{agent.baseUrl}</p>
										</div>
										<span
											className={`rounded-full px-2 py-1 text-xs ${
												agent.isEnabled
													? "bg-emerald-100 text-emerald-700"
													: "bg-zinc-100 text-zinc-600"
											}`}
										>
											{agent.isEnabled ? "启用中" : "已禁用"}
										</span>
									</div>
									<div className="mt-3 flex flex-wrap gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleSelect({ id: agent.id })}
										>
											编辑
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleObserve({ id: agent.id })}
											disabled={observeLoadingId === agent.id}
										>
											{observeLoadingId === agent.id ? "观测中..." : "观测"}
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												handleToggleEnabled({
													id: agent.id,
													nextEnabled: !agent.isEnabled,
												})
											}
										>
											{agent.isEnabled ? "禁用" : "启用"}
										</Button>
										<Button
											size="sm"
											variant="destructive"
											onClick={() => handleDelete({ id: agent.id })}
										>
											删除
										</Button>
									</div>
								</article>
							))}
							{items.length === 0 && !loading ? (
								<p className="text-sm text-zinc-500">暂无 Agent，请先新增。</p>
							) : null}
						</div>
					</div>
				</div>

				<div className="space-y-4">
					<div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
						<h2 className="text-lg font-semibold text-zinc-900">编辑 Agent</h2>
						{selectedAgent ? (
							<div className="mt-4 grid gap-3">
								<div className="grid gap-1.5">
									<Label htmlFor="editName">名称</Label>
									<Input
										id="editName"
										value={editName}
										onChange={(event) => setEditName(event.target.value)}
									/>
								</div>
								<div className="grid gap-1.5">
									<Label htmlFor="editBaseUrl">Gateway Base URL</Label>
									<Input
										id="editBaseUrl"
										value={editBaseUrl}
										onChange={(event) => setEditBaseUrl(event.target.value)}
									/>
								</div>
								<div className="grid gap-1.5">
									<Label htmlFor="editDescription">描述</Label>
									<Textarea
										id="editDescription"
										rows={3}
										value={editDescription}
										onChange={(event) => setEditDescription(event.target.value)}
									/>
								</div>
								<Button onClick={handleSaveEdit}>保存修改</Button>
							</div>
						) : (
							<p className="mt-3 text-sm text-zinc-500">
								请先从左侧列表选择一个 Agent。
							</p>
						)}
					</div>

					<div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
						<h2 className="text-lg font-semibold text-zinc-900">观测结果</h2>
						{observeResult ? (
							<pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
								{JSON.stringify(observeResult, null, 2)}
							</pre>
						) : (
							<p className="mt-3 text-sm text-zinc-500">
								点击左侧 Agent 的「观测」后，这里展示
								health/status/api-health/running-sessions。
							</p>
						)}
					</div>
				</div>
			</section>
		</main>
	);
}

export const Route = createFileRoute("/agents/")({
	component: AgentsPage,
});
