# ASP Form-Filling Assistant — User Guide

A guide for users of the ASP Form-Filling Assistant, an AI-powered tool that helps fill out benefit application forms on the web.

---

## Table of Contents

- [Signing In](#signing-in)
- [The Chat Interface](#the-chat-interface)
- [Starting a Form-Filling Session](#starting-a-form-filling-session)
- [How Form Filling Works](#how-form-filling-works)
- [Gap Analysis](#gap-analysis)
- [Reviewing and Confirming Submissions](#reviewing-and-confirming-submissions)
- [Chat History](#chat-history)
- [Sharing Sessions](#sharing-sessions)
- [Message Feedback](#message-feedback)
- [Tips & Best Practices](#tips--best-practices)

---

## Signing In

The application supports multiple ways to sign in:

- **Google** — Use your Google account
- **Microsoft** — Use your Microsoft organizational account (Entra ID / Azure AD)
- **Email & Password** — Use credentials provided by your administrator

Your administrator may restrict sign-ins to specific email domains. If you receive an error during login, confirm your email address is on the approved list.

After signing in, you'll land on the home page where you can start a new session or continue a previous one.

---

## The Chat Interface

The main screen has two areas:

- **Sidebar (left)** — Your session history, organized by date. Click any previous session to reopen it.
- **Chat area (right)** — Where you interact with the AI assistant. When browser automation is active, a live browser view appears alongside the chat.

On mobile devices, the sidebar is hidden by default. Tap the menu icon to open it.

---

## Starting a Form-Filling Session

There are two ways to begin:

1. **Type a request** — Describe what form you need help filling out. Include the participant's name or ID, the program they're applying for, and the website URL.

   Example: *"Help participant Elodi Thomas apply for WIC at ruhealth.org"*

2. **Use a suggested action** — When starting a new session, you may see example prompts you can click to get started quickly. These are pre-configured with sample participants and applications.

---

## How Form Filling Works

Once you describe the task, the AI assistant takes over the form-filling process:

1. **Data retrieval** — The assistant pulls participant information from the case management system (Apricot) to pre-fill form fields.

2. **Browser automation** — A remote browser opens and navigates to the target website. You can watch the assistant interact with the form in real time through the live browser view.

3. **Form interaction** — The assistant can:
   - Navigate to websites and follow links
   - Fill in text fields (names, addresses, dates, SSNs, etc.)
   - Select options from dropdowns
   - Check and uncheck boxes
   - Click buttons to advance through multi-step forms
   - Handle page navigation and redirects

4. **Progress updates** — The assistant communicates what it's doing at each step, so you can follow along in the chat.

---

## Gap Analysis

If the assistant cannot find all the information needed to complete a form, it performs a **gap analysis**:

- It identifies which form fields could not be filled with available data
- It reports the missing information to you in the chat
- You can provide the missing details, and the assistant will continue filling the form

This ensures no required fields are left blank or filled with incorrect data.

---

## Reviewing and Confirming Submissions

The assistant will **always ask for your confirmation before submitting any form**. You remain in control throughout the process:

- Review the filled form in the live browser view before confirming
- Ask the assistant to make corrections if anything looks wrong
- Stop the process at any time by clicking the **Stop** button

Never assume a form has been submitted without your explicit approval.

---

## Chat History

Your past sessions are listed in the sidebar, grouped by date:

- **Today**
- **Yesterday**
- **Last Week**
- **Last Month**
- **Older**

Scroll down in the sidebar to load more sessions. To delete a session, hover over it and click the delete option.

---

## Sharing Sessions

You can share session content with colleagues using shared links:

- Shared links are generated as short, encrypted URLs
- Links expire after a set time period
- Recipients must sign in to view the shared content
- When someone opens a shared link, the content loads into their chat automatically

This is useful for handing off an in-progress application or sharing results with a team member.

---

## Message Feedback

You can provide feedback on the assistant's responses by clicking the thumbs-up or thumbs-down icons that appear when you hover over a message. This feedback helps improve the quality of the assistant over time.

---

## Tips & Best Practices

- **Be specific** — Include the participant's name or ID, the benefit program, and the website URL when starting a session.
- **Watch the browser** — Follow along in the live browser view so you can catch any issues early.
- **Respond to gap analysis** — When the assistant reports missing information, provide it promptly so the form can be completed accurately.
- **Review before submitting** — Always check the filled form in the browser view before confirming submission.
- **One form at a time** — Start a new session for each form or application to keep things organized.
- **Report issues** — Use the thumbs-down button on any response that seems incorrect so the team can improve the assistant.
