document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        // Add user message
        const userMessage = document.createElement("div");
        userMessage.className = "user-message";
        userMessage.textContent = text;
        chatBox.appendChild(userMessage);

        userInput.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const response = await fetch("https://echo-bot-566869872467.us-east5.run.app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            const data = await response.json();
            const botReply = data[0]?.text || "No response from bot.";

            // Add bot message
            const botMessage = document.createElement("div");
            botMessage.className = "bot-message";
            botMessage.textContent = botReply;
            chatBox.appendChild(botMessage);
            chatBox.scrollTop = chatBox.scrollHeight;

        } catch (err) {
            const errorMessage = document.createElement("div");
            errorMessage.className = "bot-message";
            errorMessage.textContent = "⚠️ Unable to reach echo-bot.";
            chatBox.appendChild(errorMessage);
            chatBox.scrollTop = chatBox.scrollHeight;

            console.error("Error contacting echo-bot:", err);
        }
    });
});
