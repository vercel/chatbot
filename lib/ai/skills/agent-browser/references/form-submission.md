# Form Submission — Advanced JS Debugging

Load this reference only after completing steps 1–4 from the Form Submission section in SKILL.md and submit is STILL disabled.

## Step 5: Find the page's JavaScript source

The form has custom JS gating the button. Find the JS source:
```
{ action: "evaluate", script: "Array.from(document.querySelectorAll('script[src]')).map(s => s.src).join('\\n')" }
```

Fetch and read the relevant script. Look for:
- Variables that gate the button (e.g., `isExpanded`, `isCaptchaChecked`)
- Callback functions (e.g., `recaptchaCallback`)
- Event handlers bound to CSS classes (not the visible element)
- Animation callbacks (e.g., `slideToggle`) where the enable logic lives

## Step 6: Fix with minimal evaluate

Once you understand the gate logic, write the minimum evaluate to satisfy all conditions:
```
{ action: "evaluate", script: "isExpanded = true; isCaptchaChecked = true; document.querySelector('#btnSubmit').removeAttribute('disabled');" }
```

**Key principle**: Set the page's JS state variables to match the DOM state. Just removing `disabled` without updating the gating variables means the page's own JS may re-disable the button.
