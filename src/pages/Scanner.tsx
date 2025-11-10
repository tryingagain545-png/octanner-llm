import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { Play, ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getProject, TOOL_MAPPING, type ToolName, type Project, startScan } from '@/lib/api';
import { toast } from 'sonner';

export default function Scanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedTools, setSelectedTools] = useState<ToolName[]>([]);

  useEffect(() => {
    if (!projectId) {
      navigate('/projects');
      return;
    }

    loadProject();
  }, [projectId, navigate]);

  const loadProject = async () => {
    try {
      const data = await getProject(projectId!);
      setProject(data);
    } catch (error) {
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!project) return null;

  const availableTools = TOOL_MAPPING[project.targetType];

  const toggleTool = (tool: ToolName) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleRunScan = async () => {
    if (selectedTools.length === 0) return;
    
    setStarting(true);
    try {
      const result = await startScan({
        projectId: projectId!,
        tools: selectedTools,
      });
      
      toast.success('Scan started successfully!');
      navigate(`/dashboard?projectId=${projectId}&scanId=${result.scanId}&tools=${selectedTools.join(',')}`);
    } catch (error) {
      toast.error('Failed to start scan. Check backend connection.');
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const toolDescriptions: Record<ToolName, string> = {
    'PromptMap': 'Detects prompt injection and jailbreak attempts in chat interfaces',
    'RAG Tester': 'Tests RAG poisoning vulnerabilities and query manipulation',
    'Agent Fuzzer': 'Sends crafted malicious actions to AI agent APIs',
    'File Auditor': 'Checks for metadata injection and hidden prompt bytes in uploads',
    'Log Poisoner': 'Tests log parsing vulnerabilities with malformed entries',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/projects')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
            Security Scanner
          </h1>
          <p className="text-gray-400">Select tools to test {project.name}</p>
        </div>

        {/* Project Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-500" />
                Target Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Target URL:</span>
                <span className="font-mono text-cyan-500">{project.targetUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Target Type:</span>
                <span className="font-mono text-cyan-500">{project.targetType}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tool Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle>Available Security Tools</CardTitle>
              <CardDescription className="text-gray-400">
                Select one or more tools to run against your target
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availableTools.map((tool) => (
                  <motion.div
                    key={tool}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-start space-x-3 p-4 rounded-lg bg-gray-950/50 border border-gray-800 hover:border-cyan-500/50 transition-colors cursor-pointer"
                    onClick={() => toggleTool(tool)}
                  >
                    <Checkbox
                      checked={selectedTools.includes(tool)}
                      onCheckedChange={() => toggleTool(tool)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{tool}</h3>
                      <p className="text-sm text-gray-400">{toolDescriptions[tool]}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Run Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={handleRunScan}
            disabled={selectedTools.length === 0 || starting}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting Scan...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Run Security Test ({selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected)
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}