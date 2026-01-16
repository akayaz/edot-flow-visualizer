'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowRight, Layers, Zap, FileCode } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const features = [
    {
      icon: Layers,
      title: 'Visual Architecture',
      description: 'Drag-and-drop EDOT components to build your observability topology',
    },
    {
      icon: Zap,
      title: 'Live Data Flow',
      description: 'Watch telemetry particles flow through your pipeline in real-time',
    },
    {
      icon: FileCode,
      title: 'Config Export',
      description: 'Generate production-ready Collector YAML from your visual design',
    },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-4xl mx-auto"
      >
        {/* Logo/Badge */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700 mb-8"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          <span className="text-sm text-gray-300">Powered by Elastic Distribution of OpenTelemetry</span>
        </motion.div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
            EDOT Flow
          </span>
          <br />
          <span className="text-gray-100">Visualizer</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
          Understand OpenTelemetry architecture patterns through interactive, 
          animated diagrams. Design your observability pipeline visually.
        </p>

        {/* CTA Button */}
        <motion.button
          onClick={() => router.push('/otel-flow')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow cursor-pointer"
        >
          Launch Visualizer
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4">
              <feature.icon className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Architecture Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-24 text-center"
      >
        <p className="text-sm text-gray-500 mb-4">Reference Architecture Patterns</p>
        <div className="flex flex-wrap justify-center gap-4">
          {['Simple', 'Agent', 'Gateway', 'Production'].map((pattern) => (
            <span
              key={pattern}
              className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-gray-300"
            >
              {pattern}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="mt-24 text-center text-sm text-gray-500">
        <p>
          Learn more about{' '}
          <a
            href="https://www.elastic.co/docs/reference/opentelemetry"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline"
          >
            EDOT Documentation
          </a>
        </p>
      </footer>
    </main>
  );
}
