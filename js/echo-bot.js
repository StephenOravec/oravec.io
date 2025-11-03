document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatLog = document.getElementById("chat-log");

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        // Display user's message
        const userMessage = document.createElement("div");
        userMessage.classList.add("chat-message", "user");
        userMessage.textContent = text;
        chatLog.appendChild(userMessage);
        userInput.value = "";
        chatLog.scrollTop = chatLog.scrollHeight;

        try {
            // Send message to echo-bot
            const response = await fetch("https://echo-bot-566869872467.us-east5.run.app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // Response is a list, get first object
            const replyText = Array.isArray(data) && data.length > 0 ? data[0].text : "No response from echo-bot.";

            // Display bot's reply
            const botMessage = document.createElement("div");
            botMessage.classList.add("chat-message", "bot");
            botMessage.textContent = replyText;
            chatLog.appendChild(botMessage);
            chatLog.scrollTop = chatLog.scrollHeight;

        } catch (error) {
            // Display error message
            const errorMessage = document.createElement("div");
            errorMessage.classList.add("chat-message", "bot");
            errorMessage.textContent = "⚠️ Unable to reach echo-bot.";
            chatLog.appendChild(errorMessage);
            chatLog.scrollTop = chatLog.scrollHeight;

            console.error("Error contacting echo-bot:", error);
        }
    });
});
