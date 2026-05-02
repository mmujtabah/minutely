import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, FileVideo, CheckCircle2, Loader2 } from 'lucide-react';
import { generateRoomWithoutSeparator } from '@jitsi/js-utils/random';

const UploadZoneCard = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState('');
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
            alert('Please upload an audio or video file.');
            return;
        }

        setFileName(file.name);
        setUploadState('uploading');
        setProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', 'en');
        
        // Generate a random meeting ID for this uploaded file
        const meetingId = generateRoomWithoutSeparator();

        try {
            // Fake upload progress for UX (Browser doesn't support fetch upload progress easily without XHR)
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 500);

            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = {};
            if (session) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch(`/api/v1/meetings/${meetingId}/recordings/upload`, {
                method: 'POST',
                headers,
                body: formData,
            });

            clearInterval(progressInterval);

            if (!res.ok) throw new Error('Upload failed');
            
            setProgress(100);
            const data = await res.json();
            
            setUploadState('processing');
            
            if (data.job_id) {
                const eventSource = new EventSource(`/api/v1/jobs/${data.job_id}/progress`);
                
                eventSource.onmessage = (e) => {
                    try {
                        const job = JSON.parse(e.data);
                        if (job.status === 'completed') {
                            setUploadState('success');
                            eventSource.close();
                            setTimeout(() => {
                                setUploadState('idle');
                                setProgress(0);
                            }, 3000);
                        } else if (job.status === 'failed') {
                            setUploadState('error');
                            eventSource.close();
                            setTimeout(() => setUploadState('idle'), 3000);
                        }
                    } catch (err) {
                        console.error("Error parsing SSE data", err);
                    }
                };

                eventSource.onerror = () => {
                    console.error("SSE connection error");
                    eventSource.close();
                    setUploadState('error');
                    setTimeout(() => setUploadState('idle'), 3000);
                };
            } else {
                // Fallback if no job_id
                setTimeout(() => {
                    setUploadState('success');
                    setTimeout(() => {
                        setUploadState('idle');
                        setProgress(0);
                    }, 3000);
                }, 2000);
            }

        } catch (err) {
            console.error(err);
            setUploadState('error');
            setTimeout(() => setUploadState('idle'), 3000);
        }
    };

    return (
        <div className="bg-[#FFFFFF] border border-[#E4E4E7] rounded-xl overflow-hidden shadow-sm">
            <div className="p-6">
                <h2 className="text-lg font-semibold text-[#18181B] mb-1">Upload Recording</h2>
                <p className="text-[#71717A] text-sm mb-4">Generate transcripts and AI insights from past meetings.</p>
                
                {uploadState === 'idle' && (
                    <div 
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                            isDragging ? 'border-[#C01140] bg-[#C01140]/5' : 'border-[#E4E4E7] hover:border-[#A1A1AA] hover:bg-[#F4F4F5]'
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
                        <p className="text-[#18181B] font-medium mb-1">Click or drag file to upload</p>
                        <p className="text-xs text-[#71717A]">MP4, MOV, MP3, WAV, M4A up to 2GB</p>
                    </div>
                )}

                {uploadState === 'uploading' && (
                    <div className="border border-[#E4E4E7] rounded-xl p-6 bg-[#F4F4F5]">
                        <div className="flex items-center mb-4">
                            {fileName.endsWith('.mp4') || fileName.endsWith('.mov') ? (
                                <FileVideo className="h-8 w-8 text-[#71717A] mr-3" />
                            ) : (
                                <FileAudio className="h-8 w-8 text-[#71717A] mr-3" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[#18181B] text-sm font-medium truncate">{fileName}</p>
                                <p className="text-[#71717A] text-xs">Uploading... {progress}%</p>
                            </div>
                        </div>
                        <div className="w-full bg-[#E4E4E7] rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#C01140] h-1.5 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}

                {uploadState === 'processing' && (
                    <div className="border border-[#E4E4E7] rounded-xl p-6 bg-[#F4F4F5] flex flex-col items-center justify-center text-center">
                        <Loader2 className="h-8 w-8 text-[#C01140] animate-spin mb-3" />
                        <p className="text-[#18181B] font-medium">Processing Recording</p>
                        <p className="text-[#71717A] text-xs mt-1">Extracting audio & transcribing. This may take a few minutes for long meetings due to AI cold starts.</p>
                    </div>
                )}

                {uploadState === 'success' && (
                    <div className="border border-[#E4E4E7] rounded-xl p-6 bg-green-50 flex flex-col items-center justify-center text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600 mb-3" />
                        <p className="text-green-600 font-medium">Upload Complete!</p>
                        <p className="text-[#71717A] text-xs mt-1">Processing continues in the background.</p>
                    </div>
                )}

                {uploadState === 'error' && (
                    <div className="border border-red-200 rounded-xl p-6 bg-red-50 text-center">
                        <p className="text-red-600 font-medium">Upload Failed</p>
                        <p className="text-[#71717A] text-xs mt-1">Please try again later.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadZoneCard;
