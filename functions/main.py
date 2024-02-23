import openai
from firebase_admin import credentials, firestore, initialize_app, auth
from firebase_functions import https_fn
import logging
import os
import time

openai.api_key = os.getenv('OPENAI_API_KEY')
assistant_id = os.getenv('ASSISTANT_ID')

cred = credentials.Certificate("niles-8df14-firebase-adminsdk-iy45i-99b9c2e9f1.json")
initialize_app(cred)
db = firestore.client()

logging.basicConfig(filename='app.log', level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')

def generate_response(request):
    try:
        request_json = request.get_json()
        prompt = request_json.get('prompt')
        user_uid = request_json.get('userUID')

        if not prompt:
            logging.error('Missing prompt')
            return {'error': 'Missing prompt'}, 400

        conversation_ref = db.collection('conversations').doc(user_uid)
        conversation_doc = conversation_ref.get()

        if not conversation_doc.exists:
            user = auth.get_user(user_uid)
            user_name = user.display_name.split(' ')[0]
            conversation_ref.set({
                'messages': [],
                'userId': user_uid,
                'name': user_name
            })
        else:
            conversation_data = conversation_doc.to_dict()

        thread_id = conversation_data.get('thread_id')

        if not thread_id:
            thread = openai.beta.threads.create(
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            thread_id = thread.id
            conversation_ref.update({
                'thread_id': thread_id
            })

        message = openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=prompt
        )

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )

        start_time = time.time()
        while True:
            if time.time() - start_time > 60:  # 60 seconds timeout
                logging.error('Timeout while waiting for the run to complete')
                raise Exception('Timeout while waiting for the run to complete')

            run = openai.beta.threads.runs.retrieve(run.id, thread_id=thread_id)
            if run.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id).data
                assistant_messages = [m for m in messages if m.role == "assistant"]
                last_message = sorted(assistant_messages, key=lambda m: m.created_at)[-1]
                break
            elif run.status == "failed":
                logging.error(f"Run failed: {run}")
                raise Exception("Run failed")
            time.sleep(1)

        html = last_message.content
        conversation_ref.update({
            "messages": firestore.ArrayUnion([
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": html}
            ]),
            'thread_id': thread_id
        })

        return json.dumps({'response': html, 'thread_id': thread_id})

    except Exception as e:
        logging.error(f'An error occurred: {e}')
        return {'error': str(e)}, 500

generate_response_fn = https_fn.on_request(generate_response)