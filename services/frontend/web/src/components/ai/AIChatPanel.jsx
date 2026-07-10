/**
 * components/ai/AIChatPanel.jsx — AgriMind land-aware AI assistant
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useConfirm } from "../../context/ConfirmContext";
import {
  getAiChatHistory,
  sendAiChatMessage,
  clearAiChatHistory,
} from "../../services/api";
import "./AIChatPanel.css";

const SUGGESTIONS = [
  { icon: "🌡️", text: "Is the current temperature suitable for my crop?" },
  { icon: "📈", text: "Does crop quality increase or decrease over time?" },
  { icon: "🛰️", text: "Can you explain how NDVI is calculated?" },
  { icon: "🌾", text: "What is the estimated harvest window for this land?" },
];

const TOPBAR_HEIGHT = 56;
const BOTTOM_NAV_HEIGHT = 60;

function LeafIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M11 20A7 7 0 019 6c.67-.67 1.45-1.12 2.3-1.36" />
      <path d="M13 4c3.5 1.5 6 5 6 9a6 6 0 01-6 6" />
      <path d="M12 22v-4" />
    </svg>
  );
}

function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

export default function AIChatPanel({ landId, onResize, hasBottomNav = false, suppressLauncher = false }) {
  const { isDrawer } = useBreakpoint();
  const confirm = useConfirm();
  const isMobileView = isDrawer;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [mobilePanelHeight, setMobilePanelHeight] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const updateMobileHeight = useCallback(() => {
    const vv = window.visualViewport;
    const bottomOffset = hasBottomNav ? BOTTOM_NAV_HEIGHT : 0;
    const safeBottom = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)") || "0",
      10
    ) || 0;

    if (vv) {
      const avail = Math.max(280, vv.height - TOPBAR_HEIGHT - bottomOffset - safeBottom - 8);
      setMobilePanelHeight(`${avail}px`);
    } else {
      const pct = hasBottomNav ? "72vh" : "82vh";
      setMobilePanelHeight(pct);
    }
  }, [hasBottomNav]);

  useEffect(() => {
    if (!isMobileView) {
      setMobilePanelHeight(null);
      return;
    }
    updateMobileHeight();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateMobileHeight);
      vv.addEventListener("scroll", updateMobileHeight);
      return () => {
        vv.removeEventListener("resize", updateMobileHeight);
        vv.removeEventListener("scroll", updateMobileHeight);
      };
    }
  }, [isMobileView, updateMobileHeight]);

  useEffect(() => {
    onResize?.({ isOpen, width: sidebarWidth, isMobile: isMobileView });
  }, [isOpen, sidebarWidth, isMobileView, onResize]);

  useEffect(() => {
    if (!isMobileView || !isOpen) return;
    const closeIfDrawerOpen = () => {
      const shell = document.querySelector(".app-shell");
      if (shell && !shell.classList.contains("app-shell--collapsed") && isDrawer) {
        setIsOpen(false);
      }
    };
    const shellEl = document.querySelector(".app-shell");
    const observer = shellEl
      ? new MutationObserver(closeIfDrawerOpen)
      : null;
    observer?.observe(shellEl, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", closeIfDrawerOpen);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", closeIfDrawerOpen);
    };
  }, [isDrawer, isOpen, isMobileView]);

  useEffect(() => {
    if (isOpen && !historyLoaded) loadHistory();
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await getAiChatHistory(landId);
      setMessages(res.messages || []);
      setHistoryLoaded(true);
    } catch {
      setError("Could not load chat history.");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg = { role: "user", content: trimmed, message_id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await sendAiChatMessage(landId, trimmed);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.content, message_id: res.message_id },
      ]);
    } catch (err) {
      setError(err.message || "AI service unavailable. Check API keys in Profile settings.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleSuggestionClick = (text) => sendMessage(text);

  const handleClear = async () => {
    const confirmed = await confirm({
      title: "Clear Chat History",
      message: "Clear all chat history for this land?",
      confirmLabel: "Clear",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    await clearAiChatHistory(landId);
    setMessages([]);
    setHistoryLoaded(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResizeStart = (e) => {
    if (isMobileView) return;
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging || isMobileView) return;
    const onMove = (e) => {
      let w = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(620, Math.max(320, w)));
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, isMobileView]);

  // Mobile: full-screen overlay (CSS). Portal escapes topbar stacking context.
  const mobilePanelStyle = isMobileView ? undefined : { width: `${sidebarWidth}px` };

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("ai-chat-open");
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove("ai-chat-open");
    };
  }, [isOpen]);

  const overlay = (
    <>
      {isOpen && (
        <div
          className={`ai-chat-backdrop${!isMobileView ? " ai-chat-backdrop--desktop" : ""}`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "ai-chat-panel",
          isMobileView ? "ai-chat-panel--mobile" : "ai-chat-panel--desktop",
          isMobileView && hasBottomNav ? "ai-chat-panel--above-nav" : "",
          isOpen ? "ai-chat-panel--open" : "ai-chat-panel--closed",
          isDragging ? "ai-chat-panel--dragging" : "",
        ].filter(Boolean).join(" ")}
        style={mobilePanelStyle}
        role="dialog"
        aria-label="AgriMind AI chat"
        aria-hidden={!isOpen}
      >
        {!isMobileView && (
          <div className="ai-chat-resizer" onMouseDown={handleResizeStart} title="Drag to resize">
            <div className="ai-chat-resizer__grip" />
          </div>
        )}

        {isMobileView && (
          <div className="ai-chat-grab">
            <div className="ai-chat-grab__bar" />
          </div>
        )}

        <header className="ai-chat-header">
          <div className="ai-chat-header__brand">
            <div className="ai-chat-header__logo">
              <LeafIcon />
            </div>
            <div className="ai-chat-header__info">
              <div className="ai-chat-header__title">AgriMind</div>
              <div className="ai-chat-header__status">
                <span className="ai-chat-header__status-dot" />
                Land-aware agronomist
              </div>
            </div>
          </div>
          <div className="ai-chat-header__actions">
            <button type="button" className="ai-chat-header__btn" onClick={handleClear} title="Clear history">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Clear
            </button>
            <button
              type="button"
              className="ai-chat-header__btn ai-chat-header__btn--icon ai-chat-header__btn--close"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="ai-chat-messages">
          {loading && (
            <div className="ai-chat-loading">
              <div className="ai-chat-loading__spinner" />
              Loading conversation…
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="ai-chat-welcome">
              <div className="ai-chat-welcome__hero">
                <LeafIcon size={32} />
              </div>
              <h3 className="ai-chat-welcome__title">Your land agronomist</h3>
              <p className="ai-chat-welcome__subtitle">
                I know this land&apos;s NDVI, soil, climate, and crop data. Ask me anything.
              </p>
              <div className="ai-chat-suggestions">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug.text}
                    type="button"
                    className="ai-chat-suggestion"
                    onClick={() => handleSuggestionClick(sug.text)}
                  >
                    <span className="ai-chat-suggestion__icon">{sug.icon}</span>
                    <span className="ai-chat-suggestion__text">{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.message_id}
              className={`ai-chat-msg ai-chat-msg--${msg.role}`}
            >
              {msg.role === "assistant" && (
                <div className="ai-chat-msg__avatar ai-chat-msg__avatar--ai">
                  <LeafIcon size={14} />
                </div>
              )}
              <div
                className={`ai-chat-msg__bubble ai-chat-msg__bubble--${msg.role}`}
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          ))}

          {isTyping && (
            <div className="ai-chat-typing">
              <div className="ai-chat-msg__avatar ai-chat-msg__avatar--ai">
                <LeafIcon size={14} />
              </div>
              <div className="ai-chat-typing__bubble">
                <span className="ai-chat-typing__dot" />
                <span className="ai-chat-typing__dot" />
                <span className="ai-chat-typing__dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="ai-chat-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className={`ai-chat-composer${hasBottomNav && isMobileView ? " ai-chat-composer--above-nav" : ""}`}>
          <div className="ai-chat-composer__wrap">
            <textarea
              ref={inputRef}
              className="ai-chat-composer__input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this land…"
              rows={1}
            />
            <button
              type="button"
              className="ai-chat-composer__send"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          {!isMobileView && (
            <p className="ai-chat-composer__hint">Enter to send · Shift+Enter for new line</p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Launcher stays in-page; overlay is portaled above topbar */}
      <button
        type="button"
        id="ai-chat-toggle"
        className={[
          "ai-chat-launcher",
          isMobileView ? "ai-chat-launcher--mobile" : "ai-chat-launcher--desktop",
          !hasBottomNav && isMobileView ? "ai-chat-launcher--no-nav" : "",
          isOpen || suppressLauncher ? "ai-chat-launcher--hidden" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => setIsOpen(true)}
        aria-label="Open AgriMind AI assistant"
      >
        <span className="ai-chat-launcher__avatar">
          <LeafIcon size={isMobileView ? 18 : 26} />
        </span>
        {isMobileView && (
          <>
            <span className="ai-chat-launcher__text">
              <span className="ai-chat-launcher__title">AgriMind AI</span>
              <span className="ai-chat-launcher__hint">Ask about NDVI, soil, irrigation…</span>
            </span>
            <span className="ai-chat-launcher__chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </span>
          </>
        )}
      </button>

      {typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : overlay}
    </>
  );
}