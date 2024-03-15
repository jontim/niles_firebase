from llama_index.llms.groq import Groq
import os
import dotenv

Groq.api_key = os.getenv('GROQ_API_KEY')
llm = Groq(model="mixtral-8x7b-32768")
# response = llm.complete("Explain the importance of low latency LLMs")
# print(response)

from llama_index.core.llms import ChatMessage

with open('systemPrompt.txt', 'r') as file:
    system_prompt = file.read()
messages = [
    ChatMessage(
        role="system", content=system_prompt
    ),
    ChatMessage(role="user", content="What is your name"),
]
resp = llm.stream_chat(messages)

for r in resp:
    print(r.delta, end="")