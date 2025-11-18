// echo-bot.js
document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const text = userInput.value.trim();
        if (!text) return;

        // Display user message
        const userMessage = document.createElement("div");
        userMessage.className = "user-message";
        userMessage.textContent = text;
        chatBox.appendChild(userMessage);

        userInput.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            // Send message to echo-bot
            const response = await fetch("https://echo-bot-566869872467.us-east5.run.app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            // Check for HTTP errors
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

            const data = await response.json();

            // Safely get the bot's reply
            const botReply = Array.isArray(data) && data.length > 0 ? data[0].text : "No response from bot.";

            // Display bot message
            const botMessage = document.createElement("div");
            botMessage.className = "bot-message";
            botMessage.textContent = botReply;
            chatBox.appendChild(botMessage);
            chatBox.scrollTop = chatBox.scrollHeight;

        } catch (error) {
            // Display error if bot is unreachable
            const errorMessage = document.createElement("div");
            errorMessage.className = "bot-message";
            errorMessage.textContent = "⚠️ Unable to reach echo-bot.";
            chatBox.appendChild(errorMessage);
            chatBox.scrollTop = chatBox.scrollHeight;

            console.error("Error contacting echo-bot:", error);
        }
    });
});
