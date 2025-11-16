// ---------------------------
// Anonymous User ID
// ---------------------------
let userId = localStorage.getItem("nifty_user_id");
if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("nifty_user_id", userId);
}

// ---------------------------
// DOM Elements
// ---------------------------
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// ---------------------------
// Append a message to UI
// ---------------------------
function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = role;
    div.textContent = `${role}: ${text}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------------------------
// Send message
// ---------------------------
async function sendMessage() {
    const msg = userInput.value.trim();
    if (!msg) return;

    appendMessage("user", msg);
    userInput.value = "";

    try {
        const res = await fetch(
            "https://nifty-bot-566869872467.us-east5.run.app/chat",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    message: msg
                })
            }
        );

        const data = await res.json();

        if (data.response) {
            appendMessage("bot", data.response);
        } else {
            appendMessage("bot", "(No response received)");
        }
    } catch (err) {
        appendMessage("bot", "Error contacting server.");
    }
}

// ---------------------------
// UI Events
// ---------------------------
sendBtn.onclick = sendMessage;

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});
