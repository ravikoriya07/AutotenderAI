# AutotenderAI Dashboard Frontend

Modern AI SaaS dashboard built with Next.js 14, React, TypeScript, Tailwind CSS, and Shadcn-style components.

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (icons)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- **/** - Redirects to Projects
- **/projects** - Project list with filters, sorting, search
- **/my-drafts** - Personal document drafts
- **/ideator** - AI idea generation with context options
- **/extract** - File upload and extraction configuration
- **/research** - AI chat interface for research
- **/answer-bank** - Editable Q&A table with tags
- **/library** - Folder tree and document management
- **/search** - Global search
- **/settings** - Settings placeholder

## Structure

```
src/
├── app/           # App Router pages
├── components/
│   ├── layout/   # Sidebar, Header, PageContainer, DashboardLayout
│   └── ui/       # Card, Button, Input, Table, Tabs, etc.
├── contexts/     # SidebarContext
└── lib/          # utils (cn)
```

## Responsive

- **Desktop**: Full sidebar, collapsible to narrow
- **Tablet**: Collapsible sidebar
- **Mobile**: Sidebar as overlay drawer, hamburger menu in header
