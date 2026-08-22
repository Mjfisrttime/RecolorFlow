import React from 'react';

export default function PrivacyPolicy() {
    return (
        <div className="flex-1 bg-surface text-on-surface-variant py-12">
            <div className="max-w-4xl mx-auto px-6">
                
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-on-surface mb-4">Privacy Policy</h1>
                    <p className="text-on-surface-variant font-mono text-sm">Last Updated: August 22, 2026</p>
                </div>
                
                <div className="space-y-6">
                    <p className="text-center mb-12 text-lg text-on-surface-variant max-w-2xl mx-auto">
                        RecolorFlow ("we", "us", or "our") respects your privacy. We designed RecolorFlow as a secure, privacy-first utility. This policy explains how we handle your data when you use our website.
                    </p>
                    
                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">1</span>
                            We Do Not Collect or Store Your Files
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            RecolorFlow operates entirely on your local device. When you upload a GIF or image for recoloring, all processing occurs locally within your web browser. <strong className="text-primary font-medium">Your files are never uploaded to our servers, saved in any database, or viewed by us.</strong>
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">2</span>
                            We Do Not Collect Personal Information
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            You are not required to create an account, nor do we request your name, email address, or any other personal information to use RecolorFlow.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">3</span>
                            No Tracking or Cookies
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            We do not use tracking cookies, web beacons, or third-party analytics services (such as Google Analytics) to monitor your behavior on our site.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">4</span>
                            Third-Party Data Sharing
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            Because we collect neither personal data nor files, we have no information to sell, trade, or share with third parties, advertisers, or affiliates.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">5</span>
                            Changes & Contact
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            We may update this Privacy Policy in the future if we add new features. If you have any questions or concerns about this Privacy Policy, please contact us at: <a href="mailto:privacy@recolorflow.com" className="text-primary hover:underline font-medium">privacy@recolorflow.com</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
