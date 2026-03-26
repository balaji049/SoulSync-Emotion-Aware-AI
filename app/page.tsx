"use client"

import { useState, useRef, useEffect, type FormEvent } from "react"

// Message type
type Message = {
  id: string
  role: "user" | "assistant" | "joke"
  content: string
}

// SpeechRecognition type
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: (event: any) => void
  onerror: (event: any) => void
  onend: () => void
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// Simple UUID generator function
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [language, setLanguage] = useState("en-US")
  const [isListening, setIsListening] = useState(false)
  const [showJokeOffer, setShowJokeOffer] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showJokeOffer])

  // Setup SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser")
      return
    }

    const recognitionInstance = new SpeechRecognition() as SpeechRecognitionInstance
    recognitionInstance.continuous = true
    recognitionInstance.interimResults = true
    recognitionInstance.lang = language

    recognitionInstance.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("")
      setInput(transcript)
    }

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setIsListening(false)
    }

    recognitionInstance.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognitionInstance
  }, [language])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { id: generateId(), role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setShowJokeOffer(false)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage], language }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || `HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.responseText || "I'm here to listen. How can I help you today?",
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (data.detectedEmotion === "sad") {
        setShowJokeOffer(true)
      }
    } catch (error) {
      console.error("API error:", error)
      const errorMessage = error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again."
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "assistant", content: errorMessage },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleListen = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      alert("Speech recognition is not supported in your browser.")
      return
    }

    if (isListening) {
      recognition.stop()
      if (input.trim()) {
        const form = document.getElementById("chat-form") as HTMLFormElement
        form.requestSubmit()
      }
    } else {
      setInput("")
      recognition.start()
      setIsListening(true)
    }
  }

  const handleAcceptJoke = async () => {
    setShowJokeOffer(false)
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_joke", language }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || `HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const jokeMessage: Message = {
        id: generateId(),
        role: "joke",
        content: data.joke || "Here's a smile for you! 😊",
      }

      setMessages((prev) => [...prev, jokeMessage])
    } catch (error) {
      console.error("Joke API error:", error)
      const jokeMessage: Message = {
        id: generateId(),
        role: "joke",
        content: "Why don't scientists trust atoms? Because they make up everything! 😄",
      }
      setMessages((prev) => [...prev, jokeMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="w-1/3"></div>
        <h1 className="text-2xl font-bold text-center w-1/3">SoulSync AI</h1>
        <div className="w-1/3 flex justify-end">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="en-US">English</option>
            <option value="hi-IN">हिन्दी</option>
            <option value="mr-IN">मराठी</option>
            <option value="te-IN">తెలుగు</option>
          </select>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <h2 className="text-xl mb-4">Welcome to SoulSync! 🌿</h2>
            <p>Share your thoughts, and I'll listen with empathy and understanding.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "joke" ? (
              <div className="max-w-md p-4 my-2 border border-yellow-500 bg-yellow-900/50 rounded-lg shadow-lg text-center animate-fade-in">
                <p className="text-yellow-300 text-sm mb-2">A little something to make you smile...</p>
                <p className="text-lg italic">{msg.content}</p>
              </div>
            ) : (
              <div className={`max-w-lg p-3 rounded-lg ${msg.role === "user" ? "bg-blue-600" : "bg-gray-700"}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <small className="text-xs text-gray-400 mt-1 block">{new Date().toLocaleTimeString()}</small>
              </div>
            )}
          </div>
        ))}

        {showJokeOffer && (
          <div className="flex justify-center animate-fade-in">
            <div className="p-4 bg-gray-700 rounded-lg text-center">
              <p className="mb-3">It sounds like you&apos;re feeling down. I have something that might help?</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleAcceptJoke}
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Yes, please
                </button>
                <button
                  onClick={() => setShowJokeOffer(false)}
                  className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  No, thanks
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && !showJokeOffer && (
          <div className="flex justify-start">
            <div className="max-w-lg p-3 rounded-lg bg-gray-700">
              <p className="animate-pulse">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t border-gray-700 bg-gray-800">
        <form id="chat-form" onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Message SoulSync..."}
            className="flex-1 p-2 rounded-lg bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            disabled={isListening}
          />
          <button
            type="button"
            onClick={handleListen}
            className={`p-2 rounded-full transition-colors ${isListening ? "bg-red-600 animate-pulse" : "bg-gray-600 hover:bg-gray-500"}`}
            aria-label="Toggle mic"
          >
            {isListening ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            disabled={isLoading || !input.trim()}
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  )
}
