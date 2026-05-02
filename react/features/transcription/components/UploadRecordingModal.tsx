import React, { useState, useRef } from 'react';
import { Button } from '../../../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog';
import { UploadCloud, FileAudio, FileVideo, CheckCircle2, Loader2, X } from 'lucide-react';

interface UploadRecordingModalProps {
    isOpen: boolean;
    onClose: () => void;
    meetingId: string;
}

export const UploadRecordingModal: React.FC<UploadRecordingModalProps> = ({ isOpen, onClose, meetingId }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
            setErrorMsg('Please upload an audio or video file.');
            setUploadState('error');
            setTimeout(() => setUploadState('idle'), 3000);
            return;
        }

        setFileName(file.name);
        setUploadState('uploading');
        setProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', 'en');

        try {
            // Fake upload progress for UX
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 500);

            const res = await fetch(`/api/v1/meetings/${meetingId}/recordings/upload`, {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Upload failed');
            }
            
            setProgress(100);
            
            setUploadState('processing');
            
            // In a real app we'd connect to SSE. For now, simulate transition to success
            setTimeout(() => {
                setUploadState('success');
                setTimeout(() => {
                    onClose();
                    // Reset after close
                    setTimeout(() => {
                        setUploadState('idle');
                        setProgress(0);
                    }, 500);
                }, 2000);
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'An error occurred during upload.');
            setUploadState('error');
            setTimeout(() => setUploadState('idle'), 3000);
        }
    };

    // Keep state clean on open
    React.useEffect(() => {
        if (isOpen && uploadState === 'success') {
            setUploadState('idle');
            setProgress(0);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#0F0F11] border-[#2E2E35] text-[#FAFAFA] p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b border-[#2E2E35] bg-[#18181B]">
                    <DialogTitle className="text-lg">Upload Recording</DialogTitle>
                </DialogHeader>
                
                <div className="p-6">
                    {uploadState === 'idle' && (
                        <div 
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                                isDragging ? 'border-[#C01140] bg-[#C01140]/5' : 'border-[#2E2E35] hover:border-[#A1A1AA] hover:bg-[#232328]'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileInput} 
                                className="hidden" 
                                accept="audio/*,video/*"
                            />
                            <div className="flex justify-center mb-4">
                                <UploadCloud className={`h-10 w-10 ${isDragging ? 'text-[#C01140]' : 'text-[#A1A1AA]'}`} />
                            </div>
                            <p className="text-[#FAFAFA] font-medium mb-1">Click or drag file to upload</p>
                            <p className="text-xs text-[#A1A1AA]">MP4, MOV, MP3, WAV, M4A up to 2GB</p>
                        </div>
                    )}

                    {uploadState === 'uploading' && (
                        <div className="border border-[#2E2E35] rounded-xl p-6 bg-[#232328]">
                            <div className="flex items-center mb-4">
                                {fileName.endsWith('.mp4') || fileName.endsWith('.mov') ? (
                                    <FileVideo className="h-8 w-8 text-[#A1A1AA] mr-3" />
                                ) : (
                                    <FileAudio className="h-8 w-8 text-[#A1A1AA] mr-3" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[#FAFAFA] text-sm font-medium truncate">{fileName}</p>
                                    <p className="text-[#A1A1AA] text-xs">Uploading... {progress}%</p>
                                </div>
                            </div>
                            <div className="w-full bg-[#0F0F11] rounded-full h-1.5 overflow-hidden">
                                <div className="bg-[#C01140] h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {uploadState === 'processing' && (
                        <div className="border border-[#2E2E35] rounded-xl p-6 bg-[#232328] flex flex-col items-center justify-center text-center">
                            <Loader2 className="h-8 w-8 text-[#C01140] animate-spin mb-3" />
                            <p className="text-[#FAFAFA] font-medium">Processing Recording</p>
                            <p className="text-[#A1A1AA] text-xs mt-1">Extracting audio & transcribing. This may take a few minutes for long meetings due to AI cold starts.</p>
                        </div>
                    )}

                    {uploadState === 'success' && (
                        <div className="border border-green-900/50 rounded-xl p-6 bg-green-900/20 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="h-8 w-8 text-green-500 mb-3" />
                            <p className="text-green-500 font-medium">Upload Complete!</p>
                            <p className="text-[#A1A1AA] text-xs mt-1">Processing continues in the background.</p>
                        </div>
                    )}

                    {uploadState === 'error' && (
                        <div className="border border-red-900 rounded-xl p-6 bg-red-900/20 text-center">
                            <p className="text-red-500 font-medium">Upload Failed</p>
                            <p className="text-[#A1A1AA] text-xs mt-1">{errorMsg}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
