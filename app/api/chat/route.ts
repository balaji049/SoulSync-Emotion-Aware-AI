//import { GoogleGenerativeAI } from "@google/generative-ai"
import { hasSupabaseConfig, supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { stupidJokes } from "@/data/stupidstuff"
import Groq from "groq-sdk"



export const runtime = "nodejs"

//const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const languageMap: { [key: string]: string } = {
  "en-US": "English",
  "hi-IN": "Hindi",
  "mr-IN": "Marathi",
  "te-IN": "Telugu",
}
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return null
  }

  return new Groq({ apiKey })
}

type Message = {
  id: string
  role: "user" | "assistant" | "joke"
  content: string
}

async function translateJoke(joke: string, targetLanguageName: string) {
  if (targetLanguageName === "English") return joke

  const groq = getGroqClient()
  if (!groq) {
    return joke
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: `Translate this into ${targetLanguageName}: "${joke}"`,
        },
      ],
    })

    return chatCompletion.choices[0]?.message?.content?.trim() || joke
  } catch (error) {
    console.error("Joke translation failed:", error)
    return joke
  }
}

export async function POST(req: Request) {
  try {
    const groq = getGroqClient()
    if (!groq) {
      return NextResponse.json({ error: "GROQ_API_KEY is missing on the server." }, { status: 500 })
    }

    const body = await req.json()
    const { messages, language, action }: { messages: Message[]; language: string; action?: string } = body
    const targetLanguageName = languageMap[language] || "English"

    if (action === "get_joke") {
      const randomJokeObject = stupidJokes[Math.floor(Math.random() * stupidJokes.length)]
      const jokeToTranslate = randomJokeObject.body
      const translatedJoke = await translateJoke(jokeToTranslate, targetLanguageName)
      return NextResponse.json({ joke: translatedJoke })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required for a chat" }, { status: 400 })
    }

    const lastUserMessage = messages[messages.length - 1]
    const chatHistory = messages
      .slice(0, -1)
      .map((msg: Message) => `${msg.role}: ${msg.content}`)
      .join("\n")

    const advancedPrompt = `
    You are SoulSync, an advanced AI companion.
    Your Primary Goal is to be a helpful, intelligent, and empathetic companion. Understand the user's true intent, even if their message has typos. Use common sense to maintain a natural conversation.

    You have two communication styles in your toolbox:
    1. The Empathetic Listener: Use this when the user is emotional. Be a warm, validating presence. Ask gentle, open-ended questions. Avoid giving direct advice.
    2. The Knowledgeable Assistant: Use this when the user asks for facts or help. Be clear, direct, and helpful. Get straight to the point.

    Critical Instructions:
    - Use the Chat History for context. If a user asks "try a new one," they mean a new joke.
    - Handle typos gracefully. If the user says "is it jock," understand they mean "joke".
    - You are a generative AI; you don't have a fixed list of jokes you can tell.

    Your Task:
    1. Analyze the user's intent and choose a communication style.
    2. Based only on the user's latest message, detect if the emotion is "sad" or "neutral".
    3. Formulate your response in ${targetLanguageName}.

    You MUST reply in this strict JSON format:
    {
      "responseText": "Your helpful, context-aware response.",
      "detectedEmotion": "sad_or_neutral"
    }

    Chat History:
    ${chatHistory || "This is the beginning of the conversation."}

    User's Latest Message: "${lastUserMessage.content}"
    `

    const chatCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: advancedPrompt,
        },
      ],
    })

    const raw = chatCompletion.choices[0]?.message?.content || ""

    let parsedResponse
    try {
      const cleanedJsonString = raw.replace("```json", "").replace("```", "").trim()
      parsedResponse = JSON.parse(cleanedJsonString)
    } catch (error) {
      console.error("Failed to parse Groq JSON response:", error, "Raw response:", raw)
      return NextResponse.json({ responseText: raw, detectedEmotion: "neutral" })
    }

    // Save conversation to Supabase (without embeddings)
    const saveConversation = async () => {
      if (!hasSupabaseConfig || !supabase) {
        return
      }

      try {
        await supabase.from("messages").insert([
          { content: lastUserMessage.content, role: "user" },
          { content: parsedResponse.responseText, role: "assistant" },
        ])
      } catch (dbError) {
        console.error("Failed to store messages in Supabase:", dbError)
      }
    }

    saveConversation()

    return NextResponse.json(parsedResponse)
  } catch (error) {
    console.error("Fatal error in /api/chat route:", error)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "SoulSync API is running perfectly! 🌿",
    timestamp: new Date().toISOString(),
    status: "healthy",
  })
}
