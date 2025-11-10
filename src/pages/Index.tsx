import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Shield, Zap, Target, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 sm:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Logo/Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm mb-8"
            >
              <Shield className="w-5 h-5 text-cyan-500" />
              <span className="text-sm font-medium text-cyan-500">AI Red Team Platform</span>
            </motion.div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-cyan-500 bg-clip-text text-transparent">
              Secure AI Systems
              <br />
              Before Attackers Do
            </h1>

            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Comprehensive security testing dashboard for AI applications. Test Chat UIs, RAG systems, AI Agents, and more with automated vulnerability detection.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => navigate('/projects')}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
              >
                Get Started
                <Zap className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                onClick={() => navigate('/defense')}
                variant="outline"
                className="!bg-transparent !hover:bg-transparent border-gray-700 text-gray-300 hover:border-gray-600 px-8 py-6 text-lg rounded-xl"
              >
                Defense System
                <Shield className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="!bg-transparent !hover:bg-transparent border-gray-700 text-gray-300 hover:border-gray-600 px-8 py-6 text-lg rounded-xl"
              >
                View Demo
              </Button>
            </div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="grid md:grid-cols-3 gap-6 mt-24"
          >
            {[
              {
                icon: <Target className="w-8 h-8 text-cyan-500" />,
                title: 'Multi-Target Testing',
                description: 'Test Chat UIs, RAG systems, AI Agents, file uploads, and log data',
              },
              {
                icon: <Zap className="w-8 h-8 text-cyan-500" />,
                title: 'Real-Time Monitoring',
                description: 'Live scan results, streaming logs, and instant vulnerability detection',
              },
              {
                icon: <TrendingUp className="w-8 h-8 text-cyan-500" />,
                title: 'Actionable Insights',
                description: 'Detailed findings with severity ratings, evidence, and mitigation steps',
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
                <div className="relative bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}