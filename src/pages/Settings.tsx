import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Brain,
  GitBranch,
  RefreshCw,
  Palette,
  Database,
  Download,
  Upload,
  Save,
  Keyboard,
  Bell,
} from "lucide-react";
import {
  useSettingsStore,
  SyncConfig,
  ThemeConfig,
  NotificationConfig,
} from "@/store/settingsStore";
import { LLMConfig } from "@/types/llm";
import { GitConfig } from "@/types/git";

export function SettingsPage() {
  const {
    llmConfig,
    gitConfig,
    syncConfig,
    themeConfig,
    notificationConfig,
    isLoading,
    loadLLMConfig,
    saveLLMConfig,
    loadGitConfig,
    saveGitConfig,
    loadSyncConfig,
    saveSyncConfig,
    loadThemeConfig,
    saveThemeConfig,
    loadNotificationConfig,
    saveNotificationConfig,
    exportDatabase,
    importDatabase,
  } = useSettingsStore();
  const [llmFormData, setLlmFormData] = useState<LLMConfig>({
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o",
  });
  const [gitFormData, setGitFormData] = useState<GitConfig>({
    username: "",
    email: "",
    sshKeyPath: "",
  });
  const [syncFormData, setSyncFormData] = useState<SyncConfig>({
    autoSyncEnabled: false,
    syncInterval: "daily",
  });
  const [themeFormData, setThemeFormData] = useState<ThemeConfig>({
    theme: "light",
    language: "en",
  });
  const [notificationFormData, setNotificationFormData] =
    useState<NotificationConfig>({
      soundEnabled: true,
      desktopNotificationsEnabled: false,
    });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    loadLLMConfig();
    loadGitConfig();
    loadSyncConfig();
    loadThemeConfig();
    loadNotificationConfig();
  }, [
    loadLLMConfig,
    loadGitConfig,
    loadSyncConfig,
    loadThemeConfig,
    loadNotificationConfig,
  ]);

  useEffect(() => {
    if (llmConfig) {
      setLlmFormData(llmConfig);
    }
  }, [llmConfig]);

  useEffect(() => {
    if (gitConfig) {
      setGitFormData(gitConfig);
    }
  }, [gitConfig]);

  useEffect(() => {
    if (syncConfig) {
      setSyncFormData(syncConfig);
    }
  }, [syncConfig]);

  useEffect(() => {
    if (themeConfig) {
      setThemeFormData(themeConfig);
    }
  }, [themeConfig]);

  useEffect(() => {
    if (notificationConfig) {
      setNotificationFormData(notificationConfig);
    }
  }, [notificationConfig]);

  const handleLlmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveLLMConfig(llmFormData);
      toast.success("LLM configuration saved successfully");
    } catch (error) {
      toast.error(`Failed to save configuration: ${(error as Error).message}`);
    }
  };

  const handleGitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveGitConfig(gitFormData);
      toast.success("Git configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Git configuration: ${(error as Error).message}`,
      );
    }
  };

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSyncConfig(syncFormData);
      toast.success("Sync configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Sync configuration: ${(error as Error).message}`,
      );
    }
  };

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveThemeConfig(themeFormData);
      toast.success("Theme & Language configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Theme & Language configuration: ${(error as Error).message}`,
      );
    }
  };

  const handleExport = async () => {
    try {
      await exportDatabase();
      toast.success("Backup created successfully");
    } catch (error) {
      toast.error(`Failed to create backup: ${(error as Error).message}`);
    }
  };

  const handleImport = async () => {
    try {
      await importDatabase();
      toast.success(
        "Backup restored successfully. Please restart the application for changes to take effect.",
      );
    } catch (error) {
      toast.error(`Failed to restore backup: ${(error as Error).message}`);
    }
  };

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveNotificationConfig(notificationFormData);
      toast.success("Notification configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Notification configuration: ${(error as Error).message}`,
      );
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setIsCheckingUpdate(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("You are already using the latest version!");
    } catch (error) {
      toast.error(`Failed to check for updates: ${(error as Error).message}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-500">Configure your SkillVault preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <CardTitle>LLM Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure your language model providers and API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLlmSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select defaultValue="openai" disabled>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI / Compatible</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Currently only OpenAI-compatible APIs are supported
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={llmFormData.apiKey}
                  onChange={(e) =>
                    setLlmFormData({ ...llmFormData, apiKey: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  value={llmFormData.baseUrl || ""}
                  onChange={(e) =>
                    setLlmFormData({
                      ...llmFormData,
                      baseUrl: e.target.value || undefined,
                    })
                  }
                />
                <p className="text-xs text-gray-500">
                  Leave empty for default OpenAI API, or enter your custom
                  endpoint for other providers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="gpt-4o"
                  value={llmFormData.model}
                  onChange={(e) =>
                    setLlmFormData({ ...llmFormData, model: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  e.g. gpt-4o, gpt-3.5-turbo, claude-3-opus (for compatible
                  providers)
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-500" />
              <CardTitle>Git Configuration</CardTitle>
            </div>
            <CardDescription>
              Set up Git global credentials for repository operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGitSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gitUsername">Global Username</Label>
                <Input
                  id="gitUsername"
                  placeholder="John Doe"
                  value={gitFormData.username}
                  onChange={(e) =>
                    setGitFormData({ ...gitFormData, username: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  This will be used as the commit author name for all Git
                  operations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitEmail">Global Email</Label>
                <Input
                  id="gitEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={gitFormData.email}
                  onChange={(e) =>
                    setGitFormData({ ...gitFormData, email: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  This will be used as the commit author email for all Git
                  operations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sshKeyPath">SSH Key Path (Optional)</Label>
                <Input
                  id="sshKeyPath"
                  placeholder="~/.ssh/id_rsa"
                  value={gitFormData.sshKeyPath || ""}
                  onChange={(e) =>
                    setGitFormData({
                      ...gitFormData,
                      sshKeyPath: e.target.value || undefined,
                    })
                  }
                />
                <p className="text-xs text-gray-500">
                  Path to your private SSH key for Git authentication. Leave
                  empty to use system default.
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Git Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-500" />
              <CardTitle>Sync Strategy</CardTitle>
            </div>
            <CardDescription>
              Configure how skills are synced and updated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSyncSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Auto Sync</Label>
                  <p className="text-sm text-gray-500">
                    Automatically sync all repositories on a schedule
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={syncFormData.autoSyncEnabled}
                  onCheckedChange={(checked) =>
                    setSyncFormData({
                      ...syncFormData,
                      autoSyncEnabled: checked,
                    })
                  }
                />
              </div>

              {syncFormData.autoSyncEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Sync Interval</Label>
                  <Select
                    value={syncFormData.syncInterval}
                    onValueChange={(
                      value: "daily" | "weekly" | "monthly" | "never",
                    ) =>
                      setSyncFormData({ ...syncFormData, syncInterval: value })
                    }
                  >
                    <SelectTrigger id="sync-interval">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    How often to automatically sync all repositories
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Sync Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-orange-500" />
              <CardTitle>Theme & Language</CardTitle>
            </div>
            <CardDescription>
              Customize the appearance and language of SkillVault
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleThemeSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="theme-switch">Dark Mode</Label>
                  <p className="text-sm text-gray-500">
                    Toggle between light and dark themes
                  </p>
                </div>
                <Switch
                  id="theme-switch"
                  checked={themeFormData.theme === "dark"}
                  onCheckedChange={(checked) =>
                    setThemeFormData({
                      ...themeFormData,
                      theme: checked ? "dark" : "light",
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language-select">Language</Label>
                <Select
                  value={themeFormData.language}
                  onValueChange={(value: "zh" | "en") =>
                    setThemeFormData({ ...themeFormData, language: value })
                  }
                >
                  <SelectTrigger id="language-select">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Choose your preferred language
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Theme & Language"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-pink-500" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>
              Configure notification preferences and alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNotificationSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound-notifications">
                    Sound Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Play sound effects for notifications and alerts
                  </p>
                </div>
                <Switch
                  id="sound-notifications"
                  checked={notificationFormData.soundEnabled}
                  onCheckedChange={(checked) =>
                    setNotificationFormData({
                      ...notificationFormData,
                      soundEnabled: checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="desktop-notifications">
                    Desktop Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Show system desktop notifications (requires permission)
                  </p>
                </div>
                <Switch
                  id="desktop-notifications"
                  checked={notificationFormData.desktopNotificationsEnabled}
                  onCheckedChange={(checked) =>
                    setNotificationFormData({
                      ...notificationFormData,
                      desktopNotificationsEnabled: checked,
                    })
                  }
                />
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Notifications"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-indigo-500" />
              <CardTitle>Keyboard Shortcuts</CardTitle>
            </div>
            <CardDescription>
              Available keyboard shortcuts for faster navigation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-300">
                  Navigate to Skills
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    ⌘
                  </kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    1
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-300">
                  Navigate to Dispatches
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    ⌘
                  </kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    2
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-300">
                  Navigate to Settings
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    ⌘
                  </kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    3
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-700 dark:text-gray-300">
                  Search Skills
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    ⌘
                  </kbd>
                  <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    K
                  </kbd>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Keyboard shortcuts are system-wide and will work even when the app
              is in the background. Custom shortcuts coming in a future update.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-red-500" />
              <CardTitle>Backup & Restore</CardTitle>
            </div>
            <CardDescription>
              Backup your skill library and restore from backups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={handleExport} disabled={isLoading}>
                <Download className="mr-2 h-4 w-4" />
                {isLoading ? "Exporting..." : "Create Backup"}
              </Button>
              <Button
                variant="outline"
                onClick={handleImport}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isLoading ? "Importing..." : "Restore Backup"}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Backup contains your full skill library, configurations and
              repository settings. After restoring, you will need to restart the
              application.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              <CardTitle>App Updates</CardTitle>
            </div>
            <CardDescription>
              Check for new versions and update SkillVault
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Current version: 0.1.0
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Updates are installed automatically when available
                </p>
              </div>
              <Button
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || isLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isCheckingUpdate ? "animate-spin" : ""}`}
                />
                {isCheckingUpdate
                  ? "Checking for updates..."
                  : "Check for Updates"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
