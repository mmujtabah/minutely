import React, { useEffect, useState } from 'react';
import { Video, Clock, CheckCircle, Users } from 'lucide-react';

interface IProps {
    statsData: any;
    loading: boolean;
}

const AnimatedNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let start = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out quad
            const easeOut = progress * (2 - progress);
            setDisplayValue(Math.floor(easeOut * value));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
            }
        };

        if (value > 0) {
            requestAnimationFrame(animate);
        } else {
            setDisplayValue(0);
        }
    }, [value]);

    return <span>{displayValue}</span>;
};

const StatsRow: React.FC<IProps> = ({ statsData, loading }) => {
    const stats = [
        { label: 'Total Meetings', value: statsData?.total_meetings || 0, icon: Video, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Total' },
        { label: 'Hours Transcribed', value: statsData?.hours_transcribed || 0, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'Total' },
        { label: 'Open Action Items', value: statsData?.open_action_items || 0, icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Needs review' },
        { label: 'People Met', value: statsData?.people_met || 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50', trend: 'Total' },
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-6 shadow-sm animate-pulse">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-4 bg-[#F4F4F5] rounded w-1/2"></div>
                            <div className="h-10 w-10 bg-[#F4F4F5] rounded-lg"></div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <div className="h-8 bg-[#F4F4F5] rounded w-1/3"></div>
                            <div className="h-3 bg-[#F4F4F5] rounded w-1/4"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
                <div key={i} className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[#71717A] text-sm font-medium">{stat.label}</h3>
                        <div className={`p-2 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <p className="text-3xl font-bold text-[#18181B]">
                            {stat.label === 'Hours Transcribed' && typeof stat.value === 'number' 
                                ? stat.value.toFixed(1) 
                                : <AnimatedNumber value={stat.value as number} />}
                        </p>
                        <p className="text-xs text-[#71717A] font-medium">{stat.trend}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StatsRow;
