import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Plus, ArrowRight, Shield, Calendar, Loader2, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createProject, getProjects, type TargetType, type Project } from '@/lib/api';
import { toast } from 'sonner';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetUrl: '',
    targetType: 'Chat UI' as TargetType,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      toast.error('Failed to load projects. Make sure backend is running.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!formData.name || !formData.targetUrl) return;
    
    setCreating(true);
    try {
      const project = await createProject(formData);
      setProjects([...projects, project]);
      setOpen(false);
      setFormData({ name: '', description: '', targetUrl: '', targetType: 'Chat UI' });
      toast.success('Project created successfully!');
      navigate(`/scanner?projectId=${project.id}`);
    } catch (error) {
      toast.error('Failed to create project. Check backend connection.');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
              Projects
            </h1>
            <p className="text-gray-400">Manage your AI security testing projects</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/observability')}
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Observability
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/25">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800 text-white">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Set up a new AI security testing project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My AI Application"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-gray-950 border-gray-800 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the project..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-gray-950 border-gray-800 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="targetUrl">Target URL</Label>
                  <Input
                    id="targetUrl"
                    placeholder="https://api.example.com"
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                    className="bg-gray-950 border-gray-800 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="targetType">Target Type</Label>
                  <Select
                    value={formData.targetType}
                    onValueChange={(value) => setFormData({ ...formData, targetType: value as TargetType })}
                  >
                    <SelectTrigger className="bg-gray-950 border-gray-800 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="Chat UI">Chat UI</SelectItem>
                      <SelectItem value="RAG">RAG System</SelectItem>
                      <SelectItem value="Agent">AI Agent</SelectItem>
                      <SelectItem value="File Upload">File Upload</SelectItem>
                      <SelectItem value="Log Data">Log Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreateProject}
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                  disabled={!formData.name || !formData.targetUrl || creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <Shield className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Create your first project to get started</p>
            <Button
              onClick={() => setOpen(true)}
              variant="outline"
              className="!bg-transparent !hover:bg-transparent border-gray-700 text-gray-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:border-cyan-500/50 transition-all cursor-pointer group">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 group-hover:text-cyan-500 transition-colors">
                      <Shield className="w-5 h-5" />
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {project.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="font-mono text-cyan-500">{project.targetType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/scanner?projectId=${project.id}`)}
                      className="w-full mt-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 border border-cyan-500/30"
                    >
                      Run Security Test
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}