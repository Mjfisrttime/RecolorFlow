import React from 'react';

export default function TermsOfService() {
    return (
        <div className="flex-1 bg-surface text-on-surface-variant py-12">
            <div className="max-w-4xl mx-auto px-6">
                
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-on-surface mb-4">Terms of Service</h1>
                    <p className="text-on-surface-variant font-mono text-sm">Last Updated: August 22, 2026</p>
                </div>
                
                <div className="space-y-6">
                    <p className="text-center mb-12 text-lg text-on-surface-variant max-w-2xl mx-auto">
                        Welcome to RecolorFlow. By accessing our website and utilizing our tools, you agree to comply with and be bound by the following terms and conditions of use.
                    </p>
                    
                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">1</span>
                            Description of Service
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            RecolorFlow provides a web-based utility for the bulk recoloring of digital assets, such as GIFs and images. All processing is executed locally within your web browser. We do not host, store, or distribute your processed files.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">2</span>
                            User Responsibilities & Copyright
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            You are solely responsible for the images and GIFs you process using RecolorFlow. You affirm that you possess the necessary rights, licenses, or permissions to modify the files you upload into your browser. RecolorFlow assumes no responsibility for any copyright infringement resulting from your use of the tool.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">3</span>
                            Prohibited Uses
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            You agree not to use RecolorFlow for any unlawful purpose or in any manner that violates the rights of others. This includes utilizing the tool to forge, falsify, or maliciously alter documents or images with the intent to deceive.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">4</span>
                            Disclaimer of Warranties
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            The service is provided on an <strong className="text-on-surface">"AS IS"</strong> and <strong className="text-on-surface">"AS AVAILABLE"</strong> basis. RecolorFlow makes no warranties, expressed or implied, regarding the accuracy, reliability, or availability of the tool. We cannot guarantee that the service will be uninterrupted or entirely error-free.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">5</span>
                            Limitation of Liability
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            In no event shall RecolorFlow or its creators be held liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the service. This includes any loss of data or work resulting from browser crashes during file processing.
                        </p>
                    </div>

                    <div className="space-y-3 bg-surface-container-low p-8 rounded-2xl border border-outline-variant hover:border-outline transition-colors">
                        <h3 className="text-xl font-bold text-on-surface flex items-center gap-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">6</span>
                            Changes to Terms
                        </h3>
                        <p className="text-base leading-relaxed pl-12 text-on-surface-variant">
                            We reserve the right to modify these Terms of Service at any time. Any changes will become effective immediately upon posting to this page. Your continued use of the tool constitutes your acceptance of the revised terms. For questions, please contact us at: <a href="mailto:terms@recolorflow.com" className="text-primary hover:underline font-medium">terms@recolorflow.com</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
