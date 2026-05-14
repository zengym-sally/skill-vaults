import { useEffect } from "react";
import { useSkillStore } from "../store/skillStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Search,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${className}`}
  >
    {children}
  </span>
);

export function Skills() {
  const {
    skills,
    loading,
    error,
    searchQuery,
    fetchSkills,
    discoverSkills,
    deleteSkill,
    setSearchQuery,
    clearError,
  } = useSkillStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchSkills({ search: query });
  };

  const handleDiscover = () => {
    discoverSkills({ force: true })
      .then(() => {
        toast.success("Skills discovered successfully");
      })
      .catch((error) => {
        toast.error(`Failed to discover skills: ${error.message}`);
      });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete skill "${name}"?`)) {
      deleteSkill(id)
        .then(() => {
          toast.success("Skill deleted successfully");
        })
        .catch((error) => {
          toast.error(`Failed to delete skill: ${error.message}`);
        });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "archived":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "broken":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType) {
      case "github":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "private-git":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "local":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Skills</h1>
          <p className="text-gray-500">Manage your skill library</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleDiscover} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Discover Skills
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Skill
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search skills by name, description, or tags..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10"
          />
        </div>
      </div>

      {loading && skills.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && skills.length === 0 && (
        <div className="flex flex-col justify-center items-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium mb-2">No skills found</h3>
          <p className="text-gray-500 mb-6 max-w-md">
            {searchQuery
              ? "No skills match your search criteria. Try adjusting your search terms."
              : 'You haven\'t added any skills yet. Click "Discover Skills" to scan your repositories for skills.'}
          </p>
          {!searchQuery && (
            <Button onClick={handleDiscover}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Discover Skills
            </Button>
          )}
        </div>
      )}

      {skills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <Card
              key={skill.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-semibold">
                    {skill.name}
                  </CardTitle>
                  <Badge className={getStatusColor(skill.status)}>
                    {skill.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge className={getSourceTypeColor(skill.sourceType)}>
                    {skill.sourceType}
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {skill.type}
                  </Badge>
                  {skill.qualityScore && (
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                      {skill.qualityScore}/100
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {skill.description && (
                  <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {skill.description}
                  </p>
                )}
                {skill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {skill.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {skill.dependencies.length > 0 && (
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="font-medium">Dependencies: </span>
                    {skill.dependencies.length}
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between">
                <div className="text-xs text-gray-500">
                  Updated {new Date(skill.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => handleDelete(skill.id, skill.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
