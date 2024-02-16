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
    const responseBox = document.getElementById('response-box');
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
async function submitQuery(message) {
    console.log('Submitting query:', message);
    const responseBox = document.getElementById('response-box');

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
        console.log('Server response:', data.response);

        const matchResult = data.response.match(/Text\(annotations=\[\], value=('|"|)([\s\S]*?)\1\)/);
        if (matchResult && matchResult[2]) {
            let htmlContent = matchResult[2]
                // Normalize newline characters
                .replace(/\\n/g, '\n')
                // Dynamically replace markdown-like headings with HTML heading tags
                .replace(/(#+)\s*(.*?)\n/g, (match, hashes, text) => {
                    const level = hashes.length;
                    return `<h${level}>${text}</h${level}><br>`;
                })
                // Replace newline characters with <br> for HTML display
                .replace(/\n/g, '<br>');

            // Create a new div element to hold the processed content
            const newElement = document.createElement('div');
            newElement.innerHTML = `<strong>NILES:</strong> ${htmlContent}`;
            // Insert the new element into the response box at the beginning
            responseBox.insertBefore(newElement, responseBox.firstChild);

            // Optionally, add a horizontal rule for visual separation
            const hr = document.createElement('hr');
            responseBox.insertBefore(hr, responseBox.firstChild);
        } else {
            console.error('Pattern not found in server response:', data.response);
        }        
    } catch (error) {
        console.error('Error submitting query:', error);
        document.getElementById('response-box').textContent = 'Error: ' + error.message;
    }
}