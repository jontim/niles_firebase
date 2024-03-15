from openai import OpenAI

OPENAI_API_KEY = "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"
client = OpenAI(api_key=OPENAI_API_KEY)
headers = {'Authorization': f'Bearer {OPENAI_API_KEY}',
           'OpenAI-Beta': 'assistants=v1'
           }

assistant_id = "asst_1hFKjYV5WjzaoVPIsCwfuPMK"  
assistant = client.beta.assistants.retrieve(assistant_id)

print(f"Assistant ID: {assistant.id}")
print(f"Model: {assistant.model}")
print(f"Instructions: {assistant.instructions}")
print(f"Tools: {assistant.tools}")
print(f"File IDs: {assistant.file_ids}")