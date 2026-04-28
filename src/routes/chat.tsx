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
import { useAudioRecorder } from "#/hooks/demo-useAudioRecorder";
import { useTTS } from "#/hooks/demo-useTTS";
import type { ChatMessages } from "#/lib/demo-ai-hook";
import { useGuitarRecommendationChat } from "#/lib/demo-ai-hook";

function InitialLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-4">
			<div className="mx-auto w-full max-w-3xl text-center">
				<h1 className="mb-4 bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-5xl font-bold text-transparent sm:text-6xl">
					小红书 AI 助手
				</h1>
				<p className="mx-auto mb-6 w-full max-w-2xl text-base text-zinc-600 sm:text-lg">
					在这里直接进行对话式创作，快速完成选题拆解、内容润色和发布建议。
				</p>
				{children}
			</div>
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
								{message.role === "assistant" ? (
									<div className="mt-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-sm font-medium text-white">
										AI
									</div>
								) : (
									<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-medium text-white">
										Y
									</div>
								)}
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
									<button
										type="button"
										onClick={() =>
											isPlaying
												? onStopSpeak()
												: onSpeak(textContent, message.id)
										}
										className="flex-shrink-0 p-2 text-zinc-400 transition-colors hover:text-rose-500"
										title={isPlaying ? "Stop speaking" : "Read aloud"}
									>
										{isPlaying ? (
											<VolumeX className="w-4 h-4" />
										) : (
											<Volume2 className="w-4 h-4" />
										)}
									</button>
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
								<button
									type="button"
									onClick={stop}
									className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-600"
								>
									<Square className="w-4 h-4 fill-current" />
									Stop
								</button>
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
							<div className="relative max-w-xl mx-auto flex items-center gap-2">
								<button
									type="button"
									onClick={handleMicClick}
									disabled={isLoading || isTranscribing}
									className={`rounded-lg border p-3 transition-colors ${
										isRecording
											? "border-rose-500 bg-rose-500 text-white hover:bg-rose-600"
											: "border-zinc-200 bg-white text-zinc-500 hover:text-rose-500"
									} disabled:opacity-50`}
									title={isRecording ? "Stop recording" : "Start recording"}
								>
									{isTranscribing ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : isRecording ? (
										<MicOff className="w-4 h-4" />
									) : (
										<Mic className="w-4 h-4" />
									)}
								</button>

								<div className="relative flex-1">
									<textarea
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder="请输入你想问 ZeroClaw 的内容..."
										className="w-full resize-none overflow-hidden rounded-lg border border-zinc-200 bg-white py-3 pl-4 pr-12 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
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
									<button
										type="submit"
										disabled={!input.trim() || isLoading}
										className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-rose-500 transition-colors hover:text-rose-600 disabled:text-zinc-400 focus:outline-none"
									>
										<Send className="w-4 h-4" />
									</button>
								</div>
							</div>
						</form>
					</div>
				</Layout>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/chat")({
	component: ChatPage,
});
