"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  isDisabled?: boolean;
  className?: string;
}

export function VoiceInput({ onTranscript, onRecordingChange, isDisabled = false, className }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onresult = (event: any) => {
      interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Send real-time updates
      const currentText = finalTranscript + interimTranscript;
      if (currentText.trim()) {
        onTranscript(currentText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setIsProcessing(false);

      if (event.error === 'no-speech') {
        // No speech detected, continue listening
        setTimeout(() => {
          if (isRecording) {
            recognition.start();
          }
        }, 100);
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        // Restart recognition if we're still in recording mode
        setTimeout(() => {
          if (isRecording) {
            recognition.start();
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setIsProcessing(false);
    onRecordingChange?.(true);
  }, [onTranscript, isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(false);
    onRecordingChange?.(false);
  }, [onRecordingChange]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      setIsProcessing(true);
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useState(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={className}
          disabled={isDisabled || isProcessing}
          onClick={toggleRecording}
          size="sm"
          variant={isRecording ? "destructive" : "ghost"}
          type="button"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isRecording ? "Stop recording" : "Start voice input"}
      </TooltipContent>
    </Tooltip>
  );
}
