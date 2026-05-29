import { Card } from './Card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-[#a0a0a0] mb-1">{title}</p>
            <p className="text-3xl font-medium text-white">{value}</p>
            {trend && (
              <p className={`text-sm mt-2 ${trend.isPositive ? 'text-[#00B894]' : 'text-[#FF4757]'}`}>
                {trend.value}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex items-center justify-center">
            <Icon className="w-6 h-6 text-[#0d0d0d]" />
          </div>
        </div>
      </div>
    </Card>
  );
}
