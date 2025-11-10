import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Severity } from '@/lib/mockApi';

interface ScanCardProps {
  toolName: string;
  status: 'running' | 'completed' | 'failed';
  severity?: Severity;
  evidence?: string;
  timestamp: Date;
}

const severityConfig: Record<Severity, { color: string; icon: React.ReactNode }> = {
  Critical: { color: 'bg-red-500/10 text-red-500 border-red-500/50', icon: <AlertCircle className="w-4 h-4" /> },
  High: { color: 'bg-orange-500/10 text-orange-500 border-orange-500/50', icon: <AlertTriangle className="w-4 h-4" /> },
  Medium: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50', icon: <AlertTriangle className="w-4 h-4" /> },
  Low: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/50', icon: <Info className="w-4 h-4" /> },
  Info: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/50', icon: <Info className="w-4 h-4" /> },
};

export default function ScanCard({ toolName, status, severity, evidence, timestamp }: ScanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-500" />
              {toolName}
            </CardTitle>
            {status === 'running' && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/50">
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex items-center gap-1"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Running
                </motion.div>
              </Badge>
            )}
            {status === 'completed' && severity && (
              <Badge variant="outline" className={severityConfig[severity].color}>
                <div className="flex items-center gap-1">
                  {severityConfig[severity].icon}
                  {severity}
                </div>
              </Badge>
            )}
            {status === 'failed' && (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/50">
                Failed
              </Badge>
            )}
          </div>
          <CardDescription className="text-gray-400">
            {timestamp.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        {evidence && (
          <CardContent>
            <div className="bg-gray-950/50 rounded-md p-3 border border-gray-800">
              <p className="text-sm text-gray-300 font-mono">{evidence}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}