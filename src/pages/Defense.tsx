import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Database,
  FileText,
  Settings,
  Zap,
  Eye,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DefenseSetting {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  category: 'chat' | 'rag' | 'agent' | 'file' | 'log';
  severity: 'low' | 'medium' | 'high';
}


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

// API functions
const fetchDefenseSettings = async () => {
  try {
    const response = await fetch('/api/defense/settings');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Failed to fetch defense settings:', error);
  }
  return null;
};

const updateDefenseSetting = async (settingId: string, enabled: boolean) => {
  try {
    const response = await fetch(`/api/defense/settings/${settingId}?enabled=${enabled}`, {
      method: 'PUT',
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error for ${settingId}: ${response.status} - ${errorText}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Network error updating defense setting:', error);
    return false;
  }
};

const updateAllDefenseSettings = async (enabled: boolean) => {
  try {
    const response = await fetch(`/api/defense/settings?enabled=${enabled}`, {
      method: 'PUT',
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to update all defense settings:', error);
    return false;
  }
};

export default function Defense() {
  const navigate = useNavigate();

  const [defenseSettings, setDefenseSettings] = useState<DefenseSetting[]>([]);
  const [globalDefenseEnabled, setGlobalDefenseEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load defense settings on component mount
  useEffect(() => {
    loadDefenseSettings();
  }, []);

  // Update global state when defense settings change
  useEffect(() => {
    setGlobalDefenseEnabled(defenseSettings.every(s => s.enabled));
  }, [defenseSettings]);

  const loadDefenseSettings = async () => {
    setLoading(true);
    const data = await fetchDefenseSettings();
    if (data) {
      const settings: DefenseSetting[] = Object.entries(data.settings).map(([id, setting]: [string, any]) => ({
        id,
        name: getSettingName(id),
        description: getSettingDescription(id),
        icon: getSettingIcon(id),
        enabled: setting.enabled,
        category: setting.category,
        severity: setting.severity,
      }));
      setDefenseSettings(settings);
      setGlobalDefenseEnabled(settings.every(s => s.enabled));
    } else {
      // Fallback to default settings if API fails
      setDefenseSettings(getDefaultSettings());
    }
    setLoading(false);
  };

  const getSettingName = (id: string): string => {
    const names: Record<string, string> = {
      chat_prompt_injection: 'Chat Prompt Injection Defense',
      chat_jailbreak: 'Chat Jailbreak Defense',
      chat_data_leakage: 'Chat Data Leakage Prevention',
      rag_context_poisoning: 'RAG Context Poisoning Defense',
      rag_retrieval_filtering: 'RAG Retrieval Filtering',
      agent_tool_execution: 'Agent Tool Execution Control',
      agent_memory_poisoning: 'Agent Memory Poisoning Defense',
      file_upload_validation: 'File Upload Validation',
      file_metadata_filtering: 'File Metadata Filtering',
      log_data_sanitization: 'Log Data Sanitization',
    };
    return names[id] || id;
  };

  const getSettingDescription = (id: string): string => {
    const descriptions: Record<string, string> = {
      chat_prompt_injection: 'Blocks prompt injection attacks in chat interfaces by filtering malicious keywords and patterns',
      chat_jailbreak: 'Prevents jailbreak attempts by detecting and blocking system prompt override techniques',
      chat_data_leakage: 'Blocks attempts to extract sensitive information from chat responses',
      rag_context_poisoning: 'Validates and sanitizes context data to prevent poisoning attacks',
      rag_retrieval_filtering: 'Filters retrieved documents for malicious content before processing',
      agent_tool_execution: 'Validates and controls tool execution to prevent unauthorized actions',
      agent_memory_poisoning: 'Protects agent memory from malicious data injection',
      file_upload_validation: 'Scans and validates uploaded files for malicious content',
      file_metadata_filtering: 'Filters sensitive metadata from file processing',
      log_data_sanitization: 'Sanitizes log data to prevent sensitive information exposure',
    };
    return descriptions[id] || '';
  };

  const getSettingIcon = (id: string) => {
    const icons: Record<string, React.ReactNode> = {
      chat_prompt_injection: <MessageSquare className="w-5 h-5" />,
      chat_jailbreak: <Shield className="w-5 h-5" />,
      chat_data_leakage: <Lock className="w-5 h-5" />,
      rag_context_poisoning: <Database className="w-5 h-5" />,
      rag_retrieval_filtering: <Eye className="w-5 h-5" />,
      agent_tool_execution: <Settings className="w-5 h-5" />,
      agent_memory_poisoning: <Database className="w-5 h-5" />,
      file_upload_validation: <FileText className="w-5 h-5" />,
      file_metadata_filtering: <FileText className="w-5 h-5" />,
      log_data_sanitization: <FileText className="w-5 h-5" />,
    };
    return icons[id] || <Shield className="w-5 h-5" />;
  };

  const getDefaultSettings = (): DefenseSetting[] => [
    {
      id: 'chat_prompt_injection',
      name: 'Chat Prompt Injection Defense',
      description: 'Blocks prompt injection attacks in chat interfaces by filtering malicious keywords and patterns',
      icon: <MessageSquare className="w-5 h-5" />,
      enabled: false,
      category: 'chat',
      severity: 'high',
    },
    {
      id: 'chat_jailbreak',
      name: 'Chat Jailbreak Defense',
      description: 'Prevents jailbreak attempts by detecting and blocking system prompt override techniques',
      icon: <Shield className="w-5 h-5" />,
      enabled: false,
      category: 'chat',
      severity: 'high',
    },
    {
      id: 'chat_data_leakage',
      name: 'Chat Data Leakage Prevention',
      description: 'Blocks attempts to extract sensitive information from chat responses',
      icon: <Lock className="w-5 h-5" />,
      enabled: false,
      category: 'chat',
      severity: 'medium',
    },
    {
      id: 'rag_context_poisoning',
      name: 'RAG Context Poisoning Defense',
      description: 'Validates and sanitizes context data to prevent poisoning attacks',
      icon: <Database className="w-5 h-5" />,
      enabled: false,
      category: 'rag',
      severity: 'high',
    },
    {
      id: 'rag_retrieval_filtering',
      name: 'RAG Retrieval Filtering',
      description: 'Filters retrieved documents for malicious content before processing',
      icon: <Eye className="w-5 h-5" />,
      enabled: false,
      category: 'rag',
      severity: 'medium',
    },
    {
      id: 'agent_tool_execution',
      name: 'Agent Tool Execution Control',
      description: 'Validates and controls tool execution to prevent unauthorized actions',
      icon: <Settings className="w-5 h-5" />,
      enabled: false,
      category: 'agent',
      severity: 'high',
    },
    {
      id: 'agent_memory_poisoning',
      name: 'Agent Memory Poisoning Defense',
      description: 'Protects agent memory from malicious data injection',
      icon: <Database className="w-5 h-5" />,
      enabled: false,
      category: 'agent',
      severity: 'medium',
    },
    {
      id: 'file_upload_validation',
      name: 'File Upload Validation',
      description: 'Scans and validates uploaded files for malicious content',
      icon: <FileText className="w-5 h-5" />,
      enabled: false,
      category: 'file',
      severity: 'high',
    },
    {
      id: 'file_metadata_filtering',
      name: 'File Metadata Filtering',
      description: 'Filters sensitive metadata from file processing',
      icon: <FileText className="w-5 h-5" />,
      enabled: false,
      category: 'file',
      severity: 'low',
    },
    {
      id: 'log_data_sanitization',
      name: 'Log Data Sanitization',
      description: 'Sanitizes log data to prevent sensitive information exposure',
      icon: <FileText className="w-5 h-5" />,
      enabled: false,
      category: 'log',
      severity: 'medium',
    },
  ];

  const categories = [
    { id: 'chat', name: 'Chat Interfaces', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'rag', name: 'RAG Systems', color: 'bg-green-500/20 text-green-400' },
    { id: 'agent', name: 'AI Agents', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'file', name: 'File Uploads', color: 'bg-orange-500/20 text-orange-400' },
    { id: 'log', name: 'Log Data', color: 'bg-red-500/20 text-red-400' },
  ];

  const toggleDefense = async (id: string) => {
    const currentSetting = defenseSettings.find(s => s.id === id);
    if (!currentSetting) return;

    const newEnabled = !currentSetting.enabled;

    // Update UI immediately for better UX
    setDefenseSettings(prev => prev.map(setting =>
      setting.id === id ? { ...setting, enabled: newEnabled } : setting
    ));

    // Update backend
    const success = await updateDefenseSetting(id, newEnabled);
    if (!success) {
      // Revert on failure
      setDefenseSettings(prev => prev.map(setting =>
        setting.id === id ? { ...setting, enabled: !newEnabled } : setting
      ));
      toast.error('Failed to update defense setting');
    } else {
      toast.success(`${newEnabled ? 'Enabled' : 'Disabled'} ${currentSetting.name}`);
    }
  };

  const toggleGlobalDefense = async () => {
    const newState = !globalDefenseEnabled;

    // Update UI immediately
    setDefenseSettings(prev =>
      prev.map(setting => ({ ...setting, enabled: newState }))
    );

    // Update backend
    const success = await updateAllDefenseSettings(newState);
    if (!success) {
      // Revert on failure
      setDefenseSettings(prev =>
        prev.map(setting => ({ ...setting, enabled: !newState }))
      );
      toast.error('Failed to update global defense settings');
    } else {
      toast.success(`${newState ? 'Enabled' : 'Disabled'} all defense systems`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const enabledCount = defenseSettings.filter(s => s.enabled).length;
  const totalCount = defenseSettings.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading defense settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-cyan-500 bg-clip-text text-transparent">
                Defense System
              </h1>
              <p className="text-gray-400">Configure security defenses for your AI applications</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Defenses Active</p>
                <p className="text-2xl font-bold text-cyan-500">{enabledCount}/{totalCount}</p>
              </div>
              <div className={`p-3 rounded-lg ${enabledCount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {enabledCount > 0 ? (
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                ) : (
                  <ShieldX className="w-6 h-6 text-red-400" />
                )}
              </div>
            </div>
          </div>

          {/* Global Toggle */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${globalDefenseEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                    <Shield className={`w-5 h-5 ${globalDefenseEnabled ? 'text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Global Defense System</h3>
                    <p className="text-sm text-gray-400">
                      Enable all defenses simultaneously for maximum protection
                    </p>
                  </div>
                </div>
                <Switch
                  checked={globalDefenseEnabled}
                  onCheckedChange={toggleGlobalDefense}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Defense Categories */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {categories.map(category => {
            const categorySettings = defenseSettings.filter(s => s.category === category.id);

            return (
              <motion.div key={category.id} variants={itemVariants}>
                <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={`${category.color} border-0`}>
                          {category.name}
                        </Badge>
                        <span className="text-lg">
                          {categorySettings.filter(s => s.enabled).length}/{categorySettings.length} Active
                        </span>
                      </div>
                      {categorySettings.every(s => s.enabled) && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categorySettings.map(setting => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${setting.enabled ? 'bg-cyan-500/20' : 'bg-gray-600/20'}`}>
                            {setting.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{setting.name}</h4>
                              <Badge className={`${getSeverityColor(setting.severity)} border-0 text-xs`}>
                                {setting.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400">{setting.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={setting.enabled}
                          onCheckedChange={() => toggleDefense(setting.id)}
                          className="data-[state=checked]:bg-cyan-500"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Status Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-cyan-500" />
                Defense Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {defenseSettings.filter(s => s.enabled && s.severity === 'high').length}
                  </div>
                  <p className="text-sm text-gray-400">High Priority Defenses</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-1">
                    {defenseSettings.filter(s => s.enabled && s.severity === 'medium').length}
                  </div>
                  <p className="text-sm text-gray-400">Medium Priority Defenses</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {defenseSettings.filter(s => s.enabled && s.severity === 'low').length}
                  </div>
                  <p className="text-sm text-gray-400">Low Priority Defenses</p>
                </div>
              </div>

              {enabledCount === 0 && (
                <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Warning:</span>
                    <span>All defenses are disabled. Your AI applications are vulnerable to attacks.</span>
                  </div>
                </div>
              )}

              {enabledCount > 0 && enabledCount < totalCount && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">Partial Protection:</span>
                    <span>{enabledCount} of {totalCount} defenses are active. Consider enabling all defenses for maximum security.</span>
                  </div>
                </div>
              )}

              {enabledCount === totalCount && (
                <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-medium">Full Protection:</span>
                    <span>All defenses are active. Your AI applications are fully protected.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>


      </div>
    </div>
  );
}