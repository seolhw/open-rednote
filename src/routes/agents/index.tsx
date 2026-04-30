import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type {
	AgentItem,
	CreateAgentPayload,
	UpdateAgentPayload,
} from "#/api/agent";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { useAgentAdminHook } from "#/hooks/use-agent";
import { authClient } from "#/lib/auth-client";

const emptyCreateForm: CreateAgentPayload = {
	name: "",
	baseUrl: "",
	token: "",
	description: "",
	isEnabled: true,
};

const emptyEditForm: UpdateAgentPayload = {
	name: "",
	baseUrl: "",
	token: "",
	description: "",
};

function AgentsCardListPage() {
	const { data: session, isPending } = authClient.useSession();
	const [createOpen, setCreateOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [createForm, setCreateForm] = useState(emptyCreateForm);
	const [editForm, setEditForm] = useState(emptyEditForm);

	const {
		items,
		isAgentsLoading,
		statusById,
		isRefreshingStatus,
		refreshAllStatus,
		createAgentAction,
		updateAgentAction,
		deleteAgentAction,
		createErrorMessage,
		updateErrorMessage,
		deleteErrorMessage,
		isSaving,
	} = useAgentAdminHook();

	const handleOpenEdit = ({ agent }: { agent: AgentItem }) => {
		setEditingId(agent.id);
		setEditForm({
			name: agent.name,
			baseUrl: agent.baseUrl,
			token: "",
			description: agent.description ?? "",
		});
		setEditOpen(true);
	};

	const handleCreate = async () => {
		const ok = await createAgentAction({
			payload: {
				name: createForm.name.trim(),
				baseUrl: createForm.baseUrl.trim(),
				token: createForm.token.trim(),
				description: createForm.description?.trim(),
				isEnabled: true,
			},
		});
		if (!ok) {
			setMessage(createErrorMessage || "创建 Agent 失败");
			return;
		}
		setCreateForm(emptyCreateForm);
		setCreateOpen(false);
		setMessage("创建成功");
	};

	const handleSaveEdit = async () => {
		if (!editingId) return;
		const ok = await updateAgentAction({
			agentId: editingId,
			payload: {
				name: editForm.name?.trim(),
				baseUrl: editForm.baseUrl?.trim(),
				token: editForm.token?.trim() || undefined,
				description: editForm.description?.trim() || null,
			},
		});
		if (!ok) {
			setMessage(updateErrorMessage || "保存修改失败");
			return;
		}
		setMessage("保存成功");
		setEditOpen(false);
		setEditingId(null);
		setEditForm(emptyEditForm);
	};

	const handleToggleEnabled = async ({
		id,
		nextEnabled,
	}: {
		id: string;
		nextEnabled: boolean;
	}) => {
		const ok = await updateAgentAction({
			agentId: id,
			payload: { isEnabled: nextEnabled },
		});
		if (!ok) {
			setMessage(updateErrorMessage || "更新启用状态失败");
			return;
		}
		setMessage("状态已更新");
	};

	const handleDelete = async ({ id }: { id: string }) => {
		const ok = await deleteAgentAction({ agentId: id });
		if (!ok) {
			setMessage(deleteErrorMessage || "删除失败");
			return;
		}
		setMessage("已删除");
	};

	if (isPending) {
		return (
			<div className="mx-auto w-full max-w-[1160px] px-4 py-10">加载中...</div>
		);
	}

	if (!session?.user) {
		return (
			<main className="mx-auto w-full max-w-[1160px] px-4 pb-14 pt-8 sm:pt-10">
				<Card>
					<CardHeader>
						<CardTitle>Agent 管理</CardTitle>
						<CardDescription>
							你还未登录，请先登录后再管理 Agent。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link to="/auth/login" className="text-sm underline">
							前往登录
						</Link>
					</CardContent>
				</Card>
			</main>
		);
	}

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
							disabled={isAgentsLoading || isRefreshingStatus || isSaving}
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
									<p className="text-xs text-muted-foreground">
										{agent.description || "暂无描述"}
									</p>
									<p className="text-xs text-muted-foreground">
										运行状态：{statusById[agent.id]?.text ?? "未观测"}
									</p>
								</div>
								<Badge variant={agent.isEnabled ? "default" : "secondary"}>
									{agent.isEnabled ? "启用中" : "已禁用"}
								</Badge>
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
				{!items.length && !isAgentsLoading ? (
					<Card>
						<CardContent className="py-6 text-sm text-muted-foreground">
							暂无 Agent，请点击上方创建。
						</CardContent>
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
							<Button onClick={handleCreate} disabled={isSaving}>
								创建
							</Button>
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
							value={editForm.name ?? ""}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, name: e.target.value }))
							}
						/>
						<Label htmlFor="editBaseUrl">Gateway Base URL</Label>
						<Input
							id="editBaseUrl"
							value={editForm.baseUrl ?? ""}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, baseUrl: e.target.value }))
							}
						/>
						<Label htmlFor="editToken">Token</Label>
						<Input
							id="editToken"
							type="password"
							placeholder="留空则不修改"
							value={editForm.token ?? ""}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, token: e.target.value }))
							}
						/>
						<Label htmlFor="editDescription">描述</Label>
						<Textarea
							id="editDescription"
							rows={3}
							value={editForm.description ?? ""}
							onChange={(e) =>
								setEditForm((p) => ({ ...p, description: e.target.value }))
							}
						/>
						<div className="mt-2 flex justify-end gap-2">
							<Button variant="outline" onClick={() => setEditOpen(false)}>
								取消
							</Button>
							<Button onClick={handleSaveEdit} disabled={isSaving}>
								保存
							</Button>
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
