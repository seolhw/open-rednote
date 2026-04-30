import { createFileRoute } from "@tanstack/react-router";
import {
	Loader2,
	MessageSquare,
	Mic,
	MicOff,
	Plus,
	Send,
	Trash2,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import type { ChatSession } from "#/api/agent-chat";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Textarea } from "#/components/ui/textarea";
import { useAudioRecorder } from "#/hooks/demo-useAudioRecorder";
import { useTTS } from "#/hooks/demo-useTTS";
import { useAgentChatHook } from "#/hooks/use-agent-chat";
import type { ChatMessages } from "#/lib/demo-ai-hook";

function InitialLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-6 py-8">
			<Card className="mx-auto w-full max-w-3xl rounded-2xl border-zinc-200 py-10 text-center shadow-sm">
				<h1 className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-4xl font-bold tracking-wide text-transparent sm:text-5xl">
					小红书 AI 助手
				</h1>
				<p className="mx-auto mt-4 w-full max-w-2xl px-6 text-base leading-7 text-muted-foreground sm:text-lg">
					在这里直接进行对话式创作，快速完成选题拆解、内容润色和发布建议。
				</p>
				<div className="mt-6 px-4">{children}</div>
			</Card>
		</div>
	);
}

function ChattingLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="border-t border-border/60 bg-background/95 py-3">
			<div className="mx-auto w-full">{children}</div>
		</div>
	);
}

function Messages({
	messages,
	playingId,
	onSpeak,
	onStopSpeak,
}: {
	messages: ChatMessages;
	playingId: string | null;
	onSpeak: (text: string, id: string) => void;
	onStopSpeak: () => void;
}) {
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, []);

	if (!messages.length) {
		return null;
	}

	// Extract text content from message parts
	const getTextContent = (
		parts: ChatMessages[number]["parts"],
	): string | null => {
		for (const part of parts) {
			if (part.type === "text" && part.content) {
				return part.content;
			}
		}
		return null;
	};

	return (
		<div
			ref={messagesContainerRef}
			className="min-h-0 flex-1 overflow-y-auto px-2 py-4"
		>
			<div className="px-12 w-full space-y-3">
				{messages.map((message) => {
					const textContent = getTextContent(message.parts);
					const isPlaying = playingId === message.id;
					const isAssistant = message.role === "assistant";

					return (
						<div
							key={message.id}
							className={`flex items-start gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
						>
							{isAssistant ? (
								<Badge
									variant="default"
									className="h-10 w-10 shrink-0 justify-center rounded-full p-0"
								>
									小红
								</Badge>
							) : null}

							<div
								className={`max-w-[78%] rounded-2xl px-4 py-3 ${isAssistant ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}
							>
								{message.parts.map((part, partIndex) => {
									if (part.type !== "text" || !part.content) {
										return null;
									}
									return parseMessageBlocks({ text: part.content }).map(
										(block, blockIndex) => {
											const blockKey = `${message.id}-${partIndex}-${blockIndex}`;
											if (block.type === "think") {
												return (
													<details
														key={blockKey}
														className="mb-2 rounded-xl border border-dashed border-border/70 bg-background/60 p-2"
													>
														<summary className="cursor-pointer text-xs text-muted-foreground">
															思考中...
														</summary>
														<div className="mt-2 min-w-0 prose max-w-none prose-sm dark:prose-invert">
															<Streamdown>{block.content}</Streamdown>
														</div>
													</details>
												);
											}
											if (block.type === "tool_call") {
												return (
													<details
														key={blockKey}
														className="mb-2 rounded-xl border border-dashed border-emerald-400/60 bg-emerald-50/50 p-2"
													>
														<summary className="cursor-pointer text-xs text-emerald-700">
															工具调用中...
														</summary>
														<div className="mt-2 min-w-0 prose max-w-none prose-sm dark:prose-invert">
															<Streamdown>{block.content}</Streamdown>
														</div>
													</details>
												);
											}
											return (
												<div
													className={`min-w-0 prose max-w-none prose-sm ${isAssistant ? "dark:prose-invert" : "prose-invert"}`}
													key={blockKey}
												>
													<Streamdown>{block.content}</Streamdown>
												</div>
											);
										},
									);
								})}
							</div>

							{isAssistant && textContent ? (
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={() =>
										isPlaying ? onStopSpeak() : onSpeak(textContent, message.id)
									}
									title={isPlaying ? "Stop speaking" : "Read aloud"}
								>
									{isPlaying ? (
										<VolumeX className="h-4 w-4" />
									) : (
										<Volume2 className="h-4 w-4" />
									)}
								</Button>
							) : null}

							{!isAssistant ? (
								<Badge
									variant="secondary"
									className="h-10 w-10 shrink-0 justify-center rounded-full p-0"
								>
									我
								</Badge>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ChatPage() {
	const [input, setInput] = useState("");

	const { isRecording, isTranscribing, startRecording, stopRecording } =
		useAudioRecorder();
	const { playingId, speak, stop: stopTTS } = useTTS();

	const {
		sessions,
		selectedSessionId,
		selectSession,
		createSession,
		messages,
		sendMessage,
		streamingAssistantText,
		streamingSessionId,
		isLoading,
		isSessionsLoading,
		deleteSession,
	} = useAgentChatHook();

	const handleMicClick = async () => {
		if (isRecording) {
			const transcribedText = await stopRecording();
			if (transcribedText) {
				setInput((prev) =>
					prev ? `${prev} ${transcribedText}` : transcribedText,
				);
			}
		} else {
			await startRecording();
		}
	};

	const displayMessages = useMemo(() => {
		if (!streamingAssistantText) return messages;
		if (!selectedSessionId || streamingSessionId !== selectedSessionId)
			return messages;
		return [
			...messages,
			{
				id: `streaming-${selectedSessionId}`,
				role: "assistant" as const,
				createdAt: new Date().toISOString(),
				parts: [{ type: "text" as const, content: streamingAssistantText }],
			},
		];
	}, [messages, selectedSessionId, streamingAssistantText, streamingSessionId]);

	const getSessionPreview = ({ session }: { session: ChatSession }) => {
		const last = session.lastMessage;
		if (!last) {
			return "暂无消息";
		}
		for (const part of last.parts) {
			if (part.type === "text" && part.content) {
				return part.content;
			}
		}
		return "暂无消息";
	};

	return (
		<div className="mx-auto mt-6 grid flex-1 w-full max-w-[1280px] grid-cols-[300px_1fr] gap-4">
			<Card className="overflow-hidden border-border/60 bg-muted/30 p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between">
					<p className="text-sm font-semibold">会话</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={createSession}
					>
						<Plus className="h-4 w-4" />
						新建
					</Button>
				</div>
				<div className="space-y-2 overflow-y-auto pr-1">
					{isSessionsLoading ? (
						<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							加载会话中...
						</div>
					) : (
						sessions.map((session) => {
							const selected = session.id === selectedSessionId;
							return (
								<div
									key={session.id}
									className={`relative w-full rounded-xl border p-3 transition ${selected ? "border-border bg-background shadow-sm" : "border-transparent bg-transparent hover:bg-accent"}`}
								>
									<button
										type="button"
										onClick={() => selectSession({ sessionId: session.id })}
										className="block w-full pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<div className="mb-1 flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-700">
											<MessageSquare className="h-4 w-4 shrink-0 text-zinc-500" />
											<span className="truncate">{session.title}</span>
										</div>
										<p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
											{getSessionPreview({ session })}
										</p>
									</button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => deleteSession({ sessionId: session.id })}
										title="删除会话"
										className="absolute right-2 top-2"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							);
						})
					)}
				</div>
			</Card>

			<Card className="flex min-w-0 flex-1 flex-col overflow-hidden border-border/60 shadow-sm p-0">
				<div className="flex-1 min-h-0">
					{displayMessages.length ? (
						<Messages
							messages={displayMessages}
							playingId={playingId}
							onSpeak={speak}
							onStopSpeak={stopTTS}
						/>
					) : (
						<InitialLayout>
							<p className="text-sm text-muted-foreground">
								选择会话后开始聊天，或新建一个会话。
							</p>
						</InitialLayout>
					)}
				</div>
				<ChattingLayout>
					<div className="space-y-4">
						<div className="mx-auto flex justify-center flex-wrap gap-2">
							{[
								"帮我写一条今天的运营复盘",
								"给我 5 个爆款选题方向",
								"检查小红书登录状态",
							].map((prompt) => (
								<Button
									key={prompt}
									type="button"
									variant="outline"
									size="sm"
									disabled={isLoading}
									onClick={() => {
										void sendMessage(prompt);
										setInput("");
									}}
								>
									{prompt}
								</Button>
							))}
						</div>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (input.trim()) {
									sendMessage(input);
									setInput("");
								}
							}}
						>
							<div className="relative mx-auto flex max-w-2xl items-center gap-2">
								<Button
									type="button"
									variant={isRecording ? "default" : "outline"}
									size="icon"
									onClick={handleMicClick}
									disabled={isLoading || isTranscribing}
									title={isRecording ? "Stop recording" : "Start recording"}
								>
									{isTranscribing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : isRecording ? (
										<MicOff className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
								</Button>
								<div className="relative flex-1">
									<Textarea
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder="请输入你想问 ZeroClaw 的内容..."
										className="w-full resize-none overflow-hidden rounded-xl border-border bg-background pr-12"
										rows={1}
										style={{ minHeight: "44px", maxHeight: "200px" }}
										disabled={isLoading}
										onInput={(e) => {
											const target = e.target as HTMLTextAreaElement;
											target.style.height = "auto";
											target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey && input.trim()) {
												e.preventDefault();
												sendMessage(input);
												setInput("");
											}
										}}
									/>
									<Button
										type="submit"
										size="icon-sm"
										variant="ghost"
										disabled={!input.trim() || isLoading}
										className="absolute right-2 top-1/2 -translate-y-1/2"
									>
										<Send className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</form>
					</div>
				</ChattingLayout>
			</Card>
		</div>
	);
}

export const Route = createFileRoute("/chat/")({
	component: ChatPage,
});

type MessageBlock = {
	type: "text" | "think" | "tool_call";
	content: string;
};

const parseMessageBlocks = ({ text }: { text: string }): MessageBlock[] => {
	const result: MessageBlock[] = [];
	const regex = /<(think|tool_call)>([\s\S]*?)<\/\1>/g;
	let lastIndex = 0;
	let match = regex.exec(text);
	while (match) {
		const start = match.index;
		const end = regex.lastIndex;
		if (start > lastIndex) {
			const normalText = text.slice(lastIndex, start).trim();
			if (normalText) {
				result.push({ type: "text", content: normalText });
			}
		}
		const blockType = match[1] === "tool_call" ? "tool_call" : "think";
		const blockText = (match[2] ?? "").trim();
		if (blockText) {
			result.push({ type: blockType, content: blockText });
		}
		lastIndex = end;
		match = regex.exec(text);
	}
	if (lastIndex < text.length) {
		const tail = text.slice(lastIndex).trim();
		if (tail) {
			result.push({ type: "text", content: tail });
		}
	}
	return result.length ? result : [{ type: "text", content: text }];
};
