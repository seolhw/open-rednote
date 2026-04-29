import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
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

const emptyEditForm = {
	name: "",
	baseUrl: "",
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

type AgentCardStatus = { ok: boolean; text: string; updatedAt: number };

function AgentsCardListPage() {
	const [items, setItems] = useState<AgentItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
	const [message, setMessage] = useState("");
	const [createForm, setCreateForm] = useState(emptyCreateForm);
	const [editForm, setEditForm] = useState(emptyEditForm);
	const [statusById, setStatusById] = useState<Record<string, AgentCardStatus>>(
		{},
	);

	const loadAgents = useCallback(async () => {
		setLoading(true);
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

	const refreshOneStatus = useCallback(async ({ id }: { id: string }) => {
		const result = await requestJson({ url: `/api/agents/${id}/observe` });
		if (!result.ok) {
			setStatusById((p) => ({
				...p,
				[id]: {
					ok: false,
					text: `观测失败(${result.status})`,
					updatedAt: Date.now(),
				},
			}));
			return;
		}
		const payload = result.data as AgentObserveResponse;
		const ok = payload.probes.health.ok && payload.probes.apiHealth.ok;
		const text = `health ${payload.probes.health.status} / api ${payload.probes.apiHealth.status}`;
		setStatusById((p) => ({ ...p, [id]: { ok, text, updatedAt: Date.now() } }));
	}, []);

	const refreshAllStatus = useCallback(
		async ({ agents }: { agents: AgentItem[] }) => {
			setIsRefreshingStatus(true);
			await Promise.all(
				agents.map((agent) => refreshOneStatus({ id: agent.id })),
			);
			setIsRefreshingStatus(false);
		},
		[refreshOneStatus],
	);

	useEffect(() => {
		void loadAgents();
	}, [loadAgents]);
	useEffect(() => {
		if (items.length) void refreshAllStatus({ agents: items });
	}, [items, refreshAllStatus]);

	const handleCreate = async () => {
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
		setCreateOpen(false);
		setMessage("创建成功");
		await loadAgents();
	};

	const handleOpenEdit = ({ agent }: { agent: AgentItem }) => {
		setEditingId(agent.id);
		setEditForm({
			name: agent.name,
			baseUrl: agent.baseUrl,
			description: agent.description ?? "",
		});
		setEditOpen(true);
	};

	const handleSaveEdit = async () => {
		if (!editingId) {
			return;
		}
		const result = await requestJson({
			url: `/api/agents/${editingId}`,
			method: "PATCH",
			body: {
				name: editForm.name.trim(),
				baseUrl: editForm.baseUrl.trim(),
				description: editForm.description.trim() || null,
			},
		});
		if (!result.ok) {
			setMessage("保存修改失败");
			return;
		}
		setMessage("保存成功");
		setEditOpen(false);
		setEditingId(null);
		setEditForm(emptyEditForm);
		await loadAgents();
	};

	const handleToggleEnabled = async ({
		id,
		nextEnabled,
	}: {
		id: string;
		nextEnabled: boolean;
	}) => {
		const result = await requestJson({
			url: `/api/agents/${id}`,
			method: "PATCH",
			body: { isEnabled: nextEnabled },
		});
		if (!result.ok) {
			setMessage("更新启用状态失败");
			return;
		}
		setMessage("状态已更新");
		await loadAgents();
	};

	const handleDelete = async ({ id }: { id: string }) => {
		const result = await requestJson({
			url: `/api/agents/${id}`,
			method: "DELETE",
		});
		if (!result.ok) {
			setMessage("删除失败");
			return;
		}
		setMessage("已删除");
		await loadAgents();
	};

	return (
		<main className="mx-auto w-full max-w-[1160px] space-y-4 px-4 pb-14 pt-8 sm:pt-10">
			<Card>
				<CardHeader>
					<CardTitle>Agent 管理</CardTitle>
					<CardDescription>Agent 卡片列表，自动观测状态。</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{message ? <Badge variant="secondary">{message}</Badge> : null}
					<div className="flex gap-2">
						<Button onClick={() => setCreateOpen(true)}>创建 Agent</Button>
						<Button
							variant="outline"
							onClick={() => refreshAllStatus({ agents: items })}
							disabled={loading || isRefreshingStatus}
						>
							{isRefreshingStatus ? "刷新中..." : "刷新状态"}
						</Button>
					</div>
				</CardContent>
			</Card>
			<section className="grid gap-3">
				{items.map((agent) => (
					<Card key={agent.id} className="gap-3">
						<CardHeader className="pb-0">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<CardTitle className="text-base">{agent.name}</CardTitle>
									<CardDescription>{agent.baseUrl}</CardDescription>
									<p className="text-xs text-muted-foreground">{agent.description || "暂无描述"}</p>
									<p className="text-xs text-muted-foreground">运行状态：{statusById[agent.id]?.text ?? "未观测"}</p>
								</div>
								<Badge variant={agent.isEnabled ? "default" : "secondary"}>{agent.isEnabled ? "启用中" : "已禁用"}</Badge>
							</div>
						</CardHeader>
						<CardContent className="flex gap-2 pt-0">
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleOpenEdit({ agent })}
							>
								编辑
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
						</CardContent>
					</Card>
				))}
				{!items.length && !loading ? (
					<Card>
						<CardContent className="py-6 text-sm text-muted-foreground">暂无 Agent，请点击上方创建。</CardContent>
					</Card>
				) : null}
			</section>
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>创建 Agent</DialogTitle>
					</DialogHeader>
					<div className="grid gap-2">
							<Label htmlFor="name">名称</Label>
							<Input
								id="name"
								value={createForm.name}
								onChange={(e) =>
									setCreateForm((p) => ({ ...p, name: e.target.value }))
								}
							/>
							<Label htmlFor="baseUrl">Gateway Base URL</Label>
							<Input
								id="baseUrl"
								placeholder="http://127.0.0.1:42617"
								value={createForm.baseUrl}
								onChange={(e) =>
									setCreateForm((p) => ({ ...p, baseUrl: e.target.value }))
								}
							/>
							<Label htmlFor="token">Token</Label>
							<Input
								id="token"
								type="password"
								value={createForm.token}
								onChange={(e) =>
									setCreateForm((p) => ({ ...p, token: e.target.value }))
								}
							/>
							<Label htmlFor="description">描述</Label>
							<Textarea
								id="description"
								rows={3}
								value={createForm.description}
								onChange={(e) =>
									setCreateForm((p) => ({ ...p, description: e.target.value }))
								}
							/>
						<div className="mt-2 flex justify-end gap-2">
							<Button variant="outline" onClick={() => setCreateOpen(false)}>
								取消
							</Button>
							<Button onClick={handleCreate}>创建</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<Dialog
				open={editOpen}
				onOpenChange={(open) => {
					setEditOpen(open);
					if (!open) {
						setEditingId(null);
						setEditForm(emptyEditForm);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>编辑 Agent</DialogTitle>
					</DialogHeader>
					<div className="grid gap-2">
						<Label htmlFor="editName">名称</Label>
						<Input
							id="editName"
							value={editForm.name}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, name: e.target.value }))
							}
						/>
						<Label htmlFor="editBaseUrl">Gateway Base URL</Label>
						<Input
							id="editBaseUrl"
							value={editForm.baseUrl}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, baseUrl: e.target.value }))
							}
						/>
						<Label htmlFor="editDescription">描述</Label>
						<Textarea
							id="editDescription"
							rows={3}
							value={editForm.description}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, description: e.target.value }))
							}
						/>
						<div className="mt-2 flex justify-end gap-2">
							<Button variant="outline" onClick={() => setEditOpen(false)}>
								取消
							</Button>
							<Button onClick={handleSaveEdit}>保存</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</main>
	);
}

export const Route = createFileRoute("/agents/")({
	component: AgentsCardListPage,
});
