/**
 * lib/twenty/object-definitions.ts — Twenty Custom Object Definitions
 * Phase 39: Central registry of all 20 NKS custom objects for Twenty CRM.
 * Used by deploy-objects.ts and bidirectional sync engine.
 *
 * 14 NEW objects (Stream 0) + 6 existing (subscription, paymentRecord,
 * creditDispute, enrollment, supportTicket, activity from Phase 33).
 */

export interface TwentyFieldDef {
  name: string;
  type: "text" | "number" | "boolean" | "datetime" | "url" | "email" | "phone" | "currency" | "select";
  label: string;
  options?: { value: string; label: string; color: string }[];
  defaultValue?: unknown;
  required?: boolean;
}

export interface TwentyObjectDef {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description: string;
  icon: string;
  fields: TwentyFieldDef[];
  relations?: { name: string; targetObject: string; type: "many_to_one" | "one_to_many" }[];
}

// ── 14 NEW OBJECTS ──────────────────────────────────────────────────

export const leadObject: TwentyObjectDef = {
  nameSingular: "Lead", namePlural: "Leads",
  labelSingular: "Lead", labelPlural: "Leads",
  description: "Sales lead before enrollment",
  icon: "IconTarget",
  fields: [
    { name: "source", type: "select", label: "Source", options: [
      { value: "haley_ai", label: "Haley AI", color: "blue" },
      { value: "slack", label: "Slack Submission", color: "green" },
      { value: "referral", label: "Referral", color: "purple" },
      { value: "ads", label: "Ads", color: "orange" },
      { value: "organic", label: "Organic", color: "teal" },
      { value: "manual", label: "Manual", color: "gray" },
    ], defaultValue: "manual" },
    { name: "status", type: "select", label: "Status", options: [
      { value: "new", label: "New", color: "blue" },
      { value: "contacted", label: "Contacted", color: "yellow" },
      { value: "consultation", label: "Consultation Scheduled", color: "orange" },
      { value: "proposal", label: "Proposal Sent", color: "purple" },
      { value: "negotiation", label: "Negotiation", color: "pink" },
      { value: "enrolled", label: "Enrolled", color: "green" },
      { value: "lost", label: "Lost", color: "red" },
    ], defaultValue: "new" },
    { name: "pipelineStage", type: "select", label: "Pipeline Stage", options: [
      { value: "new_lead", label: "New Lead", color: "blue" },
      { value: "contacted", label: "Contacted", color: "yellow" },
      { value: "in_progress", label: "In Progress", color: "orange" },
      { value: "enrolled", label: "Enrolled", color: "green" },
      { value: "lost", label: "Lost", color: "red" },
    ], defaultValue: "new_lead" },
    { name: "estimatedValue", type: "currency", label: "Estimated Monthly Value" },
    { name: "creditScoreRange", type: "select", label: "Credit Score Range", options: [
      { value: "excellent", label: "Excellent (720+)", color: "green" },
      { value: "good", label: "Good (680-719)", color: "teal" },
      { value: "fair", label: "Fair (620-679)", color: "yellow" },
      { value: "poor", label: "Poor (580-619)", color: "orange" },
      { value: "very_poor", label: "Very Poor (<580)", color: "red" },
    ] },
    { name: "interestLevel", type: "select", label: "Interest Level", options: [
      { value: "hot", label: "Hot", color: "red" },
      { value: "warm", label: "Warm", color: "orange" },
      { value: "cold", label: "Cold", color: "blue" },
    ], defaultValue: "warm" },
    { name: "lastContactDate", type: "datetime", label: "Last Contact Date" },
    { name: "nextFollowUpDate", type: "datetime", label: "Next Follow-up Date" },
    { name: "notes", type: "text", label: "Notes" },
    { name: "conversionProbability", type: "number", label: "Conversion Probability %", defaultValue: 0 },
    { name: "slaLapsed", type: "boolean", label: "SLA Lapsed", defaultValue: false },
  ],
  relations: [
    { name: "person", targetObject: "person", type: "many_to_one" },
    { name: "assignedAgent", targetObject: "workspaceMember", type: "many_to_one" },
  ],
};

export const vapiCallObject: TwentyObjectDef = {
  nameSingular: "VapiCall", namePlural: "VapiCalls",
  labelSingular: "VAPI Call", labelPlural: "VAPI Calls",
  description: "Voice AI call log via VAPI",
  icon: "IconPhone",
  fields: [
    { name: "callType", type: "select", label: "Call Type", options: [
      { value: "outbound", label: "Outbound", color: "blue" },
      { value: "inbound", label: "Inbound", color: "green" },
    ] },
    { name: "status", type: "select", label: "Status", options: [
      { value: "queued", label: "Queued", color: "gray" },
      { value: "ringing", label: "Ringing", color: "blue" },
      { value: "in_progress", label: "In Progress", color: "yellow" },
      { value: "completed", label: "Completed", color: "green" },
      { value: "failed", label: "Failed", color: "red" },
      { value: "no_answer", label: "No Answer", color: "orange" },
      { value: "busy", label: "Busy", color: "red" },
      { value: "canceled", label: "Canceled", color: "gray" },
    ] },
    { name: "durationSeconds", type: "number", label: "Duration (seconds)" },
    { name: "vapiCallId", type: "text", label: "VAPI Call ID" },
    { name: "fromNumber", type: "phone", label: "From Number" },
    { name: "toNumber", type: "phone", label: "To Number" },
    { name: "transcriptUrl", type: "url", label: "Transcript URL" },
    { name: "recordingUrl", type: "url", label: "Recording URL" },
    { name: "outcome", type: "select", label: "Outcome", options: [
      { value: "interested", label: "Interested", color: "green" },
      { value: "not_interested", label: "Not Interested", color: "red" },
      { value: "call_back", label: "Call Back", color: "yellow" },
      { value: "voicemail", label: "Voicemail", color: "blue" },
      { value: "wrong_number", label: "Wrong Number", color: "orange" },
      { value: "dnc", label: "Do Not Call", color: "red" },
    ] },
    { name: "cost", type: "currency", label: "Cost" },
    { name: "sentiment", type: "select", label: "Sentiment", options: [
      { value: "positive", label: "Positive", color: "green" },
      { value: "neutral", label: "Neutral", color: "gray" },
      { value: "negative", label: "Negative", color: "red" },
    ] },
    { name: "agentName", type: "text", label: "Agent Name" },
    { name: "campaignId", type: "text", label: "Campaign ID" },
    { name: "retryCount", type: "number", label: "Retry Count", defaultValue: 0 },
  ],
  relations: [
    { name: "person", targetObject: "person", type: "many_to_one" },
  ],
};

export const agreementObject: TwentyObjectDef = {
  nameSingular: "Agreement", namePlural: "Agreements",
  labelSingular: "Agreement", labelPlural: "Agreements",
  description: "Customer agreement / contract",
  icon: "IconFileText",
  fields: [
    { name: "type", type: "select", label: "Type", options: [
      { value: "enrollment", label: "Enrollment Agreement", color: "blue" },
      { value: "payment_auth", label: "Payment Authorization", color: "green" },
      { value: "credit_pull", label: "Credit Pull Authorization", color: "purple" },
      { value: "cancellation", label: "Cancellation", color: "red" },
    ] },
    { name: "status", type: "select", label: "Status", options: [
      { value: "draft", label: "Draft", color: "gray" },
      { value: "sent", label: "Sent for Signature", color: "yellow" },
      { value: "signed", label: "Signed", color: "green" },
      { value: "expired", label: "Expired", color: "red" },
      { value: "voided", label: "Voided", color: "orange" },
    ], defaultValue: "draft" },
    { name: "documentUrl", type: "url", label: "Document URL" },
    { name: "signedAt", type: "datetime", label: "Signed At" },
    { name: "expiresAt", type: "datetime", label: "Expires At" },
    { name: "esignatureId", type: "text", label: "E-Signature ID" },
    { name: "ipAddress", type: "text", label: "Signer IP Address" },
    { name: "termsHash", type: "text", label: "Terms Hash" },
    { name: "version", type: "text", label: "Template Version" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const paymentMethodObject: TwentyObjectDef = {
  nameSingular: "PaymentMethod", namePlural: "PaymentMethods",
  labelSingular: "Payment Method", labelPlural: "Payment Methods",
  description: "Customer payment method (NMI vault link — SACRED)",
  icon: "IconCreditCard",
  fields: [
    { name: "type", type: "select", label: "Type", options: [
      { value: "credit_card", label: "Credit Card", color: "blue" },
      { value: "debit_card", label: "Debit Card", color: "green" },
      { value: "ach", label: "ACH / Bank", color: "purple" },
    ] },
    { name: "lastFour", type: "text", label: "Last 4 Digits" },
    { name: "brand", type: "text", label: "Card Brand" },
    { name: "expiryMonth", type: "number", label: "Expiry Month" },
    { name: "expiryYear", type: "number", label: "Expiry Year" },
    { name: "isDefault", type: "boolean", label: "Default", defaultValue: false },
    { name: "isActive", type: "boolean", label: "Active", defaultValue: true },
    { name: "nmiVaultId", type: "text", label: "NMI Vault ID (SACRED)" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const billingRecoveryTaskObject: TwentyObjectDef = {
  nameSingular: "BillingRecoveryTask", namePlural: "BillingRecoveryTasks",
  labelSingular: "Recovery Task", labelPlural: "Recovery Tasks",
  description: "Payment recovery task for declined/failed payments",
  icon: "IconAlertTriangle",
  fields: [
    { name: "status", type: "select", label: "Status", options: [
      { value: "pending", label: "Pending", color: "yellow" },
      { value: "in_progress", label: "In Progress", color: "blue" },
      { value: "recovered", label: "Recovered", color: "green" },
      { value: "failed", label: "Failed", color: "red" },
      { value: "canceled", label: "Canceled", color: "gray" },
    ], defaultValue: "pending" },
    { name: "amountDue", type: "currency", label: "Amount Due" },
    { name: "daysPastDue", type: "number", label: "Days Past Due" },
    { name: "retryCount", type: "number", label: "Retry Count", defaultValue: 0 },
    { name: "maxRetries", type: "number", label: "Max Retries", defaultValue: 3 },
    { name: "nextRetryDate", type: "datetime", label: "Next Retry Date" },
    { name: "lastPaymentAttempt", type: "datetime", label: "Last Attempt" },
    { name: "declineCode", type: "text", label: "Decline Code" },
    { name: "declineReason", type: "text", label: "Decline Reason" },
    { name: "recoveryMethod", type: "select", label: "Method", options: [
      { value: "auto_retry", label: "Auto Retry", color: "blue" },
      { value: "sms_reminder", label: "SMS Reminder", color: "green" },
      { value: "email_reminder", label: "Email Reminder", color: "purple" },
      { value: "phone_call", label: "Phone Call", color: "orange" },
      { value: "manual", label: "Manual", color: "gray" },
    ] },
    { name: "resolution", type: "text", label: "Resolution Notes" },
  ],
  relations: [
    { name: "person", targetObject: "person", type: "many_to_one" },
  ],
};

export const disputeLetterObject: TwentyObjectDef = {
  nameSingular: "DisputeLetter", namePlural: "DisputeLetters",
  labelSingular: "Dispute Letter", labelPlural: "Dispute Letters",
  description: "Credit dispute letter sent to bureaus",
  icon: "IconMail",
  fields: [
    { name: "bureau", type: "select", label: "Bureau", options: [
      { value: "equifax", label: "Equifax", color: "red" },
      { value: "experian", label: "Experian", color: "blue" },
      { value: "transunion", label: "TransUnion", color: "orange" },
    ] },
    { name: "roundNumber", type: "number", label: "Round Number", defaultValue: 1 },
    { name: "status", type: "select", label: "Status", options: [
      { value: "draft", label: "Draft", color: "gray" },
      { value: "review", label: "Ready for Review", color: "yellow" },
      { value: "approved", label: "Approved", color: "blue" },
      { value: "sent", label: "Sent", color: "green" },
      { value: "response_received", label: "Response Received", color: "purple" },
      { value: "resolved", label: "Resolved", color: "teal" },
      { value: "rejected", label: "Rejected", color: "red" },
    ], defaultValue: "draft" },
    { name: "sentDate", type: "datetime", label: "Sent Date" },
    { name: "certifiedMailId", type: "text", label: "Certified Mail ID" },
    { name: "responseDate", type: "datetime", label: "Response Date" },
    { name: "responseDeadline", type: "datetime", label: "Response Deadline (30 days)" },
    { name: "result", type: "select", label: "Result", options: [
      { value: "deleted", label: "Item Deleted", color: "green" },
      { value: "updated", label: "Item Updated", color: "yellow" },
      { value: "verified", label: "Item Verified", color: "red" },
      { value: "no_response", label: "No Response", color: "orange" },
    ] },
    { name: "templateId", type: "text", label: "Template Used" },
    { name: "documentUrl", type: "url", label: "Letter PDF URL" },
    { name: "fcraCompliant", type: "boolean", label: "FCRA Compliant", defaultValue: true },
    { name: "disputedItems", type: "text", label: "Disputed Items (comma-separated IDs)" },
    { name: "notes", type: "text", label: "Notes" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const negativeItemObject: TwentyObjectDef = {
  nameSingular: "NegativeItem", namePlural: "NegativeItems",
  labelSingular: "Negative Item", labelPlural: "Negative Items",
  description: "Negative item on credit report",
  icon: "IconExclamationCircle",
  fields: [
    { name: "bureau", type: "select", label: "Bureau", options: [
      { value: "equifax", label: "Equifax", color: "red" },
      { value: "experian", label: "Experian", color: "blue" },
      { value: "transunion", label: "TransUnion", color: "orange" },
    ] },
    { name: "accountType", type: "select", label: "Account Type", options: [
      { value: "collection", label: "Collection", color: "red" },
      { value: "charge_off", label: "Charge Off", color: "orange" },
      { value: "late_payment", label: "Late Payment", color: "yellow" },
      { value: "bankruptcy", label: "Bankruptcy", color: "purple" },
      { value: "foreclosure", label: "Foreclosure", color: "pink" },
      { value: "repossession", label: "Repossession", color: "blue" },
      { value: "inquiry", label: "Hard Inquiry", color: "gray" },
      { value: "other", label: "Other", color: "gray" },
    ] },
    { name: "accountName", type: "text", label: "Account Name" },
    { name: "accountNumber", type: "text", label: "Account Number (masked)" },
    { name: "originalCreditor", type: "text", label: "Original Creditor" },
    { name: "currentStatus", type: "text", label: "Current Status" },
    { name: "dateOpened", type: "datetime", label: "Date Opened" },
    { name: "dateReported", type: "datetime", label: "Date Reported" },
    { name: "balance", type: "currency", label: "Balance" },
    { name: "disputeStatus", type: "select", label: "Dispute Status", options: [
      { value: "not_disputed", label: "Not Disputed", color: "gray" },
      { value: "disputing", label: "Disputing", color: "yellow" },
      { value: "disputed_removed", label: "Removed", color: "green" },
      { value: "disputed_updated", label: "Updated", color: "blue" },
      { value: "disputed_verified", label: "Verified", color: "red" },
    ], defaultValue: "not_disputed" },
    { name: "disputeRoundId", type: "text", label: "Dispute Round ID" },
    { name: "isEligible", type: "boolean", label: "Eligible for Dispute", defaultValue: true },
    { name: "ineligibilityReason", type: "text", label: "Ineligibility Reason" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const creditReportObject: TwentyObjectDef = {
  nameSingular: "CreditReport", namePlural: "CreditReports",
  labelSingular: "Credit Report", labelPlural: "Credit Reports",
  description: "Credit report pulled from bureaus",
  icon: "IconFileSearch",
  fields: [
    { name: "bureau", type: "select", label: "Bureau", options: [
      { value: "equifax", label: "Equifax", color: "red" },
      { value: "experian", label: "Experian", color: "blue" },
      { value: "transunion", label: "TransUnion", color: "orange" },
      { value: "tri_merge", label: "Tri-Merge", color: "purple" },
    ] },
    { name: "pullDate", type: "datetime", label: "Pull Date" },
    { name: "creditScore", type: "number", label: "Credit Score" },
    { name: "scoreModel", type: "text", label: "Score Model" },
    { name: "totalAccounts", type: "number", label: "Total Accounts" },
    { name: "negativeCount", type: "number", label: "Negative Items Count" },
    { name: "reportUrl", type: "url", label: "Report PDF URL" },
    { name: "reportReference", type: "text", label: "Report Reference Number" },
    { name: "isCurrent", type: "boolean", label: "Current Report", defaultValue: true },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const emailMessageObject: TwentyObjectDef = {
  nameSingular: "EmailMessage", namePlural: "EmailMessages",
  labelSingular: "Email", labelPlural: "Emails",
  description: "Email sent/received via Resend",
  icon: "IconMail",
  fields: [
    { name: "direction", type: "select", label: "Direction", options: [
      { value: "inbound", label: "Inbound", color: "blue" },
      { value: "outbound", label: "Outbound", color: "green" },
    ] },
    { name: "subject", type: "text", label: "Subject" },
    { name: "body", type: "text", label: "Body (plain text)" },
    { name: "fromAddress", type: "email", label: "From" },
    { name: "toAddress", type: "email", label: "To" },
    { name: "status", type: "select", label: "Status", options: [
      { value: "sent", label: "Sent", color: "green" },
      { value: "delivered", label: "Delivered", color: "blue" },
      { value: "opened", label: "Opened", color: "purple" },
      { value: "clicked", label: "Clicked", color: "teal" },
      { value: "bounced", label: "Bounced", color: "red" },
      { value: "spam", label: "Spam", color: "orange" },
    ] },
    { name: "resendId", type: "text", label: "Resend Message ID" },
    { name: "campaignId", type: "text", label: "Campaign ID" },
    { name: "templateUsed", type: "text", label: "Template Used" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const smsMessageObject: TwentyObjectDef = {
  nameSingular: "SmsMessage", namePlural: "SmsMessages",
  labelSingular: "SMS", labelPlural: "SMS Messages",
  description: "SMS sent/received via GHL",
  icon: "IconMessage",
  fields: [
    { name: "direction", type: "select", label: "Direction", options: [
      { value: "inbound", label: "Inbound", color: "blue" },
      { value: "outbound", label: "Outbound", color: "green" },
    ] },
    { name: "body", type: "text", label: "Message Body" },
    { name: "fromNumber", type: "phone", label: "From" },
    { name: "toNumber", type: "phone", label: "To" },
    { name: "status", type: "select", label: "Status", options: [
      { value: "queued", label: "Queued", color: "gray" },
      { value: "sent", label: "Sent", color: "blue" },
      { value: "delivered", label: "Delivered", color: "green" },
      { value: "failed", label: "Failed", color: "red" },
    ] },
    { name: "ghlId", type: "text", label: "GHL Message ID" },
    { name: "segments", type: "number", label: "Segments", defaultValue: 1 },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const callLogObject: TwentyObjectDef = {
  nameSingular: "CallLog", namePlural: "CallLogs",
  labelSingular: "Call Log", labelPlural: "Call Logs",
  description: "Phone call log (Freshcaller + manual)",
  icon: "IconPhoneCall",
  fields: [
    { name: "direction", type: "select", label: "Direction", options: [
      { value: "inbound", label: "Inbound", color: "blue" },
      { value: "outbound", label: "Outbound", color: "green" },
    ] },
    { name: "durationSeconds", type: "number", label: "Duration (seconds)" },
    { name: "fromNumber", type: "phone", label: "From" },
    { name: "toNumber", type: "phone", label: "To" },
    { name: "status", type: "select", label: "Status", options: [
      { value: "completed", label: "Completed", color: "green" },
      { value: "missed", label: "Missed", color: "red" },
      { value: "voicemail", label: "Voicemail", color: "blue" },
      { value: "busy", label: "Busy", color: "orange" },
    ] },
    { name: "disposition", type: "select", label: "Disposition", options: [
      { value: "resolved", label: "Resolved", color: "green" },
      { value: "follow_up", label: "Follow Up Needed", color: "yellow" },
      { value: "transferred", label: "Transferred", color: "blue" },
      { value: "no_action", label: "No Action", color: "gray" },
    ] },
    { name: "recordingUrl", type: "url", label: "Recording URL" },
    { name: "notes", type: "text", label: "Call Notes" },
    { name: "freshcallerId", type: "text", label: "Freshcaller Call ID" },
    { name: "agentName", type: "text", label: "Agent Name" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const agentTaskObject: TwentyObjectDef = {
  nameSingular: "AgentTask", namePlural: "AgentTasks",
  labelSingular: "Agent Task", labelPlural: "Agent Tasks",
  description: "Task assigned to agent (JarvisTask bridge)",
  icon: "IconChecklist",
  fields: [
    { name: "title", type: "text", label: "Title" },
    { name: "description", type: "text", label: "Description" },
    { name: "status", type: "select", label: "Status", options: [
      { value: "todo", label: "To Do", color: "gray" },
      { value: "in_progress", label: "In Progress", color: "blue" },
      { value: "done", label: "Done", color: "green" },
      { value: "blocked", label: "Blocked", color: "red" },
    ], defaultValue: "todo" },
    { name: "priority", type: "select", label: "Priority", options: [
      { value: "low", label: "Low", color: "gray" },
      { value: "medium", label: "Medium", color: "yellow" },
      { value: "high", label: "High", color: "orange" },
      { value: "urgent", label: "Urgent", color: "red" },
    ], defaultValue: "medium" },
    { name: "dueDate", type: "datetime", label: "Due Date" },
    { name: "completedAt", type: "datetime", label: "Completed At" },
    { name: "resolution", type: "text", label: "Resolution" },
    { name: "jarvisTaskId", type: "text", label: "JarvisTask ID" },
    { name: "source", type: "select", label: "Source", options: [
      { value: "slack", label: "Slack", color: "green" },
      { value: "manual", label: "Manual", color: "blue" },
      { value: "auto", label: "Automated", color: "purple" },
      { value: "mission", label: "Mission", color: "teal" },
    ] },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const documentObject: TwentyObjectDef = {
  nameSingular: "Document", namePlural: "Documents",
  labelSingular: "Document", labelPlural: "Documents",
  description: "Customer document",
  icon: "IconFile",
  fields: [
    { name: "title", type: "text", label: "Title" },
    { name: "category", type: "select", label: "Category", options: [
      { value: "agreement", label: "Agreement", color: "blue" },
      { value: "dispute_letter", label: "Dispute Letter", color: "purple" },
      { value: "credit_report", label: "Credit Report", color: "orange" },
      { value: "payment_receipt", label: "Payment Receipt", color: "green" },
      { value: "identity", label: "Identity Document", color: "teal" },
      { value: "other", label: "Other", color: "gray" },
    ] },
    { name: "fileUrl", type: "url", label: "File URL" },
    { name: "fileType", type: "text", label: "File Type (pdf, png, etc.)" },
    { name: "fileSize", type: "number", label: "File Size (bytes)" },
    { name: "uploadedAt", type: "datetime", label: "Uploaded At" },
    { name: "uploadedBy", type: "text", label: "Uploaded By (agent or customer)" },
    { name: "isCustomerVisible", type: "boolean", label: "Visible to Customer", defaultValue: false },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

export const changeLogObject: TwentyObjectDef = {
  nameSingular: "ChangeLog", namePlural: "ChangeLogs",
  labelSingular: "Change Log", labelPlural: "Change Logs",
  description: "Audit log of record changes",
  icon: "IconHistory",
  fields: [
    { name: "entityType", type: "text", label: "Entity Type" },
    { name: "entityId", type: "text", label: "Entity ID" },
    { name: "action", type: "select", label: "Action", options: [
      { value: "created", label: "Created", color: "green" },
      { value: "updated", label: "Updated", color: "blue" },
      { value: "deleted", label: "Deleted", color: "red" },
      { value: "synced", label: "Synced", color: "purple" },
    ] },
    { name: "fieldName", type: "text", label: "Field Changed" },
    { name: "oldValue", type: "text", label: "Old Value" },
    { name: "newValue", type: "text", label: "New Value" },
    { name: "changedBy", type: "text", label: "Changed By (agent/system)" },
    { name: "source", type: "text", label: "Source (chat, twenty, base44, n8n)" },
  ],
  relations: [{ name: "person", targetObject: "person", type: "many_to_one" }],
};

// ── ALL OBJECTS REGISTRY ────────────────────────────────────────────

/** All 14 new custom objects to deploy */
export const NEW_TWENTY_OBJECTS: TwentyObjectDef[] = [
  leadObject,
  vapiCallObject,
  agreementObject,
  paymentMethodObject,
  billingRecoveryTaskObject,
  disputeLetterObject,
  negativeItemObject,
  creditReportObject,
  emailMessageObject,
  smsMessageObject,
  callLogObject,
  agentTaskObject,
  documentObject,
  changeLogObject,
];

/** All 20 NKS objects (14 new + 6 existing) */
export const ALL_NKS_OBJECTS = {
  new: NEW_TWENTY_OBJECTS,
  existing: [
    "Subscription", "PaymentRecord", "CreditDispute",
    "Enrollment", "SupportTicket", "Activity",
  ],
  get total() { return this.new.length + this.existing.length; },
};

/** Map object singular name to definition */
export function getObjectDef(singularName: string): TwentyObjectDef | undefined {
  return NEW_TWENTY_OBJECTS.find(o => o.nameSingular === singularName);
}
