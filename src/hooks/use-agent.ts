import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
	type AgentItem,
	type CreateAgentPayload,
	createAgent,
	deleteAgent,
	getAgentApiHealth,
	getAgentHealth,
	listAgents,
	type UpdateAgentPayload,
	updateAgent,
} from "#/api/agent";

export type AgentCardStatus = {
	ok: boolean;
	text: string;
	updatedAt: number;
};

const toErrorMessage = ({ error }: { error: unknown }) => {
	if (error instanceof Error) return error.message;
	return "";
};

const toMutationResult = async ({
	task,
}: {
	task: Promise<unknown>;
}): Promise<boolean> =>
	task.then(
		() => true,
		() => false,
	);

export const useAgentAdminHook = () => {
	const queryClient = useQueryClient();
	const [statusById, setStatusById] = useState<Record<string, AgentCardStatus>>(
		{},
	);
	const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

	const agentsQuery = useQuery({
		queryKey: ["agent-admin", "agents"],
		queryFn: () => listAgents(),
	});

	const createMutation = useMutation({
		mutationFn: ({ payload }: { payload: CreateAgentPayload }) =>
			createAgent({ payload }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["agent-admin", "agents"] }),
	});

	const updateMutation = useMutation({
		mutationFn: ({
			agentId,
			payload,
		}: {
			agentId: string;
			payload: UpdateAgentPayload;
		}) => updateAgent({ agentId, payload }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["agent-admin", "agents"] }),
	});

	const deleteMutation = useMutation({
		mutationFn: ({ agentId }: { agentId: string }) => deleteAgent({ agentId }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["agent-admin", "agents"] }),
	});

	const refreshOneStatus = useCallback(
		async ({ agentId }: { agentId: string }) => {
			const [healthSettled, apiHealthSettled] = await Promise.allSettled([
				getAgentHealth(),
				getAgentApiHealth(),
			]);

			if (
				healthSettled.status === "rejected" ||
				apiHealthSettled.status === "rejected" ||
				!healthSettled.value ||
				!apiHealthSettled.value
			) {
				setStatusById((prev) => ({
					...prev,
					[agentId]: {
						ok: false,
						text: "探测失败",
						updatedAt: Date.now(),
					},
				}));
				return;
			}

			const healthPayload = healthSettled.value;
			const apiHealthPayload = apiHealthSettled.value;
			const components = Object.values(apiHealthPayload.health.components);
			const okCount = components.filter(
				(component) => component.status === "ok",
			).length;
			const totalCount = components.length;
			const ok = healthPayload.status === "ok" && okCount === totalCount;
			const text = `health ${healthPayload.status} / components ${okCount}/${totalCount}`;

			setStatusById((prev) => ({
				...prev,
				[agentId]: {
					ok,
					text,
					updatedAt: Date.now(),
				},
			}));
		},
		[],
	);

	const refreshAllStatus = useCallback(
		async ({ agents }: { agents: AgentItem[] }) => {
			setIsRefreshingStatus(true);
			await Promise.all(
				agents.map((agent) => refreshOneStatus({ agentId: agent.id })),
			);
			setIsRefreshingStatus(false);
		},
		[refreshOneStatus],
	);

	useEffect(() => {
		const agents = agentsQuery.data ?? [];
		if (agents.length) {
			void refreshAllStatus({ agents });
		}
	}, [agentsQuery.data, refreshAllStatus]);

	const createAgentAction = async ({
		payload,
	}: {
		payload: CreateAgentPayload;
	}) =>
		toMutationResult({
			task: createMutation.mutateAsync({ payload }),
		});

	const updateAgentAction = async ({
		agentId,
		payload,
	}: {
		agentId: string;
		payload: UpdateAgentPayload;
	}) =>
		toMutationResult({
			task: updateMutation.mutateAsync({ agentId, payload }),
		});

	const deleteAgentAction = async ({ agentId }: { agentId: string }) =>
		toMutationResult({
			task: deleteMutation.mutateAsync({ agentId }),
		});

	const items = agentsQuery.data ?? [];
	const isSaving =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending;

	return {
		items,
		isAgentsLoading: agentsQuery.isPending,
		statusById,
		isRefreshingStatus,
		refreshAllStatus,
		createAgentAction,
		updateAgentAction,
		deleteAgentAction,
		createErrorMessage: toErrorMessage({ error: createMutation.error }),
		updateErrorMessage: toErrorMessage({ error: updateMutation.error }),
		deleteErrorMessage: toErrorMessage({ error: deleteMutation.error }),
		isSaving,
		queryErrorMessage: toErrorMessage({ error: agentsQuery.error }),
	};
};
