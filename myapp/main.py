from flask import Flask, request, session, render_template, jsonify, make_response
import openai
import time
import sys
import logging
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
import traceback
import firebase_admin 
from firebase_admin import firestore, auth, credentials
from httpx import HTTPStatusError



cred = credentials.Certificate('nileslead-firebase-adminsdk-jt2wv-308b7ef8e5.json')
firebase_admin.initialize_app(cred)
load_dotenv()
import os

app = Flask(__name__) 
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for all routes
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
openai.api_key = os.getenv('OPENAI_API_KEY')
assistant_id = os.getenv('ASSISTANT_ID')


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
# logging.DEBUG('This message will go to the log file')

@app.route('/')
def home():
    return render_template('index.html')

@app.before_request
def start_request():
    logging.info(f"Starting request to {request.path}")

@app.after_request
def log_response(response):
    logging.info(f"Response status: {response.status_code}")
    return response
    

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    logging.error(f"Unexpected error: {str(e)}")
    logging.error(traceback.format_exc())
    return {'error': 'An unexpected error occurred.'}, 500

start_time = time.time()
@app.route('/check_conversation', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type','Authorization'])
def check_conversation():
    
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
        return jsonify({'message': 'New conversation created'}), 200

end_time = time.time()

print(f"Execution time: {end_time - start_time} seconds")
        
start_time = time.time()
@app.route('/create_thread', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type','Authorization'])
def create_thread():
    # Check if the request has a JSON body
    if not request.is_json:
        app.logger.error("Request does not contain a JSON body")
        return jsonify({'error': 'Bad Request - Request must be JSON'}), 400

    try:
        thread = openai.beta.threads.create()
        thread_id = thread.id
        session['thread_id'] = thread_id
        return jsonify({'message': 'Thread created', 'thread_id': thread_id}), 200
       
    except Exception as e:
        # Log the exception along with any relevant details
        app.logger.error(f"Failed to create thread in OpenAI: {e}")
        return jsonify({'error': 'Failed to create thread'}), 500
end_time = time.time()

print(f"Execution time: {end_time - start_time} seconds")

start_time = time.time()
@app.route('/submit_query', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type','Authorization'])
def submit_query():
    logging.info("Received request for /submit_query")  # Log when a request is received
    
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
        logging.info(f"Message created with id: {message.id} and content: {message.content}")

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id           
        )
        logging.info(f"Run created with id: {run.id} and status: {run.status}")
        start_time = time.time()
        while True:
            run = openai.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
            if run.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id).data
                assistant_messages = [m for m in messages if m.role == "assistant"]
                last_message = sorted(assistant_messages, key=lambda m: m.created_at)[-1]
                logging.info(f"Response from OpenAI API: {last_message.content}")  # Log the response from the OpenAI API
                
                # Check the type of last_message.content and handle accordingly
                if isinstance(last_message.content, list):
                    # If it's a list, extract the 'value' attribute from the 'text' attribute of each object in the list
                    response = [content.text.value for content in last_message.content if hasattr(content.text, 'value')]
                elif hasattr(last_message.content.text, 'value'):
                    # If it's not a list, but an object with a 'value' attribute, wrap the 'value' in an array
                    response = [last_message.content.text.value]
                else:
                    # If it's neither a list nor an object with a 'value' attribute, wrap the content as is in an array
                    response = [last_message.content]

                # Send the response to the client
                return jsonify({'response': response}), 200

            elif run.status == "failed":
                logging.error(f"Run failed: {run}")
                raise Exception("Run failed")

            if time.time() - start_time > 60:  # Timeout after 60 seconds
                return jsonify({'error': 'Timeout waiting for response from AI assistant'}), 500

            time.sleep(1)
    except HTTPStatusError as e:
        if e.response.status_code == 400:
            logging.error(f"Bad request to OpenAI API: {e}")
            logging.error(f"Response body: {e.response.text}")
            return {'error': 'Bad request to OpenAI API.'}, 400
        else:
            raise
    except Exception as e: 
        logging.error(f"Error processing prompt: {e}")
        logging.error(traceback.format_exc())  # Log the full traceback of the exception
        return {'error': 'There was an error communicating with the AI assistant.'}, 500

end_time = time.time()
print(f"Execution time: {end_time - start_time} seconds")
# if __name__ == '__main__':
#      app.run(host='0.0.0.0',port=5001, debug=True)
    