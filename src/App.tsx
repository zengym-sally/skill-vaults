import { useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import { useConfigStore } from "./store/configStore";
import Onboarding from "./pages/Onboarding";
import { Skills } from "./pages/Skills";
import { DispatchPage } from "./pages/Dispatch";
import { Loader2, BookOpen, Send } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

function Navigation() {
  useLocation();

  const navItems = [
    { path: "/", label: "Skills", icon: <BookOpen className="h-4 w-4 mr-2" /> },
    {
      path: "/dispatches",
      label: "Dispatches",
      icon: <Send className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="container mx-auto flex items-center gap-6">
        <h1 className="text-xl font-bold text-gray-900 mr-8">SkillVault</h1>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AppContent() {
  const { basePath, isLoading, getBasePath } = useConfigStore();

  useEffect(() => {
    getBasePath();
  }, [getBasePath]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  if (!basePath) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Skills />} />
          <Route path="/dispatches" element={<DispatchPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
