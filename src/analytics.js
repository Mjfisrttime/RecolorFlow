// src/analytics.js

export const getVisitorId = () => {
    return 'anonymous';
};

export const isReturningVisitor = () => {
    return false;
};

export const initAnalytics = () => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    
    if (gaId && gaId !== 'G-YOUR_MEASUREMENT_ID_HERE') {
        // Inject the Google Analytics script
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        script.async = true;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        window.gtag = gtag; // attach to window so trackEvent can use it
        gtag('js', new Date());
        gtag('config', gaId);
        
        console.debug(`[Analytics] Initialized Google Analytics with ID: ${gaId}`);
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
