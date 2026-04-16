# Personal Finance Analysis — User Template

Fill in the sections below, then use this as a prompt with Claude or as input to the system.

---

## About Me
- **Name:** [Your Name]
- **Age:** [Your Age]
- **Occupation:** [Your Job Title & Company]
- **Annual Income:** $[Amount]
- **Years of Experience:** [Number]

## Lifestyle Context
- [Living situation, upcoming changes, dependents, etc.]

## Financial Accounts

### Investment Platforms
| Platform | Account Type | Notes |
|----------|-------------|-------|
| [e.g. Fidelity] | [e.g. Roth 401k] | [e.g. Employer match 4%] |
| | | |
| | | |

### Credit / Spending
| Platform | Type | Notes |
|----------|------|-------|
| [e.g. Chase] | [Credit Card] | [Primary spending card] |
| | | |

## Fixed Monthly Expenses
| Expense | Amount |
|---------|--------|
| Rent | $[Amount] |
| Car Insurance | $[Amount] |
| [Other] | $[Amount] |

## Variable / Annual Expenses
- [List variable expenses and rough estimates]

## Investment Preferences
- **Risk Tolerance:** [Conservative / Moderate / Aggressive]
- **Time Horizon:** [Short / Medium / Long]
- **Sector Interests:** [e.g. Technology, AI, Healthcare, etc.]

## What I Want to Know
1. Net worth and full financial picture
2. Where my money goes (spending analysis)
3. How my investments are allocated
4. What I should do next (DCA strategy, budget targets)
5. [Any specific questions]

---

## How to Use This Template

1. Fill in all sections above
2. Copy `config/user-profile.template.json` to `config/user-profile.json`
3. Update the JSON with your details
4. Export CSVs from your financial platforms into `data/raw/{platform}/`
5. Run: `npm run update`
6. Open: `http://localhost:3000`
