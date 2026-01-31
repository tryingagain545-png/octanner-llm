import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLogs } from '@/lib/api';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
  ip?: string;
  request?: string;
  metadata?: Record<string, unknown>;
}

interface WebSocketLogData {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  ip?: string;
  request?: string;
  metadata?: Record<string, unknown>;
}

const COLORS = {
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
};

const LogIcon = ({ level }: { level: LogEntry['level'] }) => {
  switch (level) {
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
};

export default function Logs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    loadLogs();

    // WebSocket connection for real-time updates
    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:8000/api/logs/stream`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Logs WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'logs_update' && data.logs) {
            const newLogs: LogEntry[] = data.logs.map((log: WebSocketLogData) => ({
              id: log.id,
              timestamp: log.timestamp,
              level: log.level as LogEntry['level'],
              source: log.source,
              message: log.message,
              ip: log.ip,
              request: log.request,
              metadata: log.metadata,
            }));
            setLogs(newLogs);
            setLastUpdated(new Date().toLocaleTimeString());
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Logs WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('Logs WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 2000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, levelFilter, sourceFilter]);

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

  const loadLogs = async () => {
    try {
      const logEntries = await getLogs(1000); // Get up to 1000 most recent logs
      setLogs(logEntries);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.request?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Source', 'Message', 'Request', 'IP'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`,
        log.request || '',
        log.ip || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getUniqueSources = () => {
    return Array.from(new Set(logs.map(log => log.source)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/observability')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Observability
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
                System Logs
              </h1>
              <p className="text-gray-400">
                Real-time log monitoring across all services
                {lastUpdated && <span className="ml-4 text-cyan-400">● Live • Last: {lastUpdated}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadLogs}
                variant="outline"
                className="border-gray-700 hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={exportLogs}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700"
                  />
                </div>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {getUniqueSources().map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoscroll"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="autoscroll" className="text-sm text-gray-400">
                    Auto-scroll
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-4 gap-4 mb-6"
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Logs</p>
                  <p className="text-2xl font-bold text-white">{logs.length}</p>
                </div>
                <Server className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-400 uppercase tracking-wide mb-1">Errors</p>
                  <p className="text-2xl font-bold text-red-500">
                    {logs.filter(l => l.level === 'error').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-yellow-400 uppercase tracking-wide mb-1">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {logs.filter(l => l.level === 'warning').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-400 uppercase tracking-wide mb-1">Success</p>
                  <p className="text-2xl font-bold text-green-500">
                    {logs.filter(l => l.level === 'success').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Logs Display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-500" />
                Live Log Stream
                <span className="text-xs font-normal text-cyan-400 ml-auto">
                  Showing {filteredLogs.length} of {logs.length} logs
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-y-auto bg-gray-950 rounded-lg p-4 font-mono text-sm">
                {filteredLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No logs found matching your filters
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mb-2 pb-2 border-b border-gray-800 last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <LogIcon level={log.level} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${COLORS[log.level]}20`, color: COLORS[log.level] }}
                            >
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-xs text-cyan-400 font-medium">
                              {log.source}
                            </span>
                          </div>
                          <div className="text-gray-300 break-words">
                            {log.message}
                          </div>
                          {log.request && (
                            <div className="text-xs text-gray-500 mt-1">
                              Request: {log.request}
                            </div>
                          )}
                          {log.ip && (
                            <div className="text-xs text-gray-500">
                              IP: {log.ip}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}