// ---------------------------
// Config
// ---------------------------
const PROXY_URL = "https://nifty-proxy-566869872467.us-east5.run.app/niftybotv2/chat";

// ---------------------------
// State
// ---------------------------
let userId = localStorage.getItem("niftyv2_user_id");
if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("niftyv2_user_id", userId);
}

// ---------------------------
// DOM
// ---------------------------
const messageDisplay = document.getElementById("message-display");
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
async function sendMessage() {
    const msg = userInput.value.trim();
    if (!msg) return;

    appendMessage({
    display: "User",
    css: "niftyv2-user",
    text: msg
    });

    userInput.value = "";

    try {
    const res = await fetch(PROXY_URL,{
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                message: msg
            })
        }
    );

    const data = await res.json();
 
    appendMessage({
        display: "Bot",
        css: "niftyv2-agent",
        text: data.response ?? "(No response received)"
    });
    
    } catch (err) {
        appendMessage({
            display: "Bot",
            css: "niftyv2-agent",
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