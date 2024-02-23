# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`
import openai  # Assuming your existing code was in a file like openai.py
from firebase_admin import credentials, firestore, initialize_app, auth
from firebase_functions import https_fn
import logging
openai.api_key = os.getenv('OPENAI.API_KEY')

# Initialize Firebase/Firestore
cred = credentials.Certificate("niles-8df14-firebase-adminsdk-iy45i-99b9c2e9f1.json")  
initialize_app(cred)
db = firestore.client() 

logging.basicConfig(filename='app.log', level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')
# Adapt your existing function

    # ... Your modified create_thread_route logic (adjusted for Cloud Functions and Firestore) ...
user_token = request_json.get('userToken')
    
# Cloud Function Declaration 
generate_response_fn = https_fn.on_request(generate_response)  

def generate_response(request):
    request_json = request.get_json()
    prompt = request_json.get('prompt')
    user_uid = request_json.get('userUID')  

    if not prompt:
        return {'error': 'Missing prompt'}, 400

    # Fetch conversation and get user name
    conversation_ref = db.collection('conversations').doc(user_uid)
    conversation_doc = conversation_ref.get()

    if not conversation_doc.exists:
        # Create conversation if it doesn't exist, including the user's name
        user_name = firebase.auth().currentUser.displayName.split(' ')[0]  # Get first name
        conversation_ref.set({
            'messages': [], 
            'userId': user_uid,  # Store userId for security
            'name': user_name
        }) 
    else:
        conversation_data = conversation_doc.to_dict()
    
# Retrieve or create thread_id from Firestore 

thread_id = conversation_data.get('thread_id')

if not thread_id:
        # Create OpenAI Thread combining initial message
        thread = openai.beta.threads.create(
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        thread_id = thread.id

        # Update Firestore with thread_id
        conversation_ref.update({
            'thread_id': thread_id
        })

    # Send message and get response from OpenAI
try:
    # Send additional message to the thread
    message = openai.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=prompt
    )

    # Create the run 
    run = openai.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id           
    )

    # Polling for completion
    while True:
        run = openai.beta.threads.runs.retrieve(run.id, thread_id=thread_id)  
        if run.status == "completed":
            # Get the response from the completed run
            messages = openai.beta.threads.messages.list(thread_id=thread_id).data
            # ... rest of your response extraction logic ... 
            assistant_messages = [m for m in messages if m.role == "assistant"]
            last_message = sorted(assistant_messages, key=lambda m: m.created_at)[-1]
            break  # Exit the loop when the run is finished
        elif run.status == "failed":
            logging.error(f"Run failed: {run}")
            raise Exception("Run failed")
        time.sleep(1)  # Adjust the polling interval as needed

thread_id = conversation_data.get('thread_id')

 # Update Firestore with latest messages and thread_id (if new)
conversation_ref.update({
        "messages": firestore.ArrayUnion([
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": html} 
        ]),
        'thread_id': thread_id  # Update in case a new thread was created 
    })  
return json.dumps({'response': html, 'thread_id': thread_id})



# initialize_app()
#
#
@https_fn.on_request()
def on_request_example(req: https_fn.Request) -> https_fn.Response:
     return https_fn.Response("Hello world!")