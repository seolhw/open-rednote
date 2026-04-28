import { useRef, useState } from 'react'

export type ChatPart =
  | { type: 'text'; content: string }
  | {
      type: 'tool-call'
      id: string
      name: string
      output?: unknown
    }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: ChatPart[]
}

export type ChatMessages = ChatMessage[]

type ZeroClawMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const toZeroClawMessages = ({
  messages,
}: {
  messages: ChatMessages
}): ZeroClawMessage[] =>
  messages
    .map((message) => {
      const textPart = message.parts.find((part) => part.type === 'text')
      if (!textPart || textPart.type !== 'text') {
        return null
      }
      return {
        role: message.role,
        content: textPart.content,
      }
    })
    .filter((message): message is ZeroClawMessage => message !== null)

export const useGuitarRecommendationChat = () => {
  const [messages, setMessages] = useState<ChatMessages>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = async (input: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', content: input }],
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    const response = await fetch('/demo/api/openclaw/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: toZeroClawMessages({ messages: [...messages, userMessage] }),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorPayload = await response.json()
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          parts: [
            { type: 'text', content: errorPayload.error || 'ZeroClaw 请求失败' },
          ],
        },
      ])
      setIsLoading(false)
      abortRef.current = null
      return
    }

    const payload = (await response.json()) as { content: string }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [{ type: 'text', content: payload.content }],
      },
    ])

    setIsLoading(false)
    abortRef.current = null
  }

  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsLoading(false)
  }

  return { messages, sendMessage, isLoading, stop }
}
