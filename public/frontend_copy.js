// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_UKLg9cuxXMov7O3oyVsWqmTD5xHL2gk",
  authDomain: "nileslead.firebaseapp.com",
  projectId: "nileslead",
  storageBucket: "nileslead.appspot.com",
  messagingSenderId: "844365075368",
  appId: "1:844365075368:web:59e7c5c204ebaa4e81839d"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let lastButtonClicked = null;
// Set Firebase Auth persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Define the authenticateUser function
async function authenticateUser() {
    console.log('Starting authentication process');
    try {
        const provider = new firebase.auth.GoogleAuthProvider()
        provider.setCustomParameters({ hd: "neuroleadership.com" });
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        userName = user.displayName.split(' ')[0]; // Extract the first name
        console.log('Authentication successful', user);
        
        if (!user.email.endsWith("@neuroleadership.com")) {
            throw new Error("Access restricted to neuroleadership.com domain.");
        }

        document.getElementById('loginStatus').textContent = `Welcome, ${user.displayName}`;
        toggleContentVisibility(true);
 
        // Initialize the conversation after the user has been authenticated
        await initializeConversation();
        document.getElementById('query-input').focus();
    } catch (error) {
        console.error('Authentication error:', error);
        document.getElementById('loginStatus').textContent = "Error during login: " + error.message;
        toggleContentVisibility(false);
    }
}

  

let thread_id = null; 

// async function initializeConversation() {
//     const user = auth.currentUser;
//     if (user) { 
//         console.log('Request to initialize conversation sent', { userUID: user.uid });
//         const response = await fetch('https://nileslead.uc.r.appspot.com/check_conversation', { // Replace with your Flask app's URL
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ userUID: user.uid }), // Pass the user's UID to the function
//             mode: 'cors'
//         });
//         console.log('Response received', response);

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const data = await response.json();
//         if (data.thread_id) {
//             // A conversation exists - get the thread_id
//             thread_id = data.thread_id; 
//         } else {
//             // No conversation exists - start a new conversation
//             const threadResponse = await fetch('https://nileslead.uc.r.appspot.com/create_thread', { // Replace with your Flask app's URL
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ prompt: 'Hello' }) // Pass an initial prompt to the function
//             });

//             if (!threadResponse.ok) {
//                 throw new Error(`HTTP error! status: ${threadResponse.status}`);
//             }

//             const threadData = await threadResponse.json();
//             thread_id = threadData.thread_id;

//             // Store the thread_id in Firestore
//             const conversationRef = db.collection('conversations').doc(user.uid);
//             await conversationRef.set({ thread_id: thread_id });
//         }
//     }
// }

function toggleContentVisibility(isLoggedIn) {
    document.getElementById('publicContent').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('privateContent').style.display = isLoggedIn ? 'block' : 'none';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', authenticateUser);
    // document.getElementById('questionButton').addEventListener('click', function() {
        // this.classList.add('active');
    });
   
    responseBox = document.getElementById('response-box');
    const circleButtons = document.querySelectorAll('.circle-button');
    circleButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Play button sound
            document.getElementById('buttonSound').play();

            // Remove 'active' class from all buttons
            circleButtons.forEach(btn => btn.classList.remove('active'));

            // Set this button as active
            this.classList.add('active');

            // Set this button as the last button clicked
            lastButtonClicked = this;

            // Focus on the query input
            const queryInput = document.getElementById('query-input');
            queryInput.focus();
        });
    });

    document.querySelectorAll('.circle-button').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('buttonSound').play();
            if (lastButtonClicked && lastButtonClicked.id !== 'questionButton') {
                lastButtonClicked.classList.remove('active');
            }
            this.classList.add('active');
            lastButtonClicked = this;
            const queryInput = document.getElementById('query-input');
            queryInput.focus();
        });
    });

    document.getElementById('ask-button').addEventListener('mousedown', handleQuerySubmission);

    document.getElementById('query-input').addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            handleQuerySubmission();
        }
    });

function extractValueFromResponse(response) {
    // Use a regular expression to match the value pattern
    const match = response.match(/value=(['"])(.*?)\1/);

    // If a match was found, the second element of the array is the value
    const value = match ? match[2] : '';

    // Unescape and clean the extracted string
    const cleanedValue = value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");

    return cleanedValue;
}


// Function to fetch conversation data when the app initializes or a user logs in
async function initializeConversation() {
    const user = firebase.auth().currentUser;
    if (user) { 
        const conversationRef = db.collection('conversations').doc(user.uid);
        const conversationSnapshot = await conversationRef.get();

        if (!conversationSnapshot.exists) { 
            // No conversation exists - start a new conversation
            const response = await fetch('https://nileslead.uc.r.appspot.com/create_thread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userUID: user.uid }), // Pass the user's UID to the function
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            thread_id = data.thread_id;

            // Store the thread_id in Firestore
            await conversationRef.set({ thread_id: thread_id });
        } else {
            // A conversation exists - get the thread_id
            const conversationData = conversationSnapshot.data();
            thread_id = conversationData.thread_id; 
        }
    }
}

async function handleQuerySubmission() {
    // Get the user's query
    const queryInput = document.getElementById('query-input');
    const message = queryInput.value; 

    // Clear the input field
    queryInput.value = '';

    // Display the user's query in the response box immediately
    const userLabel = userName || 'User';
    responseBox.innerHTML = `<p style="color:#FF4500;"><strong>${userLabel}:</strong> ${message}</p>` + responseBox.innerHTML;

    // Wait for a short delay
    await new Promise(resolve => setTimeout(resolve, 2500)); // Adjust the delay as needed

    // Create and display the "NILES is typing..." message
    const typingMessage = document.createElement('p');
    typingMessage.id = 'typingMessage';
    typingMessage.innerHTML = '<em>NILES is typing...</em>';
    responseBox.insertBefore(typingMessage, responseBox.firstChild);

    // Submit the query
    await submitQuery(message);

    // Remove the "NILES is typing..." message
    typingMessage.remove();
}

async function submitQuery(message) {
    console.log('Submitting query:', message);
    responseBox = document.getElementById('response-box');
    const requestData = { 
        prompt: message,
        thread_id: thread_id 
    }; 

    try {
        const response = await fetch('https://nileslead.uc.r.appspot.com/submit_query', { // Replace with your Flask app's URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });


        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Server response:', data);

        // Handle the server response
        await handleServerResponse(data);

    } catch (error) {
        console.error('Error processing server response:', error);

        // Display a friendly error message
        responseBox.innerHTML = `<p><strong>NILES:</strong> I'm sorry, I encountered an error. Please try asking your question again or contact support.</p>`;
    }
}
// Revised handleServerResponse to use the new cleaning function
async function handleServerResponse(data) {
    try {
        let formattedContent = '';
        if (data.response && typeof data.response[0] === 'string') {
            // Extract the 'value' from the response string
            const extractedValue = data.response[0];
            // Apply text formatting enhancements
            formattedContent = enhanceTextFormatting(extractedValue);
        }

        // Create a new div element to hold the processed content
        const newElement = document.createElement('div');
        newElement.innerHTML = `<strong>NILES:</strong> ${formattedContent}`;

        // Define responseBox and insert the new element
        const responseBox = document.getElementById('response-box');
        responseBox.insertBefore(newElement, responseBox.firstChild);
    } catch (error) {
        console.error('Error processing server response:', error);
        const responseBox = document.getElementById('response-box');
        responseBox.textContent = 'Error: ' + error.message;
    }
}
function stripHtmlAndConvert(htmlContent) {
    // Remove HTML tags
    let textContent = htmlContent.replace(/<[^>]*>/g, '');

    // Convert HTML entities
    textContent = textContent.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    return textContent;
}

function enhanceTextFormatting(textContent) {
    // Convert Markdown syntax to HTML
    let formattedContent = textContent
        .replace(/\\'/g, "'") // Handle escaped apostrophes
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>') // Heading level 2
        .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>') // Heading level 1
        .replace(/\n/g, '<br>') // Line breaks
        .replace(/- (.*?)(\n|$)/g, '<li>$1</li>'); // List items

    return formattedContent;
}

// Utility function to unescape HTML entities
function unescapeHtml(safe) {
    return safe
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}
