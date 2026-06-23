const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'services', 'frontend', 'web', 'src');

const dirs = [
  'app',
  'assets',
  'components/alerts',
  'components/cards',
  'components/charts',
  'components/forms',
  'components/layout',
  'components/map',
  'components/satellite',
  'components/ui',
  'features/analytics',
  'features/dashboard',
  'features/lands',
  'features/map',
  'hooks',
  'pages/about',
  'pages/compare',
  'pages/dashboard',
  'pages/lands',
  'pages/logs',
  'pages/methodology',
  'pages/profile',
  'pages/team',
  'routes',
  'services/analytics',
  'services/api',
  'services/auth',
  'services/lands',
  'store',
  'types',
  'utils'
];

dirs.forEach(dir => {
  const fullPath = path.join(srcDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    fs.writeFileSync(path.join(fullPath, '.gitkeep'), '');
  }
});

const files = {
  'components/layout/Sidebar.jsx': `export default function Sidebar() {
  return <aside style={{ width: '250px', borderRight: '1px solid #ccc', padding: '1rem' }}>Sidebar Placeholder</aside>;
}`,
  'components/layout/Topbar.jsx': `export default function Topbar() {
  return <header style={{ height: '60px', borderBottom: '1px solid #ccc', padding: '1rem' }}>Topbar Placeholder</header>;
}`,
  'components/layout/AppLayout.jsx': `import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}`,
  'pages/lands/LandsPage.jsx': `export default function LandsPage() { return <div>Lands Explorer Page</div>; }`,
  'pages/lands/AddLandPage.jsx': `export default function AddLandPage() { return <div>Add Land Page</div>; }`,
  'pages/lands/LandDetailsPage.jsx': `import { useParams } from "react-router-dom";
export default function LandDetailsPage() { 
  const { id } = useParams();
  return <div>Land Details Page for {id}</div>; 
}`,
  'pages/compare/CompareLandsPage.jsx': `export default function CompareLandsPage() { return <div>Compare Lands Page</div>; }`,
  'pages/methodology/MethodologyPage.jsx': `export default function MethodologyPage() { return <div>Data & Methodology Page</div>; }`,
  'pages/team/TeamPage.jsx': `export default function TeamPage() { return <div>Team Page</div>; }`,
  'pages/about/AboutPage.jsx': `export default function AboutPage() { return <div>About Project Page</div>; }`,
  'pages/profile/ProfilePage.jsx': `export default function ProfilePage() { return <div>User Profile Page</div>; }`,
  'pages/logs/LogsPage.jsx': `export default function LogsPage() { return <div>Logs / Monitoring Page</div>; }`
};

Object.entries(files).forEach(([file, content]) => {
  const fullPath = path.join(srcDir, file);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content);
  }
});

console.log('Skeleton generated successfully.');
