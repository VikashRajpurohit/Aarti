# Aarti Polymers Management System

> A comprehensive, offline-first operational management application built for Aarti Polymers.

![Expo](https://img.shields.io/badge/Expo-1A202C?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

Aarti Polymers is a robust React Native (Expo) mobile application designed to streamline factory operations, sales, and administration. It integrates a mobile app and a static marketing website, powered by a Supabase backend.

---

## 🚀 Key Features

* **📦 Sales & Challans**: Offline-first QR scanning for outgoing shipments. Scans update local state instantly and sync to the cloud in the background. Supports PDF and Excel exports.
* **🏭 Production & Raw Materials**: Track daily production shifts (Stretch Film, Bubble Roll, Pouch, Baby Products) and raw material usage.
* **⚡ Power Monitoring**: Log power cut and power-in events to monitor factory downtime.
* **🛒 Purchases & Stock**: Track raw material purchases and view stock balances.
* **🌐 Website Integration**: Manage website inquiries directly from the mobile app and track unique visitor analytics.
* **👥 Role-Based Access Control**: Multi-tier access for Admins, General Managers, Sales Managers, Purchase Managers, and Production Managers.
* **📊 Reporting & Analytics**: Comprehensive dashboards for production output, raw materials, sales, and power downtime with custom date-range filters.
* **💾 Admin Tools**: User management, activity logs/audit trails, and full database backup exports.

---

## 🏗️ Architecture & Tech Stack

### Frontend (Mobile App)
* **Framework**: React Native 0.74 via Expo SDK 51.
* **Navigation**: React Navigation v7 with a custom, data-driven bottom tab "squeeze-rail".
* **State Management**: React Context (`AuthContext`, `ChallanContext`, `RefreshBusContext`) and AsyncStorage for offline persistence.
* **UI/Design System**: Custom responsive design system (tokens in `src/theme/`) featuring dynamic layout adjustments for phones and tablets.
* **Charts**: `react-native-chart-kit` and `react-native-svg`.

### Backend
* **Database & Auth**: Supabase (PostgreSQL, Auth, Edge Functions).
* **Analytics**: Lightweight Firebase Firestore used exclusively for usage counters.
* **Data Flow**: Optimistic UI updates with background syncing for critical paths like QR scanning.

---

## 📂 Project Structure

```text
aarti-polymers/
├── App.js                  # Root providers, tab navigator, and app entry point
├── app.json / eas.json     # Expo and EAS build configurations
├── src/
│   ├── components/         # Shared UI components (ScreenHeader, AppModal, etc.)
│   ├── config/             # Role definitions, Supabase client, Firebase config
│   ├── context/            # Auth, Challan, and Refresh logic
│   ├── hooks/              # Custom hooks (e.g., useResponsiveLayout)
│   ├── models/             # Data models for Challans and Scanned Items
│   ├── screens/            # App screens organized by functionality
│   ├── services/           # Supabase service wrappers for data fetching/mutations
│   ├── theme/              # Design system tokens (colors, typography, spacing)
│   └── utils/              # Helper functions (dates, exports, QR parsing)
├── supabase/               # Edge Functions and DB Migrations
├── website/                # Static marketing website and inquiry form
└── docs/                   # Detailed architecture and feature documentation
```

---

## 🛠️ Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v20.11.1 recommended, matching EAS profiles)
* [Yarn](https://yarnpkg.com/)
* [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Installation
1. Install dependencies (uses legacy-peer-deps):
   ```bash
   yarn install
   ```

### Running the App Locally
Start the Expo development server:
```bash
yarn start
```
Run on a specific platform:
```bash
yarn android
# or
yarn ios
```

---

## 📦 Build & Release (EAS)

The project uses Expo Application Services (EAS) for builds and Over-The-Air (OTA) updates.

* **Preview Build (APK)**: `yarn build:preview`
* **Production Build (APK)**: `yarn build:production`
* **OTA Update (Preview)**: `yarn update:preview`
* **OTA Update (Production)**: `yarn update:production`

> **Note**: OTA updates ship JS bundle changes only. Any native configuration changes require a new EAS build.

---

## 🎨 UI/UX Philosophy

The app is built with a custom design system prioritizing usability in factory environments:
* **Responsive Layouts**: Adapts seamlessly to both mobile phones and tablets.
* **Offline-First UX**: Actions like QR scanning never block the user interface waiting for a network response.
* **Date Handling**: Strictly uses IST business days for shift reporting to prevent timezone drift.
* **Data-Driven Navigation**: Tabs and screens are dynamically rendered based on the user's role profile.

---

*Please refer to the `docs/` directory for in-depth information on features and backend schemas.*
