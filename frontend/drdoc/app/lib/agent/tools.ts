import { ChatGroq } from "@langchain/groq";

export const simplellm = new ChatGroq({
    model: "openai/gpt-oss-120b", // <-- Use a valid Groq model
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0,
    maxRetries: 2,
});