# Nava Form-Filling Assistant — User Guide

A guide for users of the Form-Filling Assistant, an AI-powered tool that helps fill out benefit application forms on the web.

## Why this matters
Many low-income families do not get access to critical public benefits, struggling to navigate and complete complex multi-portal requirements. In 2022, American families left $228 billion in unclaimed benefits across 7 major programs. Current AI tools help with eligibility discovery but stop short of the most time-intensive challenge: actually completing applications across multiple benefits programs.

This tool supports caseworkers with this laborious task — allowing them to focus more time and energy on the human element of helping clients.

[Learn more about the Form-Filling Assistant](https://www.navapbc.com/labs/caseworker-ai-tools/form-filling-assistant) and other AI products within the [Caseworker Empowerment Toolkit](https://www.navapbc.com/labs/caseworker-ai-tools) from [Nava Labs](https://www.navapbc.com/labs).   

---

## Table of Contents

- [Signing In](#signing-in)
- [The Chat Interface](#the-chat-interface)
- [Starting a Form-Filling Session](#starting-a-form-filling-session)
- [How Form Filling Works](#how-form-filling-works)
- [Gap Analysis](#gap-analysis)
- [Reviewing and Confirming Submissions](#reviewing-and-confirming-submissions)
- [Chat History](#chat-history)
- [Tips & Best Practices](#tips--best-practices)

---



## Signing In

The application supports multiple ways to sign in:

- **Google** — Use your Google account
- **Microsoft** — Use your Microsoft organizational account (Entra ID / Azure AD)

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

1. **Plug in your ID and select an application from the drop down** — Include the participant's name or ID and select the program they're applying for from the drop down menu.

2. **Type a request** — Describe what form you need help filling out. Include the participant's ID, the program they're applying for, and the website URL.

   Example: *"Help participant ID 123456 apply for WIC at https://www.ruhealth.org/appointments/apply-4-wic-form#"*

---

## How Form Filling Works

Once you describe the task, the AI assistant takes over the form-filling process:

1. **Data retrieval** — The assistant connects to an API to access the client database and pulls participant information to pre-fill form fields.

2. **Browser automation** — A remote browser opens and navigates to the target website. You can watch the assistant interact with the form in real time through the live browser view.

3. **Form interaction** — The assistant can:
   - Navigate to websites and follow links
   - Fill in text fields (names, addresses, dates, etc.)
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
- Ask the assistant to make corrections if anything looks wrong or make edits directly 
- Stop the process at any time by clicking the **Stop** button

Note: Never assume a form has been submitted, the assistant has been configured to not submit the form itself. 

---

## Chat History

Your past sessions are listed in the sidebar, ordered by date

Scroll down in the sidebar to load more sessions. To delete a session, hover over it and click the delete option.

---

## Tips & Best Practices

- **Be specific** — Include the participant's ID, the benefit program, and the website URL when starting a session.
- **Watch the browser** — Follow along in the live browser view so you can catch any issues early.
- **Respond to gap analysis** — When the assistant reports missing information, provide it promptly so the form can be completed accurately.
- **Review before submitting** — Always check the filled form in the take control view before confirming submission.
- **Report issues** — Send feedback to the Nava team inbox.
