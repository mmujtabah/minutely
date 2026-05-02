import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTranscriptPanel } from '../actions';
import { TranscriptionState } from '../reducer';
import { Button } from '../../../components/ui/button';
import { Bot } from 'lucide-react';

export const ToggleSidebarButton: React.FC = () => {
    const dispatch = useDispatch();
    const { isTranscriptPanelOpen } = useSelector((state: any) => state['features/transcription'] as TranscriptionState);

    return (
        <div className="absolute top-4 right-4 z-40">
            <Button 
                onClick={() => dispatch(toggleTranscriptPanel())}
                variant={isTranscriptPanelOpen ? "secondary" : "default"}
                size="sm"
                className="shadow-lg"
            >
                <Bot className="h-4 w-4 mr-2" />
                {isTranscriptPanelOpen ? 'Hide Minutely AI' : 'Minutely AI'}
            </Button>
        </div>
    );
};
