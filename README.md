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

