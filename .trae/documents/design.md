# Bamika FC Registration Form - Design Guidelines

## 1. Visual Style

### 1.1 Color Palette
- **Primary**: `blue-700` (Football Club Theme - Professional & Trust)
- **Secondary**: `yellow-500` (Accent/Action Buttons)
- **Neutral**: `slate` or `zinc` (Backgrounds, Text)
- **Feedback**:
  - Success: `emerald-600`
  - Error: `rose-600`

### 1.2 Typography
- **Font Family**: Inter (Clean, modern sans-serif)
- **Headings**: Bold, clear hierarchy (`text-2xl`, `text-xl`)
- **Body**: Readable size (`text-sm` or `text-base`), good contrast.

### 1.3 Layout
- **Container**: Centered, max-width `2xl` for the form to ensure focus.
- **Spacing**: Consistent padding (`p-6`, `p-8`) and gaps (`gap-4`, `gap-6`).
- **Responsiveness**: Mobile-first approach. Stacked inputs on mobile, potentially grid on desktop.

## 2. Component Design

### 2.1 Registration Form
- **Multi-step vs. Single Page**: Single page with clear sections.
  - Section 1: Player Information
  - Section 2: Contact Details
  - Section 3: Emergency & Medical
  - Section 4: Payment

- **Inputs**:
  - Floating labels or standard labels with placeholders.
  - Validation errors shown directly below the input field.

### 2.2 Payment Section
- Integrated Stripe Payment Element.
- "Pay & Register" button prominently displayed.

### 2.3 Feedback States
- **Loading**: Spinner overlay or button loading state during submission.
- **Success**: Success modal or redirect to a "Thank You" page with registration summary.
- **Error**: Toast notifications or inline error messages.

## 3. User Experience (UX)
- **Focus**: Keep the user focused on completing the registration.
- **Clarity**: Explain why certain information is needed (e.g., medical conditions).
- **Accessibility**: ARIA labels, keyboard navigation support.
