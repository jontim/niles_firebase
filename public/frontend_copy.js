// nileslead's Firebase configuration
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
var ui = new firebaseui.auth.AuthUI(firebase.auth());

// Define the userName variable
let userName = null;

// Define the user variable
let user = null;

document.addEventListener('DOMContentLoaded', () => {
ui.start('#firebaseui-auth-container', {
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.FacebookAuthProvider.PROVIDER_ID,
      firebase.auth.TwitterAuthProvider.PROVIDER_ID
      // Other providers go here
    ],
    callbacks: {
      signInSuccessWithAuthResult: async function(authResult, redirectUrl) {
        try {
          // Fetch the whitelist
          const whitelist = await getWhitelist();
           // Check if the user's email address ends with "@neuroleadership.com" or if their email is in the whitelist
           if (!authResult.user.email.endsWith("@neuroleadership.com") && !whitelist.includes(authResult.user.email)) {
            // If not, sign them out and show an error message
            firebase.auth().signOut();
            document.getElementById('loginStatus').textContent = "Access restricted. Please sign in with a neuroleadership.com email address or the email you used to enroll in LEAD.";
            return;
        }
                   
          console.log('Authentication successful', authResult.user);
          // User successfully signed in.
          // call toggleContentVisibility here:
          userName = authResult.user.displayName.split(' ')[0]; // Extract the first name
          user = authResult.user;
          document.getElementById('loginStatus').textContent = `Welcome, ${user.displayName}`;
          toggleContentVisibility(true);
          document.getElementById('query-input').focus();
          // Initialize the conversation after the user has been authenticated
          await initializeConversation();
          // Don't automatically redirect. We want to handle redirection in nileslead
          return false;
        } catch (error) {
          console.error('Authentication error:', error);
          document.getElementById('loginStatus').textContent = "Error during login: " + error.message;
          toggleContentVisibility(false);
        }
      }
    }
  });
});

async function getWhitelist() {
    const response = await fetch('https://your-api-url.com/whitelist');
    const data = await response.json();
    return data;
  }


let lastButtonClicked = null;
// Set Firebase Auth persistence
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });


let thread_id = null; 


function toggleContentVisibility(isLoggedIn) {
    document.getElementById('publicContent').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('privateContent').style.display = isLoggedIn ? 'block' : 'none';
}

// Event Listeners
// document.addEventListener('DOMContentLoaded', () => {
    // document.getElementById('loginButton').addEventListener('click', authenticateUser);
    // document.getElementById('questionButton').addEventListener('click', function() {
        // this.classList.add('active');
    // });
   
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

        if (conversationSnapshot.exists) {
            const conversationData = conversationSnapshot.data();
            thread_id = conversationData.thread_id;
        } else {
            thread_id = null;
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
    const newElement = document.createElement('div');
    newElement.innerHTML = `<p style="color:#FF4500;"><strong>${userLabel}:</strong> ${message}</p>`;
    responseBox.appendChild(newElement);
    newElement.scrollIntoView();
    queryInput.focus();
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
    const user = firebase.auth().currentUser;
    const requestData = { 
        prompt: message,
        user_uid: user.uid
    }; 

    let endpoint;
    if (thread_id === null) {
        endpoint = 'https://nileslead.uc.r.appspot.com/create_thread';
    } else {
        requestData.thread_id = thread_id;
        endpoint = 'https://nileslead.uc.r.appspot.com/submit_query';
    }

    try {
        const response = await fetch(endpoint, { 
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

        if (thread_id === null) {
            thread_id = data.thread_id;
            const conversationRef = db.collection('conversations').doc(user.uid);
            await conversationRef.set({ thread_id: thread_id });
        }

        // Handle the server response
        await handleServerResponse(data);

        // Log the query and response to Firestore
        const logRef = db.collection('logs').doc(user.uid);
        await logRef.set({
            query: message,
            response: data.response[0]
        }, { merge: true });

    } catch (error) {
        console.error('Error processing server response:', error);

        // Display a friendly error message
        responseBox.innerHTML = `<p><strong>NILES:</strong> I'm sorry, I encountered an error. Please try asking your question again or if errors persist, contact support ${createEmailLink()} for assistance.</p>`;
    }
}
// handleServerResponse to use the cleaning function
async function handleServerResponse(data) {
    try {
        let formattedContent = '';
        if (data.response && typeof data.response[0] === 'string') {
            // Extract the 'value' from the response string
            const extractedValue = data.response[0];
            // Apply text formatting enhancements
            formattedContent = enhanceTextFormatting(extractedValue);
         
            // Remove the reference from the response and log it to the console
            const referenceRegex = /【.*?†source】/g;
            const match = formattedContent.match(referenceRegex);
            if (match) {
                console.log('Reference removed:', match[0]);
                formattedContent = formattedContent.replace(referenceRegex, '');
            }
        }
            
        // Create a new div element to hold the processed content
        const newElement = document.createElement('div');
        newElement.innerHTML = `<strong>NILES:</strong> ${formattedContent}`;

        // Define responseBox and insert the new element
        const responseBox = document.getElementById('response-box');
        responseBox.appendChild(newElement);
        newElement.scrollIntoView();
    } catch (error) {
        console.error('Error processing server response:', error);
        const responseBox = document.getElementById('response-box');
        responseBox.textContent = 'Error: ' + error.message;
    }
}

function createEmailLink() {
    const emailAddress = 'habitactivation@neuroleadership.com';  // Replace with your support email address
    const subject = encodeURIComponent('NILES support in Docebo');
    const body = encodeURIComponent('');  // Start with an empty body

    const emailLink = `mailto:${emailAddress}?subject=${subject}&body=${body}`;

    return `<a href="${emailLink}">Contact Support</a>`;
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
        .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>') // Heading level 3
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
