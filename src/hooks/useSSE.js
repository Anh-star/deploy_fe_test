import { useEffect, useRef } from 'react';
import { getAccessToken } from '../api/tokenStorage';

// Shared state for all useSSE hook instances
let globalEventSource = null;
let activeToken = null;
let reconnectTimeout = null;
let refCount = 0; // Number of active hook consumers

// Map: eventName -> Set of callback functions
const eventListenersMap = new Map();
// Set of event names currently attached to globalEventSource
const attachedEvents = new Set();

function attachEventListener(es, eventName) {
  if (attachedEvents.has(eventName)) return;
  attachedEvents.add(eventName);

  es.addEventListener(eventName, (e) => {
    const callbacks = eventListenersMap.get(eventName);
    if (!callbacks || callbacks.size === 0) return;
    try {
      const data = JSON.parse(e.data);
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SSE] Listener error for ${eventName}:`, err);
        }
      });
    } catch (err) {
      console.error(`[SSE] Parse error for ${eventName}:`, err);
    }
  });
}

function connectSSE() {
  const token = getAccessToken();
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
  const url = token
    ? `${apiBase}/notifications/subscribe?token=${encodeURIComponent(token)}`
    : `${apiBase}/notifications/subscribe`;

  if (globalEventSource) {
    if (activeToken === token) {
      // Re-attach any missing event listeners to existing EventSource
      eventListenersMap.forEach((_, eventName) => {
        attachEventListener(globalEventSource, eventName);
      });
      return;
    }
    // Token changed, close old connection
    globalEventSource.close();
    globalEventSource = null;
    attachedEvents.clear();
  }

  activeToken = token;

  try {
    const es = new EventSource(url);
    globalEventSource = es;

    es.addEventListener('INIT', () => {
      // Connected successfully
    });

    // Attach all currently registered event names
    eventListenersMap.forEach((_, eventName) => {
      attachEventListener(es, eventName);
    });

    es.onerror = () => {
      es.close();
      if (globalEventSource === es) {
        globalEventSource = null;
        attachedEvents.clear();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        if (refCount > 0) {
          connectSSE();
        }
      }, 5000);
    };
  } catch (err) {
    console.error('[SSE] Failed to initialize EventSource:', err);
  }
}

function disconnectSSE() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (globalEventSource) {
    globalEventSource.close();
    globalEventSource = null;
    activeToken = null;
    attachedEvents.clear();
  }
}

/**
 * Hook to subscribe to SSE real-time notifications and comment broadcasts using a single shared EventSource connection.
 * @param {Object} listeners - Map of event names to listener functions e.g. { notification: fn, 'new-comment': fn }
 * @param {boolean} enabled - Whether subscription is active
 */
export function useSSE(listeners = {}, enabled = true) {
  const listenersRef = useRef(listeners);
  listenersRef.current = listeners;

  useEffect(() => {
    if (!enabled) return;

    refCount++;
    connectSSE();

    // Register callbacks
    const registered = [];
    Object.keys(listenersRef.current).forEach((eventName) => {
      const callbackWrapper = (data) => {
        if (listenersRef.current[eventName]) {
          listenersRef.current[eventName](data);
        }
      };
      if (!eventListenersMap.has(eventName)) {
        eventListenersMap.set(eventName, new Set());
      }
      eventListenersMap.get(eventName).add(callbackWrapper);
      registered.push({ eventName, callbackWrapper });

      if (globalEventSource) {
        attachEventListener(globalEventSource, eventName);
      }
    });

    return () => {
      // Unregister callbacks
      registered.forEach(({ eventName, callbackWrapper }) => {
        const set = eventListenersMap.get(eventName);
        if (set) {
          set.delete(callbackWrapper);
          if (set.size === 0) {
            eventListenersMap.delete(eventName);
          }
        }
      });

      if (--refCount <= 0) {
        refCount = 0;
        disconnectSSE();
      }
    };
  }, [enabled]);
}

