# Icafe Dashboard — Ecme Template

Built on top of **Ecme** — The Ultimate React, Vite & TypeScript Web Template. A modern, responsive admin dashboard with reusable components, pre-designed pages, and dynamic features.

**Key Features:**
- **Responsive Layout** — Optimized for all screen sizes and devices.
- **Dark / Light Mode** — Easily switch between light and dark themes.
- **Configurable Themes** — Personalize colors, layouts, and more.
- **React 19 + TypeScript** — Robust type-checking and fast development.
- **Multi-Locale Support** — Add and manage multiple languages via i18next.
- **RTL Support** — Full Right-to-Left support for Arabic, Hebrew, etc.
- **Tailwind CSS** — Utility-first styling with component-based architecture.
- **API Ready** — Simple integration with any RESTful API via Axios.

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Build for production
npm run lint       # Run ESLint
npm run format     # Run Prettier + ESLint fix
```

---

## Backend Integration

The frontend communicates with your backend through a thin Axios layer in
`src/services/`.  By default the app runs entirely with **mock data** so you
can develop the UI without a real backend.

### 1. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Full URL of your own backend API | `http://localhost:3000` |
| `VITE_ENABLE_MOCK` | `"true"` – use mock data; `"false"` – hit real backend | `"true"` |
| `VITE_FIREBASE_*` | Firebase credentials (only needed for OAuth sign-in) | *(empty)* |

### 2. Disable mock data

Set `VITE_ENABLE_MOCK=false` in `.env` and restart the dev server.  The Vite
dev server will proxy all `/api/*` requests to `VITE_API_URL`, so your backend
can remain on a different port with no CORS configuration required during
development.

### 3. Expected API contract

The frontend expects the following endpoints.  Every request that requires
authentication sends an `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sign-in` | Sign in — returns `{ token, user }` |
| `POST` | `/api/sign-up` | Register — returns `{ token, user }` |
| `POST` | `/api/sign-out` | Sign out |
| `POST` | `/api/forgot-password` | Request password reset e-mail |
| `POST` | `/api/reset-password` | Apply new password |
| `GET` | `/api/dashboard/ecommerce` | Overview dashboard data |
| `GET` | `/api/dashboard/project` | Project dashboard data |
| `GET` | `/api/dashboard/analytic` | Analytic dashboard data |
| `GET` | `/api/dashboard/marketing` | Marketing dashboard data |

See `src/services/` for the full list of service files and the endpoint they
call.  The mock responses in `src/mock/fakeApi/` show the exact JSON shape
expected from each endpoint.

### 4. Authentication response shape

`POST /api/sign-in` and `POST /api/sign-up` must return:

```json
{
  "token": "<jwt-or-opaque-token>",
  "user": {
    "userId": "1",
    "userName": "Alice",
    "email": "alice@example.com",
    "avatar": "/img/avatars/thumb-1.jpg",
    "authority": ["admin", "user"]
  }
}
```

The token is stored in `localStorage` (key `token`) and sent with every
subsequent request as `Authorization: Bearer <token>`.

### 5. Production deployment

In a production build there is no Vite proxy.  Set `VITE_API_URL` to the full
public URL of your API server (e.g. `https://api.yourapp.com`) and the Axios
client will prefix every request with that URL automatically.

```bash
VITE_API_URL=https://api.yourapp.com VITE_ENABLE_MOCK=false npm run build
```

---

## iCafe Cloud API Integration

The dashboard is wired to the **iCafe Cloud REST API v2**
(`https://api.icafecloud.com`).  A dedicated Axios instance and typed service
layer make it straightforward to pull live data about your café into any page.

**Reference:** https://dev.icafecloud.com/docs/

### Quick setup

```bash
# 1. Copy the env example
cp .env.example .env

# 2. Fill in your iCafe credentials
#    VITE_ICAFE_API_URL=https://api.icafecloud.com   (default, leave as-is)
#    VITE_ICAFE_API_KEY=<token from Admin Panel → Settings → API settings>
#    VITE_ICAFE_CAFE_ID=<your Café ID>

# 3. Start the dev server
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_ICAFE_API_URL` | Base URL of the iCafe Cloud API. Default: `https://api.icafecloud.com` |
| `VITE_ICAFE_API_KEY` | Bearer token from Admin Panel → Settings → API settings |
| `VITE_ICAFE_CAFE_ID` | Your unique Café ID (used in every `/api/v2/cafe/{cafeId}/...` path) |

> **Token notes**
> - Only one token is active at a time. Generating a new one revokes the old one.
> - The token is tied to the static IP(s) you whitelist in the Admin Panel.
> - Tokens expire after 1 year.

### Available service functions

All functions are in `src/services/IcafeService.ts` and return typed promises.

```ts
import {
    // Café
    apiGetCafeInfo,           // GET    /api/v2/cafe/{cafeId}

    // Members
    apiGetMembers,            // GET    /api/v2/cafe/{cafeId}/members
    apiCreateMember,          // POST   /api/v2/cafe/{cafeId}/members/action/create
    apiUpdateMember,          // POST   /api/v2/cafe/{cafeId}/members/action/update
    apiDeductMemberBalance,   // POST   /api/v2/cafe/{cafeId}/members/action/deductBalance
    apiConvertGuestToMember,  // POST   /api/v2/cafe/{cafeId}/members/action/convertToMember
    apiFetchTopUpBonus,       // POST   /api/v2/cafe/{cafeId}/members/action/fetchBonus
    apiTopUpMember,           // POST   /api/v2/cafe/{cafeId}/members/action/topup

    // Sessions
    apiGetSessions,           // GET    /api/v2/cafe/{cafeId}/sessions
    apiEndSession,            // POST   /api/v2/cafe/{cafeId}/sessions/{id}/end

    // PCs
    apiGetPCs,                // GET    /api/v2/cafe/{cafeId}/pcs
    apiSendPCPowerCommand,    // POST   /api/v2/cafe/{cafeId}/pcSessions/sendWssCommand

    // PC Groups & Zones
    apiGetPCGroups,           // GET    /api/v2/cafe/{cafeId}/pcgroups
    apiGetZones,              // GET    /api/v2/cafe/{cafeId}/zones

    // Packages
    apiGetPackages,           // GET    /api/v2/cafe/{cafeId}/packages
    apiCreatePackage,         // POST   /api/v2/cafe/{cafeId}/packages/action/create
    apiUpdatePackage,         // POST   /api/v2/cafe/{cafeId}/packages/action/update

    // Bookings
    apiGetBookings,           // GET    /api/v2/cafe/{cafeId}/bookings
    apiCreateBooking,         // POST   /api/v2/cafe/{cafeId}/bookings
    apiCancelBooking,         // DELETE /api/v2/cafe/{cafeId}/bookings/{id}

    // Food Orders
    apiGetFoodOrders,         // GET    /api/v2/cafe/{cafeId}/orders/food
    apiCreateFoodOrder,       // POST   /api/v2/cafe/{cafeId}/orders/food

    // Announcements
    apiGetAnnouncements,      // GET    /api/v2/cafe/{cafeId}/announcements
    apiCreateAnnouncement,    // POST   /api/v2/cafe/{cafeId}/announcements

    // Reports
    apiGetReports,            // GET    /api/v2/cafe/{cafeId}/reports

    // Staff
    apiGetStaff,              // GET    /api/v2/cafe/{cafeId}/staff
    apiCreateStaff,           // POST   /api/v2/cafe/{cafeId}/staff/action/create
    apiUpdateStaff,           // POST   /api/v2/cafe/{cafeId}/staff/action/update
    apiDeleteStaff,           // DELETE /api/v2/cafe/{cafeId}/staff/{id}

    // Billing Logs & Transactions
    apiGetBillingLogs,        // GET    /api/v2/cafe/{cafeId}/billing-logs
    apiGetTransactions,       // GET    /api/v2/cafe/{cafeId}/transactions
    apiGetReceipt,            // GET    /api/v2/cafe/{cafeId}/receipts/{id}

    // Client notification
    apiPushClientStatus,      // POST   /api/v2/cafe/{cafeId}/clients/pushClientStatus
} from '@/services/IcafeService'
```

### Example — list active sessions

```tsx
import useSWR from 'swr'
import { apiGetSessions } from '@/services/IcafeService'

const Sessions = () => {
    const { data, isLoading } = useSWR('icafe/sessions', apiGetSessions)

    if (isLoading) return <p>Loading…</p>

    return (
        <ul>
            {data?.data.map((s) => (
                <li key={s.sessionId}>
                    PC {s.pcName} — {s.status}
                </li>
            ))}
        </ul>
    )
}
```

### Example — top-up a member

```ts
import { apiFetchTopUpBonus, apiTopUpMember, apiPushClientStatus } from '@/services/IcafeService'

async function topUp(memberId: number, amount: number) {
    // 1. Calculate bonus
    const { data: { bonus } } = await apiFetchTopUpBonus({ memberId, amount })

    // 2. Perform the top-up
    await apiTopUpMember({ memberId, amount, topup_balance_bonus: bonus })

    // 3. Notify the client PC of the new balance
    await apiPushClientStatus({ memberId })
}
```

### Example — reboot selected PCs

```ts
import { apiSendPCPowerCommand } from '@/services/IcafeService'

await apiSendPCPowerCommand({
    action: 'power',
    target: 'reboot',
    data: { power_type: 'reboot', ids: [1, 2, 3] },
})
```

### Key files

| File | Purpose |
|---|---|
| `src/configs/icafe.config.ts` | Reads `VITE_ICAFE_*` env vars, exports `apiUrl`, `apiKey`, `cafeId` |
| `src/services/axios/IcafeAxios.ts` | Axios instance pre-configured for `api.icafecloud.com` with Bearer token |
| `src/services/IcafeService.ts` | All iCafe Cloud API service functions |
| `src/@types/icafe.ts` | TypeScript types for every request / response shape |

## Folder Structure

```
Icafe-Dashboard-Ecme/
├── public/                     # Static public assets
├── src/
│   ├── @types/                 # Global TypeScript type declarations
│   │   ├── auth.ts             # Auth-related types
│   │   ├── common.tsx          # Common/shared types
│   │   ├── navigation.ts       # Navigation tree types
│   │   ├── routes.tsx          # Route config types
│   │   └── theme.ts            # Theme config types
│   │
│   ├── assets/                 # Static source assets
│   │   ├── maps/               # GeoJSON map data files
│   │   ├── markdown/           # Markdown docs for UI component demos
│   │   │   ├── js/             # JavaScript examples
│   │   │   └── ts/             # TypeScript examples
│   │   ├── styles/             # Global CSS / Tailwind layers
│   │   └── svg/                # SVG icon files
│   │
│   ├── auth/                   # Authentication context & provider
│   │   ├── AuthContext.ts      # React context definition
│   │   ├── AuthProvider.tsx    # Provider component
│   │   ├── useAuth.ts          # useAuth() hook
│   │   └── index.ts            # Re-exports
│   │
│   ├── components/             # Shared, reusable React components
│   │   ├── layouts/            # Page layout wrappers
│   │   │   ├── AuthLayout/     # Layout for sign-in / sign-up pages
│   │   │   └── PostLoginLayout/# Main app layout (sidebar, header, content)
│   │   ├── route/              # Route guards & route utilities
│   │   ├── shared/             # Feature-level shared components
│   │   │   ├── GanttChart/     # Gantt chart wrapper
│   │   │   ├── Masonry/        # Masonry grid layout
│   │   │   ├── RichTextEditor/ # Tiptap rich-text editor wrapper
│   │   │   └── loaders/        # Page-level loading spinners
│   │   ├── template/           # App shell components (nav, header, panels)
│   │   │   ├── HorizontalMenuContent/
│   │   │   ├── Notification/
│   │   │   ├── SidePanel/
│   │   │   ├── StackedSideNav/
│   │   │   ├── ThemeConfigurator/
│   │   │   └── VerticalMenuContent/
│   │   ├── ui/                 # Low-level UI primitives (design system)
│   │   │   ├── Alert/
│   │   │   ├── Avatar/
│   │   │   ├── Badge/
│   │   │   ├── Button/
│   │   │   ├── Calendar/
│   │   │   ├── Card/
│   │   │   ├── Carousel/
│   │   │   ├── Checkbox/
│   │   │   ├── DatePicker/
│   │   │   ├── Dialog/
│   │   │   ├── Drawer/
│   │   │   ├── Dropdown/
│   │   │   ├── Form/
│   │   │   ├── Input/
│   │   │   ├── InputGroup/
│   │   │   ├── Menu/
│   │   │   ├── Notification/
│   │   │   ├── Pagination/
│   │   │   ├── Progress/
│   │   │   ├── Radio/
│   │   │   ├── Segment/
│   │   │   ├── Select/
│   │   │   ├── Skeleton/
│   │   │   ├── Slider/
│   │   │   ├── Spinner/
│   │   │   ├── Steps/
│   │   │   ├── Switcher/
│   │   │   ├── Table/
│   │   │   ├── Tabs/
│   │   │   ├── Tag/
│   │   │   ├── TimeInput/
│   │   │   ├── Timeline/
│   │   │   ├── Tooltip/
│   │   │   ├── Upload/
│   │   │   ├── hooks/          # UI-level hooks (useWindowSize, etc.)
│   │   │   ├── toast/          # Toast notification utility
│   │   │   └── utils/          # UI utility helpers
│   │   └── view/               # Composite view-level components
│   │       ├── Activity/       # Activity feed display
│   │       ├── CreditCardDialog/ # Credit card add/edit dialog
│   │       └── FileIcon/       # File-type icon display
│   │
│   ├── configs/                # Application configuration files
│   │   ├── app.config.ts       # Core app settings (entry path, locale, mock)
│   │   ├── chart.config.ts     # ApexCharts default options
│   │   ├── endpoint.config.ts  # API endpoint base URLs
│   │   ├── firebase.config.ts  # Firebase initialization
│   │   ├── navigation-icon.config.tsx  # Nav icon map
│   │   ├── preset-theme-schema.config.ts # Preset color schemas
│   │   ├── theme.config.ts     # Default theme settings
│   │   ├── navigation.config/  # Sidebar navigation tree
│   │   │   ├── dashboards.navigation.config.ts
│   │   │   ├── concepts.navigation.config.ts
│   │   │   └── index.ts        # Combined navigation export
│   │   └── routes.config/      # Route definitions
│   │       ├── authRoute.ts
│   │       ├── conceptsRoute.ts
│   │       ├── dashboardsRoute.ts
│   │       ├── othersRoute.ts
│   │       ├── uiComponentsRoute.tsx
│   │       ├── routes.config.ts # publicRoutes + protectedRoutes
│   │       └── index.ts
│   │
│   ├── constants/              # App-wide constant values
│   │   ├── api.constant.ts     # API endpoint constants
│   │   ├── app.constant.ts     # Misc app constants
│   │   ├── chart.constant.ts   # Chart color constants
│   │   ├── countries.constant.ts # Country list
│   │   ├── navigation.constant.ts # Nav item type constants
│   │   ├── roles.constant.ts   # User role constants (ADMIN, USER)
│   │   ├── route.constant.ts   # Route prefix constants
│   │   └── theme.constant.ts   # Theme enum constants
│   │
│   ├── locales/                # Internationalization (i18next)
│   │   ├── lang/               # Translation JSON files (en.json, …)
│   │   ├── locales.ts          # i18n initialization
│   │   └── index.ts            # Re-exports dateLocales + i18n instance
│   │
│   ├── mock/                   # Mock API layer (axios-mock-adapter)
│   │   ├── data/               # Static mock data objects
│   │   ├── fakeApi/            # Mock handler definitions per endpoint
│   │   ├── MockAdapter.ts      # Axios mock adapter setup
│   │   └── index.ts            # Registers all fake API handlers
│   │
│   ├── services/               # API service functions
│   │   ├── axios/              # Axios instance & interceptors
│   │   └── *.ts                # Per-domain API service files (e.g. AuthService.ts)
│   │
│   ├── store/                  # Global state management (Zustand)
│   │   ├── authStore.ts        # Auth state (user, token, role)
│   │   ├── localeStore.ts      # Active locale state
│   │   ├── routeKeyStore.ts    # Current route key state
│   │   └── themeStore.ts       # Theme state (mode, layout, schema)
│   │
│   ├── utils/                  # Utility / helper functions
│   │   ├── hoc/                # Higher-order components (withHeaderItem, etc.)
│   │   ├── hooks/              # Custom React hooks (useAppSelector, etc.)
│   │   └── *.ts                # Standalone helpers (classNames, sleep, etc.)
│   │
│   ├── views/                  # Page-level view components (route targets)
│   │   ├── auth/               # Authentication pages
│   │   │   ├── ForgotPassword/
│   │   │   ├── OtpVerification/
│   │   │   ├── ResetPassword/
│   │   │   ├── SignIn/
│   │   │   └── SignUp/
│   │   ├── concepts/           # Feature concept pages
│   │   │   ├── accounts/       # Settings, Activity Log, Roles, Pricing
│   │   │   ├── calendar/       # Full-calendar event view
│   │   │   └── mail/           # Mail client
│   │   ├── dashboards/         # Dashboard pages
│   │   │   ├── AnalyticDashboard/
│   │   │   ├── MarketingDashboard/
│   │   │   ├── Overview/
│   │   │   └── ProjectDashboard/
│   │   ├── demo/               # Example/demo route views
│   │   ├── others/             # Misc pages (AccessDenied, etc.)
│   │   └── ui-components/      # UI component showcase pages
│   │       ├── common/         # Button, Grid, Typography, Icons
│   │       ├── data-display/   # Avatar, Badge, Calendar, Cards, …
│   │       ├── feedback/       # Alert, Dialog, Drawer, Progress, …
│   │       ├── forms/          # Checkbox, DatePicker, Input, Select, …
│   │       ├── graph/          # Charts, Maps
│   │       └── navigation/     # Dropdown, Menu, Pagination, Steps, Tabs
│   │
│   ├── App.tsx                 # Root component (Theme → Router → Layout)
│   ├── index.css               # Tailwind base import
│   ├── main.tsx                # React DOM entry point
│   └── vite-env.d.ts           # Vite environment type declarations
│
├── index.html                  # HTML shell
├── vite.config.ts              # Vite build configuration
├── tailwind.config.cjs         # Tailwind CSS configuration
├── tsconfig.json               # TypeScript compiler options
├── eslint.config.mjs           # ESLint flat config
├── postcss.config.cjs          # PostCSS config (Tailwind + nesting)
├── .prettierrc                 # Prettier formatting rules
└── package.json                # Dependencies & npm scripts
```

---

### Demo
Check out the [Live Demo](https://ecme-react.themenate.net/) to explore the template in action.

### Guide
Please visit the [Online Documentation](https://ecme-react.themenate.net/guide/documentation/introduction) for detailed guides, setup instructions, and customization options.

