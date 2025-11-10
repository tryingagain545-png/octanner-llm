import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  TrendingUp,
  Database,
  AlertTriangle,
  Zap,
  Target,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getScanResults, type ToolName, type ScanResult, ScanWebSocket } from '@/lib/api';
import ScanCard from '@/components/ScanCard';
import { toast } from 'sonner';

interface MetricData {
  timestamp: string;
  name: string;
  successRate: number;
  detectionTime: number;
  dataExfil: number;
  failures: number;
}

interface AggregatedMetrics {
  totalScans: number;
  criticalFindings: number;
  averageSuccessRate: number;
  averageDetectionTime: number;
  totalDataExfil: number;
  toolPerformance: { name: string; value: number }[];
  severityDistribution: { name: string; value: number; color: string }[];
}

const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#3b82f6',
  Info: '#10b981',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const scanId = searchParams.get('scanId');
  const toolsParam = searchParams.get('tools');
  const tools = toolsParam?.split(',') as ToolName[] || [];

  const [logs, setLogs] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [metricsTimeSeries, setMetricsTimeSeries] = useState<MetricData[]>([]);
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetrics>({
    totalScans: 0,
    criticalFindings: 0,
    averageSuccessRate: 0,
    averageDetectionTime: 0,
    totalDataExfil: 0,
    toolPerformance: [],
    severityDistribution: [],
  });

  const wsRef = useRef<ScanWebSocket | null>(null);

  useEffect(() => {
    if (!projectId || !scanId || tools.length === 0) {
      navigate('/projects');
      return;
    }

    // Connect WebSocket for real-time updates
    wsRef.current = new ScanWebSocket(
      scanId,
      (log) => {
        setLogs((prev) => [...prev, log]);
        setProgress((prev) => Math.min(prev + (100 / (tools.length * 8)), 100));
      },
      (result) => {
        setScanResults((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((r) => r.id === result.id);
          if (idx >= 0) {
            updated[idx] = result;
          } else {
            updated.push(result);
          }

          // Update time series data
          if (result.metrics) {
            setMetricsTimeSeries((prevData) => [
              ...prevData,
              {
                timestamp: new Date().toLocaleTimeString(),
                name: result.toolName,
                successRate: result.metrics.attackSuccessRate,
                detectionTime: result.metrics.detectionTime,
                dataExfil: result.metrics.dataExfilVolume,
                failures: result.metrics.repeatFailures,
              },
            ]);

            // Update aggregated metrics
            updateAggregatedMetrics(updated);
          }

          return updated;
        });

        // Check if all scans completed
        if (result.status === 'completed' || result.status === 'failed') {
          const allCompleted = scanResults.every((r) => r.status !== 'running');
          if (allCompleted) {
            setIsScanning(false);
            setProgress(100);
          }
        }
      },
      (error) => {
        toast.error(`WebSocket error: ${error}`);
        pollScanResults();
      }
    );

    wsRef.current.connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [projectId, scanId, tools, navigate]);

  const updateAggregatedMetrics = (results: ScanResult[]) => {
    const completedResults = results.filter((r) => r.metrics);
    
    if (completedResults.length === 0) return;

    const totalScans = results.length;
    const criticalCount = results.filter((r) => r.severity === 'Critical').length;
    const avgSuccessRate =
      completedResults.reduce((sum, r) => sum + r.metrics!.attackSuccessRate, 0) /
      completedResults.length;
    const avgDetectionTime =
      completedResults.reduce((sum, r) => sum + r.metrics!.detectionTime, 0) /
      completedResults.length;
    const totalDataExfil = completedResults.reduce(
      (sum, r) => sum + r.metrics!.dataExfilVolume,
      0
    );

    const toolPerformance = results.map((r) => ({
      name: r.toolName,
      value: r.metrics?.attackSuccessRate || 0,
    }));

    const severityCounts = {
      Critical: results.filter((r) => r.severity === 'Critical').length,
      High: results.filter((r) => r.severity === 'High').length,
      Medium: results.filter((r) => r.severity === 'Medium').length,
      Low: results.filter((r) => r.severity === 'Low').length,
      Info: results.filter((r) => r.severity === 'Info').length,
    };

    const severityDistribution = Object.entries(severityCounts)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => ({
        name: level,
        value: count,
        color: SEVERITY_COLORS[level as keyof typeof SEVERITY_COLORS],
      }));

    setAggregatedMetrics({
      totalScans,
      criticalFindings: criticalCount,
      averageSuccessRate: avgSuccessRate,
      averageDetectionTime: avgDetectionTime,
      totalDataExfil: totalDataExfil,
      toolPerformance,
      severityDistribution,
    });
  };

  const pollScanResults = async () => {
    const interval = setInterval(async () => {
      try {
        const results = await getScanResults(projectId!);
        setScanResults(results);

        const allCompleted = results.every((r) => r.status !== 'running');
        if (allCompleted) {
          setIsScanning(false);
          setProgress(100);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  const completedScans = scanResults.filter((s) => s.status === 'completed').length;
  const totalScans = tools.length;

  const MetricCard = ({ icon: Icon, label, value, unit, color }: any) => (
    <motion.div variants={itemVariants}>
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>
                {typeof value === 'number' ? value.toFixed(1) : value}
                <span className="text-sm text-gray-400 ml-1">{unit}</span>
              </p>
            </div>
            <div className={`p-3 rounded-lg ${color.replace('text', 'bg').replace('500', '500/20')}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            variant="ghost"
            onClick={() => navigate('/projects')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
                Live Scan Dashboard
              </h1>
              <p className="text-gray-400">Real-time security testing with comprehensive metrics</p>
            </div>
            {!isScanning && (
              <Button
                onClick={() => navigate(`/findings?projectId=${projectId}`)}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                View Findings
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  Scan Progress
                </span>
                <span className="text-sm font-normal text-gray-400">
                  {completedScans} / {totalScans} completed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" />
              {isScanning && (
                <p className="text-sm text-gray-400 mt-2">Scanning in progress...</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Metrics Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <MetricCard
            icon={Zap}
            label="Attack Success Rate"
            value={aggregatedMetrics.averageSuccessRate}
            unit="%"
            color="text-red-500"
          />
          <MetricCard
            icon={Database}
            label="Total Data Exfiltrated"
            value={aggregatedMetrics.totalDataExfil}
            unit="GB"
            color="text-orange-500"
          />
          <MetricCard
            icon={Clock}
            label="Avg Detection Time"
            value={aggregatedMetrics.averageDetectionTime}
            unit="mins"
            color="text-blue-500"
          />
          <MetricCard
            icon={Target}
            label="Critical Findings"
            value={aggregatedMetrics.criticalFindings}
            unit=""
            color="text-red-600"
          />
        </motion.div>

        {/* Charts Section */}
        {metricsTimeSeries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid lg:grid-cols-2 gap-6 mb-8"
          >
            {/* Attack Success Rate Line Chart */}
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                  Attack Success Rate Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metricsTimeSeries}>
                    <defs>
                      <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => `${(value as number).toFixed(1)}%`}
                    />
                    <Area
                      type="monotone"
                      dataKey="successRate"
                      stroke="#06B6D4"
                      fillOpacity={1}
                      fill="url(#colorSuccessRate)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detection Time Chart */}
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-500" />
                  Detection Time by Tool
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metricsTimeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => `${(value as number).toFixed(2)} mins`}
                    />
                    <Bar dataKey="detectionTime" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Data Exfiltration Chart */}
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  Data Exfiltration Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metricsTimeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => `${(value as number).toFixed(2)} GB`}
                    />
                    <Line
                      type="monotone"
                      dataKey="dataExfil"
                      stroke="#A855F7"
                      strokeWidth={2}
                      dot={{ fill: '#A855F7', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution Pie Chart */}
            {aggregatedMetrics.severityDistribution.length > 0 && (
              <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Severity Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={aggregatedMetrics.severityDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {aggregatedMetrics.severityDistribution.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tool Performance Chart */}
            {aggregatedMetrics.toolPerformance.length > 0 && (
              <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Tool Performance Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={aggregatedMetrics.toolPerformance}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9CA3AF" />
                      <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => `${(value as number).toFixed(1)}%`}
                      />
                      <Bar dataKey="value" fill="#3B82F6" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Results and Logs Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scan Results */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-cyan-500" />
                  Scan Results ({scanResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {scanResults.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Waiting for scan results...</p>
                  ) : (
                    scanResults.map((result) => (
                      <ScanCard
                        key={result.id}
                        toolName={result.toolName}
                        status={result.status}
                        severity={result.severity}
                        evidence={result.evidence}
                        timestamp={new Date(result.timestamp)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Logs */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  Live Logs ({logs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] w-full rounded-md border border-gray-800 bg-gray-950/50 p-4">
                  <div className="space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                      <p className="text-gray-600">Waiting for logs...</p>
                    ) : (
                      logs.map((log, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-gray-300 hover:bg-gray-800/50 px-2 py-1 rounded"
                        >
                          <span className="text-cyan-400">[{new Date().toLocaleTimeString()}]</span>{' '}
                          <span className="text-gray-400">{log}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}