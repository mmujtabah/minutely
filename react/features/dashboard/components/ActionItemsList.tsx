import React, { useEffect, useState } from 'react';
import { CheckSquare, Clock, Calendar, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '../../supabase-auth/client';

interface IProps {
    items?: any[];
    loading?: boolean;
}

const ActionItemsList: React.FC<IProps> = ({ items = [], loading = false }) => {
    const [actionItems, setActionItems] = useState<any[]>([]);

    useEffect(() => {
        setActionItems(items);
    }, [items]);

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'open' ? 'done' : 'open';
        
        // Optimistic UI update
        setActionItems(prev => prev.map(item => 
            item.id === id ? { ...item, status: newStatus } : item
        ));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`/api/v1/action-items/${id}/status`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (err) {
            console.error("Failed to update status:", err);
            // Revert on error
            setActionItems(prev => prev.map(item => 
                item.id === id ? { ...item, status: currentStatus } : item
            ));
        }
    };

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#E4E4E7] flex justify-between items-center">
                <h2 className="text-lg font-semibold text-[#18181B]">My Action Items</h2>
                <div className="flex space-x-2">
                    <span className="bg-[#F4F4F5] text-[#18181B] text-xs font-medium px-2.5 py-1 rounded-lg">
                        {actionItems.filter(i => i.status === 'open').length} Open
                    </span>
                </div>
            </div>
            
            <div className="divide-y divide-[#E4E4E7]">
                {loading ? (
                    // Skeleton loader
                    [1, 2, 3].map((i) => (
                        <div key={i} className="p-6 flex items-start animate-pulse">
                            <div className="h-5 w-5 bg-[#F4F4F5] rounded-full mr-4 flex-shrink-0"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-[#F4F4F5] rounded w-3/4 mb-3"></div>
                                <div className="flex space-x-4">
                                    <div className="h-3 bg-[#F4F4F5] rounded w-16"></div>
                                    <div className="h-3 bg-[#F4F4F5] rounded w-24"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : actionItems.length === 0 ? (
                    // Empty state
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-[#F4F4F5] rounded-full flex items-center justify-center mb-4">
                            <CheckSquare className="h-8 w-8 text-[#A1A1AA]" />
                        </div>
                        <h3 className="text-[#18181B] font-medium text-lg mb-1">No action items</h3>
                        <p className="text-[#71717A] text-sm max-w-sm">
                            You're all caught up! When Minutely detects tasks in your meetings, they will appear here.
                        </p>
                    </div>
                ) : (
                    actionItems.map((item) => (
                        <div key={item.id} className="p-6 hover:bg-[#F4F4F5] transition-colors group flex items-start">
                            <button 
                                onClick={() => toggleStatus(item.id, item.status)}
                                className="mt-0.5 mr-4 focus:outline-none flex-shrink-0"
                            >
                                {item.status === 'done' ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                    <Circle className="h-5 w-5 text-[#A1A1AA] group-hover:text-[#C01140] transition-colors" />
                                )}
                            </button>
                            
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${item.status === 'done' ? 'text-[#A1A1AA] line-through' : 'text-[#18181B]'}`}>
                                    {item.task}
                                </p>
                                
                                <div className="mt-2 flex items-center space-x-4 text-xs text-[#71717A]">
                                    {item.assignee_name && (
                                        <div className="flex items-center">
                                            <div className="h-4 w-4 rounded-full bg-[#E4E4E7] flex items-center justify-center text-[10px] mr-1.5 font-bold text-[#18181B]">
                                                {item.assignee_name.charAt(0).toUpperCase()}
                                            </div>
                                            {item.assignee_name}
                                        </div>
                                    )}
                                    <div className="flex items-center">
                                        <Calendar className="mr-1 h-3.5 w-3.5" />
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActionItemsList;
