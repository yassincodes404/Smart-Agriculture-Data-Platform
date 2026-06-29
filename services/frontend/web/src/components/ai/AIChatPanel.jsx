/**
 * components/ai/AIChatPanel.jsx
 * ------------------------------
 * A floating, collapsible AI chat panel for talking to Grok about a specific land.
 * Features:
 *  - Persisted chat history (loaded from and saved to the backend)
 *  - Typing indicator during AI response
 *  - Clear chat button
 *  - Markdown-like rendering for AI responses
 */

import { useState, useEffect, useRef } from "react";
import {
  getAiChatHistory,
  sendAiChatMessage,
  clearAiChatHistory,
} from "../../services/api";

export default function AIChatPanel({ landId, onResize }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  
  // Resizable Sidebar States
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    if (onResize) {
      onResize({ isOpen, width: sidebarWidth });
    }
  }, [isOpen, sidebarWidth, onResize]);

  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history when panel opens
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
    }
    
    const mainShell = document.querySelector('.app-shell__main');
    
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (mainShell) {
        mainShell.style.paddingRight = "400px";
        mainShell.style.transition = "padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
      }
    } else {
      if (mainShell) mainShell.style.paddingRight = "0px";
    }
    
    // Cleanup on unmount
    return () => {
      if (mainShell) mainShell.style.paddingRight = "0px";
    };
  }, [isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await getAiChatHistory(landId);
      setMessages(res.messages || []);
      setHistoryLoaded(true);
    } catch (err) {
      setError("Could not load chat history.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg = { role: "user", content: text, message_id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const res = await sendAiChatMessage(landId, text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.content,
          message_id: res.message_id,
        },
      ]);
    } catch (err) {
      setError(err.message || "AI service unavailable. Check your API keys in Profile settings.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all chat history for this land?")) return;
    await clearAiChatHistory(landId);
    setMessages([]);
    setHistoryLoaded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple text formatter: bold **text**, line breaks
  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />");
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 300) newWidth = 300;
      if (newWidth > 800) newWidth = 800;
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <>
      {/* Floating button */}
      <button
        id="ai-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f97316, #ea580c)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(249,115,22,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          transition: "transform 0.2s, box-shadow 0.2s",
          fontSize: 22,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title="Chat with AI Agronomist"
      >
        {isOpen ? "✕" : "✨"}
      </button>

      {/* Chat sidebar */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: sidebarWidth,
            height: "100vh",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderLeft: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "-20px 0 60px rgba(0,0,0,0.1)",
            zIndex: 1001, /* Above floating button and navbar */
            display: "flex",
            flexDirection: "column",
            animation: "slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transition: isDragging ? "none" : "width 0.2s ease-out",
          }}
        >
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: "absolute",
              left: -4,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
              zIndex: 1002,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 4, height: 40, background: "rgba(0,0,0,0.2)", borderRadius: 2 }} />
          </div>
          {/* Header */}
          <div
            style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, var(--green-700), var(--green-950))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  AgriMind AI
                </div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                  Powered by Groq · Farm-specific context
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleClear}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "#fff",
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
                title="Clear chat history"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: 20,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                }}
                title="Close Sidebar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {loading && (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                Loading history…
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  marginTop: "var(--space-xl)",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌾</div>
                <strong>Ask me anything about this farm!</strong>
                <br />
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Try: "Why did NDVI drop last month?" or "When should I irrigate?"
                </span>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.message_id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "var(--space-sm) var(--space-md)",
                    borderRadius:
                      msg.role === "user"
                        ? "20px 20px 4px 20px"
                        : "4px 20px 20px 20px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, var(--green-500), var(--green-600))"
                        : "rgba(255,255,255,0.9)",
                    color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    border: msg.role === "assistant" ? "1px solid rgba(0,0,0,0.05)" : "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  }}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "var(--space-sm) var(--space-md)",
                    borderRadius: "4px 20px 20px 20px",
                    background: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--green-500)",
                        animation: `bounce 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "var(--error-light)",
                  border: "1px solid var(--error-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-sm) var(--space-md)",
                  fontSize: 12,
                  color: "var(--error)",
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "var(--space-sm) var(--space-md)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: "var(--space-sm)",
              flexShrink: 0,
              background: "var(--bg-card)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this farm…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: 13,
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                border: "none",
                borderRadius: "var(--radius-md)",
                color: "#fff",
                width: 36,
                flexShrink: 0,
                cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                opacity: input.trim() && !isTyping ? 1 : 0.5,
                fontSize: 16,
                transition: "opacity 0.2s",
              }}
              title="Send message"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}} />
    </>
  );
}
