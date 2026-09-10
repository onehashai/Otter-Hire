import type { Metadata } from "next";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Terms & Conditions — Otter Hire",
  description: "Terms of service governing your use of Otter Hire.",
};

const sections = [
  {
    title: "Acceptance of Terms",
    content: `Otter Hire ("Otter Hire", "We") provides its Service (as defined below) to you through its web site located at otter.bz (the "Site") and any related applications or APIs (together, the "Application"), subject to this Terms of Service agreement ("TOS").

By accepting this TOS or by accessing or using the Service or Site, you acknowledge that you have read, understood, and agree to be bound by this TOS. If you are entering into this TOS on behalf of a company, business, or other legal entity, you represent that you have the authority to bind such entity to this TOS, in which case the terms "you" or "your" shall refer to such entity.

If you do not agree with this TOS, you must not accept it and may not use the Service. Any actions you or your users take on the Service shall be deemed to have occurred on behalf of your legal entity.`,
  },
  {
    title: "Description of Service",
    content: `The "Service" means the Application, all software, data, reports, text, images, sounds, video, and content made available through the Application (collectively referred to as the "Content") and all modifications thereto.

Otter Hire is an open-source Applicant Tracking System (ATS). The source code is available under its applicable open-source licence. Otter Hire reserves the right to alter the Service at any time. Certain features of the Service may not be available in all countries.

The Service is provided on an "as-is" basis. That means the Service may include bugs that impact your ability to use the Service and/or may impact your business. Otter Hire is not liable for your use of the Service.`,
  },
  {
    title: "General Conditions / Access and Use of the Service",
    content: `Otter Hire is an open-source project. The source code is publicly available and licensed under the applicable open-source licence published in the repository. You may self-host, modify, and redistribute the code in accordance with that licence.

Subject to the terms and conditions of this TOS, you may access and use the Service only for lawful purposes and in compliance with all applicable local, state, and national laws.

All rights, title, and interest in and to the Service and its components (excluding open-source components covered by their respective licences) remain with and belong exclusively to Otter Hire.

You are solely responsible for all data, information, feedback, text, content, and other materials that you upload, post, deliver, or otherwise transmit in connection with the Service ("Your Content"). We have the right, but not the obligation, to remove any of Your Content that we determine in our sole discretion to be in violation of this TOS.

You are responsible for maintaining the confidentiality of your login, password, and account, and for all activities that occur under your account.

Otter Hire may collect information about your use of the Service ("Usage Data") for analytics purposes to review, analyse, and optimise the Service.`,
  },
  {
    title: "User Accounts & Authentication",
    content: `To use certain features of the Service, you must register for an account. You may register using an email and password or via third-party OAuth providers such as Google OAuth. When signing up via Google OAuth, you authorize Otter Hire to access your basic profile information (email address, full name, profile picture) solely for account creation, authentication, and security verification.

You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.

You are responsible for safeguarding the credentials you use to access the Service and for any activities or actions under your account. You agree not to disclose your credentials to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorised use of your account.

Otter Hire reserves the right to disable any user account at any time if, in our reasonable opinion, you have failed to comply with any of the provisions of this TOS.`,
  },
  {
    title: "Intellectual Property",
    content: `The Service and its original content (excluding Your Content and open-source components), features, and functionality are and will remain the exclusive property of Otter Hire and its licensors. The Service is protected by copyright, trademark, and other laws of India and foreign countries.

Open-source components used in or alongside the Service are subject to their respective licences, which are listed in the project repository. Nothing in this TOS grants you any rights in those components beyond what is provided by their licences.

You will not remove, alter, or obscure any copyright, trademark, service mark, or other proprietary rights notices incorporated in or accompanying the Service.`,
  },
  {
    title: "Representations and Warranties",
    content: `You represent and warrant to Otter Hire that:

(i) you have full power and authority to enter into this TOS;
(ii) you own all Your Content or have obtained all permissions, releases, rights, or licences required to engage in your activities in connection with the Service;
(iii) Your Content and other activities in connection with the Service do not and will not violate, infringe, or misappropriate any third party's copyright, trademark, right of privacy, or other personal or proprietary right, nor does Your Content contain any matter that is defamatory, obscene, unlawful, threatening, abusive, tortious, offensive, or harassing;
(iv) you will comply with all applicable local, state, national, and international laws; and
(v) you are eighteen (18) years of age or older.`,
  },
  {
    title: "Termination",
    content: `You have the right to terminate your account at any time in accordance with the procedures set forth on the Site.

Otter Hire reserves the right to (i) modify or discontinue, temporarily or permanently, the Service (or any part thereof) and (ii) refuse any and all current and future use of the Service, suspend or terminate your account, or remove any of Your Content in the Service for any reason, including if Otter Hire believes that you have violated this TOS.

All of Your Content on the Service (if any) may be permanently deleted by Otter Hire upon any termination of your account. Otter Hire will use good-faith efforts to contact you prior to suspension or termination of your account.`,
  },
  {
    title: "Disclaimer of Warranties",
    content: `THE SERVICE, INCLUDING THE SITE, CONTENT, AND ALL SERVER AND NETWORK COMPONENTS, ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND. OTTER EXPRESSLY DISCLAIMS ANY AND ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, TITLE, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

YOU ACKNOWLEDGE THAT OTTER DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, ERROR-FREE, OR VIRUS-FREE.`,
  },
  {
    title: "Limitation of Liability",
    content: `UNDER NO CIRCUMSTANCES AND UNDER NO LEGAL THEORY (WHETHER IN CONTRACT, TORT, OR OTHERWISE) SHALL OTTER BE LIABLE TO YOU OR ANY THIRD PARTY FOR (a) ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION, OR (b) FOR ANY DIRECT DAMAGES, COSTS, LOSSES, OR LIABILITIES IN EXCESS OF ONE HUNDRED ($100) US DOLLARS.

Some jurisdictions do not allow the exclusion of implied warranties or limitation of liability for incidental or consequential damages, which means that some of the above limitations may not apply to you. In these jurisdictions, Otter Hire's liability will be limited to the greatest extent permitted by law.`,
  },
  {
    title: "Indemnification",
    content: `You shall defend, indemnify, and hold harmless Otter Hire from and against any claims, actions, or demands, including without limitation reasonable legal and accounting fees, arising or resulting from your breach of this TOS, any of Your Content, or your other access, contribution to, use, or misuse of the Service.

Otter Hire shall provide notice to you of any such claim, suit, or demand. Otter Hire reserves the right to assume the exclusive defence and control of any matter subject to indemnification under this section, in which case you agree to cooperate with any reasonable requests assisting Otter Hire's defence of such matter.`,
  },
  {
    title: "Modifications",
    content: `Otter Hire may change this TOS from time to time with at least 30 days' prior notice. The revised terms and conditions will be posted on the Service. If you use the Service within 30 days after the notice has been posted, your use will constitute acceptance of the revised terms. If any change to this TOS is not acceptable to you, your only remedy is to stop accessing and using the Service.`,
  },
  {
    title: "Assignment",
    content: `You may not assign this TOS without the prior written consent of Otter Hire, but Otter Hire may assign or transfer this TOS, in whole or in part, without restriction.`,
  },
  {
    title: "Governing Law",
    content: `This TOS shall be governed by and construed in accordance with the laws in force in India without regard to the principles of conflict of laws. Unless otherwise elected by Otter Hire in a particular instance, you hereby expressly agree to submit to the exclusive personal jurisdiction of the courts in India for the purpose of resolving any dispute relating to your access to or use of the Service.`,
  },
  {
    title: "Arbitration",
    content: `The parties agree that any dispute with respect to any matter covered under this TOS, including any question regarding its existence, validity, or termination, will be submitted to mandatory, final, and binding arbitration in India, in accordance with the Arbitration and Conciliation Act, 1996.

The arbitral tribunal shall consist of a sole arbitrator appointed mutually by both parties. In case the parties do not agree upon a sole arbitrator within 30 days, any party may approach a competent court of jurisdiction to request appointment of a sole arbitrator.

The language of the arbitration shall be English. Each party shall bear its own attorney's fees and expenses, and fees of the arbitrator shall be borne equally by the parties.`,
  },
  {
    title: "Privacy",
    content: `Please visit our Privacy Policy page to understand how Otter Hire collects and uses personal information. By using the Service, you acknowledge and agree to the collection and use of your data as described in our Privacy Policy.`,
  },
  {
    title: "Confidentiality",
    content: `By virtue of your use of the Service, the parties may have access to each other's Confidential Information. "Confidential Information" means any information that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.

Confidential Information shall not include information that: (a) is or becomes publicly known through no act or omission of the receiving party; (b) was in the receiving party's lawful possession prior to the disclosure; (c) is rightfully disclosed to the receiving party by a third party without restriction; or (d) is independently developed by the receiving party.

You shall not make Otter Hire's Confidential Information available to any third party or use it for any purposes other than exercising your rights and performing your obligations under this TOS. This obligation survives termination of your use of the Service.`,
  },
  {
    title: "Notice",
    content: `You agree that Otter Hire may communicate electronically with you for any matters relating to the Service, including product updates, legal notices, and account notifications, unless prohibited by law. Any notices to be provided to you under this TOS shall be sent by electronic mail to the last email address that we have on file for you.`,
  },
  {
    title: "Contact",
    content: `If you have any questions or comments about these Terms of Use, please contact us at support@otter.bz.

YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF USE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM. YOU FURTHER AGREE THAT THEY CONSTITUTE THE COMPLETE AND EXCLUSIVE STATEMENT OF THE AGREEMENT BETWEEN YOU AND OTTER WHICH SUPERSEDES ANY PROPOSED OR PRIOR AGREEMENT, ORAL OR WRITTEN, AND ANY OTHER COMMUNICATIONS BETWEEN YOU AND OTTER RELATING TO YOUR USE OF THE SERVICE.`,
  },
];

export default function TermsPage() {
  return (
    <div className="marketing-root min-h-screen bg-white text-foreground">
      <MarketingNav onLegalPage />

      {/* Hero */}
      <div className="border-b border-black/6 bg-[#f7f8fc] px-4 pt-32 pb-14 text-center sm:pt-36 sm:pb-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Terms &amp; Conditions
        </h1>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-12 rounded-2xl border border-black/8 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          Please read these Terms and Conditions carefully before using the Otter Hire Service. By
          accessing or using the Service you agree to be bound by these Terms. If you disagree with
          any part of these Terms, you may not access the Service.
        </div>

        <div className="space-y-12">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-slate-900">
                {i + 1}. {section.title}
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-slate-600">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfd_100%)] px-4 pb-6 sm:px-6">
        <MarketingFooter />
      </div>
    </div>
  );
}
