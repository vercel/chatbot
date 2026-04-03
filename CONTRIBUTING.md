# Contributing to the Form-Filling Assistant

Thank you for your interest in contributing! The Form-Filling Assistant is an open-source AI tool built by [Nava Labs](https://www.navapbc.com/labs/ai-tools-public-benefits) to help caseworkers navigate benefit portals and complete applications on behalf of the families they serve. We welcome contributions from developers, designers, policy experts, and community members. This document explains how to get involved.

## Community

We are committed to providing a welcoming and respectful environment for all contributors. All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Bugs and Issues

Bug reports are welcome — they help us make this tool better for caseworkers and the communities they serve.

When you're ready to file, [create a GitHub issue](https://github.com/navapbc/ai-chatbot/issues/new) and include:
- A clear description of the bug and what you expected to happen
- Steps to reproduce
- Your environment (OS, Node version, browser if relevant)
- Any relevant logs or screenshots

**Security issues:** Please do not file security vulnerabilities as public GitHub issues. See our [Security Policy](SECURITY.md) for how to report them privately.

## Suggesting Features

We're especially interested in feedback from people who work directly with caseworkers or benefit systems. If you have an idea for how this tool could better serve that context, [open a GitHub issue](https://github.com/navapbc/ai-chatbot/issues/new) with the label `enhancement` and describe:
- The problem you're trying to solve
- Who it would benefit
- Any ideas you have for how it might work

## Getting Started

To contribute code, start by forking the repository and setting up your local environment. See the [Getting Started](README.md#getting-started) section in the README for setup instructions.

Once you're ready, submit a pull request with:
- A clear title and description of what you changed and why
- A reference to the related issue (e.g., `Closes #123`)
- Screenshots or screen recordings for UI changes
- Test results confirming nothing is broken

## Code Review Process

### Submitting for Review

Before opening a pull request:
- Make sure all tests pass locally
- Update any documentation affected by your changes
- Do a self-review of your diff before requesting others' time
- Request a review from a maintainer

### Review Criteria

Reviewers will evaluate contributions for:

- **Functionality** — does the code work as intended?
- **Security** — are there any vulnerabilities or data exposure risks, particularly given the sensitive nature of benefit casework?
- **Performance** — does this impact system responsiveness for users on lower-bandwidth connections?
- **Accessibility** — does this maintain accessibility standards (WCAG 2.1 AA)?
- **Maintainability** — is the code readable, well-structured, and documented?
- **Testing** — is there adequate test coverage for the changes?

### Addressing Feedback

- Respond to review comments in a timely way
- Make requested changes or explain your reasoning if you'd like to discuss an alternative
- Update tests and documentation as needed
- Re-request review once changes are complete

## Questions?

If you're unsure about anything before contributing, feel free to open a GitHub issue with the `question` label. We'd rather you ask than get stuck.

Thank you for contributing to the Form-Filling Assistant!
