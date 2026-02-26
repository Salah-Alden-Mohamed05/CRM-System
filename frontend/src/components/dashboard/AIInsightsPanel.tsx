'use client';

import { useState, useEffect } from 'react';
import { aiAPI } from '@/lib/api';
import { Brain, AlertTriangle, Info, TrendingUp, DollarSign, Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Insight {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}

const severityConfig = {
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: <Info className="w-4 h-4" />, iconBg: 'bg-blue-100 text-blue-600' },
  warning: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: <AlertTriangle className="w-4 h-4" />, iconBg: 'bg-yellow-100 text-yellow-600' },
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: <AlertTriangle className="w-4 h-4" />, iconBg: 'bg-red-100 text-red-600' },
};

const typeIcons: Record<string, React.ReactNode> = {
  sla: <AlertTriangle className="w-4 h-4" />,
  overdue: <DollarSign className="w-4 h-4" />,
  delay: <Package className="w-4 h-4" />,
  deals: <TrendingUp className="w-4 h-4" />,
};

export default function AIInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [forecast, setForecast] = useState<{
    nextMonth: number; nextQuarter: number; trend: string; confidence: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [insRes, foreRes] = await Promise.all([
          aiAPI.getInsights(),
          aiAPI.forecastRevenue(),
        ]);
        setInsights(insRes.data.data);
        setForecast(foreRes.data.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">AI Insights & Alerts</h2>
          <p className="text-xs text-gray-400">Automated analysis & predictions</p>
        </div>
      </div>

      {/* Revenue Forecast */}
      {forecast && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-purple-700">Revenue Forecast</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              forecast.trend === 'up' ? 'bg-green-100 text-green-700' :
              forecast.trend === 'down' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {forecast.trend === 'up' ? '↑' : forecast.trend === 'down' ? '↓' : '→'} {forecast.trend}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-xs text-gray-500">Next Month</p>
              <p className="font-bold text-gray-900">{fmt(forecast.nextMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Next Quarter</p>
              <p className="font-bold text-gray-900">{fmt(forecast.nextQuarter)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{forecast.confidence}% confidence</p>
        </div>
      )}

      {/* Insights */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-green-600 text-sm">✓</span>
          </div>
          <p className="text-sm text-gray-500">All systems normal</p>
          <p className="text-xs text-gray-400">No alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => {
            const config = severityConfig[insight.severity];
            return (
              <div key={i} className={`p-3 rounded-lg border ${config.bg}`}>
                <div className="flex items-start gap-2">
                  <div className={`p-1 rounded-md ${config.iconBg} flex-shrink-0 mt-0.5`}>
                    {typeIcons[insight.type] || config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${config.text}`}>{insight.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-tight">{insight.message}</p>
                    {insight.actionLabel && insight.actionUrl && (
                      <Link
                        href={insight.actionUrl}
                        className={`text-xs font-medium ${config.text} flex items-center gap-1 mt-1 hover:underline`}
                      >
                        {insight.actionLabel} <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
