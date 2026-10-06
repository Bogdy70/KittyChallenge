import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "./api";
import { renderMessage } from "../../shared/messages.mjs";
const MessageContext = createContext({
  messages: {},
  setMessages: () => {},
  ready: true,
  t: (key, params) => renderMessage({}, key, params),
});
export function MessageProvider({ children }) {
  const [messages, setMessages] = useState({}),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api("/content");
        if (active) setMessages(data.messages);
      } catch {
        /* Default copy remains usable when the server is temporarily unavailable. */
      } finally {
        if (active) setReady(true);
      }
    }
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);
  const t = useCallback(
    (key, params) => renderMessage(messages, key, params),
    [messages],
  );
  return (
    <MessageContext.Provider value={{ messages, setMessages, ready, t }}>
      {children}
    </MessageContext.Provider>
  );
}
export const useMessages = () => useContext(MessageContext);
