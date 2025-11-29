// ---------------------------
// Config
// ---------------------------
const PROXY_URL = "https://nifty-proxy-566869872467.us-east5.run.app/niftybotv4/chat";

// ---------------------------
// State
// ---------------------------
let sessionId = null;

// ---------------------------
// DOM
// ---------------------------
const messageDisplay = document.getElementById("niftyv4-message-display");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

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

// ---------------------------
// Main
// ---------------------------
const sendMessage = async () => {
    const msg = userInput.value.trim();
    if (!msg) return;

    appendMessage({
        display: "User",
        css: "niftyv4-user",
        text: msg
    });

    userInput.value = "";

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

        if (data.session_id && !sessionId) {
            sessionId = data.session_id;
        }

        appendMessage({
            display: "Bot",
            css: "niftyv4-assistant",
            text: data.response || "(No response received)"
        });

    } catch {
        appendMessage({
            display: "System",
            css: "niftyv4-system",
            text: "Error contacting server."
        });
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