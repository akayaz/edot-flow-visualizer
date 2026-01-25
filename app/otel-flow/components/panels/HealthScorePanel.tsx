'use client';

/**
 * Health Score Panel
 *
 * Displays comprehensive health score with category breakdown,
 * recommendations, and resource estimates.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  DollarSign,
  Shield,
  Eye,
  CheckCircle,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useHealthScoreStore } from '../../store/healthScoreStore';
import type { HealthScore, HealthBreakdown, ScoredRecommendation, ResourceEstimates, Assumption } from '../../lib/health-score/types';

export function HealthScorePanel() {
  const { healthScore, isCalculating, error } = useHealthScoreStore();

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm">Error calculating health score</p>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="p-4 text-center text-gray-400">
        <Activity className="w-6 h-6 mx-auto mb-2 animate-pulse" />
        <p className="text-sm">Calculating health score...</p>
      </div>
    );
  }

  if (!healthScore) {
    return (
      <div className="p-4 text-center text-gray-400">
        <Info className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm">Build a topology to see health score</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Overall Score */}
      <ScoreHeader score={healthScore} />

      {/* Category Breakdown */}
      <CategoryBreakdown breakdown={healthScore.breakdown} />

      {/* Top Recommendations */}
      <RecommendationsList recommendations={healthScore.recommendations.slice(0, 3)} />

      {/* Resource Estimates */}
      <ResourceEstimates estimates={healthScore.estimates} />

      {/* Assumptions */}
      <AssumptionsFooter assumptions={healthScore.assumptions} />
    </div>
  );
}

// ============ Sub-components ============

function ScoreHeader({ score }: { score: HealthScore }) {
  const gradeColor: Record<string, string> = {
    S: 'text-purple-400',
    A: 'text-green-400',
    B: 'text-cyan-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };

  const gradeLabel: Record<string, string> = {
    S: 'Excellent',
    A: 'Good',
    B: 'Fair',
    C: 'Needs Improvement',
    D: 'Poor',
    F: 'Critical',
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium text-gray-100">Health Score</h3>
        <p className="text-sm text-gray-400">Architecture Quality Assessment</p>
      </div>
      <div className="text-right">
        <div className={`text-3xl font-bold ${gradeColor[score.grade]}`}>
          {score.overall}/100
        </div>
        <div className={`text-sm ${gradeColor[score.grade]}`}>
          Grade {score.grade} • {gradeLabel[score.grade]}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {score.confidence} confidence
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ breakdown }: { breakdown: HealthBreakdown }) {
  const categories = [
    { key: 'configuration' as const, icon: Activity, label: 'Configuration', color: 'cyan' },
    { key: 'performance' as const, icon: TrendingUp, label: 'Performance', color: 'blue' },
    { key: 'cost' as const, icon: DollarSign, label: 'Cost Efficiency', color: 'green' },
    { key: 'reliability' as const, icon: Shield, label: 'Reliability', color: 'purple' },
    { key: 'observability' as const, icon: Eye, label: 'Observability', color: 'amber' },
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-300">Category Breakdown</h4>
      {categories.map(({ key, icon: Icon, label, color }) => {
        const cat = breakdown[key];
        const percentage = (cat.score / cat.maxScore) * 100;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-gray-300">{label}</span>
              </div>
              <span className="text-gray-400">
                {cat.score}/{cat.maxScore}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full bg-${color}-500`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsList({ recommendations }: { recommendations: ScoredRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm p-3 bg-green-500/10 rounded-lg border border-green-500/30">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>No major issues found - architecture looks good!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-300">Top Recommendations</h4>
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200">{rec.title}</div>
              <div className="text-xs text-gray-400 mt-1">{rec.description}</div>
              {rec.action && (
                <div className="text-xs text-cyan-400 mt-1">→ {rec.action}</div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-medium text-cyan-400">+{rec.scoreImprovement}</div>
              {rec.costSavings && (
                <div className="text-xs text-green-400">-${rec.costSavings}/mo</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResourceEstimates({ estimates }: { estimates: ResourceEstimates }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-300">Resource Estimates</h4>
      <div className="grid grid-cols-2 gap-3">
        <EstimateCard
          label="Memory"
          value={`${estimates.memory.estimated}MB`}
          range={`${estimates.memory.range.min}-${estimates.memory.range.max}MB`}
          confidence={estimates.memory.confidence}
        />
        <EstimateCard
          label="Monthly Cost"
          value={`$${estimates.cost.monthlyUSD}`}
          range={`$${estimates.cost.range.min}-$${estimates.cost.range.max}`}
          confidence={estimates.cost.confidence}
        />
      </div>
      <div className="text-xs text-gray-500">
        Based on {estimates.cost.breakdown.volumeGB.toFixed(1)}GB/month •{' '}
        {estimates.cost.breakdown.samplingRate.toFixed(0)}% sampling
      </div>
    </div>
  );
}

function EstimateCard({
  label,
  value,
  range,
  confidence,
}: {
  label: string;
  value: string;
  range: string;
  confidence: string;
}) {
  const confidenceColor: Record<string, string> = {
    high: 'text-green-400',
    medium: 'text-yellow-400',
    low: 'text-red-400',
  };

  return (
    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-medium text-gray-100 mt-1">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{range}</div>
      <div className={`text-xs mt-1 ${confidenceColor[confidence]}`}>
        {confidence} confidence
      </div>
    </div>
  );
}

function AssumptionsFooter({ assumptions }: { assumptions: Assumption[] }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="pt-3 border-t border-gray-800">
      <button
        onClick={() => setShowAll(!showAll)}
        className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        <Info className="w-3 h-3" />
        <span>
          {showAll ? 'Hide' : 'View'} calculation assumptions ({assumptions.length})
        </span>
      </button>
      {showAll && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 space-y-1"
        >
          {assumptions.map((a) => (
            <div key={a.key} className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">{a.key}:</span> {a.value}
              {a.source && <span className="ml-1 text-gray-600">({a.source})</span>}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
