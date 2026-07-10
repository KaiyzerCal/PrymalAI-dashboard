export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => window.location.href = '/'}
          className="mb-8 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Back to Home
        </button>

        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2 text-white">Terms of Service</h1>
          <p className="text-slate-400 mb-8">
            <strong>Effective Date:</strong> June 27, 2026<br />
            <strong>Last Updated:</strong> June 27, 2026
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">1. Agreement to Terms</h2>
          <p>
            These Terms of Service ("Terms") constitute a binding legal agreement between you ("User," "you," or "your") and Prymal AI Inc. ("Company," "we," "us," or "our").
          </p>
          <p>
            By accessing, using, or creating an account on Prymal AI (the "Service"), you:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Acknowledge you have read and understood these Terms</li>
            <li>Agree to be legally bound by these Terms</li>
            <li>Represent that you are at least 18 years old and have authority to enter this agreement</li>
            <li>Agree to comply with all applicable laws and regulations</li>
          </ul>
          <p>If you do not agree to these Terms, do not use the Service.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">2. Use License & Account Responsibility</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.1 License Grant</h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable license to use the Service solely for your personal or business use, in accordance with these Terms.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.2 Restrictions</h3>
          <p>You may NOT:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Reverse engineer, decompile, or disassemble the Service</li>
            <li>Use the Service to access others' Google Workspace or accounts without authorization</li>
            <li>Sell, resell, rent, or lease the Service</li>
            <li>Modify or create derivative works of the Service</li>
            <li>Use the Service for unlawful purposes or to facilitate illegal activity</li>
            <li>Use automated tools (bots, scrapers) to access the Service</li>
            <li>Attempt to disrupt or compromise Service security</li>
            <li>Share your account credentials with others (you are responsible for all activity on your account)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.3 Account Security</h3>
          <p>You are responsible for:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Maintaining the confidentiality of your password</li>
            <li>Notifying us immediately of unauthorized account access</li>
            <li>All activity on your account, whether authorized or not</li>
          </ul>
          <p>We are not liable for unauthorized access resulting from your negligence.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">2.4 Acceptable Use</h3>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Send spam or unsolicited communications</li>
            <li>Impersonate others or misrepresent your identity</li>
            <li>Access or tamper with others' data without authorization</li>
            <li>Create misleading, deceptive, or fraudulent content</li>
            <li>Harass, threaten, or abuse others</li>
            <li>Violate intellectual property rights</li>
            <li>Breach confidentiality agreements</li>
            <li>Violate Google's Terms of Service or Anthropic's Terms of Service</li>
          </ul>
          <p>Violations may result in immediate account suspension and legal action.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">3. Service Tiers & Pricing</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.1 Subscription Plans</h3>

          <table className="w-full border-collapse border border-slate-600 mb-6 text-sm">
            <thead>
              <tr className="bg-slate-900">
                <th className="border border-slate-600 p-3 text-left">Tier</th>
                <th className="border border-slate-600 p-3 text-left">Price</th>
                <th className="border border-slate-600 p-3 text-left">Billing</th>
                <th className="border border-slate-600 p-3 text-left">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Tier 1</strong></td>
                <td className="border border-slate-600 p-3">$17/month</td>
                <td className="border border-slate-600 p-3">Monthly auto-renewal</td>
                <td className="border border-slate-600 p-3">Email management only</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Tier 2</strong></td>
                <td className="border border-slate-600 p-3">$47/month</td>
                <td className="border border-slate-600 p-3">Monthly auto-renewal</td>
                <td className="border border-slate-600 p-3">Email + Calendar + Tasks</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Tier 3</strong></td>
                <td className="border border-slate-600 p-3">$97/month</td>
                <td className="border border-slate-600 p-3">Monthly auto-renewal</td>
                <td className="border border-slate-600 p-3">Tier 2 + Drive + Docs/Sheets/Slides</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Tier 4</strong></td>
                <td className="border border-slate-600 p-3">$147/month</td>
                <td className="border border-slate-600 p-3">Monthly auto-renewal</td>
                <td className="border border-slate-600 p-3">Tier 3 + Meet + Contacts + Photos + GMB</td>
              </tr>
              <tr>
                <td className="border border-slate-600 p-3"><strong>Trial</strong></td>
                <td className="border border-slate-600 p-3">$0 (14 days)</td>
                <td className="border border-slate-600 p-3">Free trial</td>
                <td className="border border-slate-600 p-3">Full access to Tier 1</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.2 Billing Terms</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Billing is monthly, beginning on the date you select a paid tier</li>
            <li>Charges are non-refundable except as required by law</li>
            <li>We bill your payment method on the anniversary date each month</li>
            <li>Failed payments may result in service suspension</li>
            <li>You may cancel anytime; cancellation takes effect at the end of your current billing period</li>
            <li>Price changes take effect 30 days after notice</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.3 Free Trial</h3>
          <ul className="list-disc list-inside mb-4">
            <li>First 14 days are free (Tier 1 access)</li>
            <li>Trial automatically converts to paid unless cancelled</li>
            <li>We send reminder emails before conversion</li>
            <li>No credit card required to start trial</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">3.4 Refund Policy</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Monthly subscriptions are charged in advance and are non-refundable</li>
            <li>Exceptions: If we fail to provide the Service for 30+ days, we may offer a prorated refund</li>
            <li>Refunds must be requested within 30 days of charge</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">4. AI Agent Behavior & Content</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.1 Automated Nature</h3>
          <p>
            The Service uses artificial intelligence (AI) to automate tasks. AI-generated content:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>May contain errors, inaccuracies, or hallucinations</li>
            <li>Is generated based on your input and instructions</li>
            <li>Is not guaranteed to be accurate, complete, or suitable for all uses</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.2 User Responsibility for AI Output</h3>
          <p><strong>You are responsible for:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Reviewing all AI-generated content before approving</li>
            <li>Verifying accuracy of AI suggestions</li>
            <li>Ensuring AI-generated emails, documents, or posts comply with laws and policies</li>
            <li>Modifying or rejecting inappropriate AI suggestions</li>
          </ul>

          <p><strong>We are NOT liable for:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Errors or inaccuracies in AI-generated content</li>
            <li>Harmful, offensive, or inappropriate content generated by the AI</li>
            <li>Consequences of sending, posting, or publishing AI-generated content</li>
            <li>Damage from relying on AI suggestions</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.3 Approval Workflow</h3>
          <ul className="list-disc list-inside mb-4">
            <li>The Service queues AI-generated actions for your approval</li>
            <li><strong>NOTHING is sent or published without your explicit approval</strong></li>
            <li>You review, edit, and approve all external actions before they execute</li>
            <li>You retain full control over what actually happens in your accounts</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">4.4 Prohibited AI Uses</h3>
          <p>You may NOT use the Service to:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Generate fraudulent, deceptive, or illegal content</li>
            <li>Impersonate others or misrepresent identity</li>
            <li>Generate spam or unsolicited communications</li>
            <li>Circumvent security controls or access unauthorized data</li>
            <li>Create content that violates others' rights</li>
          </ul>
          <p>Violations will result in account suspension and may trigger legal action.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">5. Intellectual Property</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.1 Service Ownership</h3>
          <p>
            The Service, including all code, design, features, and functionality, is owned by Prymal AI. You have no ownership rights except as expressly granted in these Terms.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.2 Your Content</h3>
          <ul className="list-disc list-inside mb-4">
            <li><strong>You own</strong> your email drafts, documents, data, and other content you create or upload</li>
            <li><strong>You grant us</strong> the right to access, store, and process your content only to provide the Service</li>
            <li><strong>You remain responsible</strong> for your content and ensure it complies with all laws</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.3 Google Workspace Data</h3>
          <ul className="list-disc list-inside mb-4">
            <li>You own all data in your Google Workspace (Gmail, Drive, Calendar, etc.)</li>
            <li>We access your data solely to provide the Service</li>
            <li>We do NOT claim ownership of your Google data</li>
            <li>When you disconnect or delete your account, we delete our copies (your Google data remains in your account)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">5.4 Feedback</h3>
          <p>Any feedback, suggestions, or improvements you provide to us may be used without compensation or attribution.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">6. Limitation of Liability</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.1 Disclaimer of Warranties</h3>
          <p><strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong></p>
          <p>We disclaim all warranties, express, implied, or statutory, including:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Merchantability</li>
            <li>Fitness for a particular purpose</li>
            <li>Non-infringement</li>
            <li>Accuracy or completeness</li>
            <li>Uninterrupted or error-free operation</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.2 Limitation of Damages</h3>
          <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
          <p>We are NOT liable for:</p>
          <ul className="list-disc list-inside mb-4">
            <li><strong>Direct damages</strong> beyond the amount you paid in the past 12 months (or $100, whichever is less)</li>
            <li><strong>Indirect, incidental, consequential, or punitive damages</strong>, including:
              <ul className="list-disc list-inside ml-4">
                <li>Loss of profits or revenue</li>
                <li>Loss of data</li>
                <li>Business interruption</li>
                <li>Emotional distress</li>
                <li>Reputational harm</li>
                <li>Even if we've been advised of the possibility of such damages</li>
              </ul>
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.3 Exceptions</h3>
          <p>These limitations do not apply to:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Personal injury or death caused by our gross negligence</li>
            <li>Fraud or intentional misconduct</li>
            <li>Violations of applicable consumer protection laws</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">6.4 Mitigation</h3>
          <p>If the Service causes you harm, your sole remedy is to:</p>
          <ol className="list-decimal list-inside mb-4">
            <li>Stop using the Service</li>
            <li>Delete your account</li>
            <li>Seek a refund per Section 3.4</li>
          </ol>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">7. Data & Privacy</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.1 Your Credentials</h3>
          <p>
            When you provide us with your Google OAuth access tokens, your Anthropic API key, or your Google Gemini API key, you are authorizing us to use these credentials ONLY to:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Authenticate requests on your behalf</li>
            <li>Process actions you've explicitly approved</li>
            <li>Maintain service functionality</li>
          </ul>

          <p><strong>You retain full control:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Revoke access anytime from Google Account settings</li>
            <li>Delete API keys anytime from Settings → Integrations</li>
            <li>Disconnect your account anytime</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.2 Data Retention & Deletion</h3>
          <ul className="list-disc list-inside mb-4">
            <li>See our Privacy Policy for detailed data retention terms</li>
            <li>You can delete chat history anytime from your dashboard</li>
            <li>Account deletion permanently removes all your data (see Privacy Policy Section 4)</li>
            <li>Google Workspace data is never copied — only accessed as needed</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.3 No AI Training on Your Data</h3>
          <ul className="list-disc list-inside mb-4">
            <li>We do NOT use your data to train Prymal AI's AI models</li>
            <li>We do NOT use your data to train other AI systems</li>
            <li>Third-party AI providers (Anthropic, Google) may retain data per their own Terms of Service</li>
            <li>You can review their privacy terms and opt out if desired</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">7.4 Privacy Policy</h3>
          <p>
            Our complete <a href="/privacy" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a> governs data collection and use. In the event of conflict between these Terms and the Privacy Policy, the Privacy Policy controls regarding data practices.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">8. Third-Party Services</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">8.1 External Services</h3>
          <p>We integrate with:</p>
          <ul className="list-disc list-inside mb-4">
            <li><strong>Google Workspace</strong> (Gmail, Calendar, Drive, Docs, etc.)</li>
            <li><strong>Anthropic API</strong> (Claude Haiku AI model)</li>
            <li><strong>Google Gemini API</strong> (Gemini 2.0 Flash AI model)</li>
            <li><strong>Supabase</strong> (database and authentication)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">8.2 Your Responsibility</h3>
          <ul className="list-disc list-inside mb-4">
            <li>You are responsible for compliance with each service's Terms of Service</li>
            <li>We are not responsible for third-party service failures, interruptions, or changes</li>
            <li>Third-party services may change their terms or pricing</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">8.3 API Rate Limits</h3>
          <ul className="list-disc list-inside mb-4">
            <li>Anthropic and Google may enforce rate limits on API requests</li>
            <li>If you exceed limits, some features may be unavailable</li>
            <li>We are not liable for third-party rate limiting</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">9. Indemnification</h2>

          <p>
            <strong>You agree to indemnify, defend, and hold harmless Prymal AI, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:</strong>
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Your violation of these Terms</li>
            <li>Your use of the Service</li>
            <li>Content you create or upload</li>
            <li>Your violation of Google's or Anthropic's Terms</li>
            <li>Claims by third parties related to your use</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">10. Termination</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">10.1 Termination by You</h3>
          <p>You may cancel your account anytime by:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Going to Settings → Account → Delete Account</li>
            <li>Emailing support@prymalai.com with "Cancel Account" in subject line</li>
            <li>Cancellation is effective immediately; charges cease at the end of the current billing period</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">10.2 Termination by Us</h3>
          <p>We may suspend or terminate your account if you:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Violate these Terms</li>
            <li>Engage in illegal activity</li>
            <li>Abuse the Service</li>
            <li>Don't pay required fees</li>
            <li>Pose a security risk</li>
          </ul>
          <p>We will attempt to notify you before termination, except in cases of clear abuse.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">10.3 Effect of Termination</h3>
          <p>Upon termination:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Your account is deactivated</li>
            <li>You lose access to the Service</li>
            <li>We retain archived data for 30 days per Privacy Policy</li>
            <li>You retain the right to request data deletion</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">11. Dispute Resolution</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.1 Informal Resolution</h3>
          <p>Before legal action, contact us at support@prymalai.com with:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Clear description of the dispute</li>
            <li>Supporting documentation</li>
            <li>Proposed resolution</li>
          </ul>
          <p>We will attempt to resolve disputes within 30 days.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.2 Governing Law</h3>
          <p>
            These Terms are governed by the laws of your applicable jurisdiction, without regard to conflicts of law principles.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.3 Jurisdiction</h3>
          <p>
            You and Prymal AI agree that any legal action will be handled in accordance with applicable laws, and you consent to jurisdiction where required.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">11.4 Arbitration (Optional)</h3>
          <p>For disputes not resolved informally, either party may elect binding arbitration per the American Arbitration Association (AAA) rules. This means:</p>
          <ul className="list-disc list-inside mb-4">
            <li>No class action lawsuits</li>
            <li>Both parties agree to arbitration instead of court</li>
            <li>Arbitrator's decision is final and binding</li>
            <li>Each party bears their own costs</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">12. Changes to Terms</h2>

          <p>We may modify these Terms at any time by:</p>
          <ul className="list-disc list-inside mb-4">
            <li>Posting the updated Terms on our website</li>
            <li>Sending notice to your registered email</li>
            <li>Updating the "Last Updated" date</li>
          </ul>

          <p>Changes take effect 30 days after posting (14 days for material changes). Your continued use after changes means you accept the new Terms.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">13. General Provisions</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.1 Entire Agreement</h3>
          <p>
            These Terms, along with our <a href="/privacy" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>, constitute the entire agreement between you and Prymal AI regarding the Service.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.2 Severability</h3>
          <p>If any part of these Terms is found unenforceable, the remaining parts remain in effect.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.3 Waiver</h3>
          <p>Failure to enforce any right does not waive that right.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.4 Assignment</h3>
          <p>We may assign these Terms to affiliates or successors. You may not assign without our written consent.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3 text-white">13.5 No Third-Party Beneficiaries</h3>
          <p>These Terms do not create rights for anyone except you and Prymal AI.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">14. Contact Us</h2>

          <p><strong>General Support:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:support@prymalai.com" className="text-cyan-400 hover:text-cyan-300">support@prymalai.com</a></li>
            <li>Response time: Within 48 business hours</li>
          </ul>

          <p><strong>Legal Notices:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:legal@prymalai.com" className="text-cyan-400 hover:text-cyan-300">legal@prymalai.com</a></li>
          </ul>

          <p><strong>Billing Issues:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:billing@prymalai.com" className="text-cyan-400 hover:text-cyan-300">billing@prymalai.com</a></li>
          </ul>

          <p><strong>Security Issues:</strong></p>
          <ul className="list-disc list-inside mb-4">
            <li>Email: <a href="mailto:security@prymalai.com" className="text-cyan-400 hover:text-cyan-300">security@prymalai.com</a></li>
            <li>Do NOT include sensitive information in public emails</li>
          </ul>

          <hr className="border-slate-700 my-12" />

          <p className="text-center text-slate-400">
            <strong>Prymal AI</strong><br />
            Building autonomous AI for Google Workspace<br />
            Last Updated: June 27, 2026
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 text-white">Acknowledgment</h2>
          <p>
            By using Prymal AI, you acknowledge that you have read these Terms of Service and agree to be bound by them. If you have questions, please contact us before using the Service.
          </p>
        </div>
      </div>
    </div>
  )
}
