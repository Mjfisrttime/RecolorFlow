// src/analytics.js

export const getVisitorId = () => {
    return 'anonymous';
};

export const isReturningVisitor = () => {
    return false;
};

export const trackEvent = (eventName, eventParams = {}) => {
    console.debug(`[Analytics] Event: ${eventName}`, { ...eventParams });
};

export const initAnalytics = () => {
    // No-op
};
