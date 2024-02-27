from flask import Flask, request, session, render_template, jsonify, make_response
import openai
import time
import logging
import markdown2
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
import traceback
from firebase_admin import firestore, auth
import firebase_admin

firebase_admin.initialize_app()
load_dotenv()
import os

app = Flask(__name__) 
CORS(app, supports_credentials=True, origins=["https://askniles-415514.web.app","https://askniles-415514.firebaseapp.com"])
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
openai.api_key = os.getenv('OPENAI_API_KEY')
assistant_id = os.getenv('ASSISTANT_ID')

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/')
def home():
    return render_template('/public/index.html')

@app.before_request
def start_request():
    logging.info(f"Starting request to {request.path}")

@app.after_request
def log_response(response):
    logging.info(f"Response status: {response.status_code}")
    return response

@app.errorhandler(Exception)
@cross_origin(origins=["https://askniles-415514.web.app","https://askniles-415514.firebaseapp.com"])
def handle_unexpected_error(e):
    logging.error(f"Unexpected error: {str(e)}")
    logging.error(traceback.format_exc())
    return {'error': 'An unexpected error occurred.'}, 500


@app.route('/check_conversation', methods=['POST'])
def check_conversation():
    if request.method == 'OPTIONS':
        app.logger.info('Handling OPTIONS request')
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    user_uid = request.json.get('userUID')

    # Get a reference to the Firestore database
    db = firestore.client()

    # Get a reference to the conversation document
    conversation_ref = db.collection('conversations').document(user_uid)

    # Get the conversation document
    conversation_doc = conversation_ref.get()

    if conversation_doc.exists:
        conversation_data = conversation_doc.to_dict()

        # Check if the thread_id exists in the conversation document
        if 'thread_id' in conversation_data:
            # If a conversation exists and it has a thread_id, return the thread_id
            return jsonify({'thread_id': conversation_data['thread_id']}), 200
        else:
            # If a conversation exists but it doesn't have a thread_id, return a message indicating this
            return jsonify({'message': 'No thread_id in conversation'}), 200
    else:
        # If no conversation exists, get the user's details
        user = auth.get_user(user_uid)
        user_name = user.display_name.split(' ')[0]

        # Create a new conversation document
        conversation_ref.set({
            'messages': [],
            'userId': user_uid,
            'name': user_name
        })

        response = make_response(jsonify({'message': 'Conversation checked/created successfully'}), 200)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

@app.route('/create_thread', methods=['POST'])
def create_thread():
    if request.method == 'OPTIONS':
        app.logger.info('Handling OPTIONS request')
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    prompt = request.json.get('prompt')
    if not prompt:
        return {'error': 'No prompt provided'}, 400

    thread = openai.beta.threads.create()
    thread_id = thread.id
    session['thread_id'] = thread_id

    response = make_response(jsonify({'thread_id': thread_id}), 200)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/submit_query', methods=['POST'])
def submit_query():
    logging.info("Received request for /submit_query")  # Log when a request is received
    if request.method == 'OPTIONS':
        app.logger.info('Handling OPTIONS request')
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    prompt = request.json.get('prompt')
    thread_id = request.json.get('thread_id')

    logging.info(f"Received prompt: {prompt} and thread_id: {thread_id}")  # Log the received prompt and thread_id

    if not prompt or not thread_id:
        return {'error': 'No prompt or thread_id provided'}, 400

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
                response = make_response({'response': html})
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response
            elif run.status == "failed":
                logging.error(f"Run failed: {run}")
                raise Exception("Run failed")
            time.sleep(1)

    except Exception as e: 
        logging.error(f"Error processing prompt: {e}")
        return {'error': 'There was an error communicating with the AI assistant.'}, 500
# if __name__ == '__main__':
#      app.run(host='0.0.0.0',port=5001, debug=True)
    