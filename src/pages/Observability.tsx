import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  Database,
  AlertTriangle,
  Zap,
  Target,
  Clock,
  BarChart3,
  Shield,
  Calendar,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { getAllScans, getFindings } from '@/lib/api';
import { toast } from 'sonner';

interface TimeSeriesData {
  time: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#10b981',
};

export default function Observability() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [metrics, setMetrics] = useState({
    totalScans: 0,
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    avgSuccessRate: 0,
    avgDetectionTime: 0,
    totalDataExfil: 0,
  });
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [toolStats, setToolStats] = useState<{ name: string; scans: number; findings: number }[]>([]);

  useEffect(() => {
    loadMetrics();
    
    // Auto-refresh every 10 seconds for dynamic updates
    const interval = setInterval(() => {
      loadMetrics();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const [scans, findings] = await Promise.all([
        getAllScans(),
        getFindings(),
      ]);

      // Generate actual time series data from findings grouped by hour
      const now = new Date();
      const hours: Record<number, TimeSeriesData> = {};
      
      // Initialize 24 hours with zeros
      for (let i = 0; i < 24; i++) {
        const hour = (now.getHours() - 23 + i) % 24;
        hours[hour] = {
          time: `${String(hour).padStart(2, '0')}:00`,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          total: 0,
        };
      }

      // Populate with actual findings data
      findings.forEach((finding) => {
        try {
          const findingTime = new Date(finding.timestamp);
          const hour = findingTime.getHours();
          
          if (hours[hour]) {
            if (finding.severity === 'Critical') hours[hour].critical++;
            else if (finding.severity === 'High') hours[hour].high++;
            else if (finding.severity === 'Medium') hours[hour].medium++;
            else if (finding.severity === 'Low') hours[hour].low++;
            
            hours[hour].total++;
          }
        } catch (e) {
          // Skip findings with invalid timestamps
        }
      });

      const timeSeriesArray = Object.values(hours);

      // Calculate metrics from real data
      const criticalFindings = findings.filter((f) => f.severity === 'Critical').length;
      const highFindings = findings.filter((f) => f.severity === 'High').length;
      const mediumFindings = findings.filter((f) => f.severity === 'Medium').length;
      const lowFindings = findings.filter((f) => f.severity === 'Low').length;

      const avgSuccessRate =
        scans.length > 0
          ? scans.reduce((sum, s) => sum + (s.metrics?.attackSuccessRate || 0), 0) / scans.length
          : 0;
      const avgDetectionTime =
        scans.length > 0
          ? scans.reduce((sum, s) => sum + (s.metrics?.detectionTime || 0), 0) / scans.length
          : 0;
      const totalDataExfil = scans.reduce((sum, s) => sum + (s.metrics?.dataExfilVolume || 0), 0);

      // Group by tool
      const toolGroups = scans.reduce(
        (acc, scan) => {
          const tool = scan.toolName;
          if (!acc[tool]) {
            acc[tool] = { name: tool, scans: 0, findings: 0 };
          }
          acc[tool].scans += 1;
          return acc;
        },
        {} as Record<string, { name: string; scans: number; findings: number }>
      );

      findings.forEach((finding) => {
        const scanResults = scans.filter((s) => s.id === finding.scanId);
        if (scanResults.length > 0) {
          const tool = scanResults[0].toolName;
          if (toolGroups[tool]) {
            toolGroups[tool].findings += 1;
          }
        }
      });

      setTimeSeriesData(timeSeriesArray);
      setToolStats(Object.values(toolGroups));
      setLastUpdated(new Date().toLocaleTimeString());
      setMetrics({
        totalScans: scans.length,
        totalFindings: findings.length,
        criticalCount: criticalFindings,
        highCount: highFindings,
        mediumCount: mediumFindings,
        lowCount: lowFindings,
        avgSuccessRate: avgSuccessRate,
        avgDetectionTime: avgDetectionTime,
        totalDataExfil: totalDataExfil,
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const MetricCard = ({ icon: Icon, label, value, unit, color }: any) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm h-full">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{label}</p>
              <p className={`text-4xl font-bold ${color}`}>
                {typeof value === 'number' ? value.toFixed(1) : value}
                <span className="text-xs text-gray-400 ml-2">{unit}</span>
              </p>
            </div>
            <div
              className={`p-3 rounded-lg ${color
                .replace('text-', 'bg-')
                .replace('500', '500/20')}`}
            >
              <Icon className={`w-6 h-6 ${color}`} />
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/projects')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
                Observability & Analytics
              </h1>
              <p className="text-gray-400">
                Cross-project security metrics and insights
                {lastUpdated && <span className="ml-4 text-cyan-400">● Auto-updating • Last: {lastUpdated}</span>}
              </p>
            </div>
            <Button
              onClick={loadMetrics}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh Now
            </Button>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <MetricCard
            icon={Shield}
            label="Total Scans"
            value={metrics.totalScans}
            unit="scans"
            color="text-blue-500"
          />
          <button onClick={()=>navigate("/findings")}>
          <MetricCard
            icon={AlertTriangle}
            label="Total Findings"
            value={metrics.totalFindings}
            unit="findings"
            color="text-red-500"
          />
          </button>
          <MetricCard
            icon={Zap}
            label="Avg Success Rate"
            value={metrics.avgSuccessRate}
            unit="%"
            color="text-orange-500"
          />
          <MetricCard
            icon={Database}
            label="Data Exfiltrated"
            value={metrics.totalDataExfil}
            unit="GB"
            color="text-purple-500"
          />
        </motion.div>

        {/* Severity Breakdown Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-400 uppercase tracking-wide mb-1">Critical</p>
                  <p className="text-3xl font-bold text-red-500">{metrics.criticalCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-400 uppercase tracking-wide mb-1">High</p>
                  <p className="text-3xl font-bold text-orange-500">{metrics.highCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-yellow-400 uppercase tracking-wide mb-1">Medium</p>
                  <p className="text-3xl font-bold text-yellow-500">{metrics.mediumCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-400 uppercase tracking-wide mb-1">Low</p>
                  <p className="text-3xl font-bold text-blue-500">{metrics.lowCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid lg:grid-cols-2 gap-6 mb-8"
        >
          {/* Findings Over Time */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
                Real-Time Findings Distribution (Last 24h)
                <span className="text-xs font-normal text-cyan-400 ml-auto">Live Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    stackId="1"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="medium"
                    stackId="1"
                    stroke="#eab308"
                    fill="#eab308"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tool Statistics */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Tool Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={toolStats} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" />
                  <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="scans" fill="#3B82F6" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="findings" fill="#EF4444" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Stacked Bar Chart - Severity Trend */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-500" />
                Security Trend - Last 24 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="critical" stackId="a" fill={COLORS.critical} />
                  <Bar dataKey="high" stackId="a" fill={COLORS.high} />
                  <Bar dataKey="medium" stackId="a" fill={COLORS.medium} />
                  <Bar dataKey="low" stackId="a" fill={COLORS.low} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Detection Efficiency</p>
                  <p className="text-2xl font-bold text-green-500">
                    {(metrics.avgDetectionTime ? (60 / metrics.avgDetectionTime).toFixed(1) : 0)}x
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Scans detected per hour on average
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Attack Success Rate</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {metrics.avgSuccessRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Average across all tools
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Critical Issues</p>
                  <p className="text-2xl font-bold text-red-500">
                    {metrics.criticalCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Requiring immediate attention
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}