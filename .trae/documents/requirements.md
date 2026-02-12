# Product Requirements Document - Bamika FC Registration System

## 1. Product Overview
The Bamika FC Registration System is a comprehensive web application for managing youth football player registrations (U6–U18). It streamlines the process for parents to register their children, securely upload documents, sign liability waivers, and set up recurring monthly membership payments. The system also provides a parent dashboard for managing family registrations and an admin dashboard for team roster management.

## 2. Core Features

### 2.1 User Roles
| Role | Registration Method | Core Permissions |
|------|---------------------|------------------|
| Parent | Email/Password (Supabase Auth) | Manage profile, register children, view registration status, upload documents. |
| Admin | Pre-assigned / Invite | View all registrations, export data to CSV, manage rosters. |

### 2.2 Feature Module
The system comprises the following key pages:
1.  **Landing Page**: Welcome screen with login/register options.
2.  **Authentication**: Login and Sign-up pages.
3.  **Parent Dashboard**: Overview of registered children and "Add Player" entry point.
4.  **Registration Form (Multi-step)**:
    *   Step 1: Player Details (Validation for U6-U18).
    *   Step 2: Document Upload (Birth Certificate).
    *   Step 3: Liability Waiver (Scroll & Sign).
    *   Step 4: Payment Setup (Stripe).
5.  **Admin Dashboard**: Roster table with search, filter, and CSV export.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Parent Dashboard | Child List | Display cards for each registered child with status (Active/Pending). |
| Parent Dashboard | Add Player Action | Button to start a new registration workflow. |
| Registration | Step 1: Player Info | Collect Name, DOB (validate age U6-U18), Gender, Medical Info. |
| Registration | Step 2: Documents | Secure upload for Birth Certificate (PDF/Image) to Supabase Storage. |
| Registration | Step 3: Waiver | Display mandatory liability text; require "I Agree" checkbox and capture timestamp. |
| Registration | Step 4: Payment | Stripe Checkout integration for recurring $50/month membership. |
| Admin Dashboard | Roster Management | Table view of all players; sort by age group; Export to CSV button. |

## 3. Core Process
### User Registration Flow
1.  **Parent** creates an account and logs in.
2.  **Parent** clicks "Register New Player".
3.  **Parent** fills player details and uploads birth certificate.
4.  **Parent** reviews and signs the digital liability waiver.
5.  **Parent** enters payment details for $50/mo subscription.
6.  **System** validates payment.
7.  **System** saves registration record (Registration is only finalized upon payment success).
8.  **Parent** is redirected to Dashboard showing the new player.

```mermaid
graph TD
  A[Parent Dashboard] -->|"Add Player"| B[Player Info Form]
  B -->|"Next"| C[Upload Birth Cert]
  C -->|"Next"| D[Sign Waiver]
  D -->|"Proceed to Pay"| E[Stripe Checkout]
  E -->|"Payment Success"| F[Save Registration]
  F --> G[Parent Dashboard (Updated)]
```

## 4. User Interface Design
### 4.1 Design Style
-   **Color Palette**: Black, White, and Red (Modern Sports Aesthetic).
-   **Typography**: Bold, athletic sans-serif fonts for headings; clean sans-serif for body.
-   **Layout**: Clean, spacious, card-based UI.
-   **Visuals**: High-contrast elements, sports-themed iconography.

### 4.2 Page Design Overview
| Page Name | Module Name | UI Elements |
|-----------|-------------|-------------|
| Registration | Progress Bar | Visual indicator of current step (e.g., "Info > Docs > Waiver > Pay"). |
| Waiver | Agreement Box | Scrollable text area with a sticky "I Agree" footer. |
| Dashboard | Player Card | Card displaying player name, team (U-Level), and status badge (Green for Active). |

### 4.3 Responsiveness
The application is **fully mobile-responsive**. The registration form is optimized for touch interactions on mobile devices, ensuring parents can easily complete the process on phones or tablets.
