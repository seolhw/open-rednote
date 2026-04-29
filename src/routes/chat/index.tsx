import { createFileRoute } from "@tanstack/react-router";
import {
	Loader2,
	Mic,
	MicOff,
	Send,
	Square,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Textarea } from "#/components/ui/textarea";
import { useAudioRecorder } from "#/hooks/demo-useAudioRecorder";
import { useTTS } from "#/hooks/demo-useTTS";
import type { ChatMessages } from "#/lib/demo-ai-hook";
import { useGuitarRecommendationChat } from "#/lib/demo-ai-hook";

function InitialLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-4">
			<Card className="mx-auto w-full max-w-3xl py-8 text-center">
				<h1 className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
					小红书 AI 助手
				</h1>
				<p className="mx-auto w-full max-w-2xl px-6 text-base text-muted-foreground sm:text-lg">
					在这里直接进行对话式创作，快速完成选题拆解、内容润色和发布建议。
				</p>
				<div className="px-4">{children}</div>
			</Card>
		</div>
	);
}

function ChattingLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="sticky bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white/90 backdrop-blur-sm">
			<div className="mx-auto w-full max-w-3xl px-4 py-3">{children}</div>
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
			className="flex-1 overflow-y-auto pb-4 min-h-0"
		>
			<div className="max-w-3xl mx-auto w-full px-4">
				{messages.map((message) => {
					const textContent = getTextContent(message.parts);
					const isPlaying = playingId === message.id;

					return (
						<div
							key={message.id}
							className={`p-4 ${
								message.role === "assistant"
									? "rounded-xl border border-rose-100 bg-rose-50/60"
									: "bg-transparent"
							}`}
						>
							<div className="flex items-start gap-4 max-w-3xl mx-auto w-full">
								<Badge
									variant={
										message.role === "assistant" ? "default" : "secondary"
									}
									className="mt-1 h-8 w-8 justify-center rounded-lg p-0"
								>
									{message.role === "assistant" ? "AI" : "Y"}
								</Badge>
								<div className="flex-1 min-w-0">
									{message.parts.map((part) => {
										if (part.type === "text" && part.content) {
											return (
												<div
													className="flex-1 min-w-0 prose dark:prose-invert max-w-none prose-sm"
													key={`${message.id}-text-${part.content}`}
												>
													<Streamdown>{part.content}</Streamdown>
												</div>
											);
										}
										return null;
									})}
								</div>
								{/* TTS button for assistant messages */}
								{message.role === "assistant" && textContent && (
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() =>
											isPlaying
												? onStopSpeak()
												: onSpeak(textContent, message.id)
										}
										title={isPlaying ? "Stop speaking" : "Read aloud"}
									>
										{isPlaying ? (
											<VolumeX className="h-4 w-4" />
										) : (
											<Volume2 className="h-4 w-4" />
										)}
									</Button>
								)}
							</div>
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

	const { messages, sendMessage, isLoading, stop } =
		useGuitarRecommendationChat();

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

	const Layout = messages.length ? ChattingLayout : InitialLayout;

	return (
		<div className="relative flex h-[500px]">
			<div className="flex-1 flex flex-col min-h-0">
				<Messages
					messages={messages}
					playingId={playingId}
					onSpeak={speak}
					onStopSpeak={stopTTS}
				/>

				<Layout>
					<div className="space-y-3">
						{isLoading && (
							<div className="flex items-center justify-center">
								<Button type="button" variant="destructive" onClick={stop}>
									<Square className="h-4 w-4 fill-current" />
									Stop
								</Button>
							</div>
						)}
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (input.trim()) {
									sendMessage(input);
									setInput("");
								}
							}}
						>
							<div className="relative mx-auto flex max-w-xl items-center gap-2">
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
										className="w-full resize-none overflow-hidden pr-12"
										rows={1}
										style={{ minHeight: "44px", maxHeight: "200px" }}
										disabled={isLoading}
										onInput={(e) => {
											const target = e.target as HTMLTextAreaElement;
											target.style.height = "auto";
											target.style.height =
												Math.min(target.scrollHeight, 200) + "px";
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
				</Layout>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/chat/")({
	component: ChatPage,
});
