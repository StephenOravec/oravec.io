// ---------------------------
// Config
// ---------------------------
const PROXY_URL = "https://nifty-proxy-566869872467.us-east5.run.app/niftybotv4/chat";

// ---------------------------
// State
// ---------------------------
let sessionId = null;
let lastRequestTime = 0;

// ---------------------------
// DOM
// ---------------------------
const messageDisplay = document.getElementById("niftyv4-message-display");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

// ---------------------------
// Rabbit-themed thinking messages
// ---------------------------
const thinkingMessages = [
    "🐰 Checking my pocket watch...",
    "🐰 Oh my, oh my! Let me think...",
    "🐰 Hopping through the data...",
    "🐰 Consulting my rabbit friends...",
    "🐰 Brewing some carrot tea...",
    "🐰 Late, late, late! But thinking..."
];

const coldStartMessages = [
    "🐰 Waking up from my burrow...",
    "🐰 Adjusting my bow tie...",
    "🐰 Dusting off my pocket watch...",
    "🐰 Almost ready to chat!"
];

// ---------------------------
// Helpers
// ---------------------------
function appendMessage({ display, css, text }) {
    const div = document.createElement("div");
    div.className = css;
    div.textContent = `${display}: ${text}`;
    messageDisplay.appendChild(div);
    messageDisplay.scrollTop = messageDisplay.scrollHeight;
}

function addTypingIndicator(isColdStart = false) {
    // Choose messages based on cold start
    const messages = isColdStart ? coldStartMessages : thinkingMessages;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    const typingDiv = document.createElement("div");
    typingDiv.id = "typing-indicator";
    typingDiv.className = "typing-indicator";
    typingDiv.innerHTML = `
        <span class="typing-emoji">🐰</span>
        <span class="typing-text">${randomMessage.replace('🐰 ', '')}</span>
        <span class="typing-dots">
            <span></span><span></span><span></span>
        </span>
    `;
    
    messageDisplay.appendChild(typingDiv);
    messageDisplay.scrollTop = messageDisplay.scrollHeight;
    
    // If cold start, cycle through messages
    if (isColdStart) {
        let messageIndex = 0;
        const interval = setInterval(() => {
            messageIndex++;
            if (messageIndex < messages.length) {
                const textSpan = typingDiv.querySelector('.typing-text');
                if (textSpan) {
                    // Remove emoji from message when updating
                    textSpan.textContent = messages[messageIndex].replace('🐰 ', '');
                }
            } else {
                clearInterval(interval);
            }
        }, 5000); // Change message every 5 seconds
        
        return interval;
    }
    
    return null;
}

function removeTypingIndicator(interval = null) {
    // Clear the interval if it exists
    if (interval) {
        clearInterval(interval);
    }
    
    // Remove the typing indicator element
    const typing = document.getElementById("typing-indicator");
    if (typing) {
        typing.remove();
    }
}

// ---------------------------
// Main
// ---------------------------
const sendMessage = async () => {
    const msg = userInput.value.trim();
    if (!msg) return;

    // Disable input while processing
    userInput.disabled = true;
    sendButton.disabled = true;

    // Show user's message
    appendMessage({
        display: "User",
        css: "niftyv4-user",
        text: msg
    });

    userInput.value = "";

    // Detect if cold start (>15 minutes since last request)
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const isColdStart = timeSinceLastRequest > 15 * 60 * 1000 || lastRequestTime === 0;
    
    // Show typing indicator (with interval for cold start)
    const interval = addTypingIndicator(isColdStart);

    try {
        const res = await fetch(PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: sessionId,
                message: msg
            })
        });

        const data = await res.json();

        // Save session ID
        if (data.session_id && !sessionId) {
            sessionId = data.session_id;
        }

        // Remove typing indicator
        removeTypingIndicator(interval);

        // Show bot's response
        appendMessage({
            display: "Bot",
            css: "niftyv4-assistant",
            text: data.response || "(No response received)"
        });

        // Update last request time
        lastRequestTime = Date.now();

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(interval);
        
        appendMessage({
            display: "System",
            css: "niftyv4-system",
            text: "Error contacting server."
        });
    } finally {
        // Re-enable input
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
};

// ---------------------------
// Events
// ---------------------------
sendButton.onclick = sendMessage;

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});