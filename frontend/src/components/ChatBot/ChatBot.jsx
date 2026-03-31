import { useState } from "react";

export default function ChatBot() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { type: "user", text: message };
    setChat((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      const botMsg = { type: "bot", text: data.reply };

      setChat((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setChat((prev) => [
        ...prev,
        { type: "bot", text: "Error connecting to server" },
      ]);
    }

    setMessage("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>🌾 Farmer Assistant</h2>

      <div style={{ height: "300px", overflowY: "auto", marginBottom: "10px" }}>
        {chat.map((msg, i) => (
          <div key={i} style={{
            textAlign: msg.type === "user" ? "right" : "left",
            margin: "5px 0"
          }}>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask something..."
      />

      <button onClick={sendMessage}>Send</button>
    </div>
  );
}