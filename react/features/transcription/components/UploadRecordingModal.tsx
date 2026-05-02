import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from '../../../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

interface UploadRecordingModalProps {
    isOpen: boolean;
    onClose: () => void;
    meetingId: string;
}

export const UploadRecordingModal: React.FC<UploadRecordingModalProps> = ({ isOpen, onClose, meetingId }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', 'en'); // Defaulting to English for now

        try {
            const res = await fetch(`/api/v1/meetings/${meetingId}/recordings/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await res.json();
            console.log('Upload successful. Job ID:', data.job_id);
            onClose(); // Close on success
            
            // Note: In a real implementation, you'd dispatch an action to track the job progress
            // using the /api/v1/jobs/{jobId}/progress SSE endpoint.
            
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during upload.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload Recording</DialogTitle>
                    <DialogDescription>
                        Upload a video or audio recording of a meeting to generate an AI transcript.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="recording">Recording File</Label>
                        <Input 
                            id="recording" 
                            type="file" 
                            accept="audio/*,video/*" 
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </div>
                    {error && (
                        <div className="text-sm font-medium text-destructive">
                            {error}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading || !file}>
                        {isUploading ? 'Uploading...' : 'Upload & Transcribe'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
