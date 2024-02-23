// Initialize Firebase App
const firebaseConfig = {
    apiKey: "AIzaSyAynmQqe48qCKh5HhyCQ96hnUA2b-Mz2FU",
    authDomain: "niles-8df14.firebaseapp.com",
    projectId: "niles-8df14",
    storageBucket: "niles-8df14.appspot.com",
    messagingSenderId: "728013158555",
    appId: "1:728013158555:web:ac787693ac988a87d76e3e",
};
firebase.initializeApp(firebaseConfig);



let lastButtonClicked = null;

// Authentication and User State Management
async function authenticateUser() {
    console.log('Starting authentication process');
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ hd: "neuroleadership.com" });
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        if (!user.email.endsWith("@neuroleadership.com")) {
            throw new Error("Access restricted to neuroleadership.com domain.");
        }

        document.getElementById('loginStatus').textContent = `Welcome, ${user.displayName}`;
        toggleContentVisibility(true);
    } catch (error) {
        console.error('Authentication error:', error);
        document.getElementById('loginStatus').textContent = "Error during login: " + error.message;
        toggleContentVisibility(false);
    }
}

let thread_id = null; 

async function initializeConversation() {
    const user = firebase.auth().currentUser;
    if (user) { 
        const conversationRef = db.collection('conversations').doc(user.uid);
        const conversationSnapshot = await conversationRef.get();

        if (conversationSnapshot.exists) { 
            const conversationData = conversationSnapshot.data();
            thread_id = conversationData.thread_id; 
        } 
    }
}


function toggleContentVisibility(isLoggedIn) {
    document.getElementById('publicContent').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('privateContent').style.display = isLoggedIn ? 'block' : 'none';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', authenticateUser);
    document.getElementById('questionButton').addEventListener('click', function() {
        this.classList.add('active');
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

let thread_id = null; // Initialize the thread_id variable
// Function to fetch conversation data when the app initializes or a user logs in
async function initializeConversation() {
    const user = firebase.auth().currentUser;
    if (user) { 
        const conversationRef = db.collection('conversations').doc(user.uid);
        const conversationSnapshot = await conversationRef.get();

        if (conversationSnapshot.exists) { 
            const conversationData = conversationSnapshot.data();
            thread_id = conversationData.thread_id; 
        } else {
            // No conversation exists - You have a few options:
            // Option 1: Start a new conversation automatically
              submitQuery("Hello, can you help me?"); // Or any starting message 

            // Option 2: Display a message to the user prompting them to start a conversation
            // Option 3: Do nothing, and wait for the user to initiate manually  
        }
    }
}

async function handleQuerySubmission() {
    // Get the user's query
    const queryInput = document.getElementById('query-input');
    const message = queryInput; 
    await submitQuery(message); 
   
}
    
    const query = queryInput.value;

    // Clear the input field
    queryInput.value = '';

    // Display the user's query in the response box immediately
   
    responseBox.innerHTML = `<p><strong>User:</strong> ${query}</p>` + responseBox.innerHTML;

    // Wait for a short delay
    await new Promise(resolve => setTimeout(resolve, 2500)); // Adjust the delay as needed

    // Create and display the "NILES is typing..." message
    const typingMessage = document.createElement('p');
    typingMessage.id = 'typingMessage';
    typingMessage.innerHTML = '<em>NILES is typing...</em>';
    responseBox.insertBefore(typingMessage, responseBox.firstChild);


    // Submit the query
    await submitQuery(query);
    // Remove the "NILES is typing..." message
    typingMessage.remove();
}

// Query Submission
// Parse HTML content without escaping markup


async function submitQuery(message) {
    console.log('Submitting query:', message);
    responseBox = document.getElementById('response-box');
    const requestData = { 
        prompt: message,
        thread_id: thread_id 
    }; 

    try {
        const response = await fetch('/create_thread', { // Assuming your Cloud Function URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
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
        if (typeof data === 'object' && data.response) {
            // Extract the 'value' from the response string
            const extractedValue = extractValueFromResponse(data.response);

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
// Initialization on user login or app load 
initializeConversation(); 