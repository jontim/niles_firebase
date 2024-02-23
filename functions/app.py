import json
import openai
import os 
import time
import logging 


app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
openai.api_key = os.getenv('OPENAI.API_KEY')
assistant_id = os.getenv('ASSISTANT_ID')

logging.basicConfig(filename='app.log', level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/')
def home():
    return render_template('public/index.html')

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