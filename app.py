from flask import Flask, request, session, render_template
import openai
import time
import logging
import markdown2

app = Flask(__name__)
app.config['SECRET_KEY'] = 'caa7e1ee5b96ec9d39e2a7e5062687ba1153319375edf62f30bc1eca5f0b3cd43a42be49ad3a3d692946c0f627264e51e33cb2ce699a9f7f1c4f038f572c712e'

openai.api_key = "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"
assistant_id = "asst_1hFKjYV5WjzaoVPIsCwfuPMK"

logging.basicConfig(filename='app.log', level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/')
def home():
    return render_template('index_copy_V2.html')

@app.route('/create_thread', methods=['POST'])
def create_thread_route():
    prompt = request.json.get('prompt')
    if not prompt:
        return {'error': 'No prompt provided'}, 400

    thread_id = session.get('thread_id')
    if not thread_id:
        thread = openai.beta.threads.create()
        thread_id = thread.id
        session['thread_id'] = thread_id

    try:
        message = openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=prompt
        )
        logging.info(f"Message created with id: {message.id}")

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id           
        )
        logging.info(f"Run created with id: {run.id}")

        while True:
            run = openai.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
            if run.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id).data
                assistant_messages = [m for m in messages if m.role == "assistant"]
                last_message = sorted(assistant_messages, key=lambda m: m.created_at)[-1]
                markdown_response = ''.join(str(item.text) for item in last_message.content)
                html = markdown2.markdown(markdown_response)
                logging.info(f"Response from OpenAI API: {html}")  # Log the response from the OpenAI API
                return {'response': html}
                return {'response': html}
            elif run.status == "failed":
                logging.error(f"Run failed: {run}")
                raise Exception("Run failed")
            time.sleep(1)

    except Exception as e: 
        logging.error(f"Error processing prompt: {e}")
        return {'error': 'There was an error communicating with the AI assistant.'}, 500

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5001, debug=True)