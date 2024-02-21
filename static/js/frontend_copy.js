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
let responseBox;
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

async function handleQuerySubmission() {
    // Get the user's query
    const queryInput = document.getElementById('query-input');
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
function parseHtmlContent(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.textContent || "";
}

async function submitQuery(message) {
    console.log('Submitting query:', message);
    responseBox = document.getElementById('response-box');
    const requestData = { prompt: message };

    try {
        const response = await fetch('/create_thread', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        let extractedText = '';
        if (typeof data === 'object' && data.response) {
            // Attempt to parse the response string as JSON, if applicable
            const responseContent = data.response;

            // Regex to extract the value content from the response
            const valueRegex = /value='([^']*)'/;
            const match = responseContent.match(valueRegex);

            if (match && match[1]) {
                // Decode escaped sequences and remove newlines
                extractedText = match[1].replace(/\\n/g, '\n').replace(/\\'/g, "'");
            } else {
                extractedText = "No valid content found or response format is unexpected.";
            }
        } else {
            extractedText = "Response format is not recognized.";
        }

        // Apply formatting enhancements
       let formattedContent = enhanceTextFormatting(extractedText);
       
       function enhanceTextFormatting(textContent) {
            // Convert Markdown bold to HTML <strong>
            textContent = textContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
            // Convert Markdown headings. This example only covers H1 and H2 for brevity.
            textContent = textContent.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
            textContent = textContent.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
            textContent = textContent.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
            textContent = textContent.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
            textContent = textContent.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
            // Optional: Convert other Markdown or HTML elements as needed
            // For example, Markdown links [text](url) to HTML <a href="url">text</a>
            textContent = textContent.replace(/\[([^\]]+)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        
            // Return the enhanced text
            return textContent;
        }
        
        // Apply any additional cleaning or formatting
        let cleanedContent = stripHtmlAndConvert(extractedText, true); // Assuming you want Markdown formatting

        // Create a new div element to hold the processed content
        const newElement = document.createElement('div');
        newElement.innerHTML = `<strong>NILES:</strong> ${cleanedContent}`;
        responseBox.insertBefore(newElement, responseBox.firstChild);
    } catch (error) {
        console.error('Error processing server response:', error);
        responseBox.textContent = 'Error: ' + error.message;
    }
}


// Function to strip HTML tags and optionally convert to markdown
function stripHtmlAndConvert(htmlContent, toMarkdown = false) {
    if (toMarkdown) {
        // Simple HTML to Markdown conversion (expand as needed)
        htmlContent = htmlContent
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<em>(.*?)<\/em>/g, '*$1*')
            .replace(/<p>(.*?)<\/p>/g, '$1\n')
            .replace(/<br\s*\/?>/g, '\n');
    }
    // Remove remaining HTML tags
    htmlContent = htmlContent.replace(/<\/?[^>]+(>|$)/g, "");
    return unescapeHtml(htmlContent);
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