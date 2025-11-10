import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFindings, createJiraTicket, type Severity, type Finding } from '@/lib/api';
import { toast } from 'sonner';

export default function Findings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState<string | null>(null);

  useEffect(() => {
    loadFindings();
  }, [projectId]);

  const loadFindings = async () => {
    try {
      const data = await getFindings(projectId || undefined);
      setFindings(data);
    } catch (error) {
      toast.error('Failed to load findings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const severityConfig: Record<Severity, { color: string; bgColor: string }> = {
    Critical: { color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/50' },
    High: { color: 'text-orange-500', bgColor: 'bg-orange-500/10 border-orange-500/50' },
    Medium: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10 border-yellow-500/50' },
    Low: { color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/50' },
    Info: { color: 'text-gray-500', bgColor: 'bg-gray-500/10 border-gray-500/50' },
  };

  const handleCreateTicket = async (findingId: string) => {
    setCreatingTicket(findingId);
    try {
      const result = await createJiraTicket(findingId);
      if (result.url) {
        toast.success(`JIRA ticket ${result.ticketId} created successfully!`, {
          action: {
            label: 'View Ticket',
            onClick: () => window.open(result.url, '_blank'),
          },
        });
      } else {
        toast.success(`JIRA ticket ${result.ticketId} created successfully!`);
      }

      if (result.note) {
        toast.info(result.note);
      }
    } catch (error) {
      toast.error('Failed to create JIRA ticket');
    } finally {
      setCreatingTicket(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const groupedFindings = findings.reduce((acc, finding) => {
    if (!acc[finding.severity]) acc[finding.severity] = [];
    acc[finding.severity].push(finding);
    return acc;
  }, {} as Record<Severity, typeof findings>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(projectId ? `/dashboard?projectId=${projectId}` : '/projects')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
            Security Findings
          </h1>
          <p className="text-gray-400">
            {findings.length} vulnerabilit{findings.length !== 1 ? 'ies' : 'y'} detected
          </p>
        </div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          {(['Critical', 'High', 'Medium', 'Low', 'Info'] as Severity[]).map((severity) => {
            const count = groupedFindings[severity]?.length || 0;
            return (
              <Card key={severity} className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-1 ${severityConfig[severity].color}`}>
                      {count}
                    </div>
                    <div className="text-sm text-gray-400">{severity}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Findings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-gray-900/50 border border-gray-800">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Critical">Critical</TabsTrigger>
              <TabsTrigger value="High">High</TabsTrigger>
              <TabsTrigger value="Medium">Medium</TabsTrigger>
              <TabsTrigger value="Low">Low</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {findings.map((finding, idx) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={severityConfig[finding.severity].bgColor}>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {finding.severity}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(finding.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <CardTitle className="text-xl mb-2">{finding.title}</CardTitle>
                            <CardDescription className="text-gray-400">
                              {finding.description}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCreateTicket(finding.id)}
                            disabled={creatingTicket === finding.id}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 border border-cyan-500/30"
                          >
                            {creatingTicket === finding.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                Create JIRA Ticket
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Evidence */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Evidence
                          </h4>
                          <ScrollArea className="h-32 w-full rounded-md border border-gray-800 bg-gray-950/50 p-3">
                            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                              {finding.evidence}
                            </pre>
                          </ScrollArea>
                        </div>

                        {/* Mitigation */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Recommended Mitigation
                          </h4>
                          <p className="text-sm text-gray-400 bg-gray-950/50 rounded-md p-3 border border-gray-800">
                            {finding.mitigation}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((severity) => (
              <TabsContent key={severity} value={severity} className="mt-6">
                <div className="space-y-4">
                  {(groupedFindings[severity] || []).map((finding, idx) => (
                    <motion.div
                      key={finding.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-xl">{finding.title}</CardTitle>
                          <CardDescription className="text-gray-400">
                            {finding.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-400">{finding.mitigation}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}