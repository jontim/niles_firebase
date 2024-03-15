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
import json
import requests
import os
from datetime import datetime
cred = credentials.Certificate('nileslead-firebase-adminsdk-jt2wv-308b7ef8e5.json')
firebase_admin.initialize_app(cred)
load_dotenv()
import os

app = Flask(__name__) 
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for all routes
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
openai.api_key = os.getenv('OPENAI_API_KEY')
assistant_id = os.getenv('ASSISTANT_ID')
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
# logging.DEBUG('This message will go to the log file')

def show_json(obj):
    if hasattr(obj, 'to_dict'):
        obj = obj.to_dict()
    elif hasattr(obj, 'as_dict'):
        obj = obj.as_dict()
    elif hasattr(obj, 'dict'):
        obj = obj.dict()
    elif hasattr(obj, '__dict__'):
        obj = obj.__dict__
    print(json.dumps(obj, indent=4))

@app.route('/')
def home():
    return render_template('index.html')

@app.before_request
def start_request():
    request.start_time = time.time()
    logging.info(f"Starting request to {request.path}")

@app.after_request
def log_response(response):
    execution_time = time.time() - request.start_time
    logging.info(f"Response status: {response.status_code}, Execution time: {execution_time} seconds")
    return response
    

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    logging.error(f"Unexpected error: {str(e)}")
    logging.error(traceback.format_exc())
    return {'error': 'An unexpected error occurred.'}, 500


@app.route('/create_thread', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type','Authorization'])
def create_thread():
    # Check if the request has a JSON body
    if not request.is_json:
        app.logger.error("Request does not contain a JSON body")
        return jsonify({'error': 'Bad Request - Request must be JSON'}), 400

    try:
        prompt = request.json.get('prompt')
        thread = openai.beta.threads.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        thread_id = thread.id
        message_id = thread.messages[0].id
        return jsonify({'message': 'Thread and message created', 'thread_id': thread_id, 'message_id': message_id}), 200
       
    except Exception as e:
        # Log the exception along with any relevant details
        app.logger.error(f"Failed to create thread and message in OpenAI: {e}")
        return jsonify({'error': 'Failed to create thread and message'}), 500

@app.route('/submit_query', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type','Authorization'])
def submit_query():
    logging.info("Received request for /submit_query")  # Log when a request is received
    
    thread_id = request.json.get('thread_id')
    user_message = request.json.get('message')
    

    logging.info(f"Received thread_id: {thread_id}, user_message: {user_message}")  # Log the received thread_id

    if not thread_id or not user_message:
         return {'error': 'No thread_id or message provided'}, 400


    try:
        # Add the new user message to the thread
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )
        
        logging.info("Creating run...")  # Log before creating a run
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id          
        )
        show_json(run)
        logging.info(f"Run created with id: {run.id} and status: {run.status}")
        start_time = time.time()
        time.sleep(20)  # Wait for 10 seconds before the first poll
        poll_count = 0  # Initialize poll counter
        while True:
            if poll_count >= 10:  # Limit the number of polls to 9
                  break
            logging.info("Retrieving run...")  # Log before retrieving a run
            run = openai.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
            logging.info(f"Retrieved run with status: {run.status}")  # Log the status of the retrieved run
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
                logging.info("Listing steps...")  # Log before listing steps
                steps = openai.beta.threads.runs.steps.list(run.id, thread_id=thread_id).data
                for step in steps:
                    logging.error(f"Step {step.id}: {step}")
                raise Exception("Run failed")
            time.sleep(15)  # Wait for 10 seconds between each poll
            poll_count += 1  # Increment poll counter   

            if time.time() - start_time > 180:  # Timeout after 180 seconds
                return jsonify({'error': 'Timeout waiting for response from AI assistant'}), 500

        # If the function reaches this point, the run did not complete within the expected time
        return jsonify({'error': 'Run did not complete within the expected time'}), 500    

           
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
# if __name__ == '__main__':
#      app.run(host='0.0.0.0',port=5001, debug=True)
    