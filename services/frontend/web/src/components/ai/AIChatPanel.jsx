/**
 * components/ai/AIChatPanel.jsx
 * ------------------------------
 * AI chat panel (AgriMind).
 * Redesigned for desktop + mobile:
 *  - Desktop: right resizable panel positioned below the topbar (no header overlap)
 *  - Mobile: full-width bottom sheet below header with grab bar + backdrop
 *  - Always respects topbar, plays nicely with left sidebar + search/notif
 *  - Content area padding shift only on desktop (handled by parent)
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

  const SUGGESTIONS = [
    "Is the current temperature suitable for my crop?",
    "Does the crop quality increase or decrease over time?",
    "Can you explain how NDVI is calculated?",
    "What is the estimated harvest window for this land?"
  ];
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  
  // Resizable Sidebar States
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);

  // Mobile detection for responsive redesign
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  // Dynamic height for mobile to handle virtual keyboard properly
  const [mobileChatHeight, setMobileChatHeight] = useState("72vh");

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keyboard-aware height adjustment on mobile (visualViewport)
  useEffect(() => {
    if (!isMobileView) {
      setMobileChatHeight("72vh");
      return;
    }

    const updateMobileHeight = () => {
      const vv = window.visualViewport;
      const topBarH = 56; // matches --topbar-height

      if (vv) {
        // Use visual height (shrinks with keyboard) and leave room for topbar
        const avail = Math.max(220, vv.height - topBarH - 8);
        const capped = Math.min(avail, window.innerHeight * 0.82);
        setMobileChatHeight(`${capped}px`);
      } else {
        setMobileChatHeight("72vh");
      }
    };

    updateMobileHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateMobileHeight);
      vv.addEventListener("scroll", updateMobileHeight); // some keyboards scroll
      return () => {
        vv.removeEventListener("resize", updateMobileHeight);
        vv.removeEventListener("scroll", updateMobileHeight);
      };
    }
  }, [isMobileView]);

  // Notify parent (for content padding shift on desktop)
  useEffect(() => {
    if (onResize) {
      onResize({ isOpen, width: sidebarWidth, isMobile: isMobileView });
    }
  }, [isOpen, sidebarWidth, isMobileView, onResize]);

  // On mobile, auto-close chat if main left sidebar (drawer) becomes visible to avoid two heavy overlays
  useEffect(() => {
    if (!isMobileView) return;

    const closeIfDrawerOpen = () => {
      const shell = document.querySelector(".app-shell");
      if (shell && isOpen && !shell.classList.contains("app-shell--collapsed") && window.innerWidth <= 768) {
        setIsOpen(false);
      }
    };

    // Watch class changes on the shell
    const shellEl = document.querySelector(".app-shell");
    let observer;
    if (shellEl) {
      observer = new MutationObserver(closeIfDrawerOpen);
      observer.observe(shellEl, { attributes: true, attributeFilter: ["class"] });
    }

    const t = setTimeout(closeIfDrawerOpen, 80);
    window.addEventListener("resize", closeIfDrawerOpen);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", closeIfDrawerOpen);
      if (observer) observer.disconnect();
    };
  }, [isMobileView, isOpen]);

  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history when panel opens + focus input. No more global DOM padding hacks here.
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
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

    // Reset textarea height after send
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

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

  const handleSuggestionClick = (suggestionText) => {
    // Set input and send immediately
    setInput(suggestionText);
    setTimeout(() => {
      // Need to simulate sending because state hasn't flushed to input yet
      // so we use the argument directly.
      const text = suggestionText.trim();
      if (!text || isTyping) return;

      const userMsg = { role: "user", content: text, message_id: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      setError(null);

      sendAiChatMessage(landId, text).then((res) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.content,
            message_id: res.message_id,
          },
        ]);
      }).catch((err) => {
        setError(err.message || "AI service unavailable.");
      }).finally(() => {
        setIsTyping(false);
      });
    }, 50);
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all chat history for this land?")) return;
    await clearAiChatHistory(landId);
    setMessages([]);
    setHistoryLoaded(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
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
    if (isMobileView) return;
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging || isMobileView) return;
    const handleMouseMove = (e) => {
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 300) newWidth = 300;
      if (newWidth > 620) newWidth = 620; // tighter max for desktop
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isMobileView]);

  // Dynamic positioning values for desktop + mobile redesign
  const topOffset = "var(--topbar-height)";
  const panelWidth = isMobileView ? "100%" : `${sidebarWidth}px`;
  const panelZ = 700;
  const backdropZ = 620;

  // Base layout styles (transform / visibility controlled in render for smooth open/close)
  // Mobile uses bottom-anchored + dynamic height (keyboard friendly)
  const basePanelStyle = isMobileView
    ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: mobileChatHeight,
        maxHeight: "85vh",
        width: "100%",
        backgroundColor: "var(--bg-primary)",
        borderTopLeftRadius: "18px",
        borderTopRightRadius: "18px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderBottom: "none",
        zIndex: panelZ,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        top: topOffset,
        right: 0,
        width: panelWidth,
        height: "calc(100vh - var(--topbar-height))",
        backgroundColor: "var(--bg-primary)",
        borderLeft: "1px solid var(--border-color)",
        boxShadow: "-6px 0 24px rgba(0,0,0,0.08)",
        zIndex: panelZ,
        display: "flex",
        flexDirection: "column",
      };

  return (
    <>
      {/* Floating action button (bottom-right). Completely hidden when chat is open. */}
      <button
        id="ai-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: isMobileView ? `calc(16px + env(safe-area-inset-bottom, 0px))` : 28,
          right: isMobileView ? `calc(14px + env(safe-area-inset-right, 0px))` : 28,
          width: isMobileView ? 52 : 54,
          height: isMobileView ? 52 : 54,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--green-500), var(--green-600))",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 6px 24px rgba(16, 185, 129, 0.35)",
          display: isOpen ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 850,
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
          color: "#fff",
          touchAction: "manipulation",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = "scale(1.05) translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 10px 28px rgba(16, 185, 129, 0.45)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) translateY(0)";
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(16, 185, 129, 0.35)";
        }}
        title="Chat with AI Agronomist"
        aria-label="Open AI Agronomist chat"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: isMobileView ? 24 : 26, height: isMobileView ? 24 : 26 }}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <path d="M15 9h.01M9 9h.01M12 14h.01" />
        </svg>
      </button>

      {/* Backdrop (dims content below header). Stronger on mobile. Click closes. */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: topOffset,
            left: 0,
            right: 0,
            bottom: 0,
            background: isMobileView ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.08)",
            zIndex: backdropZ,
            transition: "background 0.2s ease",
          }}
          aria-hidden="true"
        />
      )}

      {/* AI Chat Panel / Sheet — always in DOM for smooth mobile entrance */}
      <div
        style={{
          ...basePanelStyle,
          // When closed we keep it mounted but offscreen (especially useful on mobile)
          transform: isOpen
            ? isMobileView
              ? "translateY(0)"
              : "translateX(0)"
            : isMobileView
            ? "translateY(100%)"
            : "translateX(110%)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: isDragging
            ? "none"
            : "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), width 0.2s ease, opacity 0.2s ease",
        }}
        role="dialog"
        aria-label="AI Agronomist chat"
        aria-hidden={!isOpen}
      >
          {/* Desktop resizer drag handle (left edge) */}
          {!isMobileView && (
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: "absolute",
                left: -5,
                top: 0,
                bottom: 0,
                width: 10,
                cursor: "ew-resize",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Drag to resize chat"
            >
              <div style={{ width: 4, height: 36, background: "rgba(16,185,129,0.35)", borderRadius: 999 }} />
            </div>
          )}

          {/* Mobile sheet grab indicator (visual only) */}
          {isMobileView && (
            <div
              style={{
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                paddingTop: 6,
              }}
            >
              <div style={{ 
                width: 42, 
                height: 5, 
                background: "rgba(0,0,0,0.25)", 
                borderRadius: 999
              }} />
            </div>
          )}

          {/* Header */}
          <div
            style={{
              padding: isMobileView ? "10px 16px" : "12px 16px",
              background: "var(--green-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              minHeight: isMobileView ? 46 : 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ 
                width: 26, 
                height: 26, 
                borderRadius: "50%", 
                background: "var(--green-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "white",
                flexShrink: 0
              }}>
                🌱
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: isMobileView ? 14 : 15, letterSpacing: "-0.2px" }}>
                  AgriMind AI
                </div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: -1 }}>
                  Land-aware assistant
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={handleClear}
                style={{
                  background: "rgba(255,255,255,0.25)",
                  border: "none",
                  borderRadius: 999,
                  color: "#fff",
                  fontSize: 11,
                  padding: "5px 11px",
                  minHeight: 30,
                  cursor: "pointer",
                  fontWeight: 500,
                  touchAction: "manipulation",
                }}
                title="Clear chat history for this land"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.25)",
                  border: "none",
                  color: "#fff",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  touchAction: "manipulation",
                }}
                aria-label="Close chat"
                title="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobileView ? "14px 12px 8px" : "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: isMobileView ? 10 : "var(--space-sm)",
              WebkitOverflowScrolling: "touch",
              background: "var(--bg-primary)",
            }}
          >
            {loading && (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, padding: "12px 0" }}>
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
                  lineHeight: 1.5,
                  padding: "0 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.7 }}>🌱</div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Ask me anything</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: "var(--space-lg)" }}>
                  About NDVI, irrigation, soil, or crop health for this land.
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: "400px" }}>
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      style={{
                        background: "rgba(16, 185, 129, 0.1)",
                        color: "var(--green-700)",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                        borderRadius: "16px",
                        padding: "8px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        textAlign: "left",
                        lineHeight: 1.3
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(16, 185, 129, 0.2)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.message_id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 6,
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{ 
                    width: 22, height: 22, 
                    borderRadius: "50%", 
                    background: "var(--green-100)", 
                    flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11,
                    marginTop: 2
                  }}>🌱</div>
                )}
                <div
                  style={{
                    maxWidth: isMobileView ? "82%" : "76%",
                    padding: isMobileView ? "9px 13px" : "8px 13px",
                    borderRadius: msg.role === "user" 
                      ? "16px 16px 4px 16px" 
                      : "4px 16px 16px 16px",
                    background:
                      msg.role === "user"
                        ? "var(--green-600)"
                        : "var(--bg-primary)",
                    color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                    fontSize: isMobileView ? 14.5 : 14,
                    lineHeight: 1.35,
                    border: msg.role === "assistant" ? "1px solid var(--border-color)" : "none",
                    boxShadow: msg.role === "assistant" ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                  }}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start", gap: 6 }}>
                <div style={{ 
                  width: 22, height: 22, 
                  borderRadius: "50%", 
                  background: "var(--green-100)", 
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11
                }}>🌱</div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px 16px 16px 16px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 4.5,
                        height: 4.5,
                        borderRadius: "50%",
                        background: "var(--green-500)",
                        animation: `bounce 1.15s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.18}s infinite`,
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
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--error)",
                  margin: "0 4px",
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: isMobileView ? "8px 12px calc(8px + env(safe-area-inset-bottom, 8px))" : "8px 12px 10px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              gap: "8px",
              flexShrink: 0,
              background: "var(--bg-primary)",
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow textarea (mobile friendly)
                if (e.target) {
                  e.target.style.height = "auto";
                  const newH = Math.min(e.target.scrollHeight, isMobileView ? 100 : 80);
                  e.target.style.height = `${newH}px`;
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this land…"
              rows={1}
              style={{
                flex: 1,
                minHeight: isMobileView ? 40 : 36,
                maxHeight: isMobileView ? 100 : 80,
                resize: "none",
                border: "1px solid var(--border-color)",
                borderRadius: 999,
                padding: "9px 14px",
                fontSize: isMobileView ? 15 : 14,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                lineHeight: 1.3,
                overflowY: "auto",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              style={{
                background: "var(--green-600)",
                border: "none",
                borderRadius: "999px",
                color: "#fff",
                width: isMobileView ? 42 : 40,
                height: isMobileView ? 42 : 40,
                flexShrink: 0,
                cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                opacity: input.trim() && !isTyping ? 1 : 0.35,
                transition: "opacity 0.2s, transform 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "manipulation",
                marginBottom: isMobileView ? 1 : 0,
                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
              }}
              title="Send message"
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-3px); }
        }
      `}} />
    </>
  );
}
