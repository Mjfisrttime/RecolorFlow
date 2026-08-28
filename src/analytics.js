// src/analytics.js

export const getVisitorId = () => {
    let visitorId = localStorage.getItem('rf_visitor_id');
    if (!visitorId) {
        // Generate a random ID like 'device_1234abcd-...'
        // If crypto.randomUUID is not available, fallback to crypto.getRandomValues
        let newId = '';
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            newId = crypto.randomUUID();
        } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            newId = crypto.getRandomValues(new Uint32Array(4)).join('-');
        } else {
            // As a last resort, fallback to a pseudo-random value
            newId = Math.random().toString(36).substring(2, 15);
        }
        visitorId = 'device_' + newId;
        localStorage.setItem('rf_visitor_id', visitorId);
    }
    return visitorId;
};

export const isReturningVisitor = () => {
    return !!localStorage.getItem('rf_visitor_id');
};

export const initAnalytics = () => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    
    // Prevent tracking on localhost so development testing doesn't pollute live data
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        console.debug('[Analytics] Google Analytics is disabled on localhost to prevent data inflation.');
        return;
    }

    if (gaId && gaId !== 'G-YOUR_MEASUREMENT_ID_HERE') {
        // Generate or retrieve the persistent device ID
        const visitorId = getVisitorId();

        // Inject the Google Analytics script
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        script.async = true;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        window.gtag = gtag; // attach to window so trackEvent can use it
        gtag('js', new Date());
        
        // Pass the persistent device ID to GA4 to prevent user inflation
        gtag('config', gaId, {
            'user_id': visitorId
        });
        
        console.debug(`[Analytics] Initialized Google Analytics with ID: ${gaId}, User ID: ${visitorId}`);
    } else {
        console.debug('[Analytics] Google Analytics is disabled (no valid VITE_GA_MEASUREMENT_ID found).');
    }
};

export const trackEvent = (eventName, eventParams = {}) => {
    console.debug(`[Analytics] Event: ${eventName}`, { ...eventParams });
    if (window.gtag) {
        window.gtag('event', eventName, eventParams);
    }
};
