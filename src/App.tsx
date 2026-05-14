import { useEffect, Component, ErrorInfo, ReactNode } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import { useConfigStore } from "./store/configStore";
import { useSettingsStore } from "./store/settingsStore";
import Onboarding from "./pages/Onboarding";
import { Skills } from "./pages/Skills";
import { DispatchPage } from "./pages/Dispatch";
import { SettingsPage } from "./pages/Settings";
import {
  Loader2,
  BookOpen,
  Send,
  Settings as SettingsIcon,
  AlertTriangle,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    toast.error(`应用发生错误: ${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              哎呀，出问题了
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {this.state.error?.message || "应用遇到了一个意外错误。"}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full"
            >
              刷新页面
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Navigation() {
  useLocation();

  const navItems = [
    { path: "/", label: "Skills", icon: <BookOpen className="h-4 w-4 mr-2" /> },
    {
      path: "/dispatches",
      label: "Dispatches",
      icon: <Send className="h-4 w-4 mr-2" />,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: <SettingsIcon className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
      <div className="container mx-auto flex items-center gap-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mr-8">
          SkillVault
        </h1>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
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
  const { loadThemeConfig } = useSettingsStore();

  useEffect(() => {
    getBasePath();
    loadThemeConfig();
  }, [getBasePath, loadThemeConfig]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!basePath) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Skills />} />
          <Route path="/dispatches" element={<DispatchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
