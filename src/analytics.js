// src/analytics.js

export const getVisitorId = () => {
    // Return existing if already computed in this session
    if (window.__visitor_id) {
        return window.__visitor_id;
    }
    
    try {
        let id = localStorage.getItem('recolorflow_visitor_id');
        if (!id) {
            // Generate UUID if crypto.randomUUID is available, else fallback
            id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('recolorflow_visitor_id', id);
        }
        window.__visitor_id = id;
        return id;
    } catch (e) {
        // Fallback for when localStorage is not available (e.g. Incognito)
        if (!window.__visitor_id) {
            window.__visitor_id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'temp-' + Math.random().toString(36).substring(2, 15);
        }
        return window.__visitor_id;
    }
};

export const isReturningVisitor = () => {
    if (typeof window.__is_new_visitor !== 'undefined') {
        return !window.__is_new_visitor;
    }
    try {
        return !!localStorage.getItem('recolorflow_visitor_id');
    } catch (e) {
        return false;
    }
};

export const trackEvent = (eventName, eventParams = {}) => {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            ...eventParams,
            visitor_id: getVisitorId()
        });
    } else {
        console.debug(`[Analytics] Event: ${eventName}`, { ...eventParams, visitor_id: getVisitorId() });
    }
};

export const initAnalytics = () => {
    // Initial call just to make sure visitor_id is generated and stored
    getVisitorId();
};
