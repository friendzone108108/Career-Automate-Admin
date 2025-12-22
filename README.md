# Career-Automate-Admin

Admin panel for the CareerAutoMate platform. This microservice handles admin authentication, user management, document verification, API key management, and system controls.

## 🚀 Features

- **Dashboard**: Overview of platform statistics (total users, active job searchers, pending documents, etc.)
- **User Management**: View, search, and manage all platform users
- **Document Verification**: Approve/reject user documents with rejection notes
- **API Key Management**: Manage third-party API keys for job searching services
- **Notifications**: Send broadcast notifications to all users or individual users
- **Control Mechanism**: Pause/resume/stop user automations with emergency stop capability
- **Admin Settings**: Profile management and password security

## 🛠️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/friendzone108108/Career-Automate-Admin.git
cd Career-Automate-Admin
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with the following variables:
```env
# Admin Supabase Database
NEXT_PUBLIC_ADMIN_SUPABASE_URL=your_admin_supabase_url
NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY=your_admin_supabase_anon_key
ADMIN_SUPABASE_SERVICE_ROLE_KEY=your_admin_service_role_key

# Frontend Supabase Database (Read-Only)
FRONTEND_SUPABASE_URL=your_frontend_supabase_url
FRONTEND_SUPABASE_SERVICE_ROLE_KEY=your_frontend_service_role_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🗄️ Database Setup

Run the SQL schema in your Admin Supabase SQL Editor. See `docs/schema.sql` for the complete schema.

### Required Tables (Admin DB):
- `admin_users` - Admin user profiles
- `api_keys` - Third-party API key management
- `document_verifications` - Document approval tracking
- `user_automation_status` - User automation controls
- `system_settings` - Global system settings
- `activity_logs` - Admin activity audit log
- `blocked_users` - Blocked users tracking
- `broadcast_notifications` - Notifications sent to users

## 📁 Project Structure

```
src/
├── app/
│   ├── login/          # Login page
│   ├── dashboard/      # Dashboard page
│   ├── users/          # User management
│   │   └── [userId]/
│   │       └── documents/  # Document verification
│   ├── api-keys/       # API key management
│   ├── notifications/  # Notifications page
│   ├── control/        # Control mechanism
│   └── settings/       # Admin settings
├── components/
│   ├── ui/             # Reusable UI components
│   ├── AdminLayout.tsx
│   ├── Header.tsx
│   └── Sidebar.tsx
├── context/
│   └── AuthContext.tsx # Authentication context
└── lib/
    ├── supabase.ts     # Supabase client config
    └── utils.ts        # Utility functions
```

## 🔐 Admin Users

Admin users must be:
1. Created in Supabase Auth
2. Added to the `admin_users` table with matching UUID

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ADMIN_SUPABASE_URL` | Admin Supabase project URL |
| `NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY` | Admin Supabase anonymous key |
| `ADMIN_SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase service role key |
| `FRONTEND_SUPABASE_URL` | Frontend Supabase project URL |
| `FRONTEND_SUPABASE_SERVICE_ROLE_KEY` | Frontend Supabase service role key |

## 🚢 Deployment

### Deploy to Vercel:

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## 📄 License

MIT License
